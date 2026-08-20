import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { VoicePartialTranscription, VoiceTranscription } from '../../shared/contracts'

interface WorkerMessage {
  type: 'ready' | 'partial' | 'final' | 'error'
  sessionId?: string
  text?: string
  audioTimeMs?: number
  processingTimeMs?: number
  message?: string
}

interface ActiveSession {
  onPartial: (partial: VoicePartialTranscription) => void
  sampleCount: number
  acknowledgedSampleCount: number
}

interface PendingFinal {
  resolve: (transcription: VoiceTranscription) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class ParakeetStreamingTranscriber {
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null
  private activeSessions = new Map<string, ActiveSession>()
  private pendingFinals = new Map<string, PendingFinal>()

  constructor(private readonly resourcesPath: string) {}

  async start(
    sessionId: string,
    onPartial: (partial: VoicePartialTranscription) => void
  ): Promise<void> {
    await this.ensureReady()
    this.activeSessions.set(sessionId, { onPartial, sampleCount: 0, acknowledgedSampleCount: 0 })
    this.worker?.postMessage({ type: 'start', sessionId })
  }

  push(sessionId: string, samples: ArrayBuffer): void {
    const active = this.activeSessions.get(sessionId)
    if (!this.worker || !active || samples.byteLength === 0) return
    if (samples.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
      this.cancel(sessionId)
      throw new Error('O bloco incremental tem alinhamento inválido.')
    }
    const additionalSamples = samples.byteLength / Float32Array.BYTES_PER_ELEMENT
    try {
      assertStreamPushAllowed(active.sampleCount, active.acknowledgedSampleCount, additionalSamples)
    } catch (error) {
      this.cancel(sessionId)
      throw error
    }
    active.sampleCount += additionalSamples
    this.worker.postMessage({ type: 'audio', sessionId, samples }, [samples])
  }

  finish(sessionId: string): Promise<VoiceTranscription> {
    if (!this.worker || !this.activeSessions.has(sessionId)) {
      return Promise.reject(new Error('A sessão de transcrição incremental não está ativa.'))
    }
    if (this.pendingFinals.has(sessionId)) {
      return Promise.reject(new Error('A finalização desta sessão incremental já foi solicitada.'))
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.worker?.postMessage({ type: 'cancel', sessionId })
        this.pendingFinals.delete(sessionId)
        this.activeSessions.delete(sessionId)
        reject(new Error('A transcrição incremental excedeu o tempo esperado.'))
      }, 30_000)
      this.pendingFinals.set(sessionId, { resolve, reject, timeout })
      this.worker?.postMessage({ type: 'finish', sessionId })
    })
  }

  cancel(sessionId: string): void {
    this.worker?.postMessage({ type: 'cancel', sessionId })
    this.activeSessions.delete(sessionId)
    const pending = this.pendingFinals.get(sessionId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(abortError())
      this.pendingFinals.delete(sessionId)
    }
  }

  dispose(): void {
    this.failAll(abortError())
    void this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    const runtimePath = join(this.resourcesPath, 'runtime', 'whisper', 'bin', 'Release')
    const modelPath = join(
      this.resourcesPath,
      'runtime',
      'whisper',
      'models',
      'ggml-parakeet-tdt-0.6b-v3-q8_0.bin'
    )
    const worker = new Worker(join(__dirname, 'parakeet-streaming-worker.js'), {
      workerData: { runtimePath, modelPath, threads: 6 }
    })
    this.worker = worker
    this.readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('O Parakeet persistente demorou demais para iniciar.'))
        void worker.terminate()
      }, 30_000)
      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'ready') {
          clearTimeout(timeout)
          resolve()
          return
        }
        this.handleMessage(message)
      })
      worker.once('error', (error) => {
        const reason = error instanceof Error ? error : new Error('Falha no motor incremental.')
        clearTimeout(timeout)
        reject(reason)
        this.failAll(reason)
      })
      worker.once('exit', (code) => {
        clearTimeout(timeout)
        if (code !== 0) this.failAll(new Error(`O motor incremental encerrou com código ${code}.`))
        this.worker = null
        this.readyPromise = null
      })
    })
    return this.readyPromise
  }

  private handleMessage(message: WorkerMessage): void {
    const sessionId = message.sessionId
    if (!sessionId) return
    if (message.type === 'partial') {
      const active = this.activeSessions.get(sessionId)
      if (!active) return
      active.acknowledgedSampleCount = Math.min(
        active.sampleCount,
        Math.max(active.acknowledgedSampleCount, Math.floor((message.audioTimeMs ?? 0) * 16))
      )
      active.onPartial({
        sessionId,
        text: message.text ?? '',
        audioTimeMs: message.audioTimeMs ?? 0,
        processingTimeMs: message.processingTimeMs ?? 0
      })
      return
    }
    if (message.type === 'final') {
      const pending = this.pendingFinals.get(sessionId)
      if (!pending) return
      clearTimeout(pending.timeout)
      this.pendingFinals.delete(sessionId)
      this.activeSessions.delete(sessionId)
      pending.resolve({
        text: message.text ?? '',
        processingTimeMs: message.processingTimeMs ?? 0
      })
      return
    }
    if (message.type === 'error') {
      const error = new Error(message.message || 'Falha na transcrição incremental.')
      const pending = this.pendingFinals.get(sessionId)
      if (pending) {
        clearTimeout(pending.timeout)
        pending.reject(error)
        this.pendingFinals.delete(sessionId)
      }
      this.activeSessions.delete(sessionId)
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pendingFinals.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingFinals.clear()
    this.activeSessions.clear()
  }
}

export const MAX_STREAM_SAMPLES = 16_000 * 120
export const MAX_PENDING_STREAM_SAMPLES = 16_000 * 30

export function assertStreamPushAllowed(
  currentSamples: number,
  acknowledgedSamples: number,
  additionalSamples: number
): void {
  if (!Number.isInteger(additionalSamples) || additionalSamples <= 0) {
    throw new Error('O bloco incremental está vazio ou é inválido.')
  }
  if (currentSamples + additionalSamples > MAX_STREAM_SAMPLES) {
    throw new Error('A sessão incremental atingiu o limite de 120 segundos.')
  }
  const pendingSamples = Math.max(0, currentSamples - acknowledgedSamples)
  if (pendingSamples + additionalSamples > MAX_PENDING_STREAM_SAMPLES) {
    throw new Error('A transcrição incremental recebeu áudio mais rápido do que consegue processar.')
  }
}

function abortError(): Error {
  const error = new Error('A transcrição incremental foi interrompida.')
  error.name = 'AbortError'
  return error
}

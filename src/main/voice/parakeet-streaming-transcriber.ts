import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type {
  VoiceLanguage,
  VoicePartialTranscription,
  VoiceTranscription
} from '../../shared/contracts'
import { encodePcm16Wav } from './local-speech'
import { Lfm3Runtime } from './lfm3-runtime'

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
  language: VoiceLanguage
  sampleCount: number
  acknowledgedSampleCount: number
  lastPartialSampleCount: number
  chunks: Float32Array[]
  partialInFlight: boolean
  partialAbort: AbortController | null
  latestText: string
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

  constructor(
    private readonly resourcesPath: string,
    private readonly sharedRuntime?: Lfm3Runtime
  ) {}

  async start(
    sessionId: string,
    onPartial: (partial: VoicePartialTranscription) => void,
    language: VoiceLanguage = 'pt'
  ): Promise<void> {
    if (this.sharedRuntime) {
      await this.sharedRuntime.ensureServer()
      this.activeSessions.set(sessionId, {
        onPartial,
        language,
        sampleCount: 0,
        acknowledgedSampleCount: 0,
        lastPartialSampleCount: 0,
        chunks: [],
        partialInFlight: false,
        partialAbort: null,
        latestText: ''
      })
      return
    }

    await this.ensureReady()
    this.activeSessions.set(sessionId, {
      onPartial,
      language,
      sampleCount: 0,
      acknowledgedSampleCount: 0,
      lastPartialSampleCount: 0,
      chunks: [],
      partialInFlight: false,
      partialAbort: null,
      latestText: ''
    })
    this.worker?.postMessage({ type: 'start', sessionId, language })
  }

  push(sessionId: string, samples: ArrayBuffer): void {
    const active = this.activeSessions.get(sessionId)
    if (!active || samples.byteLength === 0) return
    if (!this.sharedRuntime && !this.worker) return
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

    if (this.sharedRuntime) {
      const copy = new Float32Array(additionalSamples)
      copy.set(new Float32Array(samples))
      active.chunks.push(copy)
      active.acknowledgedSampleCount = active.sampleCount
      this.maybeTriggerRuntimePartial(sessionId, active)
      return
    }

    this.worker?.postMessage({ type: 'audio', sessionId, samples }, [samples])
  }

  finish(sessionId: string): Promise<VoiceTranscription> {
    const active = this.activeSessions.get(sessionId)
    if ((!this.sharedRuntime && !this.worker) || !active) {
      return Promise.reject(new Error('A sessão de transcrição incremental não está ativa.'))
    }
    if (this.pendingFinals.has(sessionId)) {
      return Promise.reject(new Error('A finalização desta sessão incremental já foi solicitada.'))
    }

    if (this.sharedRuntime) {
      return this.finishWithSharedRuntime(sessionId, active)
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
    const active = this.activeSessions.get(sessionId)
    if (active?.partialAbort) {
      active.partialAbort.abort()
      active.partialAbort = null
    }
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
    for (const active of this.activeSessions.values()) {
      active.partialAbort?.abort()
    }
    this.failAll(abortError())
    void this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
  }

  private maybeTriggerRuntimePartial(sessionId: string, active: ActiveSession): void {
    if (!this.sharedRuntime || active.partialInFlight || this.pendingFinals.has(sessionId)) return
    if (active.sampleCount < 12_000 || active.sampleCount - active.lastPartialSampleCount < 16_000) {
      return
    }
    active.partialInFlight = true
    active.lastPartialSampleCount = active.sampleCount
    const snapshotSamples = active.sampleCount
    const controller = new AbortController()
    active.partialAbort = controller
    const merged = mergeFloatChunks(active.chunks, snapshotSamples, 16_000 * 20)
    const wav = encodePcm16Wav(merged, 16_000)

    void this.sharedRuntime
      .transcribeWav(wav, { language: active.language, signal: controller.signal })
      .then((result) => {
        const current = this.activeSessions.get(sessionId)
        if (!current || this.pendingFinals.has(sessionId) || controller.signal.aborted) return
        current.latestText = result.text
        current.onPartial({
          sessionId,
          text: result.text,
          audioTimeMs: Math.round((snapshotSamples / 16_000) * 1000),
          processingTimeMs: result.processingTimeMs
        })
      })
      .catch(() => {
        // Ignore non-fatal partial decoding errors or cancellations.
      })
      .finally(() => {
        const current = this.activeSessions.get(sessionId)
        if (current) {
          current.partialInFlight = false
          if (current.partialAbort === controller) {
            current.partialAbort = null
          }
        }
      })
  }

  private async finishWithSharedRuntime(
    sessionId: string,
    active: ActiveSession
  ): Promise<VoiceTranscription> {
    active.partialAbort?.abort()
    active.partialAbort = null
    this.activeSessions.delete(sessionId)

    if (active.sampleCount < 1_600) {
      throw new Error('A gravação ficou curta demais para transcrever.')
    }

    const merged = mergeFloatChunks(active.chunks, active.sampleCount)
    const wav = encodePcm16Wav(merged, 16_000)
    const startedAt = performance.now()
    try {
      return await this.sharedRuntime!.transcribeWav(wav, { language: active.language })
    } catch (error) {
      if (active.latestText.trim()) {
        return {
          text: active.latestText.trim(),
          processingTimeMs: Math.max(1, Math.round(performance.now() - startedAt))
        }
      }
      throw error
    }
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    const runtimePath = join(this.resourcesPath, 'runtime', 'lfm3', 'bin')
    const modelPath = join(
      this.resourcesPath,
      'runtime',
      'lfm3',
      'models',
      'LFM3-Audio-2B-Q4_K_M.gguf'
    )
    const worker = new Worker(join(__dirname, 'parakeet-streaming-worker.js'), {
      workerData: { resourcesPath: this.resourcesPath, runtimePath, modelPath, threads: 6 }
    })
    this.worker = worker
    this.readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('O motor LFM3 persistente demorou demais para iniciar.'))
        void worker.terminate()
      }, 45_000)
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

export { ParakeetStreamingTranscriber as Lfm3StreamingTranscriber }

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

function mergeFloatChunks(
  chunks: Float32Array[],
  totalSamples: number,
  maxTailSamples?: number
): Float32Array {
  const full = new Float32Array(totalSamples)
  let offset = 0
  for (const chunk of chunks) {
    full.set(chunk, offset)
    offset += chunk.length
  }
  if (maxTailSamples && full.length > maxTailSamples) {
    return full.subarray(full.length - maxTailSamples)
  }
  return full
}

function abortError(): Error {
  const error = new Error('A transcrição incremental foi interrompida.')
  error.name = 'AbortError'
  return error
}

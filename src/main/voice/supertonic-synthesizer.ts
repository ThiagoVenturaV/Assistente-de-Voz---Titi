import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { VoiceSynthesis } from '../../shared/contracts'
import { prepareTextForSpeech } from './local-speech'

type SynthesisBackend = VoiceSynthesis['backend']

interface WorkerMessage {
  type: 'ready' | 'result' | 'error'
  requestId?: string
  wavAudio?: ArrayBuffer
  processingTimeMs?: number
  audioDurationMs?: number
  backend?: SynthesisBackend
  message?: string
}

interface PendingSynthesis {
  resolve: (value: VoiceSynthesis) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  signal: AbortSignal
  abort: () => void
}

const MODEL_DIRECTORY = 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'

export class SupertonicSynthesizer {
  private readonly modelRoot: string
  private readonly directmlRoot: string
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null
  private pending = new Map<string, PendingSynthesis>()
  private directmlDisabled = false
  private generation = 0

  constructor(resourcesPath: string) {
    this.modelRoot = join(
      resourcesPath,
      'runtime',
      'supertonic',
      'model-extracted',
      MODEL_DIRECTORY
    )
    this.directmlRoot = join(resourcesPath, 'runtime', 'supertonic', 'directml')
  }

  prepare(): Promise<void> {
    return this.ensureReady()
  }

  async synthesize(
    requestId: string,
    content: string,
    rate: number,
    signal: AbortSignal
  ): Promise<VoiceSynthesis> {
    throwIfAborted(signal)
    const text = prepareTextForSpeech(content)
    if (!text) throw new Error('A resposta não contém texto para ser falado.')
    await this.ensureReady()
    throwIfAborted(signal)
    if (!this.worker) throw new Error('O worker da voz neural não está disponível.')

    return new Promise((resolve, reject) => {
      const abort = (): void => {
        const active = this.pending.get(requestId)
        if (!active) return
        this.pending.delete(requestId)
        clearTimeout(active.timeout)
        active.signal.removeEventListener('abort', active.abort)
        reject(abortError(signal))
      }
      const timeout = setTimeout(() => {
        const active = this.pending.get(requestId)
        if (!active) return
        this.pending.delete(requestId)
        active.signal.removeEventListener('abort', active.abort)
        reject(new Error('A voz neural local excedeu dois minutos para responder.'))
      }, 120_000)
      this.pending.set(requestId, { resolve, reject, timeout, signal, abort })
      signal.addEventListener('abort', abort, { once: true })
      this.worker?.postMessage({ type: 'synthesize', requestId, text, rate })
    })
  }

  dispose(): void {
    this.generation += 1
    this.failAll(abortError())
    void this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    const generation = this.generation
    const preferredBackend: SynthesisBackend = this.directmlDisabled ? 'cpu' : 'directml'
    let readiness: Promise<void>
    readiness = this.startWorker(preferredBackend, generation)
      .catch((error: unknown) => {
        if (generation !== this.generation) throw abortError()
        if (preferredBackend === 'cpu') throw error
        this.directmlDisabled = true
        return this.startWorker('cpu', generation)
      })
      .catch((error: unknown) => {
        if (generation === this.generation && this.readyPromise === readiness) {
          this.readyPromise = null
        }
        throw error
      })
    this.readyPromise = readiness
    return readiness
  }

  private startWorker(backend: SynthesisBackend, generation: number): Promise<void> {
    const worker = new Worker(join(__dirname, 'supertonic-worker.js'), {
      workerData: {
        modelRoot: this.modelRoot,
        directmlRoot: this.directmlRoot,
        backend
      }
    })
    this.worker = worker

    return new Promise((resolve, reject) => {
      let startupSettled = false
      const timeout = setTimeout(() => {
        if (startupSettled) return
        startupSettled = true
        if (backend === 'directml' && generation === this.generation) {
          this.directmlDisabled = true
        }
        if (this.worker === worker) this.worker = null
        reject(new Error(`A voz neural local em ${backend} demorou demais para iniciar.`))
        void worker.terminate()
      }, 30_000)
      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'ready') {
          if (startupSettled) return
          if (message.backend !== backend) {
            startupSettled = true
            clearTimeout(timeout)
            reject(new Error('O worker neural iniciou com um backend inesperado.'))
            void worker.terminate()
            return
          }
          startupSettled = true
          clearTimeout(timeout)
          resolve()
          return
        }
        this.handleMessage(message)
      })
      worker.once('error', (error) => {
        const reason = error instanceof Error ? error : new Error('O worker da voz neural falhou.')
        clearTimeout(timeout)
        if (backend === 'directml' && generation === this.generation) {
          this.directmlDisabled = true
        }
        if (!startupSettled) {
          startupSettled = true
          if (this.worker === worker) this.worker = null
          reject(reason)
          return
        }
        this.failAll(reason)
      })
      worker.once('exit', (code) => {
        clearTimeout(timeout)
        const wasActiveWorker = this.worker === worker
        if (wasActiveWorker) {
          this.worker = null
          if (startupSettled) this.readyPromise = null
        }
        if (backend === 'directml' && code !== 0 && generation === this.generation) {
          this.directmlDisabled = true
        }
        if (!startupSettled) {
          startupSettled = true
          reject(new Error(`O worker da voz neural encerrou antes de iniciar (${code}).`))
          return
        }
        if (generation === this.generation && wasActiveWorker) {
          this.failAll(new Error(`O worker da voz neural encerrou com código ${code}.`))
        }
      })
    })
  }

  private handleMessage(message: WorkerMessage): void {
    const requestId = message.requestId
    if (!requestId) return
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    clearTimeout(pending.timeout)
    pending.signal.removeEventListener('abort', pending.abort)

    if (message.type === 'error') {
      pending.reject(new Error(message.message || 'A voz neural local falhou.'))
      return
    }
    if (!(message.wavAudio instanceof ArrayBuffer)) {
      pending.reject(new Error('A voz neural local retornou um áudio inválido.'))
      return
    }
    if (message.backend !== 'directml' && message.backend !== 'cpu') {
      pending.reject(new Error('A voz neural local não informou o backend utilizado.'))
      return
    }
    pending.resolve({
      wavAudio: message.wavAudio,
      processingTimeMs: message.processingTimeMs ?? 0,
      audioDurationMs: message.audioDurationMs ?? 0,
      backend: message.backend
    })
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.signal.removeEventListener('abort', pending.abort)
      pending.reject(error)
    }
    this.pending.clear()
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError(signal)
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('A fala foi interrompida.')
  error.name = 'AbortError'
  return error
}

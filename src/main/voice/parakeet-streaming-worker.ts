import { dirname, resolve } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import type { VoiceLanguage } from '../../shared/contracts'
import { encodePcm16Wav } from './local-speech'
import { Lfm3Runtime } from './lfm3-runtime'

interface WorkerConfiguration {
  resourcesPath?: string
  runtimePath?: string
  modelPath?: string
  threads?: number
}

interface SessionState {
  chunks: Float32Array[]
  totalSamples: number
  language: VoiceLanguage
  latestText: string
}

type IncomingCommand =
  | { type: 'start'; sessionId: string; language?: VoiceLanguage }
  | { type: 'audio'; sessionId: string; samples: ArrayBuffer }
  | { type: 'finish'; sessionId: string }
  | { type: 'cancel'; sessionId: string }

const configuration = (workerData ?? {}) as WorkerConfiguration
const resourcesPath = resolveResourcesPath(configuration)
const runtime = new Lfm3Runtime(resourcesPath)
const sessions = new Map<string, SessionState>()
let queue: Promise<void> = Promise.resolve()

void runtime
  .prepare()
  .then(() => {
    parentPort?.postMessage({ type: 'ready' })
  })
  .catch((error: unknown) => {
    parentPort?.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Falha ao iniciar o motor LFM3.'
    })
    process.exitCode = 1
  })

parentPort?.on('message', (command: IncomingCommand) => {
  queue = queue
    .then(() => handleCommand(command))
    .catch((error: unknown) => {
      parentPort?.postMessage({
        type: 'error',
        sessionId: 'sessionId' in command ? command.sessionId : undefined,
        message: error instanceof Error ? error.message : 'Erro interno na transcrição LFM3.'
      })
    })
})

process.on('exit', () => {
  runtime.dispose()
})

async function handleCommand(command: IncomingCommand): Promise<void> {
  if (command.type === 'start') {
    sessions.set(command.sessionId, {
      chunks: [],
      totalSamples: 0,
      language: command.language ?? 'pt',
      latestText: ''
    })
    return
  }

  if (command.type === 'cancel') {
    sessions.delete(command.sessionId)
    return
  }

  const session = sessions.get(command.sessionId)
  if (!session) return

  if (command.type === 'audio') {
    const incoming = new Float32Array(command.samples)
    const copy = new Float32Array(incoming.length)
    copy.set(incoming)
    session.chunks.push(copy)
    session.totalSamples += copy.length

    const audioTimeMs = Math.round((session.totalSamples / 16_000) * 1000)
    const merged = mergeSamples(session.chunks, session.totalSamples, 16_000 * 15)
    const wav = encodePcm16Wav(merged, 16_000)
    try {
      const result = await runtime.transcribeWav(wav, { language: session.language })
      session.latestText = result.text
      parentPort?.postMessage({
        type: 'partial',
        sessionId: command.sessionId,
        text: result.text,
        audioTimeMs,
        processingTimeMs: result.processingTimeMs
      })
    } catch {
      parentPort?.postMessage({
        type: 'partial',
        sessionId: command.sessionId,
        text: session.latestText,
        audioTimeMs,
        processingTimeMs: 0
      })
    }
    return
  }

  if (command.type === 'finish') {
    sessions.delete(command.sessionId)
    const merged = mergeSamples(session.chunks, session.totalSamples)
    const wav = encodePcm16Wav(merged, 16_000)
    try {
      const result = await runtime.transcribeWav(wav, { language: session.language })
      parentPort?.postMessage({
        type: 'final',
        sessionId: command.sessionId,
        text: result.text,
        processingTimeMs: result.processingTimeMs
      })
    } catch (error) {
      if (session.latestText.trim()) {
        parentPort?.postMessage({
          type: 'final',
          sessionId: command.sessionId,
          text: session.latestText.trim(),
          processingTimeMs: 1
        })
        return
      }
      throw error
    }
  }
}

function mergeSamples(
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

function resolveResourcesPath(config: WorkerConfiguration): string {
  if (config.resourcesPath) return resolve(config.resourcesPath)
  if (config.runtimePath) {
    const normalized = resolve(config.runtimePath)
    const idx = normalized.toLowerCase().lastIndexOf('runtime')
    if (idx > 0) return dirname(normalized.slice(0, idx + 'runtime'.length))
  }
  return process.cwd()
}

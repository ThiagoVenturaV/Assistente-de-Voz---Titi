import { dirname, resolve } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import type { VoiceGender, VoiceLanguage, VoiceMode, VoiceSynthesis } from '../../shared/contracts'
import { Lfm3Runtime } from './lfm3-runtime'

interface WorkerConfiguration {
  resourcesPath?: string
  modelRoot?: string
  directmlRoot?: string
  backend?: VoiceSynthesis['backend']
}

interface SynthesizeMessage {
  type: 'synthesize'
  requestId: string
  text: string
  rate: number
  mode?: VoiceMode
  gender?: VoiceGender
  language?: VoiceLanguage
}

const configuration = (workerData ?? {}) as WorkerConfiguration
const resourcesPath = resolveResourcesPath(configuration)
const runtime = new Lfm3Runtime(resourcesPath)
const declaredBackend: VoiceSynthesis['backend'] = configuration.backend ?? 'lfm3-streaming'
let queue: Promise<void> = Promise.resolve()

void runtime
  .prepare()
  .then(() => {
    parentPort?.postMessage({ type: 'ready', backend: declaredBackend })
  })
  .catch((error: unknown) => {
    parentPort?.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível iniciar o motor LFM3.'
    })
    process.exitCode = 1
  })

parentPort?.on('message', (message: SynthesizeMessage) => {
  if (message.type !== 'synthesize') return
  queue = queue
    .then(async () => {
      const synthesis = await runtime.synthesize(message.requestId, message.text, message.rate, {
        mode: message.mode ?? 'streaming',
        gender: message.gender ?? 'female',
        language: message.language ?? 'pt',
        onChunk: (chunk) => {
          if (chunk.pcmAudio.byteLength > 0) {
            parentPort?.postMessage({ type: 'chunk', ...chunk }, [chunk.pcmAudio])
          } else {
            parentPort?.postMessage({ type: 'chunk', ...chunk })
          }
        }
      })
      parentPort?.postMessage(
        {
          type: 'result',
          requestId: message.requestId,
          wavAudio: synthesis.wavAudio,
          processingTimeMs: synthesis.processingTimeMs,
          audioDurationMs: synthesis.audioDurationMs,
          backend: configuration.backend ?? synthesis.backend
        },
        [synthesis.wavAudio]
      )
    })
    .catch((error: unknown) => {
      parentPort?.postMessage({
        type: 'error',
        requestId: message.requestId,
        message: error instanceof Error ? error.message : 'Falha na síntese LFM3.'
      })
    })
})

process.on('exit', () => {
  runtime.dispose()
})

function resolveResourcesPath(config: WorkerConfiguration): string {
  if (config.resourcesPath) return resolve(config.resourcesPath)
  for (const candidate of [config.modelRoot, config.directmlRoot]) {
    if (!candidate) continue
    const normalized = resolve(candidate)
    const idx = normalized.toLowerCase().lastIndexOf('runtime')
    if (idx > 0) return dirname(normalized.slice(0, idx + 'runtime'.length))
  }
  return process.cwd()
}

import { accessSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { encodePcm16Wav } from './local-speech'

type SynthesisBackend = 'directml' | 'cpu'

interface GeneratedAudio {
  samples: Float32Array
  sampleRate: number
}

interface OfflineTtsInstance {
  generate(request: {
    text: string
    enableExternalBuffer: boolean
    generationConfig: unknown
  }): GeneratedAudio
}

interface SherpaModule {
  OfflineTts: new (config: unknown) => OfflineTtsInstance
  GenerationConfig: new (config: Record<string, unknown>) => unknown
}

interface WorkerConfiguration {
  modelRoot: string
  directmlRoot: string
  backend: SynthesisBackend
}

interface SynthesisCommand {
  type: 'synthesize'
  requestId: string
  text: string
  rate: number
}

const configuration = workerData as WorkerConfiguration
const port = parentPort
if (!port) throw new Error('Canal do worker de voz neural indisponível.')

const requiredFiles = [
  'duration_predictor.int8.onnx',
  'text_encoder.int8.onnx',
  'vector_estimator.int8.onnx',
  'vocoder.int8.onnx',
  'tts.json',
  'unicode_indexer.bin',
  'voice.bin'
]
for (const file of requiredFiles) accessSync(join(configuration.modelRoot, file))

const sherpa = loadSherpa(configuration)
const engine = new sherpa.OfflineTts({
  model: {
    supertonic: {
      durationPredictor: join(configuration.modelRoot, 'duration_predictor.int8.onnx'),
      textEncoder: join(configuration.modelRoot, 'text_encoder.int8.onnx'),
      vectorEstimator: join(configuration.modelRoot, 'vector_estimator.int8.onnx'),
      vocoder: join(configuration.modelRoot, 'vocoder.int8.onnx'),
      ttsJson: join(configuration.modelRoot, 'tts.json'),
      unicodeIndexer: join(configuration.modelRoot, 'unicode_indexer.bin'),
      voiceStyle: join(configuration.modelRoot, 'voice.bin')
    },
    debug: false,
    numThreads: 4,
    provider: configuration.backend
  },
  maxNumSentences: 2
})

port.on('message', (command: SynthesisCommand) => {
  if (command.type !== 'synthesize') return
  try {
    const startedAt = performance.now()
    const audio = engine.generate({
      text: command.text,
      enableExternalBuffer: false,
      generationConfig: new sherpa.GenerationConfig({
        sid: 5,
        speed: command.rate,
        numSteps: 5,
        extra: { lang: 'pt' }
      })
    })
    if (
      !(audio.samples instanceof Float32Array)
      || !Number.isInteger(audio.sampleRate)
      || audio.sampleRate < 8_000
      || audio.sampleRate > 192_000
      || audio.samples.length === 0
    ) {
      throw new Error('O motor neural retornou amostras de áudio inválidas.')
    }
    const wavAudio = encodePcm16Wav(audio.samples, audio.sampleRate)
    port.postMessage({
      type: 'result',
      requestId: command.requestId,
      wavAudio,
      processingTimeMs: Math.round(performance.now() - startedAt),
      audioDurationMs: Math.round(audio.samples.length / audio.sampleRate * 1000),
      backend: configuration.backend
    }, [wavAudio])
  } catch (error) {
    port.postMessage({
      type: 'error',
      requestId: command.requestId,
      message: error instanceof Error ? error.message : 'A voz neural local falhou.'
    })
  }
})

port.postMessage({ type: 'ready', backend: configuration.backend })

function loadSherpa(workerConfiguration: WorkerConfiguration): SherpaModule {
  if (workerConfiguration.backend === 'cpu') {
    return require('sherpa-onnx-node') as SherpaModule
  }

  const nativeRoot = join(
    workerConfiguration.directmlRoot,
    'node_modules',
    'sherpa-onnx-win-x64'
  )
  for (const file of [
    'DirectML.dll',
    'onnxruntime.dll',
    'sherpa-onnx-c-api.dll',
    'sherpa-onnx.node'
  ]) {
    accessSync(join(nativeRoot, file))
  }
  process.env.PATH = `${nativeRoot};${process.env.PATH ?? ''}`
  const directmlRequire = createRequire(join(workerConfiguration.directmlRoot, 'loader.cjs'))
  return directmlRequire('sherpa-onnx-node') as SherpaModule
}

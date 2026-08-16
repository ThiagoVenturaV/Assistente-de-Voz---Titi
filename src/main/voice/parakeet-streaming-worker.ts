import { parentPort, workerData } from 'node:worker_threads'
import koffi from 'koffi'

interface WorkerConfiguration {
  runtimePath: string
  modelPath: string
  threads: number
}

type WorkerCommand =
  | { type: 'start'; sessionId: string }
  | { type: 'audio'; sessionId: string; samples: ArrayBuffer }
  | { type: 'finish'; sessionId: string }
  | { type: 'cancel'; sessionId: string }

interface ContextParamsValue {
  useGpu: boolean
  gpuDevice: number
}

interface FullParamsValue {
  strategy: number
  threads: number
  offsetMs: number
  durationMs: number
  noContext: boolean
  audioContext: number
  newSegmentCallback: unknown
  newSegmentUserData: unknown
  newTokenCallback: unknown
  newTokenUserData: unknown
  progressCallback: unknown
  progressUserData: unknown
  encoderBeginCallback: unknown
  encoderBeginUserData: unknown
  abortCallback: unknown
  abortUserData: unknown
}

interface TokenDataValue {
  id: number
}

const configuration = workerData as WorkerConfiguration
const port = parentPort
if (!port) throw new Error('Canal do worker de transcrição indisponível.')

const Context = koffi.opaque('ParakeetContext')
const State = koffi.opaque('ParakeetState')
const ContextPointer = koffi.pointer(Context)
const StatePointer = koffi.pointer(State)
const ContextParams = koffi.struct('ParakeetContextParams', {
  useGpu: 'bool',
  gpuDevice: 'int'
})
const TokenData = koffi.struct('ParakeetTokenData', {
  id: 'int32_t',
  durationIndex: 'int',
  durationValue: 'int',
  frameIndex: 'int',
  probability: 'float',
  logProbability: 'float',
  start: 'int64_t',
  end: 'int64_t',
  isWordStart: 'bool'
})
const TokenCallback = koffi.proto('ParakeetTokenCallback', 'void', [
  ContextPointer,
  StatePointer,
  koffi.pointer(TokenData),
  'void *'
])
const FullParams = koffi.struct('ParakeetFullParams', {
  strategy: 'int',
  threads: 'int',
  offsetMs: 'int',
  durationMs: 'int',
  noContext: 'bool',
  audioContext: 'int',
  newSegmentCallback: 'void *',
  newSegmentUserData: 'void *',
  newTokenCallback: koffi.pointer(TokenCallback),
  newTokenUserData: 'void *',
  progressCallback: 'void *',
  progressUserData: 'void *',
  encoderBeginCallback: 'void *',
  encoderBeginUserData: 'void *',
  abortCallback: 'void *',
  abortUserData: 'void *'
})

const ggml = koffi.load(`${configuration.runtimePath}/ggml.dll`)
const parakeet = koffi.load(`${configuration.runtimePath}/parakeet.dll`)
const loadBackends = ggml.func('ggml_backend_load_all_from_path', 'void', ['str'])
const defaultContextParams = parakeet.func(
  'parakeet_context_default_params_by_ref',
  koffi.pointer(ContextParams),
  []
)
const freeContextParams = parakeet.func('parakeet_free_context_params', 'void', [
  koffi.pointer(ContextParams)
])
const initContext = parakeet.func(
  'parakeet_init_from_file_with_params_no_state',
  ContextPointer,
  ['str', ContextParams]
)
const initState = parakeet.func('parakeet_init_state', StatePointer, [ContextPointer])
const freeState = parakeet.func('parakeet_free_state', 'void', [StatePointer])
const freeContext = parakeet.func('parakeet_free', 'void', [ContextPointer])
const defaultFullParams = parakeet.func(
  'parakeet_full_default_params_by_ref',
  koffi.pointer(FullParams),
  ['int']
)
const freeFullParams = parakeet.func('parakeet_free_params', 'void', [koffi.pointer(FullParams)])
const transcribeAccumulated = parakeet.func('parakeet_full_with_state', 'int', [
  ContextPointer,
  StatePointer,
  FullParams,
  'float *',
  'int'
])
const tokenToString = parakeet.func('parakeet_token_to_str', 'str', [ContextPointer, 'int32_t'])
const tokenToText = parakeet.func('parakeet_token_to_text', 'int', [
  'str',
  'bool',
  '_Out_ char *',
  'int'
])

loadBackends(configuration.runtimePath)
const contextParamsPointer = defaultContextParams()
const contextParams = koffi.decode(contextParamsPointer, ContextParams) as ContextParamsValue
freeContextParams(contextParamsPointer)
contextParams.useGpu = false
contextParams.gpuDevice = 0

const context = initContext(configuration.modelPath, contextParams)
if (!context) throw new Error('Não foi possível carregar o contexto persistente do Parakeet.')
let state = initState(context)
if (!state) throw new Error('Não foi possível criar o estado persistente do Parakeet.')

let activeSessionId: string | null = null
let chunks: Float32Array[] = []
let sampleCount = 0
let currentPass = ''
let lastText = ''
let firstToken = true
let accumulatedProcessingTimeMs = 0

const tokenCallback = (_context: unknown, _state: unknown, tokenPointer: unknown): void => {
  const token = koffi.decode(tokenPointer, TokenData) as TokenDataValue
  const piece = tokenToString(context, token.id) as string
  const output = Buffer.alloc(256)
  const length = tokenToText(piece, firstToken, output, output.length) as number
  if (length <= 0) return
  firstToken = false
  currentPass += output.subarray(0, Math.min(length, output.length - 1)).toString('utf8')
}

const fullParamsPointer = defaultFullParams(0)
const fullParams = koffi.decode(fullParamsPointer, FullParams) as FullParamsValue
freeFullParams(fullParamsPointer)
fullParams.threads = configuration.threads
fullParams.noContext = true
fullParams.newTokenCallback = tokenCallback

port.on('message', (command: WorkerCommand) => {
  try {
    if (command.type === 'start') {
      resetSession(command.sessionId)
      return
    }
    if (command.sessionId !== activeSessionId) return
    if (command.type === 'cancel') {
      activeSessionId = null
      chunks = []
      sampleCount = 0
      return
    }
    if (command.type === 'finish') {
      port.postMessage({
        type: 'final',
        sessionId: command.sessionId,
        text: lastText,
        processingTimeMs: accumulatedProcessingTimeMs
      })
      return
    }

    const samples = new Float32Array(command.samples)
    if (samples.length === 0) return
    chunks.push(samples)
    sampleCount += samples.length
    const accumulated = joinChunks(chunks, sampleCount)
    currentPass = ''
    firstToken = true
    const startedAt = performance.now()
    const result = transcribeAccumulated(context, state, fullParams, accumulated, accumulated.length) as number
    const processingTimeMs = Math.round(performance.now() - startedAt)
    accumulatedProcessingTimeMs += processingTimeMs
    if (result !== 0) throw new Error(`Parakeet falhou ao revisar o áudio acumulado (${result}).`)
    lastText = currentPass.trim()
    port.postMessage({
      type: 'partial',
      sessionId: command.sessionId,
      text: lastText,
      audioTimeMs: Math.round(sampleCount / 16),
      processingTimeMs
    })
  } catch (error) {
    port.postMessage({
      type: 'error',
      sessionId: command.sessionId,
      message: error instanceof Error ? error.message : 'Falha na transcrição incremental.'
    })
  }
})

port.postMessage({ type: 'ready' })

function resetSession(sessionId: string): void {
  freeState(state)
  state = initState(context)
  if (!state) throw new Error('Não foi possível reiniciar o estado persistente do Parakeet.')
  activeSessionId = sessionId
  chunks = []
  sampleCount = 0
  currentPass = ''
  lastText = ''
  firstToken = true
  accumulatedProcessingTimeMs = 0
}

function joinChunks(values: Float32Array[], length: number): Float32Array {
  const joined = new Float32Array(length)
  let offset = 0
  for (const value of values) {
    joined.set(value, offset)
    offset += value.length
  }
  return joined
}

process.once('exit', () => {
  freeState(state)
  freeContext(context)
})

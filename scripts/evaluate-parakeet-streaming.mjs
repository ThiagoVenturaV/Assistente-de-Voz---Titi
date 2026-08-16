#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import koffi from 'koffi'

const runtime = resolve('runtime/whisper/bin/Release')
const model = resolve('runtime/whisper/models/ggml-parakeet-tdt-0.6b-v3-q8_0.bin')
const audioPath = resolve(process.argv[2] || `${process.env.TEMP}/titi-voice-long-qa.wav`)
const chunkSeconds = Number(process.argv[3] || 1.5)
const maximumSeconds = Number(process.argv[4] || 15)

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

const ggml = koffi.load(resolve(runtime, 'ggml.dll'))
const parakeet = koffi.load(resolve(runtime, 'parakeet.dll'))
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

loadBackends(runtime)
const contextParamsPointer = defaultContextParams()
const contextParams = koffi.decode(contextParamsPointer, ContextParams)
freeContextParams(contextParamsPointer)
contextParams.useGpu = false
contextParams.gpuDevice = 0

const loadStarted = performance.now()
const context = initContext(model, contextParams)
if (!context) throw new Error('Não foi possível carregar o contexto Parakeet.')
const state = initState(context)
if (!state) throw new Error('Não foi possível criar o estado Parakeet.')

let firstToken = true
let transcript = ''
let currentPass = ''
let firstPartialMs = null
const tokenCallback = (_context, _state, tokenPointer) => {
  const token = koffi.decode(tokenPointer, TokenData)
  const piece = tokenToString(context, token.id)
  const output = Buffer.alloc(256)
  const length = tokenToText(piece, firstToken, output, output.length)
  if (length <= 0) return
  firstToken = false
  if (firstPartialMs === null) firstPartialMs = performance.now() - inferenceStarted
  currentPass += output.subarray(0, Math.min(length, output.length - 1)).toString('utf8')
}

const fullParamsPointer = defaultFullParams(0)
const fullParams = koffi.decode(fullParamsPointer, FullParams)
freeFullParams(fullParamsPointer)
fullParams.threads = 6
fullParams.noContext = true
fullParams.newTokenCallback = tokenCallback

const wav = await readFile(audioPath)
const allSamples = decodeMonoPcm16Wav(wav)
const samples = allSamples.subarray(0, Math.min(allSamples.length, Math.round(maximumSeconds * 16_000)))
const chunkSamples = Math.max(3200, Math.round(16_000 * chunkSeconds))
const inferenceStarted = performance.now()

try {
  for (let end = chunkSamples; end <= samples.length + chunkSamples; end += chunkSamples) {
    const accumulated = samples.subarray(0, Math.min(samples.length, end))
    currentPass = ''
    firstToken = true
    const passStarted = performance.now()
    const result = transcribeAccumulated(context, state, fullParams, accumulated, accumulated.length)
    if (result !== 0) throw new Error(`Parakeet falhou no bloco acumulado ${end / chunkSamples}: ${result}.`)
    transcript = currentPass
    process.stdout.write(`\r[${(accumulated.length / 16_000).toFixed(1)} s / ${Math.round(performance.now() - passStarted)} ms] ${transcript}`)
    if (accumulated.length === samples.length) break
  }
} finally {
  freeState(state)
  freeContext(context)
}

process.stdout.write('\n')
console.log(JSON.stringify({
  chunkSeconds,
  maximumSeconds,
  audioSeconds: samples.length / 16_000,
  modelLoadMs: Math.round(inferenceStarted - loadStarted),
  firstPartialMs: firstPartialMs === null ? null : Math.round(firstPartialMs),
  inferenceMs: Math.round(performance.now() - inferenceStarted),
  transcript
}, null, 2))

function decodeMonoPcm16Wav(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('O arquivo de teste não é WAV.')
  }
  let offset = 12
  let data = null
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'data') {
      data = wav.subarray(offset + 8, offset + 8 + size)
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (!data) throw new Error('Bloco PCM ausente no WAV.')
  const output = new Float32Array(data.length / 2)
  for (let index = 0; index < output.length; index += 1) {
    output[index] = data.readInt16LE(index * 2) / 32768
  }
  return output
}

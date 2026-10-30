#!/usr/bin/env node

const { resolve, join } = require('node:path')
const { Worker } = require('node:worker_threads')

const resourcesPath = resolve(process.argv[2] || 'release/win-unpacked/resources')
const workerPath = resolve(
  process.argv[3] || join(resourcesPath, 'app.asar', 'out', 'main', 'supertonic-worker.js')
)
const requestId = '5599faba-382a-4b73-849f-47ac40bcca36'
const repeatRequestId = '5599faba-382a-4b73-849f-47ac40bcca37'
const worker = new Worker(workerPath, {
  workerData: { resourcesPath, backend: 'lfm3-streaming' }
})
const timeout = setTimeout(() => finish(new Error('O worker empacotado do LFM3 excedeu 60 segundos.')), 60_000)
let settled = false
let coldGenerationMs = 0
let streamingChunks = 0

worker.on('message', (message) => {
  if (message.type === 'ready') {
    if (!['lfm3-streaming', 'lfm3-tts', 'lfm3'].includes(message.backend)) {
      finish(new Error(`O worker empacotado iniciou em ${message.backend || 'backend desconhecido'}.`))
      return
    }
    worker.postMessage({
      type: 'synthesize',
      requestId,
      text: 'Olá, Tiago. A voz neural local LFM3 do Titi está funcionando.',
      rate: 1.0,
      mode: 'tts',
      gender: 'female',
      language: 'pt'
    })
    return
  }
  if (message.type === 'chunk') {
    if (message.requestId === repeatRequestId) {
      streamingChunks += 1
    }
    return
  }
  if (message.type === 'error') {
    finish(new Error(message.message || 'O worker empacotado LFM3 não sintetizou a voz.'))
    return
  }
  if (message.type !== 'result' || ![requestId, repeatRequestId].includes(message.requestId)) return
  if (!(message.wavAudio instanceof ArrayBuffer) || message.wavAudio.byteLength < 44) {
    finish(new Error('O worker empacotado retornou um WAV inválido.'))
    return
  }
  if (!['lfm3-streaming', 'lfm3-tts', 'lfm3'].includes(message.backend)) {
    finish(new Error(`A síntese empacotada usou ${message.backend || 'backend desconhecido'}.`))
    return
  }
  const signature = Buffer.from(message.wavAudio, 0, 4).toString('ascii')
  if (signature !== 'RIFF') {
    finish(new Error('O áudio empacotado não contém o cabeçalho RIFF.'))
    return
  }
  const wav = new DataView(message.wavAudio)
  const format = wav.getUint16(20, true)
  const channels = wav.getUint16(22, true)
  const sampleRate = wav.getUint32(24, true)
  const bitsPerSample = wav.getUint16(34, true)
  const declaredRiffBytes = wav.getUint32(4, true) + 8
  const declaredDataBytes = wav.getUint32(40, true)
  if (
    format !== 1
    || channels !== 1
    || sampleRate < 8_000
    || sampleRate > 192_000
    || bitsPerSample !== 16
    || declaredRiffBytes !== message.wavAudio.byteLength
    || declaredDataBytes !== message.wavAudio.byteLength - 44
  ) {
    finish(new Error('O worker empacotado retornou metadados WAV incompatíveis.'))
    return
  }
  if (message.requestId === requestId) {
    coldGenerationMs = message.processingTimeMs
    worker.postMessage({
      type: 'synthesize',
      requestId: repeatRequestId,
      text: 'Hello, Tiago. Streaming male voice synthesis is active.',
      rate: 1.0,
      mode: 'streaming',
      gender: 'male',
      language: 'en'
    })
    return
  }
  if (streamingChunks < 1) {
    finish(new Error('O modo streaming do LFM3 não emitiu blocos incrementais de áudio.'))
    return
  }
  console.log(JSON.stringify({
    backend: message.backend,
    streamingChunks,
    audioSeconds: Number((message.audioDurationMs / 1000).toFixed(2)),
    coldGenerationSeconds: Number((coldGenerationMs / 1000).toFixed(2)),
    warmGenerationSeconds: Number((message.processingTimeMs / 1000).toFixed(2)),
    wavBytes: message.wavAudio.byteLength,
    format,
    channels,
    sampleRate,
    bitsPerSample,
    declaredRiffBytes,
    declaredDataBytes
  }))
  finish()
})
worker.once('error', (error) => finish(error))
worker.once('exit', (code) => {
  if (!settled && code !== 0) finish(new Error(`O worker empacotado encerrou com código ${code}.`))
})

function finish(error) {
  if (settled) return
  settled = true
  clearTimeout(timeout)
  void worker.terminate()
  if (error) {
    console.error(error)
    process.exitCode = 1
  }
}

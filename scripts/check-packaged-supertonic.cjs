#!/usr/bin/env node

const { resolve, join } = require('node:path')
const { Worker } = require('node:worker_threads')

const resourcesPath = resolve(process.argv[2] || 'release/win-unpacked/resources')
const workerPath = resolve(
  process.argv[3] || join(resourcesPath, 'app.asar', 'out', 'main', 'supertonic-worker.js')
)
const modelRoot = join(
  resourcesPath,
  'runtime',
  'supertonic',
  'model-extracted',
  'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
)
const directmlRoot = join(resourcesPath, 'runtime', 'supertonic', 'directml')
const requestId = '5599faba-382a-4b73-849f-47ac40bcca36'
const repeatRequestId = '5599faba-382a-4b73-849f-47ac40bcca37'
const worker = new Worker(workerPath, {
  workerData: { modelRoot, directmlRoot, backend: 'directml' }
})
const timeout = setTimeout(() => finish(new Error('O worker empacotado do Supertonic excedeu 30 segundos.')), 30_000)
let settled = false
let coldGenerationMs = 0

worker.on('message', (message) => {
  if (message.type === 'ready') {
    if (message.backend !== 'directml') {
      finish(new Error(`O worker empacotado iniciou em ${message.backend || 'backend desconhecido'}.`))
      return
    }
    worker.postMessage({
      type: 'synthesize',
      requestId,
      text: 'Olá, Tiago. A voz neural local do Titi está funcionando.',
      rate: 1.02
    })
    return
  }
  if (message.type === 'error') {
    finish(new Error(message.message || 'O worker empacotado não sintetizou a voz.'))
    return
  }
  if (message.type !== 'result' || ![requestId, repeatRequestId].includes(message.requestId)) return
  if (!(message.wavAudio instanceof ArrayBuffer) || message.wavAudio.byteLength < 44) {
    finish(new Error('O worker empacotado retornou um WAV inválido.'))
    return
  }
  if (message.backend !== 'directml') {
    finish(new Error(`A síntese empacotada usou ${message.backend || 'backend desconhecido'}.`))
    return
  }
  const signature = Buffer.from(message.wavAudio, 0, 4).toString('ascii')
  if (signature !== 'RIFF') {
    finish(new Error('O áudio empacotado não contém o cabeçalho RIFF.'))
    return
  }
  if (message.requestId === requestId) {
    coldGenerationMs = message.processingTimeMs
    worker.postMessage({
      type: 'synthesize',
      requestId: repeatRequestId,
      text: 'Olá, Tiago. A voz neural local do Titi está funcionando.',
      rate: 1.02
    })
    return
  }
  if (message.processingTimeMs >= message.audioDurationMs) {
    finish(new Error('A síntese DirectML aquecida não ficou mais rápida que o áudio gerado.'))
    return
  }
  console.log(JSON.stringify({
    backend: message.backend,
    audioSeconds: Number((message.audioDurationMs / 1000).toFixed(2)),
    coldGenerationSeconds: Number((coldGenerationMs / 1000).toFixed(2)),
    warmGenerationSeconds: Number((message.processingTimeMs / 1000).toFixed(2)),
    wavBytes: message.wavAudio.byteLength
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

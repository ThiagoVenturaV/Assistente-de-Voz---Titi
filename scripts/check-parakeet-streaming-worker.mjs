#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'

const audioPath = resolve(process.argv[2] || `${process.env.TEMP}/titi-voice-long-qa.wav`)
const maximumSeconds = Number(process.argv[3] || 15)
const resourcesPath = process.argv[4] ? resolve(process.argv[4]) : null
const runtimePath = resourcesPath
  ? join(resourcesPath, 'runtime', 'lfm3', 'bin')
  : resolve('runtime/lfm3/bin')
const modelPath = resourcesPath
  ? join(resourcesPath, 'runtime', 'lfm3', 'models', 'LFM3-Audio-2B-Q4_K_M.gguf')
  : resolve('runtime/lfm3/models/LFM3-Audio-2B-Q4_K_M.gguf')
const workerPath = resourcesPath
  ? join(resourcesPath, 'app.asar', 'out', 'main', 'parakeet-streaming-worker.js')
  : resolve('out/main/parakeet-streaming-worker.js')
const ttsWorkerPath = resourcesPath
  ? join(resourcesPath, 'app.asar', 'out', 'main', 'supertonic-worker.js')
  : resolve('out/main/supertonic-worker.js')

if (!existsSync(audioPath)) {
  await generateSampleWav(audioPath, resourcesPath, ttsWorkerPath)
}

const worker = new Worker(workerPath, {
  workerData: { runtimePath, modelPath, threads: 6 }
})
const sessionId = '5599faba-382a-4b73-849f-47ac40bcca36'

try {
  await waitForMessage(worker, (message) => message.type === 'ready')
  worker.postMessage({ type: 'start', sessionId, language: 'pt' })

  const wav = await readFile(audioPath)
  const { samples: allSamples, sampleRate } = decodeMonoPcm16Wav(wav)
  const samples16k = sampleRate === 16_000
    ? allSamples
    : resampleTo16k(allSamples, sampleRate)
  const samples = samples16k.subarray(0, Math.min(samples16k.length, maximumSeconds * 16_000))
  const chunkSamples = 24_000
  const partials = []
  for (let offset = 0; offset < samples.length; offset += chunkSamples) {
    const source = samples.subarray(offset, Math.min(samples.length, offset + chunkSamples))
    const chunk = new Float32Array(source.length)
    chunk.set(source)
    worker.postMessage({ type: 'audio', sessionId, samples: chunk.buffer }, [chunk.buffer])
    const partial = await waitForMessage(
      worker,
      (message) => message.type === 'partial' && message.sessionId === sessionId,
      60_000
    )
    partials.push(partial)
    console.log(`[${(partial.audioTimeMs / 1000).toFixed(1)} s / ${partial.processingTimeMs} ms] ${partial.text}`)
  }

  worker.postMessage({ type: 'finish', sessionId })
  const final = await waitForMessage(
    worker,
    (message) => message.type === 'final' && message.sessionId === sessionId,
    60_000
  )
  if (!final.text || partials.length < 2) throw new Error('O worker LFM3 não produziu revisões suficientes.')
  console.log(JSON.stringify({ partials: partials.length, final }, null, 2))
} finally {
  await worker.terminate()
}

async function generateSampleWav(targetPath, resourcesRoot, synthesizerWorkerPath) {
  const ttsWorker = new Worker(synthesizerWorkerPath, {
    workerData: {
      resourcesPath: resourcesRoot ?? resolve('.'),
      backend: 'lfm3'
    }
  })
  try {
    await waitForMessage(ttsWorker, (message) => message.type === 'ready', 60_000)
    const requestId = '5599faba-382a-4b73-849f-47ac40bcca39'
    ttsWorker.postMessage({
      type: 'synthesize',
      requestId,
      text: 'Olá, eu sou o assistente Titi falando em português com o novo modelo local LFM3 para testar a transcrição incremental.',
      rate: 1.0,
      mode: 'tts',
      gender: 'female',
      language: 'pt'
    })
    const result = await waitForMessage(
      ttsWorker,
      (message) => message.type === 'result' && message.requestId === requestId,
      60_000
    )
    await writeFile(targetPath, Buffer.from(result.wavAudio))
  } finally {
    await ttsWorker.terminate()
  }
}

function waitForMessage(targetWorker, predicate, timeoutMs = 45_000) {
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Tempo excedido aguardando o worker LFM3.'))
    }, timeoutMs)
    const message = (value) => {
      if (value.type === 'error') {
        cleanup()
        reject(new Error(value.message))
      } else if (predicate(value)) {
        cleanup()
        resolveMessage(value)
      }
    }
    const error = (reason) => {
      cleanup()
      reject(reason)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      targetWorker.off('message', message)
      targetWorker.off('error', error)
    }
    targetWorker.on('message', message)
    targetWorker.on('error', error)
  })
}

function decodeMonoPcm16Wav(wav) {
  const sampleRate = wav.readUInt32LE(24)
  let offset = 12
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'data') {
      const data = wav.subarray(offset + 8, offset + 8 + size)
      const samples = new Float32Array(data.length / 2)
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = data.readInt16LE(index * 2) / 32768
      }
      return { samples, sampleRate }
    }
    offset += 8 + size + (size % 2)
  }
  throw new Error('Bloco PCM ausente no WAV.')
}

function resampleTo16k(samples, sourceRate) {
  const ratio = sourceRate / 16_000
  const targetLength = Math.floor(samples.length / ratio)
  const output = new Float32Array(targetLength)
  for (let i = 0; i < targetLength; i += 1) {
    output[i] = samples[Math.min(samples.length - 1, Math.floor(i * ratio))]
  }
  return output
}

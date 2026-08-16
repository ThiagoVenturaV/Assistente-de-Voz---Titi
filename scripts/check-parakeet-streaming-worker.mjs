#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'

const audioPath = resolve(process.argv[2] || `${process.env.TEMP}/titi-voice-long-qa.wav`)
const maximumSeconds = Number(process.argv[3] || 15)
const resourcesPath = process.argv[4] ? resolve(process.argv[4]) : null
const runtimePath = resourcesPath
  ? join(resourcesPath, 'runtime', 'whisper', 'bin', 'Release')
  : resolve('runtime/whisper/bin/Release')
const modelPath = resourcesPath
  ? join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin')
  : resolve('runtime/whisper/models/ggml-parakeet-tdt-0.6b-v3-q8_0.bin')
const workerPath = resourcesPath
  ? join(resourcesPath, 'app.asar', 'out', 'main', 'parakeet-streaming-worker.js')
  : resolve('out/main/parakeet-streaming-worker.js')
const worker = new Worker(workerPath, {
  workerData: { runtimePath, modelPath, threads: 6 }
})
const sessionId = '5599faba-382a-4b73-849f-47ac40bcca36'

try {
  await waitForMessage((message) => message.type === 'ready')
  worker.postMessage({ type: 'start', sessionId })

  const wav = await readFile(audioPath)
  const allSamples = decodeMonoPcm16Wav(wav)
  const samples = allSamples.subarray(0, Math.min(allSamples.length, maximumSeconds * 16_000))
  const chunkSamples = 24_000
  const partials = []
  for (let offset = 0; offset < samples.length; offset += chunkSamples) {
    const source = samples.subarray(offset, Math.min(samples.length, offset + chunkSamples))
    const chunk = new Float32Array(source.length)
    chunk.set(source)
    worker.postMessage({ type: 'audio', sessionId, samples: chunk.buffer }, [chunk.buffer])
    const partial = await waitForMessage(
      (message) => message.type === 'partial' && message.sessionId === sessionId
    )
    partials.push(partial)
    console.log(`[${(partial.audioTimeMs / 1000).toFixed(1)} s / ${partial.processingTimeMs} ms] ${partial.text}`)
  }

  worker.postMessage({ type: 'finish', sessionId })
  const final = await waitForMessage(
    (message) => message.type === 'final' && message.sessionId === sessionId
  )
  if (!final.text || partials.length < 2) throw new Error('O worker não produziu revisões suficientes.')
  console.log(JSON.stringify({ partials: partials.length, final }, null, 2))
} finally {
  await worker.terminate()
}

function waitForMessage(predicate, timeoutMs = 30_000) {
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Tempo excedido aguardando o worker incremental.'))
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
      worker.off('message', message)
      worker.off('error', error)
    }
    worker.on('message', message)
    worker.on('error', error)
  })
}

function decodeMonoPcm16Wav(wav) {
  let offset = 12
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'data') {
      const data = wav.subarray(offset + 8, offset + 8 + size)
      const output = new Float32Array(data.length / 2)
      for (let index = 0; index < output.length; index += 1) {
        output[index] = data.readInt16LE(index * 2) / 32768
      }
      return output
    }
    offset += 8 + size + (size % 2)
  }
  throw new Error('Bloco PCM ausente no WAV.')
}

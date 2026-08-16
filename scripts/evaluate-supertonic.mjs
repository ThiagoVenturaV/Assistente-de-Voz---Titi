#!/usr/bin/env node

import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

const require = createRequire(import.meta.url)
const sherpa = require('sherpa-onnx-node')
const root = resolve('runtime/supertonic/model-extracted/sherpa-onnx-supertonic-3-tts-int8-2026-05-11')
const output = resolve(process.argv[2] || 'runtime/supertonic/amostra-node-f1.wav')
const text = process.argv[3]
  || 'Olá, Tiago. Agora o Titi está usando uma voz neural local e mais natural. O emoji continua no chat, mas não será lido em voz alta. A reunião começa às oito e quarenta e cinco.'

const tts = new sherpa.OfflineTts({
  model: {
    supertonic: {
      durationPredictor: resolve(root, 'duration_predictor.int8.onnx'),
      textEncoder: resolve(root, 'text_encoder.int8.onnx'),
      vectorEstimator: resolve(root, 'vector_estimator.int8.onnx'),
      vocoder: resolve(root, 'vocoder.int8.onnx'),
      ttsJson: resolve(root, 'tts.json'),
      unicodeIndexer: resolve(root, 'unicode_indexer.bin'),
      voiceStyle: resolve(root, 'voice.bin')
    },
    debug: false,
    numThreads: 4,
    provider: 'cpu'
  },
  maxNumSentences: 1
})

const started = performance.now()
const audio = tts.generate({
  text,
  generationConfig: new sherpa.GenerationConfig({
    sid: 5,
    speed: 1.02,
    numSteps: 5,
    extra: { lang: 'pt' }
  })
})
sherpa.writeWave(output, { samples: audio.samples, sampleRate: audio.sampleRate })

console.log(JSON.stringify({
  output,
  sampleRate: audio.sampleRate,
  audioSeconds: audio.samples.length / audio.sampleRate,
  generationSeconds: (performance.now() - started) / 1000
}, null, 2))

#!/usr/bin/env node

import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

const require = createRequire(import.meta.url)
const moduleRequire = process.env.TITI_SHERPA_MODULE_ROOT
  ? createRequire(resolve(process.env.TITI_SHERPA_MODULE_ROOT, 'benchmark.cjs'))
  : require
const sherpa = moduleRequire('sherpa-onnx-node')
const root = resolve('runtime/supertonic/model-extracted/sherpa-onnx-supertonic-3-tts-int8-2026-05-11')
const output = resolve(process.argv[2] || 'runtime/supertonic/amostra-node-f1.wav')
const provider = process.env.TITI_TTS_PROVIDER?.trim() || 'cpu'
const debug = process.env.TITI_TTS_DEBUG === '1'
const text = process.argv[3]
  || 'Olá, Tiago. Agora o Titi está usando uma voz neural local e mais natural. O emoji continua no chat, mas não será lido em voz alta. A reunião começa às oito e quarenta e cinco.'

const initializationStarted = performance.now()
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
    debug,
    numThreads: 4,
    provider
  },
  maxNumSentences: 1
})
const initializationSeconds = (performance.now() - initializationStarted) / 1000

const generationConfig = () => new sherpa.GenerationConfig({
  sid: 5,
  speed: 1.02,
  numSteps: 8,
  extra: { lang: 'pt' }
})
const warmupText = process.env.TITI_TTS_WARMUP_TEXT?.trim()
let warmupSeconds = 0
if (warmupText) {
  const warmupStarted = performance.now()
  tts.generate({ text: warmupText, generationConfig: generationConfig() })
  warmupSeconds = (performance.now() - warmupStarted) / 1000
}

const repetitions = Math.max(1, Math.min(10, Number(process.env.TITI_TTS_REPETITIONS || 1)))
const generationSecondsAll = []
let audio
for (let index = 0; index < repetitions; index += 1) {
  const started = performance.now()
  audio = tts.generate({
    text,
    generationConfig: generationConfig()
  })
  generationSecondsAll.push((performance.now() - started) / 1000)
}
sherpa.writeWave(output, { samples: audio.samples, sampleRate: audio.sampleRate })

console.log(JSON.stringify({
  output,
  provider,
  sampleRate: audio.sampleRate,
  audioSeconds: audio.samples.length / audio.sampleRate,
  initializationSeconds,
  warmupSeconds,
  generationSeconds: generationSecondsAll.at(-1),
  generationSecondsAll
}, null, 2))

const holdMs = Number(process.env.TITI_TTS_HOLD_MS || 0)
if (Number.isFinite(holdMs) && holdMs > 0) {
  await new Promise((resolveHold) => setTimeout(resolveHold, Math.min(holdMs, 60_000)))
}

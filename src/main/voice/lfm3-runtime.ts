import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import {
  VOICE_LANGUAGE_OPTIONS,
  type VoiceGender,
  type VoiceLanguage,
  type VoiceMode,
  type VoiceSynthesis,
  type VoiceSynthesisChunk,
  type VoiceTranscription
} from '../../shared/contracts'
import { encodePcm16Wav, prepareTextForSpeech } from './local-speech'

export const LFM3_SAMPLE_RATE = 24_000
export const LFM3_INPUT_SAMPLE_RATE = 16_000
export const LFM3_MODEL_FILE = 'LFM3-Audio-2B-Q4_K_M.gguf'
export const LFM3_MMPROJ_FILE = 'mmproj-LFM3-Audio-2B-Q8_0.gguf'

const LANGUAGE_ENGLISH_NAMES = new Map<VoiceLanguage, string>(
  VOICE_LANGUAGE_OPTIONS.map((option) => [option.code, option.englishName])
)

export function buildLfm3AsrSystemPrompt(language: VoiceLanguage = 'pt'): string {
  const englishName = LANGUAGE_ENGLISH_NAMES.get(language) ?? 'Portuguese'
  return `Perform ASR in ${englishName}.`
}

export function lfm3ServerArguments(
  modelPath: string,
  mmprojPath: string,
  port: number,
  threads = Math.max(2, Math.min(8, Math.floor(availableParallelism() * 0.75)))
): string[] {
  return [
    '-m',
    modelPath,
    '--mmproj',
    mmprojPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-c',
    '4096',
    '-t',
    String(threads)
  ]
}

export function lfm3AsrArguments(
  modelPath: string,
  mmprojPath: string,
  inputPath: string,
  language: VoiceLanguage = 'pt'
): string[] {
  return [
    '-m',
    modelPath,
    '--mmproj',
    mmprojPath,
    '--audio',
    inputPath,
    '-sys',
    buildLfm3AsrSystemPrompt(language),
    '-p',
    '<__media__>',
    '--temp',
    '0',
    '-n',
    '256',
    '--no-gpu'
  ]
}

export function lfm3TtsArguments(
  modelPath: string,
  mmprojPath: string,
  outputPath: string,
  text: string,
  language: VoiceLanguage = 'pt',
  gender: VoiceGender = 'female'
): string[] {
  return [
    '-m',
    modelPath,
    '-mm',
    mmprojPath,
    '-p',
    text,
    '--tts-lang',
    language,
    '--tts-voice',
    gender,
    '-o',
    outputPath
  ]
}

export function sanitizeTranscription(raw: string): string {
  const cleaned = raw
    .replace(/<\|[^|>]+\|>/g, ' ')
    .replace(/\[(?:música|musica|música de fundo|aplausos|risos|ruído|ruido|silêncio|silencio|inaudível|inaudivel)[^\]]*\]/giu, ' ')
    .replace(/\((?:música|musica|ruído|ruido|silêncio|silencio|aplausos|risos)[^)]*\)/giu, ' ')
    .replace(/[♪♫]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    throw new Error('Não identifiquei voz humana clara na gravação.')
  }
  return cleaned
}

export function assertValidWavBuffer(audioBuffer: ArrayBuffer): void {
  if (audioBuffer.byteLength < 44) {
    throw new Error('A gravação ficou curta demais para transcrever.')
  }
  const header = Buffer.from(audioBuffer, 0, 12)
  const riff = header.toString('ascii', 0, 4)
  const wave = header.toString('ascii', 8, 12)
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Áudio inválido: esperado formato WAV.')
  }
}

export interface Lfm3SynthesizeOptions {
  mode?: VoiceMode
  gender?: VoiceGender
  language?: VoiceLanguage
  signal?: AbortSignal
  onChunk?: (chunk: VoiceSynthesisChunk) => void
}

export interface Lfm3TranscribeOptions {
  language?: VoiceLanguage
  signal?: AbortSignal
}

export class Lfm3Runtime {
  readonly binDir: string
  readonly modelsDir: string
  readonly serverExecutable: string
  readonly ttsExecutable: string
  readonly mtmdExecutable: string
  readonly modelPath: string
  readonly mmprojPath: string

  private process: ChildProcess | null = null
  private port: number | null = null
  private startupPromise: Promise<string> | null = null
  private disposed = false
  private requestLock: Promise<void> = Promise.resolve()

  constructor(resourcesPath: string) {
    this.binDir = join(resourcesPath, 'runtime', 'lfm3', 'bin')
    this.modelsDir = join(resourcesPath, 'runtime', 'lfm3', 'models')
    this.serverExecutable = join(this.binDir, 'llama-server.exe')
    this.ttsExecutable = join(this.binDir, 'llama-tts.exe')
    this.mtmdExecutable = join(this.binDir, 'llama-mtmd-cli.exe')
    this.modelPath = join(this.modelsDir, LFM3_MODEL_FILE)
    this.mmprojPath = join(this.modelsDir, LFM3_MMPROJ_FILE)
  }

  async prepare(): Promise<void> {
    this.disposed = false
    await this.ensureServer()
  }

  async ensureServer(signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal)
    if (this.disposed) {
      this.disposed = false
    }
    if (this.process && this.port !== null && this.process.exitCode === null) {
      return `http://127.0.0.1:${this.port}`
    }
    if (this.startupPromise) {
      return waitForPromiseWithSignal(this.startupPromise, signal)
    }

    const startup = this.spawnServer()
    this.startupPromise = startup
    try {
      return await waitForPromiseWithSignal(startup, signal)
    } finally {
      if (this.startupPromise === startup) {
        this.startupPromise = null
      }
    }
  }

  async getWebSocketUrl(signal?: AbortSignal): Promise<string> {
    const httpUrl = await this.ensureServer(signal)
    return httpUrl.replace(/^http:/, 'ws:') + '/v1/realtime'
  }

  async transcribeWav(
    audioBuffer: ArrayBuffer,
    options: Lfm3TranscribeOptions = {}
  ): Promise<VoiceTranscription> {
    throwIfAborted(options.signal)
    assertValidWavBuffer(audioBuffer)

    return this.runExclusive(async () => {
      throwIfAborted(options.signal)
      const startedAt = performance.now()
      const baseUrl = await this.ensureServer(options.signal)
      const language = options.language ?? 'pt'
      const wavBase64 = Buffer.from(audioBuffer).toString('base64')

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: buildLfm3AsrSystemPrompt(language) },
            {
              role: 'user',
              content: [
                {
                  type: 'input_audio',
                  input_audio: { data: wavBase64, format: 'wav' }
                }
              ]
            }
          ],
          temperature: 0,
          max_tokens: 512
        }),
        signal: options.signal
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Falha na transcrição LFM3 (${response.status}): ${detail || response.statusText}`)
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const rawText = payload.choices?.[0]?.message?.content ?? ''
      const text = sanitizeTranscription(rawText)
      return {
        text,
        processingTimeMs: Math.max(1, Math.round(performance.now() - startedAt))
      }
    }, options.signal)
  }

  async synthesize(
    requestId: string,
    text: string,
    rate = 1,
    options: Lfm3SynthesizeOptions = {}
  ): Promise<VoiceSynthesis> {
    throwIfAborted(options.signal)
    const language = options.language ?? 'pt'
    const gender = options.gender ?? 'female'
    const mode = options.mode ?? 'streaming'
    const spokenText = prepareTextForSpeech(text, language)
    if (!spokenText) {
      throw new Error('Não há conteúdo falável para sintetizar.')
    }

    return this.runExclusive(async () => {
      throwIfAborted(options.signal)
      const startedAt = performance.now()
      const baseUrl = await this.ensureServer(options.signal)
      const isStreaming = mode === 'streaming'

      const response = await fetch(`${baseUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: spokenText,
          lang: language,
          voice: gender,
          stream: isStreaming,
          response_format: 'pcm'
        }),
        signal: options.signal
      })

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Falha na síntese de voz LFM3 (${response.status}): ${detail || response.statusText}`)
      }

      const floatChunks: Float32Array[] = []
      let totalSamples = 0
      let remainder = Buffer.alloc(0)

      const reader = response.body.getReader()
      try {
        while (true) {
          throwIfAborted(options.signal)
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue

          const combined = remainder.length > 0
            ? Buffer.concat([remainder, Buffer.from(value.buffer, value.byteOffset, value.byteLength)])
            : Buffer.from(value.buffer, value.byteOffset, value.byteLength)

          const alignedBytes = combined.length - (combined.length % 4)
          remainder = combined.subarray(alignedBytes)
          if (alignedBytes === 0) continue

          const sampleCount = alignedBytes / 4
          const samples = new Float32Array(sampleCount)
          for (let i = 0; i < sampleCount; i += 1) {
            const sample = combined.readFloatLE(i * 4)
            samples[i] = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0
          }

          const adjustedSamples = applySpeechRateToPcm(samples, rate)
          floatChunks.push(adjustedSamples)
          totalSamples += adjustedSamples.length

          if (isStreaming && options.onChunk && adjustedSamples.length > 0) {
            const chunkBuffer = new ArrayBuffer(adjustedSamples.byteLength)
            new Float32Array(chunkBuffer).set(adjustedSamples)
            options.onChunk({
              requestId,
              pcmAudio: chunkBuffer,
              sampleRate: LFM3_SAMPLE_RATE,
              final: false
            })
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (isStreaming && options.onChunk) {
        options.onChunk({
          requestId,
          pcmAudio: new ArrayBuffer(0),
          sampleRate: LFM3_SAMPLE_RATE,
          final: true
        })
      }

      if (totalSamples === 0) {
        throw new Error('O modelo LFM3 não gerou amostras de áudio.')
      }

      const merged = new Float32Array(totalSamples)
      let offset = 0
      for (const chunk of floatChunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      const wavAudio = encodePcm16Wav(merged, LFM3_SAMPLE_RATE)
      const audioDurationMs = Math.max(1, Math.round((merged.length / LFM3_SAMPLE_RATE) * 1000))
      const processingTimeMs = Math.max(1, Math.round(performance.now() - startedAt))

      return {
        wavAudio,
        processingTimeMs,
        audioDurationMs,
        backend: isStreaming ? 'lfm3-streaming' : 'lfm3-tts'
      }
    }, options.signal)
  }

  dispose(): void {
    this.disposed = true
    this.startupPromise = null
    if (this.process) {
      try {
        this.process.kill()
      } catch {
        // Ignore kill race on exit.
      }
      this.process = null
    }
    this.port = null
  }

  private async runExclusive<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const previous = this.requestLock
    let release!: () => void
    this.requestLock = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      await waitForPromiseWithSignal(previous, signal)
      throwIfAborted(signal)
      return await task()
    } finally {
      release()
    }
  }

  private async spawnServer(): Promise<string> {
    const port = await allocateLoopbackPort()
    const args = lfm3ServerArguments(this.modelPath, this.mmprojPath, port)
    const child = spawn(this.serverExecutable, args, {
      cwd: this.binDir,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    })

    let stderrTail = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2_000)
    })

    this.process = child
    this.port = port

    const baseUrl = `http://127.0.0.1:${port}`
    const deadline = Date.now() + 45_000

    try {
      while (Date.now() < deadline) {
        if (this.disposed) {
          throw createAbortError()
        }
        if (child.exitCode !== null) {
          throw new Error(
            `O servidor local LFM3 encerrou durante a inicialização (código ${child.exitCode}). ${stderrTail.trim()}`
          )
        }
        try {
          const response = await fetch(`${baseUrl}/health`)
          if (response.ok) {
            return baseUrl
          }
        } catch {
          // Server is still loading model weights.
        }
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      throw new Error('Tempo esgotado ao iniciar o servidor local LFM3.')
    } catch (error) {
      if (this.process === child) {
        try {
          child.kill()
        } catch {
          // Ignore kill race.
        }
        this.process = null
        this.port = null
      }
      throw error
    }
  }
}

export function applySpeechRateToPcm(samples: Float32Array, rate: number): Float32Array {
  const clampedRate = Number.isFinite(rate) ? Math.max(0.7, Math.min(1.4, rate)) : 1
  if (Math.abs(clampedRate - 1) < 0.02 || samples.length < 256) {
    return samples
  }
  const outputLength = Math.max(1, Math.round(samples.length / clampedRate))
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * clampedRate
    const index0 = Math.min(samples.length - 1, Math.floor(sourceIndex))
    const index1 = Math.min(samples.length - 1, index0 + 1)
    const fraction = sourceIndex - index0
    output[i] = samples[index0] * (1 - fraction) + samples[index1] * fraction
  }
  return output
}

function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error || !port) reject(error ?? new Error('Não foi possível alocar porta local para o LFM3.'))
        else resolve(port)
      })
    })
  })
}

function waitForPromiseWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(createAbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export function createAbortError(): Error {
  return Object.assign(new Error('Operação de voz cancelada.'), { name: 'AbortError' })
}

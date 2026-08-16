import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { VoiceTranscription } from '../../shared/contracts'

export class WhisperTranscriber {
  private readonly executable: string
  private readonly model: string
  private readonly vadModel: string

  constructor(resourcesPath: string, tempPath: string) {
    this.executable = join(resourcesPath, 'runtime', 'whisper', 'bin', 'Release', 'whisper-cli.exe')
    this.model = join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-large-v3-turbo-q8_0.bin')
    this.vadModel = join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-silero-v6.2.0.bin')
    this.tempPath = tempPath
  }

  private readonly tempPath: string

  async transcribe(wavAudio: ArrayBuffer, signal?: AbortSignal): Promise<VoiceTranscription> {
    throwIfAborted(signal)
    const bytes = Buffer.from(wavAudio)
    validateAudio(bytes)
    await Promise.all([access(this.executable), access(this.model), access(this.vadModel)]).catch(() => {
      throw new Error('O motor local de voz ainda não foi preparado. Execute a preparação do whisper.cpp.')
    })

    const id = `titi-voice-${randomUUID()}`
    const inputPath = join(this.tempPath, `${id}.wav`)
    const outputBase = join(this.tempPath, id)
    const outputPath = `${outputBase}.txt`
    const startedAt = performance.now()

    try {
      await writeFile(inputPath, bytes)
      throwIfAborted(signal)
      await runWhisper(
        this.executable,
        whisperArguments(this.model, this.vadModel, inputPath, outputBase),
        signal
      )
      throwIfAborted(signal)
      const text = sanitizeTranscription(await readFile(outputPath, 'utf8'))
      return {
        text,
        processingTimeMs: Math.round(performance.now() - startedAt)
      }
    } finally {
      await Promise.allSettled([unlink(inputPath), unlink(outputPath)])
    }
  }
}

export function whisperArguments(
  model: string,
  vadModel: string,
  inputPath: string,
  outputBase: string
): string[] {
  return [
    '--model', model,
    '--file', inputPath,
    '--language', 'pt',
    '--threads', '6',
    '--audio-ctx', '768',
    '--beam-size', '8',
    '--no-gpu',
    '--no-timestamps',
    '--suppress-nst',
    '--vad',
    '--vad-model', vadModel,
    '--vad-threshold', '0.50',
    '--vad-min-speech-duration-ms', '250',
    '--vad-min-silence-duration-ms', '200',
    '--vad-speech-pad-ms', '100',
    '--output-txt',
    '--output-file', outputBase,
    '--prompt', 'Conversa em português brasileiro sobre aplicativos e computador. Titi, Spotify, Brave, Ollama, Codex e Antigravity. Abrir, fechar, tocar, dar play, pausar, pesquisar, escrever e clicar.'
  ]
}

const NON_SPEECH_WORDS = [
  'aplausos?',
  'inaud[ií]vel',
  'm[uú]sica',
  'music',
  'noise',
  'ru[ií]do',
  'sil[eê]ncio',
  'silence',
  'som de fundo',
  'background sound'
].join('|')
const NON_SPEECH_ANNOTATION = new RegExp(
  `(?:\\[[^\\]\\r\\n]{0,60}(?:${NON_SPEECH_WORDS})[^\\]\\r\\n]{0,60}\\]|\\([^\\)\\r\\n]{0,60}(?:${NON_SPEECH_WORDS})[^\\)\\r\\n]{0,60}\\)|[♪♫]+)`,
  'giu'
)

export function sanitizeTranscription(value: string): string {
  const text = value
    .replace(/^\uFEFF/, '')
    .replace(NON_SPEECH_ANNOTATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || !/[\p{L}\p{N}]/u.test(text)) {
    throw new Error('Não identifiquei voz humana nessa gravação. Fale mais perto do microfone e tente novamente.')
  }
  return text
}

function validateAudio(bytes: Buffer): void {
  if (bytes.byteLength < 48) throw new Error('A gravação ficou curta demais.')
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('A gravação excedeu o limite de 32 MB.')
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('O áudio recebido não está no formato WAV esperado.')
  }
}

function runWhisper(executable: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    let settled = false
    let terminationError: Error | null = null
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve()
    }
    const abort = (): void => {
      terminationError = abortError(signal)
      if (!child.kill()) finish(terminationError)
    }
    const timeout = setTimeout(() => {
      terminationError = new Error('A transcrição local excedeu dois minutos.')
      if (!child.kill()) finish(terminationError)
    }, 120_000)
    signal?.addEventListener('abort', abort, { once: true })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4000)
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code) => {
      if (terminationError) {
        finish(terminationError)
        return
      }
      if (code === 0) finish()
      else finish(new Error(`Falha na transcrição local (${code ?? 'sem código'}). ${lastLine(stderr)}`))
    })
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('A transcrição foi interrompida.')
  error.name = 'AbortError'
  return error
}

function lastLine(value: string): string {
  return value.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? ''
}

import { describe, expect, it } from 'vitest'
import {
  sanitizeTranscription,
  WhisperTranscriber,
  whisperArguments
} from './whisper-transcriber'

describe('WhisperTranscriber input validation', () => {
  const transcriber = new WhisperTranscriber('C:\\missing-resources', 'C:\\Temp')

  it('rejects recordings that are too short before starting a process', async () => {
    await expect(transcriber.transcribe(new ArrayBuffer(12)))
      .rejects.toThrow('A gravação ficou curta demais.')
  })

  it('honra cancelamento antes de validar ou iniciar o processo local', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(transcriber.transcribe(new ArrayBuffer(12), controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects data that is not a RIFF/WAVE recording before starting a process', async () => {
    const invalidAudio = new TextEncoder().encode('not-a-wave-file'.padEnd(64, '.')).buffer

    await expect(transcriber.transcribe(invalidAudio))
      .rejects.toThrow('O áudio recebido não está no formato WAV esperado.')
  })
})

describe('WhisperTranscriber quality controls', () => {
  it('ativa VAD e supressão de tokens não falados', () => {
    const args = whisperArguments('model.bin', 'vad.bin', 'input.wav', 'output')

    expect(args).toEqual(expect.arrayContaining([
      '--suppress-nst',
      '--vad',
      '--vad-model', 'vad.bin',
      '--language', 'pt',
      '--audio-ctx', '768',
      '--beam-size', '8'
    ]))
  })

  it.each([
    '[música de fundo]',
    '[SILÊNCIO]',
    '(ruído)',
    '♪♫'
  ])('não transforma som sem fala em mensagem: %s', (value) => {
    expect(() => sanitizeTranscription(value)).toThrow('Não identifiquei voz humana')
  })

  it('remove uma anotação acústica sem apagar a fala reconhecida', () => {
    expect(sanitizeTranscription('[música] Abra o Spotify e dê play.'))
      .toBe('Abra o Spotify e dê play.')
  })

  it('preserva linguagem natural sem reescrever palavras', () => {
    expect(sanitizeTranscription('  Não, ele não está rodando.  '))
      .toBe('Não, ele não está rodando.')
  })
})

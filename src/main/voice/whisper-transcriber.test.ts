import { describe, expect, it } from 'vitest'
import { WhisperTranscriber } from './whisper-transcriber'

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

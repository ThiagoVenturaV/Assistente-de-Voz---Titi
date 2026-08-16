import { describe, expect, it } from 'vitest'
import {
  ParakeetTranscriber,
  parakeetArguments,
  sanitizeTranscription
} from './parakeet-transcriber'

describe('ParakeetTranscriber input validation', () => {
  const transcriber = new ParakeetTranscriber('C:\\missing-resources', 'C:\\Temp')

  it('recusa conteúdo que não seja WAV', async () => {
    const invalid = Buffer.alloc(80)
    await expect(transcriber.transcribe(invalid.buffer)).rejects.toThrow('formato WAV')
  })

  it('recusa gravação curta demais', async () => {
    await expect(transcriber.transcribe(new ArrayBuffer(12))).rejects.toThrow('curta demais')
  })

  it('respeita cancelamento antes de acessar o runtime', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(transcriber.transcribe(new ArrayBuffer(80), controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('ParakeetTranscriber quality controls', () => {
  it('usa o modelo Parakeet em CPU e produz texto sem saída auxiliar', () => {
    const args = parakeetArguments('model.bin', 'input.wav', 'output')

    expect(args).toContain('--no-gpu')
    expect(args).toContain('--no-prints')
    expect(args).toContain('--output-txt')
    expect(args).not.toContain('--audio-ctx')
    expect(args).not.toContain('--prompt')
  })

  it('remove marcadores acústicos antes de enviar texto ao chat', () => {
    expect(sanitizeTranscription('  [MÚSICA DE FUNDO] Abra o Brave.  ')).toBe('Abra o Brave.')
    expect(() => sanitizeTranscription('(ruído) ♪')).toThrow('Não identifiquei voz humana')
  })
})

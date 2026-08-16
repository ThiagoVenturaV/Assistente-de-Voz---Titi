import { describe, expect, it } from 'vitest'
import { encodePcm16Wav, prepareTextForSpeech } from './local-speech'

describe('SupertonicSynthesizer', () => {
  it('preserva o conteúdo, mas remove Markdown, links e emojis da fala', () => {
    expect(prepareTextForSpeech(
      '**Pronto**, Tiago! 🎵 Abra o [Spotify](https://open.spotify.com) e dê play. 👨‍💻\n- Depois me avise ✅'
    )).toBe('Pronto, Tiago! Abra o Spotify e dê play. Depois me avise')
  })

  it('remove bandeiras e keycaps sem apagar números comuns', () => {
    expect(prepareTextForSpeech('Brasil 🇧🇷: reunião às 8h. Escolha 1️⃣ ou 2.'))
      .toBe('Brasil: reunião às 8h. Escolha ou 2.')
  })

  it('codifica PCM em um WAV mono de 16 bits válido', () => {
    const wav = encodePcm16Wav(new Float32Array([-1, 0, 1]), 24_000)
    const view = new DataView(wav)
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe('WAVE')
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getInt16(44, true)).toBe(-32_768)
    expect(view.getInt16(48, true)).toBe(32_767)
  })
})

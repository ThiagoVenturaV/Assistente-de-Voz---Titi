import { describe, expect, it } from 'vitest'
import {
  encodePcm16Wav,
  normalizeBrazilianPortugueseSpeech,
  prepareTextForSpeech
} from './local-speech'
import {
  createSupertonicGenerationOptions,
  SUPERTONIC_QUALITY_STEPS
} from './supertonic-generation'

describe('SupertonicSynthesizer', () => {
  it('preserva o conteúdo, mas remove Markdown, links e emojis da fala', () => {
    expect(prepareTextForSpeech(
      '**Pronto**, Tiago! 🎵 Abra o [Spotify](https://open.spotify.com) e dê play. 👨‍💻\n- Depois me avise ✅'
    )).toBe('Pronto, Tiago! Abra o Ispótifai e dê play. Depois me avise')
  })

  it('remove bandeiras e keycaps sem apagar números comuns', () => {
    expect(prepareTextForSpeech('Brasil 🇧🇷: reunião às 8h. Escolha 1️⃣ ou 2.'))
      .toBe('Brasil: reunião às 8 horas. Escolha 1 ou 2.')
  })

  it('projeta termos técnicos e marcas para uma pronúncia brasileira previsível', () => {
    expect(prepareTextForSpeech(
      'A versão v0.2.0-beta.8 usa 2,5 GB, CPU, GPU e DirectML às 14:30; veja youtube.com ou suporte@example.com.'
    )).toBe(
      'A versão 0 ponto 2 ponto 0 beta 8 usa 2,5 gigabytes, cê pê u, gê pê u e Dáirect eme éle às 14 horas e 30 minutos; veja Iutúbi ponto com ou suporte arroba example ponto com.'
    )
  })

  it('verbaliza data, moeda e percentual sem alterar negações', () => {
    expect(prepareTextForSpeech(
      'Não feche o Spotify. Hoje é 20/08/2026, custa R$ 1.234,56 e está em 42%.'
    )).toBe(
      'Não feche o Ispótifai. Hoje é 20 de agosto de 2026, custa 1234 reais e 56 centavos e está em 42 por cento.'
    )
  })

  it('não lê blocos de código e preserva a ordem de listas numeradas', () => {
    expect(prepareTextForSpeech(
      'Passos:\n1. Rode o comando.\n2. Confira.\n```js\nconsole.log("segredo")\n```'
    )).toBe('Passos: 1: Rode o comando. 2: Confira. Há um bloco de código no chat.')
  })

  it('é idempotente depois da projeção pt-BR', () => {
    const projected = normalizeBrazilianPortugueseSpeech(
      'A CPU usa 8 GB e a reunião é às 8h05.'
    )
    expect(normalizeBrazilianPortugueseSpeech(projected)).toBe(projected)
  })

  it('usa português e o perfil neural de qualidade média', () => {
    expect(SUPERTONIC_QUALITY_STEPS).toBe(8)
    expect(createSupertonicGenerationOptions(0.95)).toEqual({
      sid: 5,
      speed: 0.95,
      numSteps: 8,
      extra: { lang: 'pt' }
    })
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

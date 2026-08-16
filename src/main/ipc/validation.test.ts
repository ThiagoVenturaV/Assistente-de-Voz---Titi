import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  validatedChatRequest,
  validatedConversationId,
  validatedPcmAudio,
  validatedRequestId,
  validatedSettingsPatch,
  validatedVoiceSynthesisRequest,
  validatedWavAudio
} from './validation'

describe('IPC validation', () => {
  it('accepts the complete settings shape used by the renderer', () => {
    expect(validatedSettingsPatch(DEFAULT_SETTINGS)).toMatchObject(DEFAULT_SETTINGS)
  })

  it.each([
    { ...DEFAULT_SETTINGS, extra: true },
    { ...DEFAULT_SETTINGS, provider: { ...DEFAULT_SETTINGS.provider, endpoint: 'file:///C:/secret' } },
    { ...DEFAULT_SETTINGS, provider: { ...DEFAULT_SETTINGS.provider, endpoint: 'https://remote.example.com' } },
    { ...DEFAULT_SETTINGS, voice: { ...DEFAULT_SETTINGS.voice, pushToTalkShortcut: 'Space' } },
    { ...DEFAULT_SETTINGS, voice: { ...DEFAULT_SETTINGS.voice, speechRate: 99 } },
    { ...DEFAULT_SETTINGS, voice: { ...DEFAULT_SETTINGS.voice, inputDeviceId: 'x'.repeat(513) } },
    { ...DEFAULT_SETTINGS, games: { standbyEnabled: true, executables: ['C:\\Jogos\\jogo.exe'] } },
    { ...DEFAULT_SETTINGS, games: { standbyEnabled: true, executables: ['jogo.exe', 42] } }
  ])('rejects malformed or externally routed settings', (value) => {
    expect(() => validatedSettingsPatch(value)).toThrow()
  })

  it('preserva um identificador válido de microfone', () => {
    expect(validatedSettingsPatch({
      voice: { ...DEFAULT_SETTINGS.voice, inputDeviceId: 'microfone-usb-123' }
    })).toMatchObject({ voice: { inputDeviceId: 'microfone-usb-123' } })
  })

  it('aceita somente booleano para o opt-in de controle do computador', () => {
    expect(validatedSettingsPatch({ computerControlEnabled: true }))
      .toEqual({ computerControlEnabled: true })
    expect(() => validatedSettingsPatch({ computerControlEnabled: 'sim' }))
      .toThrow('Valor inválido para computerControlEnabled')
  })

  it('aceita e remove duplicatas da lista explícita de jogos', () => {
    expect(validatedSettingsPatch({
      games: {
        standbyEnabled: true,
        executables: ['MeuJogo.exe', 'meujogo.EXE']
      }
    })).toEqual({
      games: { standbyEnabled: true, executables: ['meujogo.EXE'] }
    })
  })

  it('normalizes a valid chat request', () => {
    expect(validatedChatRequest({ content: '  olá  ' })).toEqual({ content: 'olá' })
  })

  it('preserva o identificador válido do pedido para cancelamento', () => {
    const requestId = '5599faba-382a-4b73-849f-47ac40bcca36'
    expect(validatedChatRequest({ requestId, content: 'olá' })).toEqual({ requestId, content: 'olá' })
    expect(() => validatedRequestId('../pedido')).toThrow('Identificador de pedido inválido')
  })

  it.each(['', '../conversation', 'not-a-uuid', 1, null])(
    'rejects invalid conversation id %s',
    (value) => expect(() => validatedConversationId(value)).toThrow()
  )

  it('enforces WAV transfer size before reaching the transcriber', () => {
    expect(() => validatedWavAudio(new ArrayBuffer(43))).toThrow()
    expect(validatedWavAudio(new ArrayBuffer(44)).byteLength).toBe(44)
  })

  it('aceita somente blocos Float32 limitados para a transcrição incremental', () => {
    expect(validatedPcmAudio(new Float32Array(16_000).buffer).byteLength).toBe(64_000)
    expect(() => validatedPcmAudio(new ArrayBuffer(3))).toThrow('Bloco PCM inválido')
    expect(() => validatedPcmAudio(new Float32Array(16_000 * 16).buffer)).toThrow('15 segundos')
  })

  it('valida texto, identificador e velocidade antes da síntese local', () => {
    const requestId = '5599faba-382a-4b73-849f-47ac40bcca36'
    expect(validatedVoiceSynthesisRequest(requestId, 'Olá, Tiago.', 1.05)).toEqual({
      requestId,
      text: 'Olá, Tiago.',
      rate: 1.05
    })
    expect(() => validatedVoiceSynthesisRequest('../voz', 'olá', 1)).toThrow()
    expect(() => validatedVoiceSynthesisRequest(requestId, '', 1)).toThrow('Texto de síntese')
    expect(() => validatedVoiceSynthesisRequest(requestId, 'olá', 2)).toThrow('Velocidade')
  })
})

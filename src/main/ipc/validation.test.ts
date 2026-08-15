import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  validatedChatRequest,
  validatedConversationId,
  validatedRequestId,
  validatedSettingsPatch,
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
    { ...DEFAULT_SETTINGS, voice: { ...DEFAULT_SETTINGS.voice, inputDeviceId: 'x'.repeat(513) } }
  ])('rejects malformed or externally routed settings', (value) => {
    expect(() => validatedSettingsPatch(value)).toThrow()
  })

  it('preserva um identificador válido de microfone', () => {
    expect(validatedSettingsPatch({
      voice: { ...DEFAULT_SETTINGS.voice, inputDeviceId: 'microfone-usb-123' }
    })).toMatchObject({ voice: { inputDeviceId: 'microfone-usb-123' } })
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
})

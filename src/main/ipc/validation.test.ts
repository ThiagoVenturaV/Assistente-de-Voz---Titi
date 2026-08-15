import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  validatedChatRequest,
  validatedConversationId,
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
    { ...DEFAULT_SETTINGS, voice: { ...DEFAULT_SETTINGS.voice, speechRate: 99 } }
  ])('rejects malformed or externally routed settings', (value) => {
    expect(() => validatedSettingsPatch(value)).toThrow()
  })

  it('normalizes a valid chat request', () => {
    expect(validatedChatRequest({ content: '  olá  ' })).toEqual({ content: 'olá' })
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

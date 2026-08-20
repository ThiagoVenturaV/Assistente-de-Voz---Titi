import { describe, expect, it } from 'vitest'
import {
  allowsAudioPermissionCheck,
  allowsAudioPermissionRequest
} from './media-permission'

describe('media permission policy', () => {
  it('allows audio only from the trusted main frame', () => {
    expect(allowsAudioPermissionCheck('media', true, 'audio', true)).toBe(true)
  })

  it.each([
    ['camera access', 'media', true, 'video', true],
    ['subframe access', 'media', false, 'audio', true],
    ['untrusted renderer access', 'media', true, 'audio', false],
    ['another permission', 'geolocation', true, 'audio', true]
  ])('denies %s during permission checks', (_label, permission, isMainFrame, mediaType, trusted) => {
    expect(allowsAudioPermissionCheck(permission, isMainFrame, mediaType, trusted)).toBe(false)
  })

  it('denies combined camera and microphone requests', () => {
    expect(allowsAudioPermissionRequest('media', ['audio', 'video'], true)).toBe(false)
  })

  it.each([
    ['trusted audio', 'media', ['audio'], true, true],
    ['camera', 'media', ['video'], true, false],
    ['untrusted audio', 'media', ['audio'], false, false],
    ['missing media types', 'media', undefined, true, false]
  ])('evaluates %s permission requests', (_label, permission, mediaTypes, trusted, expected) => {
    expect(allowsAudioPermissionRequest(permission, mediaTypes, trusted)).toBe(expected)
  })
})

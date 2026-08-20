import { describe, expect, it } from 'vitest'
import {
  isTrustedRendererFrameUrl,
  rendererUrlWithHash,
  resolveTrustedRendererLocation,
  safeExternalHttpsUrl
} from './renderer-origin'

describe('renderer origin policy', () => {
  it('ignores the development URL in packaged builds', () => {
    const location = resolveTrustedRendererLocation(true, 'https://attacker.example')
    expect(location.kind).toBe('packaged')
    expect(location.baseUrl).toBe('titi://app/index.html')
  })

  it.each([
    'https://attacker.example',
    'file:///C:/tmp/index.html',
    'http://user:pass@localhost:5173',
    'http://localhost:5173/?token=secret',
    'not-a-url'
  ])('rejects an unsafe development renderer URL: %s', (value) => {
    expect(() => resolveTrustedRendererLocation(false, value)).toThrow()
  })

  it('allows only the configured loopback document and its hash', () => {
    const location = resolveTrustedRendererLocation(false, 'http://127.0.0.1:5173/')
    expect(rendererUrlWithHash(location, 'app')).toBe('http://127.0.0.1:5173/#app')
    expect(isTrustedRendererFrameUrl('http://127.0.0.1:5173/#mascot', location)).toBe(true)
    expect(isTrustedRendererFrameUrl('http://localhost:5173/#app', location)).toBe(false)
    expect(isTrustedRendererFrameUrl('http://127.0.0.1:5173/other#app', location)).toBe(false)
    expect(isTrustedRendererFrameUrl('http://127.0.0.1:5173/?x=1#app', location)).toBe(false)
  })

  it('rejects another custom-protocol host even when the path matches', () => {
    const location = resolveTrustedRendererLocation(true, undefined)
    expect(isTrustedRendererFrameUrl('titi://attacker/index.html#app', location)).toBe(false)
  })

  it('normalizes safe external HTTPS links', () => {
    expect(safeExternalHttpsUrl('https://example.com/path?q=1')).toBe(
      'https://example.com/path?q=1'
    )
  })

  it.each([
    'http://example.com',
    'https://user:secret@example.com',
    'file:///C:/Windows/System32',
    'javascript:alert(1)',
    'not-a-url'
  ])('rejects an unsafe external link: %s', (value) => {
    expect(safeExternalHttpsUrl(value)).toBeNull()
  })
})

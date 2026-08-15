import { describe, expect, it } from 'vitest'
import { normalizeHttpUrl } from './desktop-toolkit'

describe('normalizeHttpUrl', () => {
  it('adds HTTPS to a hostname', () => {
    expect(normalizeHttpUrl('openai.com')).toBe('https://openai.com/')
  })

  it('keeps safe HTTP URLs', () => {
    expect(normalizeHttpUrl('http://localhost:3000/test')).toBe('http://localhost:3000/test')
  })

  it('rejects non-web protocols', () => {
    expect(() => normalizeHttpUrl('file:///C:/Windows')).toThrow('Somente endereços HTTP ou HTTPS')
  })
})

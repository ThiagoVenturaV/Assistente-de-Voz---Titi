import { describe, expect, it, vi } from 'vitest'
import { DesktopToolkit, normalizeHttpUrl } from './desktop-toolkit'

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

describe('DesktopToolkit application discovery', () => {
  it('passes a common application name to the safe catalog', async () => {
    const open = vi.fn(async () => ({
      ok: true,
      message: 'OpenAI ChatGPT aberto.'
    }))
    const toolkit = new DesktopToolkit({ open })

    const result = await toolkit.execute('open_application', {
      application: 'aplicativo do ChatGPT'
    })

    expect(open).toHaveBeenCalledWith('aplicativo do ChatGPT')
    expect(result).toEqual({ ok: true, message: 'OpenAI ChatGPT aberto.' })
  })
})

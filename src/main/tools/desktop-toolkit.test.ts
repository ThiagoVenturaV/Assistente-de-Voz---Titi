import { describe, expect, it, vi } from 'vitest'
import { DesktopToolkit, normalizeHttpUrl } from './desktop-toolkit'

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn(async () => undefined) }
}))

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

  it('confirma um atalho despachado quando a janela aparece em qualquer monitor', async () => {
    const open = vi.fn(async () => ({
      ok: false,
      status: 'dispatched' as const,
      message: 'Pedido enviado.'
    }))
    const controller = {
      observe: vi.fn(async () => ({
        application: 'brave',
        windowTitle: 'YouTube - Brave',
        processName: 'brave',
        controls: [{ name: 'Aba pessoal', controlType: 'TabItem', automationId: 'tab-1', enabled: true }]
      })),
      invoke: vi.fn(),
      capture: vi.fn(),
      click: vi.fn()
    }
    const toolkit = new DesktopToolkit(
      { open },
      controller,
      async () => true
    )

    const result = await toolkit.execute('open_application', { application: 'brave' })
    expect(result).toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { verification: 'window_observed_after_launch' }
    })
    expect(result.details?.observation).toEqual({
      application: 'brave',
      windowTitle: 'YouTube - Brave',
      processName: 'brave'
    })
  })
})

describe('DesktopToolkit web navigation', () => {
  it('transforma uma busca pelo nome de site conhecido em navegação direta', async () => {
    const toolkit = new DesktopToolkit()
    const result = await toolkit.execute('open_web', { query: 'YouTube' })

    expect(result).toMatchObject({
      status: 'dispatched',
      details: {
        url: 'https://www.youtube.com/',
        navigation: 'direct'
      }
    })
  })
})

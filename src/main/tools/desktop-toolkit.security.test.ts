import { describe, expect, it } from 'vitest'
import { DesktopToolkit, normalizeHttpUrl } from './desktop-toolkit'

describe('DesktopToolkit security boundaries', () => {
  it.each([
    'javascript:alert(1)',
    ' data:text/html,<script>alert(1)</script>',
    'FILE:///C:/Windows/System32/cmd.exe',
    'spotify:track:123'
  ])('rejects a non-web protocol: %s', (value) => {
    expect(() => normalizeHttpUrl(value)).toThrow('Somente endereços HTTP ou HTTPS')
  })

  it.each([
    'https://usuario:senha@example.com/conta',
    'http://token@example.com',
    'https://:segredo@example.com'
  ])('rejects embedded URL credentials: %s', (value) => {
    expect(() => normalizeHttpUrl(value)).toThrow('sem credenciais')
  })

  it('does not execute arbitrary tool names requested by the model', async () => {
    const toolkit = new DesktopToolkit()

    await expect(toolkit.execute('run_command', {
      command: 'powershell.exe'
    })).resolves.toEqual({
      ok: false,
      message: 'Ferramenta desconhecida: run_command.'
    })
  })

  it('rejects applications outside the explicit allowlist', async () => {
    const toolkit = new DesktopToolkit()

    await expect(toolkit.execute('open_application', {
      application: 'C:\\Windows\\System32\\cmd.exe'
    })).resolves.toEqual({
      ok: false,
      message: 'Valor inválido para application.'
    })
  })
})

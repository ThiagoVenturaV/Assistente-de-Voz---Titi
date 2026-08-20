import { describe, expect, it, vi } from 'vitest'
import type { ApplicationCatalog } from '../apps/windows-app-catalog'
import { DesktopToolkit, normalizeHttpUrl } from './desktop-toolkit'
import type { VisualComputerAgent } from './visual-computer-agent'
import type { ComputerController, ComputerObservation } from './windows-ui-automation'

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
      status: 'failed',
      message: 'Ferramenta desconhecida: run_command.'
    })
  })

  it('rejects applications outside the explicit allowlist', async () => {
    const toolkit = new DesktopToolkit()

    await expect(toolkit.execute('open_application', {
      application: 'C:\\Windows\\System32\\cmd.exe'
    })).resolves.toEqual({
      ok: false,
      status: 'failed',
      message: 'Valor inválido para application.'
    })
  })

  it('keeps generic UI control disabled until the user opts in', async () => {
    const controller = makeComputerController([])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => false)

    await expect(toolkit.execute('computer_observe', { application: 'Spotify' }))
      .resolves.toMatchObject({
        ok: false,
        status: 'failed',
        details: { computerControlEnabled: false }
      })
    expect(controller.observe).not.toHaveBeenCalled()
  })

  it('observes accessible controls without performing an action', async () => {
    const observation = spotifyObservation('Play')
    const controller = makeComputerController([observation])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('computer_observe', { application: 'Spotify' }))
      .resolves.toMatchObject({
        ok: true,
        status: 'confirmed',
        details: { processName: 'Spotify', controls: [{ name: 'Play' }] }
      })
    expect(controller.invoke).not.toHaveBeenCalled()
  })

  it('confirms Spotify play only after the accessible button changes to Pause', async () => {
    const controller = makeComputerController([
      spotifyObservation('Play'),
      spotifyObservation('Pause')
    ])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('spotify', { action: 'play' })).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: {
        method: 'windows_ui_automation',
        verification: 'verified_after_action'
      }
    })
    expect(controller.invoke).toHaveBeenCalledWith(
      'spotify',
      'Play',
      'Button',
      {
        window: {
          processId: 4242,
          windowHandle: '123456',
          windowTitle: 'Spotify Premium',
          processName: 'Spotify'
        },
        control: { automationId: 'play', runtimeId: '42.1' }
      },
      undefined
    )
  })

  it('does not toggle playback when Spotify already shows the requested state', async () => {
    const controller = makeComputerController([spotifyObservation('Pause')])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('spotify', { action: 'play' })).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { verification: 'already_in_requested_state' }
    })
    expect(controller.invoke).not.toHaveBeenCalled()
  })

  it('uses the local visual fallback when Spotify exposes no accessible controls', async () => {
    const controller = makeComputerController([{
      ...spotifyObservation('Play'),
      controls: []
    }])
    const visualAgent: VisualComputerAgent = {
      act: vi.fn(async () => ({
        ok: true,
        status: 'confirmed' as const,
        message: 'A reprodução foi verificada visualmente.',
        details: { method: 'local_visual_model' }
      })),
      observeDesktop: vi.fn(async () => ({
        ok: true,
        status: 'confirmed' as const,
        message: 'Monitores observados.'
      }))
    }
    const toolkit = new DesktopToolkit(
      makeAppCatalog(),
      controller,
      async () => true,
      visualAgent
    )

    await expect(toolkit.execute('spotify', { action: 'play' })).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { method: 'local_visual_model' }
    })
    expect(visualAgent.act).toHaveBeenCalledWith('play', undefined)
  })

  it('executa foco e minimizar janela quando controlado', async () => {
    const controller = makeComputerController([spotifyObservation('Play')])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('focus_window', { application: 'Spotify' })).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: {
        action: 'focus',
        effectState: 'confirmed'
      }
    })
    await expect(toolkit.execute('minimize_window', {
      application: 'Spotify',
      windowTitle: 'Spotify'
    })).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: {
        action: 'minimize',
        effectState: 'confirmed'
      }
    })
    expect(controller.focusWindow).toHaveBeenCalledWith('Spotify', undefined, undefined)
    expect(controller.minimizeWindow).toHaveBeenCalledWith('Spotify', 'Spotify', undefined)
  })

  it('reporta fechamento de janela como despachado', async () => {
    const controller = makeComputerController([spotifyObservation('Play')])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('close_window', {
      application: 'Spotify',
      windowTitle: 'Spotify Premium'
    })).resolves.toMatchObject({
      ok: false,
      status: 'dispatched',
      details: {
        action: 'close',
        effectState: 'dispatched_unverified'
      }
    })
    expect(controller.closeWindow).toHaveBeenCalledWith('Spotify', 'Spotify Premium', undefined)
  })

  it('opens Spotify before the unverified media-key fallback when interface control is off', async () => {
    const open = vi.fn(async () => ({
      ok: false,
      status: 'dispatched' as const,
      message: 'Spotify solicitado ao Windows.'
    }))
    const mediaKey = vi.fn(async () => undefined)
    const toolkit = new DesktopToolkit(
      { open },
      undefined,
      async () => false,
      undefined,
      mediaKey
    )

    await expect(toolkit.execute('spotify', { action: 'play' })).resolves.toMatchObject({
      ok: false,
      status: 'dispatched',
      message: expect.stringContaining('Spotify solicitado ao Windows.'),
      details: { fallback: 'windows_media_key' }
    })
    expect(open).toHaveBeenCalledWith('spotify')
    expect(mediaKey).toHaveBeenCalledWith('play_pause', undefined)
  })

  it('reports a generic accessible click as dispatched until its effect is understood', async () => {
    const observation = spotifyObservation('Play')
    const controller = makeComputerController([observation])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)
    const context = toolContext('chain-ui-action')

    await toolkit.execute('computer_observe', { application: 'Spotify' }, context)

    await expect(toolkit.execute('computer_action', {
      action: 'click',
      application: 'Spotify',
      target: 'Play',
      controlType: 'Button'
    }, context)).resolves.toMatchObject({
      ok: false,
      status: 'dispatched',
      details: { effectState: 'dispatched_unverified' }
    })
  })

  it('blocks a generic click that was not observed in the same interaction', async () => {
    const controller = makeComputerController([spotifyObservation('Play')])
    const toolkit = new DesktopToolkit(makeAppCatalog(), controller, async () => true)

    await expect(toolkit.execute('computer_action', {
      action: 'click',
      application: 'Spotify',
      target: 'Play',
      controlType: 'Button'
    }, toolContext('chain-without-observation'))).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      details: { observationRequired: true }
    })
    expect(controller.invoke).not.toHaveBeenCalled()
  })
})

function makeAppCatalog(): ApplicationCatalog {
  return {
    open: vi.fn(async () => ({
      ok: false,
      status: 'dispatched' as const,
      message: 'Aplicativo aberto.'
    }))
  }
}

function makeComputerController(observations: ComputerObservation[]): ComputerController & {
  observe: ReturnType<typeof vi.fn>
  invoke: ReturnType<typeof vi.fn>
} {
  let observationIndex = 0
  return {
    observe: vi.fn(async () => observations[Math.min(observationIndex++, observations.length - 1)]),
    invoke: vi.fn(async (application: string, target: string, controlType?: string) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: 'Spotify Premium',
      processName: 'Spotify',
      invoked: true as const,
      control: {
        name: target,
        controlType: controlType ?? 'Button',
        automationId: 'play',
        runtimeId: '42.1',
        enabled: true
      }
    })),
    capture: vi.fn(async (application: string) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: 'Spotify Premium',
      processName: 'Spotify',
      width: 1600,
      height: 900,
      imageBase64: '/9j/2Q=='
    })),
    click: vi.fn(async (application: string, x: number, y: number) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: 'Spotify Premium',
      processName: 'Spotify',
      clicked: true as const,
      x,
      y
    })),
    focusWindow: vi.fn(async (application: string, windowTitle?: string) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: windowTitle ?? 'Spotify Premium',
      processName: 'Spotify',
      action: 'focus' as const
    })),
    minimizeWindow: vi.fn(async (application: string, windowTitle?: string) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: windowTitle ?? 'Spotify Premium',
      processName: 'Spotify',
      action: 'minimize' as const
    })),
    closeWindow: vi.fn(async (application: string, windowTitle?: string) => ({
      application,
      processId: 4242,
      windowHandle: '123456',
      windowTitle: windowTitle ?? 'Spotify Premium',
      processName: 'Spotify',
      action: 'close' as const
    }))
  }
}

function spotifyObservation(controlName: 'Play' | 'Pause'): ComputerObservation {
  return {
    application: 'spotify',
    processId: 4242,
    windowHandle: '123456',
    windowTitle: 'Spotify Premium',
    processName: 'Spotify',
    controls: [{
      name: controlName,
      controlType: 'Button',
      automationId: controlName.toLocaleLowerCase(),
      runtimeId: '42.1',
      enabled: true
    }]
  }
}

function toolContext(chainId: string) {
  return {
    chainId,
    runId: `${chainId}-run`,
    requestId: `${chainId}-request`,
    round: 1,
    attempt: 1,
    timeoutMs: 10_000
  }
}

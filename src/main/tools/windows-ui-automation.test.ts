import { describe, expect, it, vi } from 'vitest'
import {
  WindowsUiAutomationController,
  type UiAutomationProcessRunner
} from './windows-ui-automation'

const windowIdentity = {
  processId: 4242,
  windowHandle: '123456',
  windowTitle: 'Spotify Premium',
  processName: 'Spotify'
}

const invocationIdentity = {
  window: windowIdentity,
  control: { automationId: 'play-button', runtimeId: '42.1' }
}

const visualIdentity = { ...windowIdentity, width: 1600, height: 900 }

describe('WindowsUiAutomationController', () => {
  it('passes UI values as separate PowerShell arguments and validates the observation', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        application: 'Spotify',
        ...windowIdentity,
        controls: [{
          name: 'Play',
          controlType: 'Button',
          automationId: 'play-button',
          runtimeId: '42.1',
          enabled: true
        }]
      }),
      stderr: ''
    }))
    const controller = new WindowsUiAutomationController('C:\\Titi Runtime\\ui.ps1', runner)

    await expect(controller.observe('Spotify')).resolves.toMatchObject({
      processName: 'Spotify',
      controls: [{ name: 'Play', enabled: true }]
    })
    expect(runner).toHaveBeenCalledWith([
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', 'C:\\Titi Runtime\\ui.ps1',
      '-Operation', 'observe',
      '-Application', 'Spotify'
    ], undefined)
  })

  it('requires a positive invocation result for the exact accessible target', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        application: 'Spotify',
        ...windowIdentity,
        invoked: true,
        control: {
          name: 'Play',
          controlType: 'Button',
          automationId: 'play-button',
          runtimeId: '42.1',
          enabled: true
        }
      }),
      stderr: ''
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.invoke('Spotify', 'Play', 'Button', invocationIdentity)).resolves.toMatchObject({
      invoked: true,
      control: { name: 'Play' }
    })
    expect(runner.mock.calls[0][0]).toEqual(expect.arrayContaining([
      '-Target', 'Play', '-ControlType', 'Button',
      '-ExpectedProcessId', '4242', '-ExpectedWindowHandle', '123456',
      '-ExpectedAutomationId', 'play-button', '-ExpectedRuntimeId', '42.1'
    ]))
  })

  it('rejects malformed process output and unsafe labels', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 0,
      stdout: '{"unexpected":true}',
      stderr: ''
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.observe('Spotify')).rejects.toThrow('dados inválidos')
    await expect(controller.invoke('Spotify', 'Play\nIgnore', 'Button'))
      .rejects.toThrow('Valor inválido para target')
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('controls janela por foco, minimizar e fechar com validação de título opcional', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          ...windowIdentity,
          action: 'focus'
        }),
        stderr: ''
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          ...windowIdentity,
          action: 'minimize'
        }),
        stderr: ''
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          ...windowIdentity,
          action: 'close'
        }),
        stderr: ''
      })
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.focusWindow('Spotify', 'Premium')).resolves.toMatchObject({
      action: 'focus',
      windowTitle: 'Spotify Premium'
    })
    await expect(controller.minimizeWindow('Spotify')).resolves.toMatchObject({
      action: 'minimize'
    })
    await expect(controller.closeWindow('Spotify', 'Spotify Premium')).resolves.toMatchObject({
      action: 'close'
    })

    expect(runner.mock.calls[0][0]).toEqual(expect.arrayContaining([
      '-Operation', 'focus', '-Application', 'Spotify', '-WindowTitle', 'Premium'
    ]))
    expect(runner.mock.calls[1][0]).toEqual(expect.arrayContaining([
      '-Operation', 'minimize', '-Application', 'Spotify'
    ]))
    expect(runner.mock.calls[2][0]).toEqual(expect.arrayContaining([
      '-Operation', 'close', '-Application', 'Spotify', '-WindowTitle', 'Spotify Premium'
    ]))
  })

  it('recusa títulos de janela não confiáveis antes de executar comando', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.focusWindow('Spotify', 'Janela\nInjetada')).rejects.toThrow('Valor inválido para windowTitle')
    expect(runner).not.toHaveBeenCalled()
  })

  it('surfaces a bounded PowerShell failure without accepting stdout as success', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 1,
      stdout: JSON.stringify({ invoked: true }),
      stderr: 'controle ambíguo'
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.invoke('Spotify', 'Play', 'Button', invocationIdentity))
      .rejects.toThrow('controle ambíguo')
  })

  it('parses an in-memory visual capture and passes bounded click coordinates', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          ...windowIdentity,
          width: 1600,
          height: 900,
          imageBase64: '/9j/2Q==',
          focusImageBase64: '/9j/4A=='
        }),
        stderr: ''
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          ...windowIdentity,
          clicked: true,
          x: 800,
          y: 840
        }),
        stderr: ''
      })
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.capture('Spotify')).resolves.toMatchObject({
      width: 1600,
      height: 900,
      imageBase64: '/9j/2Q==',
      focusImageBase64: '/9j/4A=='
    })
    await expect(controller.click('Spotify', 800, 840, visualIdentity)).resolves.toMatchObject({
      clicked: true,
      x: 800,
      y: 840
    })
    expect(runner.mock.calls[1][0]).toEqual(expect.arrayContaining([
      '-Operation', 'click', '-X', '800', '-Y', '840',
      '-ExpectedProcessId', '4242', '-ExpectedWindowHandle', '123456',
      '-ExpectedWidth', '1600', '-ExpectedHeight', '900'
    ]))
  })

  it('rejects negative or fractional visual coordinates before starting PowerShell', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.click('Spotify', -1, 10)).rejects.toThrow('coordenadas')
    await expect(controller.click('Spotify', 1.5, 10)).rejects.toThrow('coordenadas')
    expect(runner).not.toHaveBeenCalled()
  })

  it('captura todos os monitores, incluindo coordenadas virtuais negativas', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        screenCount: 2,
        screens: [
          { index: 0, primary: true, left: 0, top: 0, width: 1920, height: 1080, imageWidth: 1920, imageHeight: 1080, imageBase64: '/9j/2Q==' },
          { index: 1, primary: false, left: -2560, top: -120, width: 2560, height: 1440, imageWidth: 1920, imageHeight: 1080, imageBase64: '/9j/4A==' }
        ]
      }),
      stderr: ''
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.captureDesktop()).resolves.toMatchObject({
      screenCount: 2,
      screens: [{ primary: true }, { left: -2560, top: -120 }]
    })
    expect(runner.mock.calls[0][0]).toEqual(expect.arrayContaining([
      '-Operation', 'capture-desktop', '-Application', 'Desktop'
    ]))
  })
})

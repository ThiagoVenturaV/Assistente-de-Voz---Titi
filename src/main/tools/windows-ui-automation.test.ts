import { describe, expect, it, vi } from 'vitest'
import {
  WindowsUiAutomationController,
  type UiAutomationProcessRunner
} from './windows-ui-automation'

describe('WindowsUiAutomationController', () => {
  it('passes UI values as separate PowerShell arguments and validates the observation', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        application: 'Spotify',
        windowTitle: 'Spotify Premium',
        processName: 'Spotify',
        controls: [{
          name: 'Play',
          controlType: 'Button',
          automationId: 'play-button',
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
        windowTitle: 'Spotify',
        processName: 'Spotify',
        invoked: true,
        control: { name: 'Play', controlType: 'Button', automationId: 'play', enabled: true }
      }),
      stderr: ''
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.invoke('Spotify', 'Play', 'Button')).resolves.toMatchObject({
      invoked: true,
      control: { name: 'Play' }
    })
    expect(runner.mock.calls[0][0]).toEqual(expect.arrayContaining([
      '-Target', 'Play', '-ControlType', 'Button'
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

  it('surfaces a bounded PowerShell failure without accepting stdout as success', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>(async () => ({
      exitCode: 1,
      stdout: JSON.stringify({ invoked: true }),
      stderr: 'controle ambíguo'
    }))
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.invoke('Spotify', 'Play', 'Button'))
      .rejects.toThrow('controle ambíguo')
  })

  it('parses an in-memory visual capture and passes bounded click coordinates', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          application: 'Spotify',
          windowTitle: 'Spotify Premium',
          processName: 'Spotify',
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
          windowTitle: 'Spotify Premium',
          processName: 'Spotify',
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
    await expect(controller.click('Spotify', 800, 840)).resolves.toMatchObject({
      clicked: true,
      x: 800,
      y: 840
    })
    expect(runner.mock.calls[1][0]).toEqual(expect.arrayContaining([
      '-Operation', 'click', '-X', '800', '-Y', '840'
    ]))
  })

  it('rejects negative or fractional visual coordinates before starting PowerShell', async () => {
    const runner = vi.fn<UiAutomationProcessRunner>()
    const controller = new WindowsUiAutomationController('ui.ps1', runner)

    await expect(controller.click('Spotify', -1, 10)).rejects.toThrow('coordenadas')
    await expect(controller.click('Spotify', 1.5, 10)).rejects.toThrow('coordenadas')
    expect(runner).not.toHaveBeenCalled()
  })
})

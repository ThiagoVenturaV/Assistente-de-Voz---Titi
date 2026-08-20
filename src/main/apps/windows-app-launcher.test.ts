import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { spawnMock, openPathMock, openExternalMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  openPathMock: vi.fn(async () => ''),
  openExternalMock: vi.fn(async () => undefined)
}))

vi.mock('node:child_process', () => ({ spawn: spawnMock }))
vi.mock('electron', () => ({
  shell: {
    openPath: openPathMock,
    openExternal: openExternalMock
  }
}))

import { WindowsAppLauncher } from './windows-app-catalog'

afterEach(() => vi.clearAllMocks())

describe('WindowsAppLauncher evidence', () => {
  it('confirms a direct executable only while its process remains alive', async () => {
    const child = childProcess(4312)
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    })

    await expect(new WindowsAppLauncher('win32').launch({
      kind: 'executable',
      path: 'C:\\Program Files\\Nebula\\Nebula.exe'
    })).resolves.toEqual({
      accepted: true,
      method: 'executable',
      verified: true,
      processId: 4312
    })
    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\Program Files\\Nebula\\Nebula.exe',
      [],
      expect.objectContaining({ shell: false, windowsHide: true, stdio: 'ignore' })
    )
  })

  it('marks Windows app-id dispatch as unverified instead of claiming it opened', async () => {
    const child = childProcess(812)
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    })

    await expect(new WindowsAppLauncher('win32').launch({
      kind: 'app-id',
      appId: 'OpenAI.Codex_2p2nqsd0c76g0!App'
    })).resolves.toMatchObject({
      accepted: true,
      method: 'app-id',
      verified: false
    })
  })

  it('marks shortcut dispatch as unverified', async () => {
    const inspectShortcut = vi.fn(async () => 'C:\\Program Files\\Nebula\\Nebula.exe')
    await expect(new WindowsAppLauncher('win32', inspectShortcut).launch({
      kind: 'shortcut',
      path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Nebula.lnk'
    })).resolves.toEqual({ accepted: true, method: 'shortcut', verified: false })
    expect(inspectShortcut).toHaveBeenCalledOnce()
  })

  it.each([
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:\\Windows\\System32\\wscript.exe',
    'C:\\Windows\\explorer.exe',
    'C:\\Tools\\python.exe',
    'relative\\Nebula.exe',
    'C:\\Tools\\launch.cmd'
  ])('blocks an unsafe shortcut target: %s', async (targetPath) => {
    const launcher = new WindowsAppLauncher('win32', async () => targetPath)

    await expect(launcher.launch({
      kind: 'shortcut',
      path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Nebula.lnk'
    })).rejects.toThrow(/não é permitido/i)
    expect(openPathMock).not.toHaveBeenCalled()
  })

  it('blocks opaque ClickOnce shortcuts', async () => {
    const inspectShortcut = vi.fn(async () => 'C:\\Program Files\\Nebula\\Nebula.exe')
    const launcher = new WindowsAppLauncher('win32', inspectShortcut)

    await expect(launcher.launch({
      kind: 'shortcut',
      path: 'C:\\Users\\qa\\Start Menu\\Nebula.appref-ms'
    })).rejects.toThrow(/ClickOnce/i)
    expect(inspectShortcut).not.toHaveBeenCalled()
    expect(openPathMock).not.toHaveBeenCalled()
  })
})

function childProcess(processId: number): EventEmitter & {
  pid: number
  exitCode: number | null
  unref(): void
} {
  const child = new EventEmitter() as EventEmitter & {
    pid: number
    exitCode: number | null
    unref(): void
  }
  child.pid = processId
  child.exitCode = null
  child.unref = vi.fn()
  return child
}

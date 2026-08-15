import { describe, expect, it, vi } from 'vitest'
import { GameStandbyMonitor, normalizeExecutable } from './game-standby-monitor'

const game = { processId: 42, executable: 'Game.exe', fullscreen: true }

describe('GameStandbyMonitor', () => {
  it('enters and exits standby only after consecutive evidence', async () => {
    const samples = [game, game, null, null]
    const enter = vi.fn()
    const exit = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => samples.shift() ?? null,
      onEnter: enter,
      onExit: exit,
      enterSamples: 2,
      exitSamples: 2
    })

    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(false)
    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(true)
    expect(enter).toHaveBeenCalledWith(game)
    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(true)
    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(false)
    expect(exit).toHaveBeenCalledWith(game)
  })

  it.each(['chrome.exe', 'brave', 'PowerPnt.EXE', 'vlc.exe', 'Titi.exe'])(
    'does not treat fullscreen %s as a game',
    async (executable) => {
      const enter = vi.fn()
      const monitor = new GameStandbyMonitor({
        poll: async () => ({ processId: 1, executable, fullscreen: true }),
        onEnter: enter,
        onExit: vi.fn(),
        enterSamples: 1
      })

      await monitor.checkNow()
      expect(enter).not.toHaveBeenCalled()
      expect(monitor.isInStandby()).toBe(false)
    }
  )

  it('accepts a configured game even in borderless mode', async () => {
    const enter = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => ({ processId: 7, executable: 'MyGame.exe', fullscreen: false }),
      knownGames: ['mygame.exe'],
      onEnter: enter,
      onExit: vi.fn(),
      enterSamples: 1
    })

    await monitor.checkNow()
    expect(enter).toHaveBeenCalledOnce()
  })

  it('does not classify an arbitrary fullscreen meeting app as a game', async () => {
    const enter = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => ({ processId: 9, executable: 'MeetingRoom.exe', fullscreen: true }),
      onEnter: enter,
      onExit: vi.fn(),
      enterSamples: 1
    })

    await monitor.checkNow()
    expect(enter).not.toHaveBeenCalled()
  })

  it('normalizes executable names without accepting paths', () => {
    expect(normalizeExecutable('  MyGame.EXE ')).toBe('mygame')
  })
})

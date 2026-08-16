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
      knownGames: ['game'],
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

  it('stays in standby while the foreground switches directly between games', async () => {
    const gameB = { processId: 84, executable: 'OtherGame.exe', fullscreen: true }
    const samples = [game, gameB, null, null]
    const exit = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => samples.shift() ?? null,
      knownGames: ['game', 'othergame'],
      onEnter: vi.fn(),
      onExit: exit,
      enterSamples: 1,
      exitSamples: 2
    })

    await monitor.checkNow()
    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(true)
    expect(exit).not.toHaveBeenCalled()
    await monitor.checkNow()
    await monitor.checkNow()
    expect(exit).toHaveBeenCalledOnce()
  })

  it('does not treat polling failures as evidence that the game ended', async () => {
    let fail = false
    const exit = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => {
        if (fail) throw new Error('poll indisponível')
        return game
      },
      knownGames: ['game'],
      onEnter: vi.fn(),
      onExit: exit,
      enterSamples: 1,
      exitSamples: 1
    })

    await monitor.checkNow()
    fail = true
    await monitor.checkNow()
    await monitor.checkNow()
    expect(monitor.isInStandby()).toBe(true)
    expect(exit).not.toHaveBeenCalled()
  })

  it('requires consecutive samples from the same configured game', async () => {
    const samples = [
      game,
      { processId: 84, executable: 'OtherGame.exe', fullscreen: true },
      game
    ]
    const enter = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => samples.shift() ?? null,
      knownGames: ['game', 'othergame'],
      onEnter: enter,
      onExit: vi.fn(),
      enterSamples: 2
    })

    await monitor.checkNow()
    await monitor.checkNow()
    await monitor.checkNow()
    expect(enter).not.toHaveBeenCalled()
  })

  it.each(['NotAGame.exe', 'VideoGame.exe', 'UnrealEditor-Win64-Shipping.exe'])(
    'does not infer unknown game status from the executable name %s',
    async (executable) => {
      const enter = vi.fn()
      const monitor = new GameStandbyMonitor({
        poll: async () => ({ processId: 11, executable, fullscreen: true }),
        onEnter: enter,
        onExit: vi.fn(),
        enterSamples: 1
      })

      await monitor.checkNow()
      expect(enter).not.toHaveBeenCalled()
    }
  )

  it('normalizes executable names without accepting paths', () => {
    expect(normalizeExecutable('  MyGame.EXE ')).toBe('mygame')
  })

  it('aceita atualizar a lista explícita sem reativar heurísticas de nome', async () => {
    const enter = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: async () => ({ processId: 15, executable: 'JogoDoThiago.exe', fullscreen: false }),
      onEnter: enter,
      onExit: vi.fn(),
      enterSamples: 1
    })

    await monitor.checkNow()
    expect(enter).not.toHaveBeenCalled()
    monitor.setKnownGames(['JogoDoThiago.exe'])
    await monitor.checkNow()
    expect(enter).toHaveBeenCalledOnce()
  })

  it('aguarda a amostra em andamento ao parar e não deixa standby órfão', async () => {
    let release!: (value: typeof game) => void
    const enter = vi.fn()
    const exit = vi.fn()
    const monitor = new GameStandbyMonitor({
      poll: () => new Promise((resolve) => {
        release = resolve
      }),
      knownGames: ['game'],
      onEnter: enter,
      onExit: exit,
      enterSamples: 1
    })

    const checking = monitor.checkNow()
    const stopping = monitor.stop()
    release(game)
    await Promise.all([checking, stopping])

    expect(enter).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledOnce()
    expect(monitor.isInStandby()).toBe(false)
  })
})

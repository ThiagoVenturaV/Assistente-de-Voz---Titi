import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { accessSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import type { RuntimeStatus } from '../../shared/contracts'
import type { SettingsStore } from '../storage/settings-store'
import { OllamaRuntimeManager, ollamaTagsUrl } from './ollama-runtime-manager'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
vi.mock('node:fs', () => ({ accessSync: vi.fn() }))

const disconnected: RuntimeStatus = {
  provider: 'ollama',
  connected: false,
  model: DEFAULT_SETTINGS.provider.model,
  availableModels: [],
  message: 'Desconectado',
  checkedAt: '2026-08-15T00:00:00.000Z'
}

describe('OllamaRuntimeManager process lifecycle', () => {
  const originalLocalAppData = process.env.LOCALAPPDATA

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA
    else process.env.LOCALAPPDATA = originalLocalAppData
  })

  it('coalesces concurrent starts and launches Ollama without a shell or visible window', async () => {
    process.env.LOCALAPPDATA = 'C:\\Users\\qa\\AppData\\Local'
    vi.mocked(accessSync).mockReturnValue(undefined)
    const child = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>
      kill: ReturnType<typeof vi.fn>
      exitCode: number | null
      killed: boolean
    }
    child.unref = vi.fn()
    child.kill = vi.fn(() => true)
    child.exitCode = null
    child.killed = false
    vi.mocked(spawn).mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'))
      return child as never
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))

    const settings = {
      get: vi.fn(async () => DEFAULT_SETTINGS)
    } as unknown as SettingsStore
    const readStatus = vi.fn(async () => disconnected)
    const manager = new OllamaRuntimeManager(settings, readStatus, vi.fn(), 'C:\\Temp')

    await expect(Promise.all([manager.ensureRunning(), manager.ensureRunning()]))
      .resolves.toEqual([true, true])

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'C:\\Users\\qa\\AppData\\Local\\Programs\\Ollama\\ollama.exe',
      ['serve'],
      expect.objectContaining({
        detached: false,
        windowsHide: true,
        shell: false,
        stdio: 'ignore',
        env: expect.objectContaining({ OLLAMA_HOST: '127.0.0.1:11434' })
      })
    )
    expect(child.unref).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )

    expect(manager.shutdownOwnedEngine()).toBe(true)
    expect(child.kill).toHaveBeenCalledOnce()
    expect(manager.shutdownOwnedEngine()).toBe(false)
  })

  it('never stops an Ollama service that was already running externally', async () => {
    const settings = {
      get: vi.fn(async () => DEFAULT_SETTINGS)
    } as unknown as SettingsStore
    const manager = new OllamaRuntimeManager(
      settings,
      vi.fn(async () => ({ ...disconnected, connected: true })),
      vi.fn(),
      'C:\\Temp'
    )

    await expect(manager.ensureRunning()).resolves.toBe(true)
    expect(spawn).not.toHaveBeenCalled()
    expect(manager.shutdownOwnedEngine()).toBe(false)
  })

  it('cancela a inicialização pendente e encerra somente o processo que iniciou', async () => {
    process.env.LOCALAPPDATA = 'C:\\Users\\qa\\AppData\\Local'
    vi.mocked(accessSync).mockReturnValue(undefined)
    const child = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>
      kill: ReturnType<typeof vi.fn>
      exitCode: number | null
      killed: boolean
    }
    child.unref = vi.fn()
    child.kill = vi.fn(() => true)
    child.exitCode = null
    child.killed = false
    vi.mocked(spawn).mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'))
      return child as never
    })
    vi.stubGlobal('fetch', vi.fn((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    ))
    const settings = {
      get: vi.fn(async () => DEFAULT_SETTINGS)
    } as unknown as SettingsStore
    const manager = new OllamaRuntimeManager(
      settings,
      vi.fn(async () => disconnected),
      vi.fn(),
      'C:\\Temp'
    )
    const controller = new AbortController()

    const pending = manager.ensureRunning(controller.signal)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    controller.abort(abortError())

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(manager.shutdownOwnedEngine()).toBe(false)
  })

  it('unloads the selected model without stopping the Ollama service', async () => {
    const settings = {
      get: vi.fn(async () => DEFAULT_SETTINGS)
    } as unknown as SettingsStore
    const request = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', request)
    const manager = new OllamaRuntimeManager(settings, vi.fn(), vi.fn(), 'C:\\Temp')

    await expect(manager.unloadSelectedModel()).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: DEFAULT_SETTINGS.provider.model,
          prompt: '',
          stream: false,
          keep_alive: 0
        })
      })
    )
  })

  it('só confirma a descarga depois que o modelo desaparece de /api/ps', async () => {
    vi.useFakeTimers()
    const settings = {
      get: vi.fn(async () => DEFAULT_SETTINGS)
    } as unknown as SettingsStore
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [{ name: DEFAULT_SETTINGS.provider.model }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
    vi.stubGlobal('fetch', request)
    const manager = new OllamaRuntimeManager(settings, vi.fn(), vi.fn(), 'C:\\Temp')

    const unloading = manager.unloadSelectedModel()
    await vi.advanceTimersByTimeAsync(250)

    await expect(unloading).resolves.toBe(true)
    expect(request.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:11434/api/generate',
      'http://127.0.0.1:11434/api/ps',
      'http://127.0.0.1:11434/api/ps'
    ])
  })
})

describe('ollamaTagsUrl', () => {
  it('respeita o endpoint configurado e remove credenciais e sufixos', () => {
    expect(ollamaTagsUrl('https://user:secret@ollama.local/base/')).toBe(
      'https://ollama.local/base/api/tags'
    )
  })

  it('bloqueia protocolos que não são web', () => {
    expect(() => ollamaTagsUrl('file:///tmp/ollama')).toThrow(/HTTP ou HTTPS/)
  })
})

function abortError(): Error {
  const error = new Error('Interrompido.')
  error.name = 'AbortError'
  return error
}

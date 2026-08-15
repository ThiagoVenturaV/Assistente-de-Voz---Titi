import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WindowsAppCatalog,
  type AppLaunchRecipe,
  type AppRecipeLauncher
} from './windows-app-catalog'

describe('WindowsAppCatalog', () => {
  let root: string
  let startMenu: string
  let windowsApps: string
  let programs: string
  let skillsPath: string
  let launch: ReturnType<typeof vi.fn<AppRecipeLauncher['launch']>>

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'titi-app-catalog-'))
    startMenu = join(root, 'Start Menu', 'Programs')
    windowsApps = join(root, 'WindowsApps')
    programs = join(root, 'Programs')
    skillsPath = join(root, 'profile', 'app-skills.json')
    await Promise.all([
      mkdir(startMenu, { recursive: true }),
      mkdir(windowsApps, { recursive: true }),
      mkdir(programs, { recursive: true })
    ])
    launch = vi.fn(async (recipe: AppLaunchRecipe) => ({
      accepted: true as const,
      method: recipe.kind,
      verified: true
    }))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('finds a Start Menu shortcut and persists a structured learned skill', async () => {
    const shortcut = join(startMenu, 'Nebula Editor.lnk')
    await writeFile(shortcut, '')
    const catalog = createCatalog()

    const result = await catalog.open('Nebula Editor')

    expect(result.ok).toBe(true)
    expect(launch).toHaveBeenCalledWith({ kind: 'shortcut', path: shortcut })
    const persisted = JSON.parse(await readFile(skillsPath, 'utf8')) as {
      version: number
      skills: Array<Record<string, unknown>>
    }
    expect(persisted.version).toBe(1)
    expect(persisted.skills).toHaveLength(1)
    expect(persisted.skills[0]).toMatchObject({
      name: 'Nebula Editor',
      successfulLaunches: 1,
      procedure: {
        action: 'launch-discovered-application',
        target: { kind: 'shortcut', path: shortcut }
      }
    })
    expect(JSON.stringify(persisted)).not.toContain('command')
    expect(JSON.stringify(persisted)).not.toContain('arguments')
  })

  it.each<[
    string,
    string,
    string,
    AppLaunchRecipe
  ]>([
    ['spotify', 'Spotify', 'SpotifyAB.SpotifyMusic!Spotify', { kind: 'app-id', appId: 'SpotifyAB.SpotifyMusic!Spotify' }],
    ['navegador brave', 'Brave Browser', 'BraveSoftware.Brave!App', { kind: 'app-id', appId: 'BraveSoftware.Brave!App' }],
    ['aplicativo do chatgpt', 'OpenAI ChatGPT', 'OpenAI.ChatGPT!App', { kind: 'app-id', appId: 'OpenAI.ChatGPT!App' }],
    ['aplicativo do codex', 'OpenAI Codex', 'OpenAI.Codex!App', { kind: 'app-id', appId: 'OpenAI.Codex!App' }],
    ['google antigravity', 'Antigravity', 'Google.Antigravity!App', { kind: 'app-id', appId: 'Google.Antigravity!App' }]
  ])('resolves the known alias %s from trusted Windows sources', async (
    requestedName,
    name,
    appId,
    expectedRecipe
  ) => {
    const catalog = createCatalog({ startApps: [{ name, appId }] })

    await expect(catalog.open(requestedName)).resolves.toMatchObject({ ok: true })
    expect(launch).toHaveBeenCalledWith(expectedRecipe)
  })

  it('refuses a learned app id when Windows no longer registers it', async () => {
    const first = createCatalog({
      startApps: [{ name: 'OpenAI Codex', appId: 'OpenAI.Codex!App' }]
    })
    await first.open('codex')
    launch.mockClear()

    const second = createCatalog()
    const result = await second.open('codex app')

    expect(result).toMatchObject({ ok: false })
    expect(result.message).toMatch(/origem deixou de ser confiável/i)
    expect(launch).not.toHaveBeenCalled()
  })

  it.each(['chatgpt', 'codex app'])(
    'maps %s to the installed Codex/ChatGPT Store identity',
    async (alias) => {
      const installedId = 'OpenAI.Codex_2p2nqsd0c76g0!App'
      const catalog = createCatalog({
        startApps: [{ name: 'ChatGPT', appId: installedId }]
      })

      await expect(catalog.open(alias)).resolves.toMatchObject({ ok: true })
      expect(launch).toHaveBeenCalledWith({ kind: 'app-id', appId: installedId })
    }
  )

  it('tries trusted installation folders when an app has no shortcut', async () => {
    const folder = join(programs, 'Antigravity')
    const executable = join(folder, 'Antigravity.exe')
    await mkdir(folder, { recursive: true })
    await writeFile(executable, '')

    const result = await createCatalog().open('anti gravity')

    expect(result.ok).toBe(true)
    expect(launch).toHaveBeenCalledWith({ kind: 'executable', path: executable })
  })

  it.each([
    'C:\\Windows\\System32\\cmd.exe',
    '..\\malware.exe',
    'powershell.ps1',
    'Prompt de Comando',
    'Windows Terminal',
    'file:///C:/Windows/System32/cmd.exe'
  ])('never treats a path or command as an application name: %s', async (value) => {
    const result = await createCatalog().open(value)

    expect(result).toEqual({ ok: false, message: 'Valor inválido para application.' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('does not learn when Windows rejects the launch', async () => {
    await writeFile(join(startMenu, 'Nebula.lnk'), '')
    launch.mockRejectedValueOnce(new Error('Acesso negado'))

    const result = await createCatalog().open('Nebula')

    expect(result).toMatchObject({ ok: false })
    await expect(readFile(skillsPath, 'utf8')).rejects.toThrow()
  })

  it('opens but does not persist a recipe when local history is disabled', async () => {
    const shortcut = join(startMenu, 'Novo Editor.lnk')
    await writeFile(shortcut, '')
    const catalog = createCatalog({ shouldLearn: false })

    await expect(catalog.open('Novo Editor')).resolves.toMatchObject({
      ok: true,
      details: { learned: false }
    })
    expect(launch).toHaveBeenCalledWith({ kind: 'shortcut', path: shortcut })
    await expect(readFile(skillsPath, 'utf8')).rejects.toThrow()
  })

  it('does not claim an uninstalled known application exists', async () => {
    const result = await createCatalog().open('codex')

    expect(result.ok).toBe(false)
    expect(launch).not.toHaveBeenCalled()
  })

  it('does not let a similarly named user shortcut impersonate a known app', async () => {
    await writeFile(join(startMenu, 'Spotify.lnk'), '')

    const result = await createCatalog().open('spotify')

    expect(result.ok).toBe(false)
    expect(launch).not.toHaveBeenCalled()
  })

  it('does not learn or claim success without process evidence', async () => {
    const shortcut = join(startMenu, 'Novo Editor.lnk')
    await writeFile(shortcut, '')
    launch.mockResolvedValueOnce({
      accepted: true,
      method: 'shortcut',
      verified: false
    })

    const result = await createCatalog().open('Novo Editor')

    expect(result).toMatchObject({
      ok: true,
      details: { learned: false, verified: false }
    })
    expect(result.message).toMatch(/não consegui confirmar/i)
    await expect(readFile(skillsPath, 'utf8')).rejects.toThrow()
  })

  it('ignores a corrupted skill file and discovers the app again', async () => {
    await mkdir(join(root, 'profile'), { recursive: true })
    await writeFile(skillsPath, '{broken')
    const shortcut = join(startMenu, 'Nebula.lnk')
    await writeFile(shortcut, '')

    const result = await createCatalog().open('Nebula')

    expect(result.ok).toBe(true)
    expect(launch).toHaveBeenCalledWith({ kind: 'shortcut', path: shortcut })
  })

  function createCatalog(options: {
    startApps?: Array<{ name: string; appId: string }>
    shouldLearn?: boolean
  } = {}): WindowsAppCatalog {
    return new WindowsAppCatalog({
      platform: 'win32',
      recipeFilePath: skillsPath,
      launcher: { launch },
      startMenuRoots: [startMenu],
      windowsAppsRoot: windowsApps,
      installRoots: [programs],
      getStartApps: async () => options.startApps ?? [],
      shouldLearn: async () => options.shouldLearn ?? true,
      now: () => new Date('2026-08-15T12:00:00.000Z')
    })
  }
})

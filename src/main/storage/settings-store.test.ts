import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsStore } from './settings-store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('SettingsStore', () => {
  it('preserva configurações aninhadas ao atualizar um único campo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(directory)

    const updated = await store.update({
      provider: {
        kind: 'ollama',
        endpoint: 'http://127.0.0.1:2244',
        model: 'qwen3.5:9b'
      }
    })
    const renamed = await store.update({ mascotName: 'Titi Teste' })

    expect(updated.provider.endpoint).toBe('http://127.0.0.1:2244')
    expect(renamed.provider.endpoint).toBe('http://127.0.0.1:2244')
    expect(renamed.mascotName).toBe('Titi Teste')
    expect(renamed.voice.enabled).toBe(true)
  })

  it('mantém confirmações críticas sempre ativas', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(directory)

    await expect(store.update({ confirmSensitiveActions: false }))
      .resolves.toMatchObject({ confirmSensitiveActions: true })
    await expect(store.get()).resolves.toMatchObject({ confirmSensitiveActions: true })
  })

  it('mantém o controle da interface desativado por padrão e preserva o opt-in explícito', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(directory)

    await expect(store.get()).resolves.toMatchObject({ computerControlEnabled: false })
    await store.update({ computerControlEnabled: true })
    await expect(new SettingsStore(directory).get())
      .resolves.toMatchObject({ computerControlEnabled: true })
  })

  it('migrates the old unsafe Space placeholder to a modified global shortcut', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(directory)
    const current = await store.get()

    await store.update({
      voice: { ...current.voice, pushToTalkShortcut: 'Space' }
    })

    await expect(store.get()).resolves.toMatchObject({
      voice: { pushToTalkShortcut: 'CommandOrControl+Shift+Space' }
    })
  })

  it('salvages safe fields but rejects malformed persisted security settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    await writeFile(join(directory, 'settings.json'), JSON.stringify({
      version: 1,
      onboardingComplete: true,
      mascotName: 'Titi Antigo',
      keepHistory: 'false',
      confirmSensitiveActions: false,
      provider: {
        kind: 'ollama',
        endpoint: 'https://remote.example.com',
        model: 'remote-model'
      },
      voice: {
        enabled: true,
        pushToTalkShortcut: 'Space',
        liveMode: false,
        speechRate: 1
      }
    }))

    const settings = await new SettingsStore(directory).get()

    expect(settings).toMatchObject({
      onboardingComplete: true,
      mascotName: 'Titi Antigo',
      keepHistory: true,
      confirmSensitiveActions: true,
      provider: { endpoint: 'http://127.0.0.1:11434', model: 'qwen3:4b-instruct' },
      voice: { pushToTalkShortcut: 'CommandOrControl+Shift+Space' }
    })
  })

  it('preserva patches concorrentes em campos independentes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-settings-'))
    temporaryDirectories.push(directory)
    const store = new SettingsStore(directory)

    await Promise.all([
      store.update({ mascotName: 'Titi Concorrente' }),
      store.update({ launchAtStartup: true }),
      store.update({ showFloatingMascot: false })
    ])

    await expect(store.get()).resolves.toMatchObject({
      mascotName: 'Titi Concorrente',
      launchAtStartup: true,
      showFloatingMascot: false
    })
  })
})

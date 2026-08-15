import { mkdtemp, rm } from 'node:fs/promises'
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
})

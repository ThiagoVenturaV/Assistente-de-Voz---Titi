import { join } from 'node:path'
import type { TitiSettings } from '../../shared/contracts'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { JsonStore } from './json-store'

export class SettingsStore {
  private readonly store: JsonStore<TitiSettings>

  constructor(userDataPath: string) {
    this.store = new JsonStore(join(userDataPath, 'settings.json'), DEFAULT_SETTINGS)
  }

  async get(): Promise<TitiSettings> {
    const saved = await this.store.read()
    return mergeSettings(DEFAULT_SETTINGS, saved)
  }

  async update(patch: Partial<TitiSettings>): Promise<TitiSettings> {
    const current = await this.get()
    const next = mergeSettings(current, patch)
    await this.store.write(next)
    return next
  }
}

function mergeSettings(
  current: TitiSettings,
  patch: Partial<TitiSettings>
): TitiSettings {
  return {
    ...current,
    ...patch,
    provider: {
      ...current.provider,
      ...(patch.provider ?? {})
    },
    voice: {
      ...current.voice,
      ...(patch.voice ?? {})
    }
  }
}

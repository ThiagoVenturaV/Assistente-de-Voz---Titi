import { join } from 'node:path'
import type { TitiSettings } from '../../shared/contracts'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { JsonStore } from './json-store'
import { validatedSettingsPatch } from '../ipc/validation'

export class SettingsStore {
  private readonly store: JsonStore<TitiSettings>

  constructor(userDataPath: string) {
    this.store = new JsonStore(join(userDataPath, 'settings.json'), DEFAULT_SETTINGS)
  }

  async get(): Promise<TitiSettings> {
    const saved = await this.store.read()
    return normalizeStoredSettings(saved)
  }

  async update(patch: Partial<TitiSettings>): Promise<TitiSettings> {
    const current = await this.get()
    const next = mergeSettings(current, patch)
    await this.store.write(next)
    return next
  }
}

function normalizeStoredSettings(value: unknown): TitiSettings {
  const candidate = isRecord(value) ? value : {}
  const result = structuredClone(DEFAULT_SETTINGS)

  for (const key of [
    'onboardingComplete', 'launchAtStartup', 'showFloatingMascot', 'keepHistory'
  ] as const) {
    if (typeof candidate[key] === 'boolean') result[key] = candidate[key]
  }

  try {
    const patch = validatedSettingsPatch({ mascotName: candidate.mascotName })
    if (patch.mascotName) result.mascotName = patch.mascotName
  } catch {
    // Keep the safe default for malformed persisted data.
  }

  try {
    const patch = validatedSettingsPatch({ provider: candidate.provider })
    if (patch.provider) result.provider = patch.provider
  } catch {
    // A persisted remote or malformed endpoint must never be reactivated.
  }

  if (isRecord(candidate.voice)) {
    const voice = { ...candidate.voice }
    // "Space" was a placeholder before global shortcuts existed and would
    // capture ordinary typing system-wide. Migrate it before validation.
    if (voice.pushToTalkShortcut === 'Space') {
      voice.pushToTalkShortcut = DEFAULT_SETTINGS.voice.pushToTalkShortcut
    }
    try {
      const patch = validatedSettingsPatch({ voice })
      if (patch.voice) result.voice = patch.voice
    } catch {
      // Keep the complete safe voice defaults rather than accepting a mixed shape.
    }
  }

  result.confirmSensitiveActions = true
  return result
}

function mergeSettings(
  current: TitiSettings,
  patch: Partial<TitiSettings>
): TitiSettings {
  return {
    ...current,
    ...patch,
    // As proteções críticas não podem ser desativadas por configuração.
    confirmSensitiveActions: true,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

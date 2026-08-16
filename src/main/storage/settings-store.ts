import { join } from 'node:path'
import type { TitiSettings } from '../../shared/contracts'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { JsonStore } from './json-store'
import { validatedSettingsPatch } from '../ipc/validation'

export class SettingsStore {
  private readonly store: JsonStore<TitiSettings>
  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string) {
    this.store = new JsonStore(join(userDataPath, 'settings.json'), DEFAULT_SETTINGS)
  }

  async get(): Promise<TitiSettings> {
    await this.mutationQueue
    return this.readNormalized()
  }

  private async readNormalized(): Promise<TitiSettings> {
    const saved = await this.store.read()
    return normalizeStoredSettings(saved)
  }

  async update(patch: Partial<TitiSettings>): Promise<TitiSettings> {
    const mutation = this.mutationQueue.catch(() => undefined).then(async () => {
      const current = await this.readNormalized()
      const next = mergeSettings(current, patch)
      await this.store.write(next)
      return next
    })
    this.mutationQueue = mutation.then(() => undefined, () => undefined)
    return mutation
  }
}

function normalizeStoredSettings(value: unknown): TitiSettings {
  const candidate = isRecord(value) ? value : {}
  const result = structuredClone(DEFAULT_SETTINGS)

  for (const key of [
    'onboardingComplete', 'launchAtStartup', 'showFloatingMascot', 'computerControlEnabled', 'keepHistory'
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
    const voice = { ...DEFAULT_SETTINGS.voice, ...candidate.voice }
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

  if (isRecord(candidate.games)) {
    try {
      const patch = validatedSettingsPatch({ games: candidate.games })
      if (patch.games) result.games = patch.games
    } catch {
      // Keep the conservative built-in game defaults for malformed data.
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
    },
    games: {
      ...current.games,
      ...(patch.games ?? {})
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

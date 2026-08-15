import type { TitiSettings } from './contracts'

export const DEFAULT_SETTINGS: TitiSettings = {
  version: 1,
  onboardingComplete: false,
  mascotName: 'Titi',
  launchAtStartup: false,
  showFloatingMascot: true,
  keepHistory: true,
  confirmSensitiveActions: true,
  provider: {
    kind: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen3.5:9b'
  },
  voice: {
    enabled: true,
    pushToTalkShortcut: 'Space',
    liveMode: false,
    speechRate: 1
  }
}

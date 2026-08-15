export interface GlobalShortcutBackend {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

export class GlobalPushToTalk {
  private current: string | null = null

  constructor(
    private readonly backend: GlobalShortcutBackend,
    private readonly onToggle: () => void
  ) {}

  register(accelerator: string): void {
    const normalized = accelerator.trim()
    if (normalized === this.current) return
    if (!isSafePushToTalkShortcut(normalized)) {
      throw new Error('Use um atalho com Ctrl, Alt ou Shift e uma tecla, por exemplo Ctrl+Shift+Espaço.')
    }
    if (!this.backend.register(normalized, this.onToggle)) {
      throw new Error(`O atalho “${normalized}” já está sendo usado por outro aplicativo.`)
    }
    const previous = this.current
    this.current = normalized
    if (previous) this.backend.unregister(previous)
  }

  dispose(): void {
    if (this.current) this.backend.unregister(this.current)
    this.current = null
  }
}

export function isSafePushToTalkShortcut(value: string): boolean {
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2 || parts.length > 5) return false
  const modifiers = new Set(['commandorcontrol', 'command', 'cmd', 'control', 'ctrl', 'alt', 'option', 'shift', 'super', 'meta'])
  const normalized = parts.map((part) => part.toLocaleLowerCase())
  const keyParts = normalized.filter((part) => !modifiers.has(part))
  return keyParts.length === 1
    && normalized.some((part) => modifiers.has(part))
    && /^(?:[a-z0-9]|space|f(?:[1-9]|1[0-2])|up|down|left|right)$/i.test(keyParts[0])
}

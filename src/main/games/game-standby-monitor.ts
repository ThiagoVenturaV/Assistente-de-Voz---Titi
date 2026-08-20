import { spawn } from 'node:child_process'

export interface ForegroundApplication {
  processId: number
  executable: string
  fullscreen: boolean
}

export interface GameStandbyMonitorOptions {
  poll?: () => Promise<ForegroundApplication | null>
  onEnter(app: ForegroundApplication): Promise<boolean> | boolean
  onExit(app: ForegroundApplication): Promise<void> | void
  knownGames?: string[]
  intervalMs?: number
  enterSamples?: number
  exitSamples?: number
}

const NON_GAME_FULLSCREEN = new Set([
  'brave',
  'chrome',
  'firefox',
  'msedge',
  'opera',
  'powerpnt',
  'vlc',
  'wmplayer',
  'mpv',
  'obs64',
  'photos',
  'applicationframehost',
  'explorer',
  'titi',
  'codex',
  'antigravity'
])
const DEFAULT_KNOWN_GAMES = [
  'cs2',
  'csgo',
  'dota2',
  'valorant',
  'valorant-win64-shipping',
  'fortniteclient-win64-shipping',
  'gta5',
  'rdr2',
  'rocketleague',
  'minecraft',
  'overwatch',
  'league of legends',
  'eldenring',
  'cyberpunk2077',
  'robloxplayerbeta',
  'witcher3',
  'starfield'
]

/**
 * Conservative foreground-game detector. It requires consecutive samples and
 * never accepts process names from the model or executes a discovered path.
 */
export class GameStandbyMonitor {
  private readonly poll: () => Promise<ForegroundApplication | null>
  private readonly onEnter: GameStandbyMonitorOptions['onEnter']
  private readonly onExit: GameStandbyMonitorOptions['onExit']
  private readonly knownGames = new Set<string>()
  private readonly intervalMs: number
  private readonly enterSamples: number
  private readonly exitSamples: number
  private timer: NodeJS.Timeout | null = null
  private checking: Promise<void> | null = null
  private entering = 0
  private enteringExecutable: string | null = null
  private exiting = 0
  private active: ForegroundApplication | null = null
  private deferredProcessId: number | null = null

  constructor(options: GameStandbyMonitorOptions) {
    this.poll = options.poll ?? readForegroundApplication
    this.onEnter = options.onEnter
    this.onExit = options.onExit
    this.setKnownGames(options.knownGames ?? [])
    this.intervalMs = Math.max(2_000, options.intervalMs ?? 5_000)
    this.enterSamples = Math.max(1, options.enterSamples ?? 2)
    this.exitSamples = Math.max(1, options.exitSamples ?? 2)
  }

  start(): void {
    if (this.timer) return
    void this.checkNow().catch(() => undefined)
    this.timer = setInterval(() => void this.checkNow().catch(() => undefined), this.intervalMs)
    this.timer.unref()
  }

  async stop(options: { restore?: boolean } = {}): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.checking?.catch(() => undefined)
    this.entering = 0
    this.enteringExecutable = null
    this.exiting = 0
    this.deferredProcessId = null
    if (options.restore !== false && this.active) {
      const previous = this.active
      this.active = null
      await this.onExit(previous)
    }
  }

  async checkNow(): Promise<void> {
    if (this.checking) return this.checking
    const checking = this.checkOnce()
    this.checking = checking
    try {
      await checking
    } finally {
      if (this.checking === checking) this.checking = null
    }
  }

  private async checkOnce(): Promise<void> {
    let foreground: ForegroundApplication | null
    try {
      foreground = await this.poll()
    } catch {
      // Falha de observação não prova que o jogo terminou.
      return
    }
    const candidate = foreground && this.isGame(foreground) ? foreground : null

    if (!this.active) {
      this.exiting = 0
      if (!candidate) {
        this.entering = 0
        this.enteringExecutable = null
        this.deferredProcessId = null
        return
      }
      if (this.deferredProcessId === candidate.processId) return
      if (this.deferredProcessId !== null) this.deferredProcessId = null
      const candidateExecutable = candidate
        ? normalizeExecutable(candidate.executable)
        : null
      if (!candidateExecutable) {
        this.entering = 0
        this.enteringExecutable = null
      } else if (candidateExecutable === this.enteringExecutable) {
        this.entering += 1
      } else {
        this.entering = 1
        this.enteringExecutable = candidateExecutable
      }
      if (candidate && this.entering >= this.enterSamples) {
        this.entering = 0
        this.enteringExecutable = null
        const shouldEnter = await this.onEnter(candidate)
        if (shouldEnter !== false) this.active = candidate
        else this.deferredProcessId = candidate.processId
      }
      return
    }

    if (candidate) {
      // Trocar de jogo não deve restaurar voz/modelo entre os dois processos.
      this.active = candidate
      this.exiting = 0
      return
    }

    this.exiting += 1
    if (this.exiting >= this.exitSamples) {
      const previous = this.active
      this.exiting = 0
      this.active = null
      try {
        await this.onExit(previous)
      } catch (error) {
        this.active = previous
        throw error
      }
    }
  }

  isInStandby(): boolean {
    return this.active !== null
  }

  setKnownGames(configuredGames: string[]): void {
    this.knownGames.clear()
    for (const executable of [...DEFAULT_KNOWN_GAMES, ...configuredGames]) {
      const normalized = normalizeExecutable(executable)
      if (normalized) this.knownGames.add(normalized)
    }
  }

  private isGame(app: ForegroundApplication): boolean {
    const executable = normalizeExecutable(app.executable)
    if (!executable || NON_GAME_FULLSCREEN.has(executable)) return false
    return this.knownGames.has(executable)
  }
}

export function normalizeExecutable(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\.exe$/i, '')
}

export async function readForegroundApplication(): Promise<ForegroundApplication | null> {
  if (process.platform !== 'win32') return null
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class TitiForeground { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out RECT r); public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } }'",
    '$h=[TitiForeground]::GetForegroundWindow()',
    'if ($h -eq [IntPtr]::Zero) { exit 0 }',
    '$pidValue=0; [void][TitiForeground]::GetWindowThreadProcessId($h,[ref]$pidValue)',
    '$rect=New-Object TitiForeground+RECT; [void][TitiForeground]::GetWindowRect($h,[ref]$rect)',
    '$screen=[System.Windows.Forms.Screen]::FromHandle($h).Bounds',
    '$process=Get-Process -Id $pidValue -ErrorAction Stop',
    '$fullscreen=($rect.Left -le $screen.Left -and $rect.Top -le $screen.Top -and $rect.Right -ge $screen.Right -and $rect.Bottom -ge $screen.Bottom)',
    '[pscustomobject]@{ processId=$pidValue; executable=$process.ProcessName; fullscreen=$fullscreen } | ConvertTo-Json -Compress'
  ].join('; ')

  const output = await captureHiddenProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    script
  ])
  if (!output.trim()) return null
  const parsed = JSON.parse(output) as Partial<ForegroundApplication>
  return Number.isInteger(parsed.processId)
    && typeof parsed.executable === 'string'
    && typeof parsed.fullscreen === 'boolean'
    ? parsed as ForegroundApplication
    : null
}

function captureHiddenProcess(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    let output = ''
    const timeout = setTimeout(() => child.kill(), 4_000)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      output = `${output}${chunk}`.slice(-4_000)
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve(output)
      else reject(new Error('Não foi possível verificar o aplicativo em primeiro plano.'))
    })
  })
}

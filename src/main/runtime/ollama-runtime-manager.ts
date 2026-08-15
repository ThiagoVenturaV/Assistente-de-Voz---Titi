import { spawn } from 'node:child_process'
import { accessSync } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  RuntimeSetupProgress,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'
import { SettingsStore } from '../storage/settings-store'

type StatusReader = () => Promise<RuntimeStatus>
type ProgressReporter = (progress: RuntimeSetupProgress) => void

export class OllamaRuntimeManager {
  constructor(
    private readonly settings: SettingsStore,
    private readonly readProviderStatus: StatusReader,
    private readonly report: ProgressReporter,
    private readonly temporaryPath: string
  ) {}

  async status(): Promise<RuntimeStatus> {
    return this.enrich(await this.readProviderStatus())
  }

  async enrich(status: RuntimeStatus): Promise<RuntimeStatus> {
    const settings = await this.settings.get()
    const executable = findOllamaExecutable()
    const modelInstalled = status.availableModels.includes(settings.provider.model)
    return {
      ...status,
      engineInstalled: Boolean(executable),
      modelInstalled,
      setupAction: selectSetupAction(status, Boolean(executable), modelInstalled)
    }
  }

  async ensureRunning(): Promise<boolean> {
    const current = await this.readProviderStatus()
    if (current.connected) return true
    const executable = findOllamaExecutable()
    if (!executable) return false
    this.report({ stage: 'starting-engine', message: 'Iniciando o mecanismo local…' })
    const child = spawn(executable, ['serve'], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    })
    child.on('error', () => undefined)
    child.unref()
    return waitForOllama(15_000)
  }

  async prepare(): Promise<RuntimeStatus> {
    try {
      this.report({ stage: 'checking', message: 'Verificando o ambiente local…' })
      let status = await this.status()

      if (status.setupAction === 'install-engine') {
        await this.installEngine()
      }

      if (!status.connected) {
        const started = await this.ensureRunning()
        if (!started) throw new Error('O Ollama foi instalado, mas o serviço local não iniciou.')
      }

      status = await this.status()
      if (!status.modelInstalled) {
        const settings = await this.settings.get()
        await this.pullModel(settings)
      }

      status = await this.status()
      this.report({ stage: 'ready', message: 'IA local pronta para conversar.', percent: 100 })
      return status
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao preparar a IA local.'
      this.report({ stage: 'error', message })
      throw error
    }
  }

  private async installEngine(): Promise<void> {
    const installerPath = join(this.temporaryPath, 'Titi-OllamaSetup.exe')
    this.report({ stage: 'downloading-engine', message: 'Baixando o instalador oficial do Ollama…', percent: 0 })
    try {
      await downloadFile(
        'https://ollama.com/download/OllamaSetup.exe',
        installerPath,
        (percent) => this.report({
          stage: 'downloading-engine',
          message: 'Baixando o instalador oficial do Ollama…',
          percent
        })
      )
      await verifyOllamaSignature(installerPath)
      this.report({ stage: 'installing-engine', message: 'Instalando o Ollama no seu perfil do Windows…' })
      await runProcess(installerPath, ['/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES'], 10 * 60_000)
    } finally {
      await unlink(installerPath).catch(() => undefined)
    }
  }

  private async pullModel(settings: TitiSettings): Promise<void> {
    const executable = findOllamaExecutable()
    if (!executable) throw new Error('O executável do Ollama não foi encontrado.')
    this.report({
      stage: 'downloading-model',
      message: `Baixando ${settings.provider.model}…`,
      percent: 0
    })
    await runProcess(
      executable,
      ['pull', settings.provider.model],
      60 * 60_000,
      (chunk) => {
        const clean = chunk.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        const matches = [...clean.matchAll(/(\d{1,3})%/g)]
        const percent = matches.length ? Number(matches.at(-1)?.[1]) : undefined
        this.report({
          stage: 'downloading-model',
          message: `Baixando ${settings.provider.model}${percent === undefined ? '…' : ` — ${percent}%`}`,
          percent
        })
      }
    )
  }
}

export function selectSetupAction(
  status: RuntimeStatus,
  engineInstalled: boolean,
  modelInstalled: boolean
): NonNullable<RuntimeStatus['setupAction']> {
  if (status.connected) return modelInstalled ? 'ready' : 'download-model'
  return engineInstalled ? 'start-engine' : 'install-engine'
}

function findOllamaExecutable(): string | null {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return null
  const candidate = join(localAppData, 'Programs', 'Ollama', 'ollama.exe')
  try {
    accessSync(candidate)
    return candidate
  } catch {
    return null
  }
}

async function waitForOllama(timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', {
        signal: AbortSignal.timeout(1000)
      })
      if (response.ok) return true
    } catch {
      // O serviço ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function downloadFile(
  url: string,
  destination: string,
  onProgress: (percent?: number) => void
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Download do Ollama falhou: HTTP ${response.status}.`)
  const total = Number(response.headers.get('content-length') ?? 0)
  const file = await open(destination, 'w')
  const reader = response.body.getReader()
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await file.write(value)
      received += value.byteLength
      onProgress(total ? Math.round((received / total) * 100) : undefined)
    }
  } finally {
    await file.close()
  }
}

async function verifyOllamaSignature(path: string): Promise<void> {
  const script = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $args[0]",
    "if ($signature.Status -ne 'Valid') { exit 1 }",
    "if ($signature.SignerCertificate.Subject -notmatch '(^|, )O=Ollama Inc\\.(,|$)') { exit 2 }"
  ].join('; ')
  await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script, path], 60_000)
}

function runProcess(
  executable: string,
  args: string[],
  timeout: number,
  onOutput?: (chunk: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let errorOutput = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('A preparação local excedeu o tempo limite.'))
    }, timeout)
    const collect = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      errorOutput = `${errorOutput}${text}`.slice(-5000)
      onOutput?.(text)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(errorOutput.trim().split(/\r?\n/).at(-1) || `Processo encerrado com código ${code}.`))
    })
  })
}

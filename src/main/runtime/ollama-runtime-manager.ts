import { spawn, type ChildProcess } from 'node:child_process'
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
  private startingEngine: Promise<boolean> | null = null
  private startingEngineController: AbortController | null = null
  private preparingRuntime: Promise<RuntimeStatus> | null = null
  private preparationController: AbortController | null = null
  private unloadingModel: Promise<boolean> | null = null
  private ownedEngine: ChildProcess | null = null

  constructor(
    private readonly settings: SettingsStore,
    private readonly readProviderStatus: StatusReader,
    private readonly report: ProgressReporter,
    private readonly temporaryPath: string
  ) {}

  async status(signal?: AbortSignal): Promise<RuntimeStatus> {
    return waitWithAbort(
      this.readProviderStatus().then((status) => this.enrich(status, signal)),
      signal
    )
  }

  async enrich(status: RuntimeStatus, signal?: AbortSignal): Promise<RuntimeStatus> {
    const settings = await waitWithAbort(this.settings.get(), signal)
    const executable = findOllamaExecutable()
    const modelInstalled = status.availableModels.includes(settings.provider.model)
    return {
      ...status,
      engineInstalled: Boolean(executable),
      modelInstalled,
      setupAction: selectSetupAction(status, Boolean(executable), modelInstalled)
    }
  }

  async ensureRunning(signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal)
    const current = await waitWithAbort(this.readProviderStatus(), signal)
    if (current.connected) return true
    if (this.startingEngine) return waitWithAbort(this.startingEngine, signal)
    const executable = findOllamaExecutable()
    if (!executable) return false
    const controller = new AbortController()
    const unlink = linkAbortSignal(signal, controller)
    this.startingEngineController = controller
    this.startingEngine = this.startConfiguredEngine(executable, controller.signal)
    try {
      return await this.startingEngine
    } finally {
      unlink()
      if (this.startingEngineController === controller) {
        this.startingEngineController = null
      }
      this.startingEngine = null
    }
  }

  private async startConfiguredEngine(
    executable: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    const settings = await waitWithAbort(this.settings.get(), signal)
    return this.startEngine(executable, settings.provider.endpoint, signal)
  }

  private async startEngine(
    executable: string,
    endpoint: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    throwIfAborted(signal)
    this.report({ stage: 'starting-engine', message: 'Preparando a inteligência do Titi em segundo plano…' })
    const parsedEndpoint = new URL(endpoint.trim())
    const child = await launchBackground(executable, ['serve'], {
      ...process.env,
      OLLAMA_HOST: parsedEndpoint.host
    }, signal)
    this.ownedEngine = child
    child.once('exit', () => {
      if (this.ownedEngine === child) this.ownedEngine = null
    })
    let ready = false
    try {
      ready = await waitForOllama(endpoint, 15_000, signal)
      return ready
    } finally {
      if (!ready && this.ownedEngine === child) {
        this.ownedEngine = null
        if (child.exitCode === null && !child.killed) child.kill()
      }
    }
  }

  /**
   * Stops only the Ollama process launched by this Titi instance. An Ollama
   * service that was already connected is never adopted or terminated.
   */
  shutdownOwnedEngine(): boolean {
    const child = this.ownedEngine
    this.ownedEngine = null
    if (!child || child.exitCode !== null || child.killed) return false
    return child.kill()
  }

  cancelActiveWork(reason: Error = cancellationError()): boolean {
    let cancelled = false
    for (const controller of [this.preparationController, this.startingEngineController]) {
      if (!controller || controller.signal.aborted) continue
      controller.abort(reason)
      cancelled = true
    }
    return cancelled
  }

  async unloadSelectedModel(): Promise<boolean> {
    if (this.unloadingModel) return this.unloadingModel
    this.unloadingModel = this.unloadSelectedModelOnce()
    try {
      return await this.unloadingModel
    } finally {
      this.unloadingModel = null
    }
  }

  private async unloadSelectedModelOnce(): Promise<boolean> {
    const settings = await this.settings.get()
    const endpoint = settings.provider.endpoint.trim().replace(/\/+$/, '')
    try {
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.provider.model,
          prompt: '',
          stream: false,
          keep_alive: 0
        }),
        signal: AbortSignal.timeout(10_000)
      })
      if (!response.ok) return false
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const processes = await fetch(`${endpoint}/api/ps`, {
          signal: AbortSignal.timeout(2_000)
        })
        if (!processes.ok) return false
        const payload = await processes.json() as {
          models?: Array<{ name?: string; model?: string }>
        }
        const stillLoaded = (payload.models ?? []).some(({ name, model }) =>
          (name ?? model) === settings.provider.model
        )
        if (!stillLoaded) return true
        await delay(250)
      }
      return false
    } catch {
      return false
    }
  }

  async prepare(signal?: AbortSignal): Promise<RuntimeStatus> {
    throwIfAborted(signal)
    if (this.preparingRuntime) return waitWithAbort(this.preparingRuntime, signal)
    const controller = new AbortController()
    const unlink = linkAbortSignal(signal, controller)
    this.preparationController = controller
    this.preparingRuntime = this.prepareOnce(controller.signal)
    try {
      return await this.preparingRuntime
    } finally {
      unlink()
      if (this.preparationController === controller) {
        this.preparationController = null
      }
      this.preparingRuntime = null
    }
  }

  private async prepareOnce(signal: AbortSignal): Promise<RuntimeStatus> {
    try {
      throwIfAborted(signal)
      this.report({ stage: 'checking', message: 'Verificando o ambiente local…' })
      let status = await this.status(signal)

      if (status.setupAction === 'install-engine') {
        await this.installEngine(signal)
      }

      if (!status.connected) {
        const started = await this.ensureRunning(signal)
        if (!started) throw new Error('O Ollama foi instalado, mas o serviço local não iniciou.')
      }

      status = await this.status(signal)
      if (!status.modelInstalled) {
        const settings = await waitWithAbort(this.settings.get(), signal)
        await this.pullModel(settings, signal)
      }

      status = await this.status(signal)
      this.report({ stage: 'ready', message: 'IA local pronta para conversar.', percent: 100 })
      return status
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        this.report({ stage: 'cancelled', message: 'Preparação da IA local interrompida.' })
        throw abortError(signal)
      }
      const message = error instanceof Error ? error.message : 'Falha ao preparar a IA local.'
      this.report({ stage: 'error', message })
      throw error
    }
  }

  private async installEngine(signal: AbortSignal): Promise<void> {
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
        }),
        signal
      )
      throwIfAborted(signal)
      await verifyOllamaSignature(installerPath, signal)
      this.report({ stage: 'installing-engine', message: 'Instalando o Ollama no seu perfil do Windows…' })
      await runProcess(
        installerPath,
        ['/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES'],
        10 * 60_000,
        undefined,
        signal
      )
    } finally {
      await unlink(installerPath).catch(() => undefined)
    }
  }

  private async pullModel(settings: TitiSettings, signal: AbortSignal): Promise<void> {
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
      },
      signal
    )
  }
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, milliseconds))
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, milliseconds)
    const abort = (): void => {
      clearTimeout(timer)
      reject(abortError(signal))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
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

function launchBackground(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  signal?: AbortSignal
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const child = spawn(executable, args, {
      detached: false,
      windowsHide: true,
      shell: false,
      stdio: 'ignore',
      env: environment
    })
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve(child)
    }
    const abort = (): void => {
      if (child.exitCode === null && !child.killed) child.kill()
      finish(abortError(signal))
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.once('spawn', () => {
      child.unref()
      finish()
    })
    child.once('error', (error) => finish(error))
  })
}

async function waitForOllama(
  endpoint: string,
  timeout: number,
  signal?: AbortSignal
): Promise<boolean> {
  const tagsUrl = ollamaTagsUrl(endpoint)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    throwIfAborted(signal)
    const attempt = timeoutSignal(1000, signal)
    try {
      const response = await fetch(tagsUrl, {
        signal: attempt.signal
      })
      if (response.ok) return true
    } catch (error) {
      if (signal?.aborted) throw abortError(signal)
      // O serviço ainda está iniciando.
    } finally {
      attempt.cleanup()
    }
    await delay(500, signal)
  }
  return false
}

export function ollamaTagsUrl(endpoint: string): string {
  const parsed = new URL(endpoint.trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('O endereço do Ollama precisa usar HTTP ou HTTPS.')
  }
  parsed.username = ''
  parsed.password = ''
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/api/tags`
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

async function downloadFile(
  url: string,
  destination: string,
  onProgress: (percent?: number) => void,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal)
  const response = await fetch(url, { signal })
  if (!response.ok || !response.body) throw new Error(`Download do Ollama falhou: HTTP ${response.status}.`)
  const total = Number(response.headers.get('content-length') ?? 0)
  const file = await open(destination, 'w')
  const reader = response.body.getReader()
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      throwIfAborted(signal)
      await file.write(value)
      received += value.byteLength
      onProgress(total ? Math.round((received / total) * 100) : undefined)
    }
  } finally {
    await file.close()
  }
}

async function verifyOllamaSignature(path: string, signal?: AbortSignal): Promise<void> {
  const script = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $args[0]",
    "if ($signature.Status -ne 'Valid') { exit 1 }",
    "if ($signature.SignerCertificate.Subject -notmatch '(^|, )O=Ollama Inc\\.(,|$)') { exit 2 }"
  ].join('; ')
  await runProcess(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script, path],
    60_000,
    undefined,
    signal
  )
}

function runProcess(
  executable: string,
  args: string[],
  timeout: number,
  onOutput?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const child = spawn(executable, args, {
      detached: false,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let errorOutput = ''
    let settled = false
    let terminationError: Error | null = null
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve()
    }
    const timer = setTimeout(() => {
      terminationError = new Error('A preparação local excedeu o tempo limite.')
      if (!child.kill()) finish(terminationError)
    }, timeout)
    const abort = (): void => {
      terminationError = abortError(signal)
      if (!child.kill()) finish(terminationError)
    }
    signal?.addEventListener('abort', abort, { once: true })
    const collect = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      errorOutput = `${errorOutput}${text}`.slice(-5000)
      onOutput?.(text)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => {
      finish(error)
    })
    child.on('close', (code) => {
      if (terminationError) {
        finish(terminationError)
        return
      }
      if (code === 0) finish()
      else finish(new Error(errorOutput.trim().split(/\r?\n/).at(-1) || `Processo encerrado com código ${code}.`))
    })
  })
}

function waitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  throwIfAborted(signal)
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(abortError(signal))
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

function linkAbortSignal(
  signal: AbortSignal | undefined,
  controller: AbortController
): () => void {
  if (!signal) return () => undefined
  const abort = (): void => controller.abort(signal.reason)
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  return () => signal.removeEventListener('abort', abort)
}

function timeoutSignal(
  milliseconds: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup(): void } {
  const controller = new AbortController()
  const unlink = linkAbortSignal(externalSignal, controller)
  const timer = setTimeout(() => controller.abort(new Error('Tempo limite excedido.')), milliseconds)
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      unlink()
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  return cancellationError()
}

function cancellationError(): Error {
  const error = new Error('A preparação local foi interrompida.')
  error.name = 'AbortError'
  return error
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

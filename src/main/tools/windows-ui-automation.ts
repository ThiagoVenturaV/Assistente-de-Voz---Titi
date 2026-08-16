import { spawn } from 'node:child_process'

export interface UiControlSnapshot {
  name: string
  controlType: string
  automationId: string
  enabled: boolean
}

export interface ComputerObservation {
  application: string
  windowTitle: string
  processName: string
  controls: UiControlSnapshot[]
}

export interface ComputerInvocation {
  application: string
  windowTitle: string
  processName: string
  invoked: true
  control: UiControlSnapshot
}

export interface ComputerVisualCapture {
  application: string
  windowTitle: string
  processName: string
  width: number
  height: number
  imageBase64: string
  focusImageBase64?: string
}

export interface ComputerVisualClick {
  application: string
  windowTitle: string
  processName: string
  clicked: true
  x: number
  y: number
}

export interface DesktopScreenCapture {
  index: number
  primary: boolean
  left: number
  top: number
  width: number
  height: number
  imageWidth: number
  imageHeight: number
  imageBase64: string
}

export interface ComputerDesktopCapture {
  screenCount: number
  screens: DesktopScreenCapture[]
}

export interface ComputerController {
  observe(application: string, signal?: AbortSignal): Promise<ComputerObservation>
  invoke(
    application: string,
    target: string,
    controlType?: string,
    signal?: AbortSignal
  ): Promise<ComputerInvocation>
  capture(application: string, signal?: AbortSignal): Promise<ComputerVisualCapture>
  captureDesktop?(signal?: AbortSignal): Promise<ComputerDesktopCapture>
  click(application: string, x: number, y: number, signal?: AbortSignal): Promise<ComputerVisualClick>
}

export interface UiAutomationProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type UiAutomationProcessRunner = (
  args: string[],
  signal?: AbortSignal
) => Promise<UiAutomationProcessResult>

const MAX_APPLICATION_LENGTH = 80
const MAX_TARGET_LENGTH = 120
const ALLOWED_CONTROL_TYPES = new Set([
  'Button',
  'CheckBox',
  'Hyperlink',
  'ListItem',
  'MenuItem',
  'RadioButton',
  'TabItem'
])

export class WindowsUiAutomationController implements ComputerController {
  constructor(
    private readonly scriptPath: string,
    private readonly runner: UiAutomationProcessRunner = runPowerShell
  ) {}

  async observe(application: string, signal?: AbortSignal): Promise<ComputerObservation> {
    const safeApplication = requiredUiLabel(application, 'application', MAX_APPLICATION_LENGTH)
    const result = await this.runner([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-Operation',
      'observe',
      '-Application',
      safeApplication
    ], signal)
    return parseObservation(result)
  }

  async invoke(
    application: string,
    target: string,
    controlType?: string,
    signal?: AbortSignal
  ): Promise<ComputerInvocation> {
    const safeApplication = requiredUiLabel(application, 'application', MAX_APPLICATION_LENGTH)
    const safeTarget = requiredUiLabel(target, 'target', MAX_TARGET_LENGTH)
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-Operation',
      'invoke',
      '-Application',
      safeApplication,
      '-Target',
      safeTarget
    ]
    if (controlType) {
      if (!ALLOWED_CONTROL_TYPES.has(controlType)) {
        throw new Error('O tipo de controle solicitado não é permitido.')
      }
      args.push('-ControlType', controlType)
    }
    const result = await this.runner(args, signal)
    return parseInvocation(result)
  }

  async capture(application: string, signal?: AbortSignal): Promise<ComputerVisualCapture> {
    const safeApplication = requiredUiLabel(application, 'application', MAX_APPLICATION_LENGTH)
    const result = await this.runner([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-Operation',
      'capture',
      '-Application',
      safeApplication
    ], signal)
    return parseCapture(result)
  }

  async captureDesktop(signal?: AbortSignal): Promise<ComputerDesktopCapture> {
    const result = await this.runner([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-Operation',
      'capture-desktop',
      '-Application',
      'Desktop'
    ], signal)
    return parseDesktopCapture(result)
  }

  async click(
    application: string,
    x: number,
    y: number,
    signal?: AbortSignal
  ): Promise<ComputerVisualClick> {
    const safeApplication = requiredUiLabel(application, 'application', MAX_APPLICATION_LENGTH)
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      throw new Error('As coordenadas do clique são inválidas.')
    }
    const result = await this.runner([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      this.scriptPath,
      '-Operation',
      'click',
      '-Application',
      safeApplication,
      '-X',
      String(x),
      '-Y',
      String(y)
    ], signal)
    return parseClick(result)
  }
}

function parseObservation(result: UiAutomationProcessResult): ComputerObservation {
  const value = parseProcessJson(result)
  if (
    typeof value.application !== 'string'
    || typeof value.windowTitle !== 'string'
    || typeof value.processName !== 'string'
    || !Array.isArray(value.controls)
  ) throw new Error('A observação da interface retornou dados inválidos.')

  return {
    application: safeOutput(value.application, MAX_APPLICATION_LENGTH),
    windowTitle: safeOutput(value.windowTitle, 160),
    processName: safeOutput(value.processName, 100),
    controls: value.controls.slice(0, 120).map(parseControl)
  }
}

function parseInvocation(result: UiAutomationProcessResult): ComputerInvocation {
  const value = parseProcessJson(result)
  if (
    value.invoked !== true
    || typeof value.application !== 'string'
    || typeof value.windowTitle !== 'string'
    || typeof value.processName !== 'string'
  ) throw new Error('A automação não confirmou que o controle foi acionado.')

  return {
    application: safeOutput(value.application, MAX_APPLICATION_LENGTH),
    windowTitle: safeOutput(value.windowTitle, 160),
    processName: safeOutput(value.processName, 100),
    invoked: true,
    control: parseControl(value.control)
  }
}

function parseCapture(result: UiAutomationProcessResult): ComputerVisualCapture {
  const value = parseProcessJson(result)
  const width = positiveInteger(value.width)
  const height = positiveInteger(value.height)
  if (
    typeof value.application !== 'string'
    || typeof value.windowTitle !== 'string'
    || typeof value.processName !== 'string'
    || !width
    || !height
    || typeof value.imageBase64 !== 'string'
    || value.imageBase64.length > 5_000_000
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.imageBase64)
  ) throw new Error('A captura visual retornou dados inválidos.')
  const focusImageBase64 = optionalBase64(value.focusImageBase64, 1_000_000)
  return {
    application: safeOutput(value.application, MAX_APPLICATION_LENGTH),
    windowTitle: safeOutput(value.windowTitle, 160),
    processName: safeOutput(value.processName, 100),
    width,
    height,
    imageBase64: value.imageBase64,
    ...(focusImageBase64 ? { focusImageBase64 } : {})
  }
}

function parseClick(result: UiAutomationProcessResult): ComputerVisualClick {
  const value = parseProcessJson(result)
  const x = nonNegativeInteger(value.x)
  const y = nonNegativeInteger(value.y)
  if (
    value.clicked !== true
    || typeof value.application !== 'string'
    || typeof value.windowTitle !== 'string'
    || typeof value.processName !== 'string'
    || x === null
    || y === null
  ) throw new Error('A automação visual não confirmou o clique.')
  return {
    application: safeOutput(value.application, MAX_APPLICATION_LENGTH),
    windowTitle: safeOutput(value.windowTitle, 160),
    processName: safeOutput(value.processName, 100),
    clicked: true,
    x,
    y
  }
}

function parseDesktopCapture(result: UiAutomationProcessResult): ComputerDesktopCapture {
  const value = parseProcessJson(result)
  if (
    !Number.isInteger(value.screenCount)
    || Number(value.screenCount) < 1
    || Number(value.screenCount) > 8
    || !Array.isArray(value.screens)
    || value.screens.length !== value.screenCount
  ) throw new Error('A captura dos monitores retornou dados inválidos.')

  const screens = value.screens.map((screen, expectedIndex): DesktopScreenCapture => {
    if (!isRecord(screen)) throw new Error('A captura retornou um monitor inválido.')
    const index = nonNegativeInteger(screen.index)
    const width = positiveInteger(screen.width)
    const height = positiveInteger(screen.height)
    const imageWidth = positiveInteger(screen.imageWidth)
    const imageHeight = positiveInteger(screen.imageHeight)
    if (
      index !== expectedIndex
      || typeof screen.primary !== 'boolean'
      || !Number.isInteger(screen.left)
      || !Number.isInteger(screen.top)
      || !width
      || !height
      || !imageWidth
      || !imageHeight
    ) throw new Error('A captura retornou a geometria de um monitor inválida.')
    const imageBase64 = optionalBase64(screen.imageBase64, 8_000_000)
    if (!imageBase64) throw new Error('A captura retornou a imagem de um monitor inválida.')
    return {
      index,
      primary: screen.primary,
      left: Number(screen.left),
      top: Number(screen.top),
      width,
      height,
      imageWidth,
      imageHeight,
      imageBase64
    }
  })
  return { screenCount: Number(value.screenCount), screens }
}

function parseControl(value: unknown): UiControlSnapshot {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.controlType !== 'string') {
    throw new Error('A interface retornou um controle inválido.')
  }
  return {
    name: safeOutput(value.name, MAX_TARGET_LENGTH),
    controlType: safeOutput(value.controlType, 40),
    automationId: typeof value.automationId === 'string' ? safeOutput(value.automationId, 120) : '',
    enabled: value.enabled === true
  }
}

function parseProcessJson(result: UiAutomationProcessResult): Record<string, unknown> {
  if (result.exitCode !== 0) {
    throw new Error(safeOutput(result.stderr, 300) || 'A automação da interface do Windows falhou.')
  }
  try {
    const value = JSON.parse(result.stdout.trim()) as unknown
    if (isRecord(value)) return value
  } catch {
    // Fall through to the stable public error below.
  }
  throw new Error('A automação da interface retornou uma resposta inválida.')
}

function requiredUiLabel(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim()
  if (
    !trimmed
    || trimmed.length > maxLength
    || /[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(trimmed)
  ) throw new Error(`Valor inválido para ${field}.`)
  return trimmed
}

function safeOutput(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null
}

function optionalBase64(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maxLength
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) throw new Error('A captura visual retornou um recorte inválido.')
  return value
}

async function runPowerShell(
  args: string[],
  signal?: AbortSignal
): Promise<UiAutomationProcessResult> {
  if (process.platform !== 'win32') {
    throw new Error('O controle da interface está disponível somente no Windows.')
  }
  if (signal?.aborted) throw abortError(signal)

  return await new Promise<UiAutomationProcessResult>((resolve, reject) => {
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString('utf8')
      return next.length > 6_000_000 ? next.slice(-6_000_000) : next
    }
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk) })
    const abort = (): void => {
      child.kill()
      reject(abortError(signal))
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.once('error', (error) => {
      signal?.removeEventListener('abort', abort)
      reject(error)
    })
    child.once('exit', (exitCode) => {
      signal?.removeEventListener('abort', abort)
      resolve({ exitCode: exitCode ?? 1, stdout, stderr })
    })
  })
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('A automação da interface foi interrompida.')
  error.name = 'AbortError'
  return error
}

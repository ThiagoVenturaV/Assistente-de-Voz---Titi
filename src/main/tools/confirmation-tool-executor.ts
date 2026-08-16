import type { ToolConfirmationRequest } from '../../shared/contracts'
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutor
} from './contracts'

export type ToolConfirmationDecisionStatus = 'approved' | 'denied' | 'expired' | 'cancelled'

export interface ToolConfirmationDecision {
  status: ToolConfirmationDecisionStatus
  requestId: string
}

export type ToolConfirmationPrompt = Omit<ToolConfirmationRequest, 'id' | 'expiresAt'>

export type ToolConfirmationRequester = (
  prompt: ToolConfirmationPrompt,
  context?: ToolExecutionContext
) => Promise<ToolConfirmationDecision>

type ToolRiskAssessment =
  | { kind: 'safe' }
  | { kind: 'sensitive'; prompt: ToolConfirmationPrompt }
  | { kind: 'blocked'; message: string }

const ANTIGRAVITY_APPLICATION_NAMES = new Set(['antigravity', 'anti gravity', 'anti draft'])
const BLOCKED_APPLICATION_NAMES = new Set([
  'cmd',
  'command prompt',
  'prompt de comando',
  'powershell',
  'pwsh',
  'terminal',
  'windows terminal',
  'regedit',
  'registry editor',
  'editor do registro',
  'script host',
  'wscript',
  'cscript',
  'mshta',
  'rundll32'
])
const SPOTIFY_ACTIONS = [
  'open',
  'search',
  'play',
  'pause',
  'play_pause',
  'next',
  'previous',
  'volume_up',
  'volume_down',
  'mute'
] as const
const COMPUTER_CONTROL_TYPES = [
  'Button',
  'CheckBox',
  'Hyperlink',
  'ListItem',
  'MenuItem',
  'RadioButton',
  'TabItem'
] as const
const BLOCKED_UI_APPLICATION_NAMES = new Set([
  ...BLOCKED_APPLICATION_NAMES,
  'titi',
  'windows security',
  'seguranca do windows',
  'task manager',
  'gerenciador de tarefas',
  'credential manager',
  'gerenciador de credenciais',
  '1password',
  'bitwarden',
  'keepass'
])

/**
 * Central safety boundary for every tool invocation.
 *
 * Keep this decorator immediately inside the audit decorator so approvals,
 * refusals and expirations are all recorded without performing side effects.
 */
export class ConfirmationToolExecutor implements ToolExecutor {
  readonly definitions: ToolDefinition[]

  constructor(
    private readonly delegate: ToolExecutor,
    private readonly requestConfirmation: ToolConfirmationRequester
  ) {
    this.definitions = delegate.definitions
  }

  async execute(
    name: string,
    argumentsValue: unknown,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    throwIfAborted(context?.signal)
    const assessment = assessToolRisk(name, argumentsValue)
    if (assessment.kind === 'blocked') {
      return {
        ok: false,
        status: 'failed',
        message: assessment.message,
        details: { confirmationStatus: 'blocked', risk: 'blocked' }
      }
    }
    if (assessment.kind === 'safe') {
      return context
        ? this.delegate.execute(name, argumentsValue, context)
        : this.delegate.execute(name, argumentsValue)
    }

    const decision = context
      ? await this.requestConfirmation(assessment.prompt, context)
      : await this.requestConfirmation(assessment.prompt)
    throwIfAborted(context?.signal)
    if (decision.status === 'approved') {
      // This second check closes the approve -> stop race before any effect.
      throwIfAborted(context?.signal)
      const result = context
        ? await this.delegate.execute(name, argumentsValue, context)
        : await this.delegate.execute(name, argumentsValue)
      return {
        ...result,
        details: {
          ...result.details,
          confirmationStatus: 'approved',
          requestId: decision.requestId,
          risk: assessment.prompt.risk
        }
      }
    }

    return {
      ok: false,
      status: decision.status === 'cancelled' ? 'cancelled' : 'failed',
      message: decision.status === 'expired'
        ? 'A ação não foi executada porque a confirmação expirou.'
        : decision.status === 'cancelled'
          ? 'A ação não foi executada porque a interação foi interrompida.'
          : 'A ação não foi executada porque você não permitiu.',
      details: {
        confirmationStatus: decision.status,
        requestId: decision.requestId,
        risk: assessment.prompt.risk
      }
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error('A interação foi interrompida antes da ferramenta.')
  error.name = 'AbortError'
  throw error
}

export function assessToolRisk(name: string, argumentsValue: unknown): ToolRiskAssessment {
  const args = parseArguments(argumentsValue)

  switch (name) {
    case 'current_datetime':
      return { kind: 'safe' }
    case 'open_application': {
      const application = safeApplicationName(args.application)
      if (!application) {
        return blocked('O nome do aplicativo é inválido. Informe somente o nome, sem caminho, comando ou argumentos.')
      }
      if (!ANTIGRAVITY_APPLICATION_NAMES.has(normalizeApplicationName(application))) {
        return { kind: 'safe' }
      }
      return antigravityConfirmation('open_application', 'abrir o aplicativo')
    }
    case 'spotify': {
      if (!isAllowedString(args.action, SPOTIFY_ACTIONS)) {
        return blocked('A ação solicitada para o aplicativo de música não é permitida.')
      }
      if (args.action === 'search' && !optionalString(args.query)) {
        return blocked('A busca foi bloqueada porque não informou o que pesquisar.')
      }
      return { kind: 'safe' }
    }
    case 'computer_observe': {
      const application = safeApplicationName(args.application)
      if (!application || BLOCKED_UI_APPLICATION_NAMES.has(normalizeApplicationName(application))) {
        return blocked('A observação foi bloqueada porque o nome do aplicativo é inválido ou protegido.')
      }
      return { kind: 'safe' }
    }
    case 'computer_action': {
      if (args.action !== 'click') {
        return blocked('A ação de interface solicitada não é permitida.')
      }
      const application = safeApplicationName(args.application)
      if (!application || BLOCKED_UI_APPLICATION_NAMES.has(normalizeApplicationName(application))) {
        return blocked('O Titi não pode controlar este aplicativo por segurança.')
      }
      const target = safeControlName(args.target)
      if (!target) {
        return blocked('O controle solicitado é inválido. Use exatamente um nome retornado pela observação da interface.')
      }
      if (args.controlType !== undefined && !isAllowedString(args.controlType, COMPUTER_CONTROL_TYPES)) {
        return blocked('O tipo de controle solicitado não é permitido.')
      }
      if (ANTIGRAVITY_APPLICATION_NAMES.has(normalizeApplicationName(application))) {
        return antigravityConfirmation('computer_action', `acionar “${safeLabel(target, 120)}”`)
      }
      return { kind: 'safe' }
    }
    case 'open_web':
      return assessWebNavigation(args)
    default:
      return blocked(`A ferramenta “${safeLabel(name)}” não é permitida pelo Titi.`)
  }
}

function assessWebNavigation(args: Record<string, unknown>): ToolRiskAssessment {
  const query = optionalString(args.query)
  const requestedUrl = optionalString(args.url)
  if (!query && !requestedUrl) return blocked('A navegação foi bloqueada porque não informou uma página ou busca.')

  if (query) {
    return { kind: 'safe' }
  }

  const destination = parseHttpDestination(requestedUrl ?? '')
  if (!destination) {
    return blocked('A navegação foi bloqueada porque o endereço não é HTTP ou HTTPS válido.')
  }
  return { kind: 'safe' }
}

function antigravityConfirmation(tool: string, action: string): ToolRiskAssessment {
  return sensitive(
    tool,
    'Permitir ação no Antigravity?',
    `O Titi quer ${action} no Antigravity.`,
    [
      'Durante a beta, o Antigravity é o único aplicativo que continua exigindo confirmação.',
      'A ação só será executada depois da sua permissão.'
    ]
  )
}

function sensitive(
  tool: string,
  title: string,
  description: string,
  consequences: string[]
): ToolRiskAssessment {
  return {
    kind: 'sensitive',
    prompt: {
      tool,
      risk: 'sensitive',
      title,
      description,
      consequences
    }
  }
}

function blocked(message: string): ToolRiskAssessment {
  return { kind: 'blocked', message }
}

function parseHttpDestination(value: string): { host: string; label: string } | null {
  const trimmed = value.trim()
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return null
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (
      !['http:', 'https:'].includes(parsed.protocol)
      || !parsed.hostname
      || parsed.username
      || parsed.password
    ) return null
    const host = safeLabel(parsed.hostname, 100)
    const path = parsed.pathname === '/' ? '' : safeLabel(parsed.pathname, 70)
    return { host, label: `${host}${path}` }
  } catch {
    return null
  }
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return isRecord(value) ? value : {}
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isAllowedString<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function safeApplicationName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (
    !trimmed
    || trimmed.length > 80
    || /[\\/\u0000-\u001f\u007f]/.test(trimmed)
    || /^[a-z]:/i.test(trimmed)
    || /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    || /\.(?:exe|lnk|cmd|bat|ps1|vbs|js)$/i.test(trimmed)
    || /(?:^|\s)(?:--?[\w-]+|\/[\w-]+)(?:\s|$)/.test(trimmed)
  ) return null

  return BLOCKED_APPLICATION_NAMES.has(normalizeApplicationName(trimmed))
    ? null
    : trimmed
}

function safeControlName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (
    !trimmed
    || trimmed.length > 120
    || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(trimmed)
  ) return null
  return trimmed
}

function normalizeApplicationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeLabel(value: string, limit = 80): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned
}

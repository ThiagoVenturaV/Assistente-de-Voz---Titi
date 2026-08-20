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

type ToolDefinitionRisk = Exclude<ToolDefinition['risk'], undefined>
type ToolRiskAssessment =
  | { kind: 'safe' }
  | { kind: 'sensitive'; prompt: ToolConfirmationPrompt }
  | { kind: 'blocked'; message: string }
type ToolRiskDecision = 'allow' | 'confirm' | 'block'

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

const SENSITIVE_COMPUTER_TARGET_PATTERNS = [
  /\bcomprar\b/i,
  /\bcompra\b/i,
  /\benviar\b/i,
  /\benviar(?:\s+(?:para|para\s+|de\s+)?(?:a|o)\s+)?(?:arquivo|mensagem|pix|email|e-?mail|fatura)?\b/i,
  /\bpublicar\b/i,
  /\bexclu(?:ir|uir)\b/i,
  /\bdeletar\b/i,
  /\bremover\b/i,
  /\b(pagament|pagar|billing|checkout|cartão|payment)\b/i,
  /\b(credencial|credenciais|senha|password|token)\b/i,
  /\b(account|conta|trocar\s+conta|mudar\s+conta|alterar\s+conta)\b/i,
  /\b(confirmar|confirm|aceitar|finalizar|finalizar\s+pedido|confirmar\s+pedido)\b/i,
  /\b(log\s*out|sair)\b/i,
  /\b(apagar|delete|remove|uninstall|instalar|instalação)\b/i
] as const

const PROMPT_INJECTION_PATTERNS = [
  /\bignore\b/i,
  /\bignore(?:ing)?\s+.*\binstructions\b/i,
  /\bdesconsidere\b/i,
  /\bignore\s+as\s+instru/i,
  /\bsegu[a-z]*\s+instru/i,
  /\bsystem\b/i,
  /\bassistant\b/i,
  /\bprompt\b/i,
  /\bjavascript:/i,
  /\bshell:/i,
  /\bcmd\b/i,
  /\bpowershell\b/i,
  /[`'"|;&|<>(){}[\]\\]/,
  /&&|\|\|/
] as const

const TOOL_RISK_POLICY: Record<ToolDefinitionRisk, { action: ToolRiskDecision, message?: string }> = {
  read: { action: 'allow' },
  reversible: { action: 'allow' },
  sensitive: { action: 'confirm' },
  destructive: { action: 'block', message: 'A ferramenta foi bloqueada pela política de segurança atual.' }
}

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
    const definition = this.delegate.definitions.find(({ function: tool }) => tool.name === name)
    if (!definition) {
      return {
        ok: false,
        status: 'failed',
        message: `A ferramenta “${safeLabel(name)}” não está registrada no executor.` ,
        details: { confirmationStatus: 'blocked', risk: 'blocked' }
      }
    }
    if (!definition.risk) {
      return {
        ok: false,
        status: 'failed',
        message: `A ferramenta “${safeLabel(name)}” está sem classificação de risco e foi bloqueada por segurança.`
      ,
        details: { confirmationStatus: 'blocked', risk: 'blocked' }
      }
    }
    const policy = TOOL_RISK_POLICY[definition.risk]
    if (policy.action === 'block') {
      return {
        ok: false,
        status: 'failed',
        message: policy.message ?? 'A ferramenta foi bloqueada pela política atual.',
        details: { confirmationStatus: 'blocked', risk: definition.risk }
      }
    }
    const assessment = assessToolRisk(name, argumentsValue)
    if (assessment.kind === 'blocked') {
      return {
        ok: false,
        status: 'failed',
        message: assessment.message,
        details: { confirmationStatus: 'blocked', risk: definition.risk }
      }
    }
    const confirmation: ToolConfirmationPrompt | null = assessment.kind === 'sensitive'
      ? assessment.prompt
      : policy.action === 'confirm'
        ? {
          tool: name,
          risk: 'sensitive',
          title: `Permitir ação em ${safeLabel(name)}?`,
          description: `O Titi quer executar a ferramenta ${safeLabel(name)}.`,
          consequences: [
            'A ação de maior risco em beta exige permissão explícita para reduzir efeitos indesejados.',
            'Se não tiver certeza, escolha Não permitir.'
          ]
        }
        : null

    if (assessment.kind === 'safe' && policy.action === 'allow') {
      return context
        ? this.delegate.execute(name, argumentsValue, context)
        : this.delegate.execute(name, argumentsValue)
    }

    if (!confirmation) {
      throw new Error(`A ferramenta “${safeLabel(name)}” entrou numa rota de segurança inválida.`)
    }

    const decision = context
      ? await this.requestConfirmation(confirmation, context)
      : await this.requestConfirmation(confirmation)
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
          risk: confirmation.risk
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
        risk: confirmation.risk
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
      if (!application || isBlockedUiApplication(application)) {
        return blocked('A observação foi bloqueada porque o nome do aplicativo é inválido ou protegido.')
      }
      return { kind: 'safe' }
    }
    case 'computer_look': {
      const goal = optionalString(args.goal)
      if (!goal || goal.length > 240) {
        return blocked('A observação visual foi bloqueada porque o objetivo é inválido.')
      }
      return { kind: 'safe' }
    }
    case 'computer_action': {
      if (args.action !== 'click') {
        return blocked('A ação de interface solicitada não é permitida.')
      }
      const application = safeApplicationName(args.application)
      if (!application || isBlockedUiApplication(application)) {
        return blocked('O Titi não pode controlar este aplicativo por segurança.')
      }
      const target = safeControlName(args.target)
      if (!target) {
        return blocked('O controle solicitado é inválido. Use exatamente um nome retornado pela observação da interface.')
      }
      if (isSensitiveComputerTarget(target)) {
        return blocked('A ação foi bloqueada por conter termo de alto risco para o controle solicitado.')
      }
      if (looksLikePromptInjection(target)) {
        return blocked('A ação foi bloqueada por conter texto com instruções fora do padrão da observação.')
      }
      if (args.controlType !== undefined && !isAllowedString(args.controlType, COMPUTER_CONTROL_TYPES)) {
        return blocked('O tipo de controle solicitado não é permitido.')
      }
      if (ANTIGRAVITY_APPLICATION_NAMES.has(normalizeApplicationName(application))) {
        return antigravityConfirmation('computer_action', `acionar “${safeLabel(target, 120)}”`)
      }
      return sensitive(
        'computer_action',
        'Permitir ação na interface?',
        `O Titi quer acionar “${safeLabel(target, 120)}” em ${safeLabel(application, 80)}.`,
        [
          'O controle pode produzir um efeito externo que não é possível inferir apenas pelo texto visível.',
          'A ação será vinculada à mesma janela e ao mesmo controle que acabaram de ser observados.'
        ]
      )
    }
    case 'focus_window':
    case 'minimize_window': {
      const application = safeApplicationName(args.application)
      if (!application || isBlockedUiApplication(application)) {
        return blocked('A ação de janela foi bloqueada porque o nome do aplicativo é inválido ou protegido.')
      }
      const windowTitle = safeWindowTitle(args.windowTitle)
      if (windowTitle === null) {
        return blocked('O título da janela informado é inválido.')
      }
      return { kind: 'safe' }
    }
    case 'close_window': {
      const application = safeApplicationName(args.application)
      if (!application || isBlockedUiApplication(application)) {
        return blocked('A ação de janela foi bloqueada porque o nome do aplicativo é inválido ou protegido.')
      }
      const windowTitle = safeWindowTitle(args.windowTitle)
      if (windowTitle === null) {
        return blocked('O título da janela informado é inválido.')
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
      'O Antigravity e outras ações sensíveis de interface exigem confirmação explícita.',
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

function isSensitiveComputerTarget(value: string): boolean {
  const normalized = safeLabel(value).toLocaleLowerCase('pt-BR')
  return SENSITIVE_COMPUTER_TARGET_PATTERNS.some((pattern) => pattern.test(normalized))
}

function looksLikePromptInjection(value: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value))
}

function safeWindowTitle(value: unknown): string | null {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 160 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(trimmed)) return null
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

function isBlockedUiApplication(value: string): boolean {
  const normalized = normalizeApplicationName(value)
  if (BLOCKED_UI_APPLICATION_NAMES.has(normalized)) return true
  if (normalized.length < 4) return false
  return [...BLOCKED_UI_APPLICATION_NAMES].some((blocked) => (
    blocked.startsWith(`${normalized} `)
    || blocked.endsWith(` ${normalized}`)
    || normalized.startsWith(`${blocked} `)
  ))
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

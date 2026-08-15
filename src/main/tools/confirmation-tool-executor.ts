import type { ToolConfirmationRequest } from '../../shared/contracts'
import type { ToolDefinition, ToolExecutionResult, ToolExecutor } from './contracts'

export type ToolConfirmationDecisionStatus = 'approved' | 'denied' | 'expired'

export interface ToolConfirmationDecision {
  status: ToolConfirmationDecisionStatus
  requestId: string
}

export type ToolConfirmationPrompt = Omit<ToolConfirmationRequest, 'id' | 'expiresAt'>

export type ToolConfirmationRequester = (
  prompt: ToolConfirmationPrompt
) => Promise<ToolConfirmationDecision>

type ToolRiskAssessment =
  | { kind: 'safe' }
  | { kind: 'sensitive'; prompt: ToolConfirmationPrompt }
  | { kind: 'blocked'; message: string }

const KNOWN_APPLICATION_ALIASES = new Set([
  'chrome',
  'google chrome',
  'brave',
  'brave browser',
  'spotify',
  'chatgpt',
  'chat gpt',
  'codex',
  'codex app',
  'antigravity',
  'anti gravity'
])
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
  'play_pause',
  'next',
  'previous',
  'volume_up',
  'volume_down',
  'mute'
] as const

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

  async execute(name: string, argumentsValue: unknown): Promise<ToolExecutionResult> {
    const assessment = assessToolRisk(name, argumentsValue)
    if (assessment.kind === 'blocked') {
      return {
        ok: false,
        message: assessment.message,
        details: { confirmationStatus: 'blocked', risk: 'blocked' }
      }
    }
    if (assessment.kind === 'safe') return this.delegate.execute(name, argumentsValue)

    const decision = await this.requestConfirmation(assessment.prompt)
    if (decision.status === 'approved') {
      const result = await this.delegate.execute(name, argumentsValue)
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
      message: decision.status === 'expired'
        ? 'A ação não foi executada porque a confirmação expirou.'
        : 'A ação não foi executada porque você não permitiu.',
      details: {
        confirmationStatus: decision.status,
        requestId: decision.requestId,
        risk: assessment.prompt.risk
      }
    }
  }
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
      const knownApplication = KNOWN_APPLICATION_ALIASES.has(normalizeApplicationName(application))
      return sensitive(
        'open_application',
        'Abrir este aplicativo?',
        `O Titi quer localizar e abrir “${safeLabel(application, 80)}”.`,
        [
          'O Titi procurará somente nos aplicativos registrados e pastas confiáveis do Windows.',
          knownApplication
            ? 'Confirme que este é o aplicativo que você pediu.'
            : 'Se um processo correspondente for confirmado, ele poderá guardar localmente essa forma segura para a próxima vez.'
        ]
      )
    }
    case 'spotify': {
      if (!isAllowedString(args.action, SPOTIFY_ACTIONS)) {
        return blocked('A ação solicitada para o aplicativo de música não é permitida.')
      }
      if (args.action === 'open') {
        return sensitive(
          'spotify',
          'Abrir este aplicativo?',
          'O Titi quer localizar e abrir o aplicativo de música.',
          [
            'O Titi procurará somente nos aplicativos registrados e pastas confiáveis do Windows.',
            'Confirme que este é o aplicativo que você pediu.'
          ]
        )
      }
      if (args.action !== 'search') return { kind: 'safe' }
      const query = optionalString(args.query)
      if (!query) return blocked('A busca foi bloqueada porque não informou o que pesquisar.')
      return sensitive(
        'spotify',
        'Pesquisar no aplicativo de música?',
        `O Titi quer pesquisar por “${safeLabel(query, 120)}”.`,
        ['O aplicativo de música será aberto.', 'O termo da busca será enviado ao serviço de música.']
      )
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
    const label = safeLabel(query, 120)
    return sensitive(
      'open_web',
      'Pesquisar na web?',
      `O Titi quer pesquisar por “${label}” no navegador.`,
      ['Seu navegador será aberto.', 'A busca será enviada ao mecanismo de pesquisa.']
    )
  }

  const destination = parseHttpDestination(requestedUrl ?? '')
  if (!destination) {
    return blocked('A navegação foi bloqueada porque o endereço não é HTTP ou HTTPS válido.')
  }
  return sensitive(
    'open_web',
    'Abrir esta página?',
    `O Titi quer abrir ${destination.label} no navegador.`,
    ['Seu navegador será aberto.', `O computador se conectará ao site ${destination.host}.`]
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
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null
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

import type {
  DiagnosticSummary,
  RuntimeStatus,
  TitiSettings,
  ToolActionLogEntry
} from '../../shared/contracts'

export interface DiagnosticReportInput {
  summary: DiagnosticSummary
  settings: TitiSettings
  runtime: RuntimeStatus | null
  activity: ToolActionLogEntry[]
}

export interface DiagnosticReport {
  schemaVersion: 1
  product: 'Titi'
  generatedAt: string
  privacy: {
    generatedManually: true
    automaticUpload: false
    includesConversations: false
    includesToolArguments: false
    includesPersonalPaths: false
    includesDeviceIdentifiers: false
  }
  summary: DiagnosticSummary
  configuration: {
    historyEnabled: boolean
    computerControlEnabled: boolean
    launchAtStartup: boolean
    floatingMascotEnabled: boolean
    gameStandbyEnabled: boolean
    configuredGameCount: number
  }
  runtime: {
    provider: 'ollama'
    endpointScope: 'loopback' | 'local-network' | 'custom-redacted'
    model: string
    connected: boolean | null
    engineInstalled: boolean | null
    modelInstalled: boolean | null
    setupAction: RuntimeStatus['setupAction'] | null
    availableModelCount: number | null
    checkedAt: string | null
  }
  recentActivity: Array<{
    tool: string
    status: ToolActionLogEntry['status'] | 'unknown'
    ok: boolean
    durationMs: number
    createdAt: string
  }>
}

export function buildDiagnosticReport(input: DiagnosticReportInput): DiagnosticReport {
  return {
    schemaVersion: 1,
    product: 'Titi',
    generatedAt: new Date().toISOString(),
    privacy: {
      generatedManually: true,
      automaticUpload: false,
      includesConversations: false,
      includesToolArguments: false,
      includesPersonalPaths: false,
      includesDeviceIdentifiers: false
    },
    summary: {
      ...input.summary,
      runtime: {
        ...input.summary.runtime,
        model: safeIdentifier(input.summary.runtime.model, 'modelo personalizado (nome omitido)')
      }
    },
    configuration: {
      historyEnabled: input.settings.keepHistory,
      computerControlEnabled: input.settings.computerControlEnabled,
      launchAtStartup: input.settings.launchAtStartup,
      floatingMascotEnabled: input.settings.showFloatingMascot,
      gameStandbyEnabled: input.settings.games.standbyEnabled,
      configuredGameCount: input.settings.games.executables.length
    },
    runtime: {
      provider: 'ollama',
      endpointScope: classifyEndpoint(input.settings.provider.endpoint),
      model: safeIdentifier(input.settings.provider.model, 'modelo personalizado (nome omitido)'),
      connected: input.runtime?.connected ?? null,
      engineInstalled: input.runtime?.engineInstalled ?? null,
      modelInstalled: input.runtime?.modelInstalled ?? null,
      setupAction: input.runtime?.setupAction ?? null,
      availableModelCount: input.runtime?.availableModels.length ?? null,
      checkedAt: safeIsoDate(input.runtime?.checkedAt)
    },
    recentActivity: input.activity.slice(0, 50).map((entry) => ({
      tool: safeIdentifier(entry.tool, 'ferramenta-desconhecida'),
      status: entry.status ?? 'unknown',
      ok: entry.ok,
      durationMs: Math.max(0, Math.round(entry.durationMs)),
      createdAt: safeIsoDate(entry.createdAt) ?? 'invalid-date'
    }))
  }
}

function safeIdentifier(value: string, fallback: string): string {
  const normalized = value.trim()
  return /^[a-zA-Z0-9_.:+-]{1,80}$/.test(normalized) ? normalized : fallback
}

function safeIsoDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function classifyEndpoint(endpoint: string): DiagnosticReport['runtime']['endpointScope'] {
  try {
    const parsed = new URL(endpoint)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
      return 'loopback'
    }
    if (
      parsed.hostname.startsWith('10.')
      || parsed.hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname)
    ) return 'local-network'
  } catch {
    // A URL original nunca entra no relatório.
  }
  return 'custom-redacted'
}

import type { ActionLogStore } from '../storage/action-log-store'
import type { ToolDefinition, ToolExecutionResult, ToolExecutor } from './contracts'

const SENSITIVE_KEY = /api[-_]?key|authorization|cookie|password|secret|token|query|url/i

export class AuditedToolExecutor implements ToolExecutor {
  readonly definitions: ToolDefinition[]

  constructor(
    private readonly delegate: ToolExecutor,
    private readonly actions: ActionLogStore,
    private readonly shouldRecord: () => Promise<boolean> = async () => true
  ) {
    this.definitions = delegate.definitions
  }

  async execute(name: string, argumentsValue: unknown): Promise<ToolExecutionResult> {
    const startedAt = performance.now()
    let result: ToolExecutionResult
    try {
      result = await this.delegate.execute(name, argumentsValue)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A ferramenta falhou de forma inesperada.'
      await this.record({
        tool: name,
        arguments: redactSensitive(argumentsValue),
        ok: false,
        message: auditMessage(name, message, false),
        durationMs: Math.round(performance.now() - startedAt)
      })
      throw error
    }

    await this.record({
      tool: name,
      arguments: redactSensitive(argumentsValue),
      ok: result.ok,
      message: auditMessage(name, result.message, result.ok),
      details: redactSensitive(result.details),
      durationMs: Math.round(performance.now() - startedAt)
    })
    return result
  }

  private async record(
    entry: Parameters<ActionLogStore['record']>[0]
  ): Promise<void> {
    const enabled = await this.shouldRecord().catch(() => false)
    if (!enabled) return
    await this.actions.record(entry).catch(() => undefined)
  }
}

export function auditMessage(tool: string, message: string, ok: boolean): string {
  if (tool === 'open_web') {
    return ok ? 'Página ou pesquisa aberta.' : 'Não foi possível abrir a página ou pesquisa.'
  }
  if (tool === 'spotify' && /pesquis/i.test(message)) {
    return ok ? 'Pesquisa aberta no aplicativo de música.' : 'Não foi possível pesquisar no aplicativo de música.'
  }
  return redactUrls(message)
}

function redactUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s)\]}>,]+/gi, '[endereço oculto]')
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[oculto]' : redactSensitive(item)
  ]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

import type {
  ChatMessage,
  DiagnosticSelfTestModelResult,
  TitiSettings
} from '../../shared/contracts'
import { OllamaProvider } from '../harness/ollama-provider'
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutor
} from '../tools/contracts'

const CURRENT_DATETIME_DEFINITION: ToolDefinition = {
  type: 'function',
  risk: 'read',
  execution: { timeoutMs: 5_000, sideEffect: 'none' },
  function: {
    name: 'current_datetime',
    description: 'Consulta a data, a hora e o fuso atuais deste computador.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
}

export interface GuidedSelfTestOptions {
  settings: TitiSettings
  signal?: AbortSignal
  now?: () => Date
}

/**
 * Runs an isolated model/tool probe. It intentionally does not receive the
 * conversation store, the normal desktop toolkit, confirmations or audit log.
 */
export async function runGuidedSelfTestModelProbe({
  settings,
  signal,
  now = () => new Date()
}: GuidedSelfTestOptions): Promise<DiagnosticSelfTestModelResult> {
  const executor = new CurrentDatetimeProbeExecutor(now)
  const provider = new OllamaProvider(executor)
  const startedAt = performance.now()
  const messages: ChatMessage[] = [{
    id: 'guided-self-test-request',
    role: 'user',
    content: 'Consulte a data e a hora atuais deste computador usando a ferramenta disponível.',
    createdAt: now().toISOString()
  }]

  await provider.complete(
    messages,
    settings,
    signal,
    'guided-self-test'
  )
  const toolResult = executor.lastResult
  if (!toolResult) {
    throw new Error('O modelo respondeu sem chamar a ferramenta segura do autoteste.')
  }
  if (!toolResult.ok) {
    throw new Error(toolResult.message || 'A ferramenta segura do autoteste falhou.')
  }

  return {
    model: settings.provider.model,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    tool: {
      name: 'current_datetime',
      called: true,
      ok: true,
      message: 'Consulta segura de data e hora concluída.'
    }
  }
}

export class CurrentDatetimeProbeExecutor implements ToolExecutor {
  readonly definitions = [CURRENT_DATETIME_DEFINITION]
  lastResult: ToolExecutionResult | null = null

  constructor(private readonly now: () => Date = () => new Date()) {}

  async execute(
    name: string,
    _argumentsValue: unknown,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (context?.signal?.aborted) throw abortError(context.signal)
    if (name !== 'current_datetime') {
      const result: ToolExecutionResult = {
        ok: false,
        status: 'failed',
        message: 'O autoteste bloqueou uma ferramenta fora da sonda segura.'
      }
      this.lastResult = result
      return result
    }

    const date = this.now()
    const result: ToolExecutionResult = {
      ok: true,
      status: 'confirmed',
      message: `Data e hora locais: ${date.toLocaleString('pt-BR')}.`
    }
    this.lastResult = result
    return result
  }
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason
  const error = new Error('O autoteste foi interrompido.')
  error.name = 'AbortError'
  return error
}

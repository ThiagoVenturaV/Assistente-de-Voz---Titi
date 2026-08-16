import { randomUUID } from 'node:crypto'
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutor
} from './contracts'

const DEFAULT_TOOL_TIMEOUT_MS = 15_000

export interface ToolInvocationSeed {
  chainId?: string
  runId?: string
  requestId?: string
  round?: number
  attempt?: number
}

/**
 * Runs every tool through the same deadline, cancellation and result contract.
 * The AbortSignal reaches the real executor so cancellation is more than merely
 * abandoning the caller's wait.
 */
export async function executeToolWithControl(
  tools: ToolExecutor,
  name: string,
  argumentsValue: Record<string, unknown>,
  seed: ToolInvocationSeed = {},
  externalSignal?: AbortSignal
): Promise<ToolExecutionResult> {
  const definition = tools.definitions.find(({ function: value }) => value.name === name)
  const timeoutMs = Math.max(250, definition?.execution?.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS)
  const controller = new AbortController()
  let timedOut = false
  const abortFromExternal = (): void => controller.abort(externalSignal?.reason)
  if (externalSignal?.aborted) abortFromExternal()
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(timeoutError())
  }, timeoutMs)
  const chainId = seed.chainId ?? seed.requestId ?? randomUUID()
  const context: ToolExecutionContext = {
    chainId,
    runId: seed.runId ?? randomUUID(),
    ...(seed.requestId ? { requestId: seed.requestId } : {}),
    round: seed.round ?? 1,
    attempt: seed.attempt ?? 1,
    timeoutMs,
    signal: controller.signal
  }

  try {
    const result = await waitWithAbort(
      safelyExecuteTool(tools, name, argumentsValue, context),
      controller.signal
    )
    return normalizeToolResult(result)
  } catch (error) {
    if (!timedOut && externalSignal?.aborted) throw abortError(externalSignal)
    if (!timedOut) throw error
    return {
      ok: false,
      status: 'timed_out',
      message: definition?.execution?.sideEffect === 'external'
        ? `A ferramenta ${name} excedeu ${timeoutMs} ms. O efeito pode ter começado, então não vou repeti-la automaticamente.`
        : `A ferramenta ${name} excedeu ${timeoutMs} ms e foi interrompida.`,
      details: {
        code: 'tool_timeout',
        timeoutMs,
        effectState: definition?.execution?.sideEffect === 'external'
          ? 'may_have_occurred'
          : 'not_started'
      }
    }
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abortFromExternal)
  }
}

async function safelyExecuteTool(
  tools: ToolExecutor,
  name: string,
  argumentsValue: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const result = await tools.execute(name, argumentsValue, context)
    if (
      typeof result?.ok !== 'boolean'
      || typeof result.message !== 'string'
      || !result.message.trim()
    ) {
      return failure(`A ferramenta ${name} retornou um resultado inválido.`, 'invalid_tool_result')
    }
    return result
  } catch (error) {
    if (context.signal?.aborted) throw abortError(context.signal)
    const reason = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'erro inesperado'
    return failure(`A ferramenta ${name} falhou: ${reason}.`, 'tool_execution_failed')
  }
}

function normalizeToolResult(result: ToolExecutionResult): ToolExecutionResult {
  const status = result.status ?? (result.ok ? 'confirmed' : 'failed')
  return status === 'confirmed'
    ? { ...result, ok: true, status }
    : { ...result, ok: false, status }
}

function failure(message: string, code: string): ToolExecutionResult {
  return { ok: false, status: 'failed', message, details: { code } }
}

function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(abortError(signal))
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason
  const error = new Error('A interação foi interrompida.')
  error.name = 'AbortError'
  return error
}

function timeoutError(): Error {
  const error = new Error('A ferramenta excedeu o tempo limite.')
  error.name = 'TimeoutError'
  return error
}

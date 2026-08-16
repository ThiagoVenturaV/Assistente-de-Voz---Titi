export interface ToolDefinition {
  type: 'function'
  execution?: {
    timeoutMs: number
    sideEffect: 'none' | 'external'
  }
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export type ToolExecutionStatus =
  | 'confirmed'
  | 'dispatched'
  | 'failed'
  | 'cancelled'
  | 'timed_out'

export interface ToolExecutionContext {
  chainId: string
  runId: string
  requestId?: string
  round: number
  attempt: number
  timeoutMs: number
  signal?: AbortSignal
}

export interface ToolExecutionResult {
  ok: boolean
  message: string
  status?: ToolExecutionStatus
  details?: Record<string, unknown>
}

export interface ToolExecutor {
  readonly definitions: ToolDefinition[]
  execute(
    name: string,
    argumentsValue: unknown,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult>
}

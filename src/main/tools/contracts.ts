export interface ToolDefinition {
  type: 'function'
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

export interface ToolExecutionResult {
  ok: boolean
  message: string
  details?: Record<string, unknown>
}

export interface ToolExecutor {
  readonly definitions: ToolDefinition[]
  execute(name: string, argumentsValue: unknown): Promise<ToolExecutionResult>
}

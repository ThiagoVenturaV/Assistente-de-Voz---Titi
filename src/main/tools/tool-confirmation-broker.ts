import { randomUUID } from 'node:crypto'
import type { ToolConfirmationRequest, ToolConfirmationResponse } from '../../shared/contracts'
import type {
  ToolConfirmationDecision,
  ToolConfirmationPrompt
} from './confirmation-tool-executor'

interface PendingConfirmation {
  resolve: (decision: ToolConfirmationDecision) => void
  timeout: NodeJS.Timeout
}

export class ToolConfirmationBroker {
  private readonly pending = new Map<string, PendingConfirmation>()

  constructor(
    private readonly dispatch: (request: ToolConfirmationRequest) => void,
    private readonly timeoutMs = 45_000
  ) {}

  request(prompt: ToolConfirmationPrompt): Promise<ToolConfirmationDecision> {
    const id = randomUUID()
    const request: ToolConfirmationRequest = {
      ...prompt,
      id,
      expiresAt: new Date(Date.now() + this.timeoutMs).toISOString()
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        resolve({ status: 'expired', requestId: id })
      }, this.timeoutMs)
      this.pending.set(id, { resolve, timeout })
      this.dispatch(request)
    })
  }

  respond(response: ToolConfirmationResponse): boolean {
    const confirmation = this.pending.get(response.requestId)
    if (!confirmation) return false
    clearTimeout(confirmation.timeout)
    this.pending.delete(response.requestId)
    confirmation.resolve({
      status: response.approved ? 'approved' : 'denied',
      requestId: response.requestId
    })
    return true
  }

  cancelAll(): void {
    for (const [requestId, confirmation] of this.pending) {
      clearTimeout(confirmation.timeout)
      confirmation.resolve({ status: 'denied', requestId })
    }
    this.pending.clear()
  }
}

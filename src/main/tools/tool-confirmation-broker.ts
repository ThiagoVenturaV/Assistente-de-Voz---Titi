import { randomUUID } from 'node:crypto'
import type { ToolConfirmationRequest, ToolConfirmationResponse } from '../../shared/contracts'
import type {
  ToolConfirmationDecision,
  ToolConfirmationPrompt
} from './confirmation-tool-executor'

interface PendingConfirmation {
  resolve: (decision: ToolConfirmationDecision) => void
  timeout: NodeJS.Timeout
  signal?: AbortSignal
  abort?: () => void
}

export class ToolConfirmationBroker {
  private readonly pending = new Map<string, PendingConfirmation>()

  constructor(
    private readonly dispatch: (request: ToolConfirmationRequest) => void,
    private readonly timeoutMs = 45_000,
    private readonly dismiss: (requestId: string) => void = () => undefined
  ) {}

  request(
    prompt: ToolConfirmationPrompt,
    signal?: AbortSignal
  ): Promise<ToolConfirmationDecision> {
    const id = randomUUID()
    if (signal?.aborted) {
      return Promise.resolve({ status: 'cancelled', requestId: id })
    }
    const request: ToolConfirmationRequest = {
      ...prompt,
      id,
      expiresAt: new Date(Date.now() + this.timeoutMs).toISOString()
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.settle(id, 'expired')
      }, this.timeoutMs)
      const abort = signal ? (): void => {
        this.settle(id, 'cancelled')
      } : undefined
      this.pending.set(id, { resolve, timeout, signal, abort })
      signal?.addEventListener('abort', abort!, { once: true })
      this.dispatch(request)
    })
  }

  respond(response: ToolConfirmationResponse): boolean {
    const confirmation = this.pending.get(response.requestId)
    if (!confirmation) return false
    this.settle(response.requestId, response.approved ? 'approved' : 'denied')
    return true
  }

  cancelAll(): void {
    for (const requestId of [...this.pending.keys()]) this.settle(requestId, 'cancelled')
  }

  private settle(
    requestId: string,
    status: ToolConfirmationDecision['status']
  ): boolean {
    const confirmation = this.pending.get(requestId)
    if (!confirmation) return false
    clearTimeout(confirmation.timeout)
    if (confirmation.abort) {
      confirmation.signal?.removeEventListener('abort', confirmation.abort)
    }
    this.pending.delete(requestId)
    try {
      this.dismiss(requestId)
    } catch {
      // A camada visual nunca pode impedir a decisão de segurança de concluir.
    }
    confirmation.resolve({ status, requestId })
    return true
  }
}

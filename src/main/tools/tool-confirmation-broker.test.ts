import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolConfirmationRequest } from '../../shared/contracts'
import type { ToolConfirmationPrompt } from './confirmation-tool-executor'
import { ToolConfirmationBroker } from './tool-confirmation-broker'

const prompt: ToolConfirmationPrompt = {
  tool: 'open_web',
  risk: 'sensitive',
  title: 'Abrir esta página?',
  description: 'O Titi quer abrir example.com.',
  consequences: ['Seu navegador será aberto.']
}

afterEach(() => vi.useRealTimers())

describe('ToolConfirmationBroker', () => {
  it('aceita apenas uma resposta ligada a uma solicitação pendente', async () => {
    let sent: ToolConfirmationRequest | undefined
    const broker = new ToolConfirmationBroker((request) => { sent = request })
    const decisionPromise = broker.request(prompt)

    expect(sent).toBeDefined()
    expect(broker.respond({ requestId: 'desconhecida', approved: true })).toBe(false)
    expect(broker.respond({ requestId: sent!.id, approved: true })).toBe(true)
    await expect(decisionPromise).resolves.toEqual({
      status: 'approved',
      requestId: sent!.id
    })
    expect(broker.respond({ requestId: sent!.id, approved: true })).toBe(false)
  })

  it('expira sem aprovação e ignora respostas atrasadas', async () => {
    vi.useFakeTimers()
    let sent: ToolConfirmationRequest | undefined
    const broker = new ToolConfirmationBroker((request) => { sent = request }, 1_000)
    const decisionPromise = broker.request(prompt)

    await vi.advanceTimersByTimeAsync(1_001)

    await expect(decisionPromise).resolves.toEqual({
      status: 'expired',
      requestId: sent!.id
    })
    expect(broker.respond({ requestId: sent!.id, approved: true })).toBe(false)
  })

  it('cancela pendências quando o aplicativo encerra', async () => {
    let sent: ToolConfirmationRequest | undefined
    const broker = new ToolConfirmationBroker((request) => { sent = request })
    const decisionPromise = broker.request(prompt)

    broker.cancelAll()

    await expect(decisionPromise).resolves.toEqual({
      status: 'cancelled',
      requestId: sent!.id
    })
  })

  it('cancela somente a confirmação ligada ao sinal e dispensa a modal', async () => {
    const requests: ToolConfirmationRequest[] = []
    const dismiss = vi.fn()
    const broker = new ToolConfirmationBroker((request) => requests.push(request), 45_000, dismiss)
    const controller = new AbortController()
    const first = broker.request(prompt, controller.signal)
    const second = broker.request(prompt)

    controller.abort()

    await expect(first).resolves.toMatchObject({ status: 'cancelled' })
    expect(dismiss).toHaveBeenCalledWith(requests[0].id)
    expect(broker.respond({ requestId: requests[1].id, approved: true })).toBe(true)
    await expect(second).resolves.toMatchObject({ status: 'approved' })
  })
})

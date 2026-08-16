import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolExecutor } from './contracts'
import { executeToolWithControl } from './tool-execution-controller'

afterEach(() => vi.useRealTimers())

describe('executeToolWithControl', () => {
  it('aborta o executor real e informa efeito possível ao exceder o timeout', async () => {
    vi.useFakeTimers()
    let observedAbort = false
    const tools = fakeTools((_name, _args, context) => new Promise((_resolve, reject) => {
      context?.signal?.addEventListener('abort', () => {
        observedAbort = true
        reject(context.signal?.reason)
      }, { once: true })
    }))

    const pending = executeToolWithControl(tools, 'external_action', {})
    await vi.advanceTimersByTimeAsync(1_001)

    await expect(pending).resolves.toMatchObject({
      ok: false,
      status: 'timed_out',
      details: { effectState: 'may_have_occurred', timeoutMs: 1_000 }
    })
    expect(observedAbort).toBe(true)
  })

  it('normaliza despacho sem evidência para ok false', async () => {
    const tools = fakeTools(async () => ({
      ok: true,
      status: 'dispatched',
      message: 'Pedido aceito pelo sistema.'
    }))

    await expect(executeToolWithControl(tools, 'external_action', {})).resolves.toMatchObject({
      ok: false,
      status: 'dispatched'
    })
  })

  it('propaga cancelamento externo ao executor e não o converte em falha comum', async () => {
    const controller = new AbortController()
    const tools = fakeTools((_name, _args, context) => new Promise((_resolve, reject) => {
      context?.signal?.addEventListener('abort', () => reject(context.signal?.reason), { once: true })
    }))

    const pending = executeToolWithControl(tools, 'external_action', {}, {}, controller.signal)
    controller.abort(abortError())

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

function fakeTools(execute: ToolExecutor['execute']): ToolExecutor {
  return {
    definitions: [{
      type: 'function',
      execution: { timeoutMs: 1_000, sideEffect: 'external' },
      function: {
        name: 'external_action',
        description: 'Executa um efeito externo.',
        parameters: { type: 'object', properties: {} }
      }
    }],
    execute
  }
}

function abortError(): Error {
  const error = new Error('cancelado')
  error.name = 'AbortError'
  return error
}

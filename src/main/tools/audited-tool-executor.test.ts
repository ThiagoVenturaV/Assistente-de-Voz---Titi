import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionLogStore } from '../storage/action-log-store'
import type { ToolExecutor } from './contracts'
import { auditMessage, AuditedToolExecutor, redactSensitive } from './audited-tool-executor'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('AuditedToolExecutor', () => {
  it('registra o resultado da ferramenta sem expor segredos', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-audited-tool-'))
    directories.push(directory)
    const store = new ActionLogStore(directory)
    const delegate: ToolExecutor = {
      definitions: [],
      execute: async () => ({
        ok: true,
        message: 'Concluído.',
        details: { authorization: 'não guardar', confirmationStatus: 'approved' }
      })
    }
    const executor = new AuditedToolExecutor(delegate, store)

    await executor.execute('teste', { query: 'Titi', apiKey: 'não guardar' })

    expect((await store.list())[0]).toMatchObject({
      tool: 'teste',
      arguments: { query: '[oculto]', apiKey: '[oculto]' },
      ok: true,
      message: 'Concluído.',
      details: { authorization: '[oculto]', confirmationStatus: 'approved' }
    })
  })

  it('não muda o resultado real se a gravação da auditoria falhar', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-audited-tool-'))
    directories.push(directory)
    const store = new ActionLogStore(directory)
    vi.spyOn(store, 'record').mockRejectedValue(new Error('disco indisponível'))
    const execute = vi.fn(async () => ({ ok: true, message: 'Página aberta.' }))
    const executor = new AuditedToolExecutor({ definitions: [], execute }, store)

    await expect(executor.execute('open_web', { url: 'https://example.com' }))
      .resolves.toEqual({ ok: true, message: 'Página aberta.' })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('não persiste atividade durante uma sessão sem histórico', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-audited-tool-'))
    directories.push(directory)
    const store = new ActionLogStore(directory)
    const executor = new AuditedToolExecutor(
      { definitions: [], execute: async () => ({ ok: true, message: 'Concluído.' }) },
      store,
      async () => false
    )

    await executor.execute('current_datetime', {})
    await expect(store.list()).resolves.toEqual([])
  })

  it('registra efeito externo cancelado como possivelmente iniciado', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-audited-tool-'))
    directories.push(directory)
    const store = new ActionLogStore(directory)
    const controller = new AbortController()
    const executor = new AuditedToolExecutor({
      definitions: [{
        type: 'function',
        execution: { timeoutMs: 1_000, sideEffect: 'external' },
        function: {
          name: 'open_web',
          description: 'Abre uma página.',
          parameters: { type: 'object', properties: {} }
        }
      }],
      execute: async (_name, _arguments, context) => new Promise((_resolve, reject) => {
        context?.signal?.addEventListener('abort', () => reject(context.signal?.reason), { once: true })
      })
    }, store)
    const pending = executor.execute('open_web', {}, {
      chainId: 'chain-1',
      runId: 'run-1',
      round: 1,
      attempt: 1,
      timeoutMs: 1_000,
      signal: controller.signal
    })

    controller.abort(abortError())
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({
        status: 'cancelled',
        chainId: 'chain-1',
        runId: 'run-1',
        details: { effectState: 'may_have_occurred' }
      })
    ])
  })
})

describe('redactSensitive', () => {
  it('oculta segredos também em objetos e listas aninhadas', () => {
    expect(redactSensitive({ nested: [{ authorization: 'Bearer x', value: 1 }] })).toEqual({
      nested: [{ authorization: '[oculto]', value: 1 }]
    })
  })

  it('oculta URLs e termos de busca dos dados estruturados', () => {
    expect(redactSensitive({
      url: 'https://example.com/?token=segredo',
      query: 'assunto privado',
      browser: 'brave'
    })).toEqual({ url: '[oculto]', query: '[oculto]', browser: 'brave' })
  })

  it('não grava destinos ou pesquisas dentro da mensagem da ferramenta', () => {
    expect(auditMessage('open_web', 'Página aberta: https://example.com/?token=x.', true))
      .toBe('Página ou pesquisa aberta.')
    expect(auditMessage('spotify', 'Pesquisa aberta no Spotify: assunto privado.', true))
      .toBe('Pesquisa aberta no aplicativo de música.')
    expect(auditMessage('open_web', 'Página aberta: https://example.com.', false, 'dispatched'))
      .toBe('Pedido de página ou pesquisa enviado; efeito não confirmado.')
  })
})

function abortError(): Error {
  const error = new Error('Interrompido.')
  error.name = 'AbortError'
  return error
}

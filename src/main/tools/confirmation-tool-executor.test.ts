import { describe, expect, it, vi } from 'vitest'
import type { ToolExecutor } from './contracts'
import {
  assessToolRisk,
  ConfirmationToolExecutor,
  type ToolConfirmationRequester
} from './confirmation-tool-executor'

function makeDelegate(): ToolExecutor & { execute: ReturnType<typeof vi.fn> } {
  return {
    definitions: [],
    execute: vi.fn(async () => ({ ok: true, message: 'Executada.' }))
  }
}

describe('ConfirmationToolExecutor', () => {
  it('executa uma ação segura sem abrir confirmação', async () => {
    const delegate = makeDelegate()
    const confirm = vi.fn<ToolConfirmationRequester>()
    const executor = new ConfirmationToolExecutor(delegate, confirm)

    await expect(executor.execute('current_datetime', {})).resolves.toMatchObject({ ok: true })
    expect(confirm).not.toHaveBeenCalled()
    expect(delegate.execute).toHaveBeenCalledOnce()
  })

  it('só executa uma navegação sensível depois de aprovação', async () => {
    const delegate = makeDelegate()
    const confirm: ToolConfirmationRequester = async () => ({
      status: 'approved',
      requestId: 'approval-1'
    })
    const executor = new ConfirmationToolExecutor(delegate, confirm)

    await expect(executor.execute('open_web', { url: 'https://example.com/docs' }))
      .resolves.toMatchObject({ ok: true })
    expect(delegate.execute).toHaveBeenCalledWith('open_web', { url: 'https://example.com/docs' })
  })

  it.each(['denied', 'expired'] as const)('não produz efeito quando a confirmação é %s', async (status) => {
    const delegate = makeDelegate()
    const executor = new ConfirmationToolExecutor(delegate, async () => ({
      status,
      requestId: 'approval-2'
    }))

    const result = await executor.execute('open_web', { query: 'notícias locais' })

    expect(result).toMatchObject({
      ok: false,
      details: { confirmationStatus: status, requestId: 'approval-2', risk: 'sensitive' }
    })
    expect(delegate.execute).not.toHaveBeenCalled()
  })

  it('bloqueia ferramentas desconhecidas antes do executor real', async () => {
    const delegate = makeDelegate()
    const executor = new ConfirmationToolExecutor(delegate, vi.fn())

    const result = await executor.execute('run_arbitrary_shell', { command: 'do not run' })

    expect(result).toMatchObject({ ok: false, details: { confirmationStatus: 'blocked' } })
    expect(delegate.execute).not.toHaveBeenCalled()
  })

  it('também confirma antes de enviar uma busca ao serviço de música', async () => {
    const delegate = makeDelegate()
    const confirm = vi.fn<ToolConfirmationRequester>(async () => ({
      status: 'denied',
      requestId: 'approval-spotify'
    }))
    const executor = new ConfirmationToolExecutor(delegate, confirm)

    const result = await executor.execute('spotify', { action: 'search', query: 'música ambiente' })

    expect(result).toMatchObject({ ok: false, details: { confirmationStatus: 'denied' } })
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ tool: 'spotify' }))
    expect(delegate.execute).not.toHaveBeenCalled()
  })

  it('pede confirmação antes de descobrir um aplicativo novo pelo nome', async () => {
    const delegate = makeDelegate()
    const confirm = vi.fn<ToolConfirmationRequester>(async () => ({
      status: 'approved',
      requestId: 'approval-new-app'
    }))
    const executor = new ConfirmationToolExecutor(delegate, confirm)

    await expect(executor.execute('open_application', { application: 'Novo Editor' }))
      .resolves.toMatchObject({ ok: true })
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'open_application',
      title: 'Abrir este aplicativo?'
    }))
    expect(delegate.execute).toHaveBeenCalledWith('open_application', {
      application: 'Novo Editor'
    })
  })

  it.each([
    'C:\\Windows\\System32\\cmd.exe',
    'powershell',
    'Prompt de Comando',
    'Windows Terminal',
    'editor.exe',
    'file:///C:/Windows/notepad.exe',
    'Editor --disable-security'
  ])('bloqueia caminho, shell ou argumento disfarçado de aplicativo: %s', async (application) => {
    const delegate = makeDelegate()
    const confirm = vi.fn<ToolConfirmationRequester>()
    const executor = new ConfirmationToolExecutor(delegate, confirm)

    await expect(executor.execute('open_application', { application }))
      .resolves.toMatchObject({ ok: false, details: { confirmationStatus: 'blocked' } })
    expect(confirm).not.toHaveBeenCalled()
    expect(delegate.execute).not.toHaveBeenCalled()
  })
})

describe('assessToolRisk', () => {
  it('gera uma explicação curta e compreensível sem expor a query completa da URL', () => {
    expect(assessToolRisk('open_web', {
      url: 'https://example.com/documentation?token=segredo'
    })).toMatchObject({
      kind: 'sensitive',
      prompt: {
        title: 'Abrir esta página?',
        description: 'O Titi quer abrir example.com/documentation no navegador.'
      }
    })
  })

  it('bloqueia protocolos que podem acionar recursos locais', () => {
    expect(assessToolRisk('open_web', { url: 'file:///C:/Users/teste/segredo.txt' }))
      .toMatchObject({ kind: 'blocked' })
  })

  it('confirma tanto aliases conhecidos quanto nomes novos', () => {
    expect(assessToolRisk('open_application', { application: 'ChatGPT' }))
      .toMatchObject({ kind: 'sensitive', prompt: { tool: 'open_application' } })
    expect(assessToolRisk('open_application', { application: 'Editor recém-lançado' }))
      .toMatchObject({ kind: 'sensitive', prompt: { tool: 'open_application' } })
  })

  it('não deixa a ferramenta de música abrir o aplicativo sem confirmação', () => {
    expect(assessToolRisk('spotify', { action: 'open' }))
      .toMatchObject({ kind: 'sensitive', prompt: { tool: 'spotify' } })
    expect(assessToolRisk('spotify', { action: 'play_pause' }))
      .toEqual({ kind: 'safe' })
  })
})

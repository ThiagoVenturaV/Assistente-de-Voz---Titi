import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import type { ChatMessage } from '../../shared/contracts'
import type { ToolExecutor } from '../tools/contracts'
import { OllamaProvider } from './ollama-provider'

const messages: ChatMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    content: 'Que horas são?',
    createdAt: new Date(0).toISOString()
  }
]

describe('OllamaProvider tool calling', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('aborta uma geração local pendente', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })))
    const provider = new OllamaProvider(fakeTools(vi.fn()))

    const pending = provider.complete(messages, DEFAULT_SETTINGS, controller.signal)
    await Promise.resolve()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('mantém cancelamento ativo enquanto o corpo JSON ainda está pendente', async () => {
    let bodyStarted = false
    vi.stubGlobal('fetch', vi.fn((_input: unknown, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        bodyStarted = true
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    } as Response)))
    const controller = new AbortController()
    const provider = new OllamaProvider(fakeTools(vi.fn()))

    const pending = provider.complete(messages, DEFAULT_SETTINGS, controller.signal)
    await vi.waitFor(() => expect(bodyStarted).toBe(true))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('aborta enquanto uma ferramenta ainda aguarda sem executar rodadas seguintes', async () => {
    let release!: () => void
    const execute = vi.fn(() => new Promise<{ ok: true; message: string }>((resolve) => {
      release = () => resolve({ ok: true, message: 'Ação tardia.' })
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      message: {
        role: 'assistant',
        tool_calls: [{ type: 'function', function: { name: 'current_datetime', arguments: {} } }]
      }
    })))
    const controller = new AbortController()
    const provider = new OllamaProvider(fakeTools(execute))

    const pending = provider.complete(messages, DEFAULT_SETTINGS, controller.signal)
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledOnce()
    release()
  })

  it('executes tool calls and returns the trusted tool outcome', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'sexta-feira, 10:30' }))
    const tools = fakeTools(execute)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ type: 'function', function: { name: 'current_datetime', arguments: {} } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Agora são 10:30.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(tools)
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('sexta-feira, 10:30')
    expect(execute).toHaveBeenCalledWith(
      'current_datetime',
      {},
      expect.objectContaining({
        chainId: expect.any(String),
        runId: expect.any(String),
        round: 1,
        attempt: 1,
        signal: expect.any(AbortSignal)
      })
    )

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { tools: unknown[] }
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      messages: Array<{ role: string; tool_name?: string; content?: string }>
    }
    expect(firstBody.tools).toHaveLength(6)
    expect(secondBody.messages).toContainEqual(expect.objectContaining({
      role: 'tool',
      tool_name: 'current_datetime',
      content: expect.stringContaining('sexta-feira')
    }))
  })

  it('does not let the model contradict a failed tool result', async () => {
    const execute = vi.fn(async () => ({ ok: false, message: 'Aplicativo não encontrado.' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{ type: 'function', function: { name: 'open_application', arguments: { application: 'codex' } } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Codex aberto com sucesso.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(messages, DEFAULT_SETTINGS)
    expect(answer).toBe('Não consegui executar essa ação. Aplicativo não encontrado.')
    expect(answer).not.toContain('aberto com sucesso')

    const finalBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { messages: Array<{ content?: string }> }
    expect(finalBody.messages.at(-1)?.content).toContain('"ok":false')
  })

  it('recovers a natural compound action after the model only promises to act', async () => {
    const actionMessages: ChatMessage[] = [{
      id: 'natural-action',
      role: 'user',
      content: 'Titi, o Spotify não está rodando; abre ele e dá play na minha playlist.',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn(async (name: string) => name === 'open_application'
      ? { ok: false, status: 'dispatched' as const, message: 'Spotify solicitado ao Windows.' }
      : { ok: true, status: 'confirmed' as const, message: 'A música começou a tocar no Spotify.' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Vou abrir o Spotify e tocar agora mesmo.' }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            decision: 'needs_tool', confidence: 0.98, reason: 'Pedido de ação composto.'
          })
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              { type: 'function', function: { name: 'open_application', arguments: '{"application":"spotify"}' } },
              { type: 'function', function: { name: 'spotify', arguments: '{"action":"play"}' } }
            ]
          }
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Spotify aberto e tocando.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(actionMessages, DEFAULT_SETTINGS)

    expect(answer).toContain('Pedido enviado, ainda sem confirmação do efeito. Spotify solicitado ao Windows.')
    expect(answer).toContain('A música começou a tocar no Spotify.')
    expect(answer).not.toContain('Vou abrir')
    expect(execute.mock.calls.map(([name]) => name)).toEqual(['open_application', 'spotify'])
    expect(String(fetchMock.mock.calls[2][0])).toContain('/v1/chat/completions')
    const forcedBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body)) as {
      tool_choice?: string
      messages: Array<{ role: string; content: string }>
    }
    expect(forcedBody.tool_choice).toBe('required')
    expect(forcedBody.messages.at(-1)?.content).toContain('AUDITORIA INTERNA')
  })

  it('recovers a tool call when the first native model response is completely empty', async () => {
    const actionMessages: ChatMessage[] = [{
      id: 'empty-native-action',
      role: 'user',
      content: 'Abre o Spotify e dá play.',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn(async () => ({
      ok: true,
      status: 'confirmed' as const,
      message: 'A música começou a tocar no Spotify.'
    }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: '' }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            decision: 'needs_tool', confidence: 0.99, reason: 'Pedido direto de ação.'
          })
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              type: 'function',
              function: { name: 'spotify', arguments: '{"action":"play"}' }
            }]
          }
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: '[SEM_FERRAMENTA] Pronto.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(actionMessages, DEFAULT_SETTINGS)).resolves.toBe(
      'A música começou a tocar no Spotify.'
    )
    expect(execute).toHaveBeenCalledWith(
      'spotify',
      { action: 'play' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(String(fetchMock.mock.calls[2][0])).toContain('/v1/chat/completions')
  })

  it('strips the no-tool marker without adding a classifier round', async () => {
    const execute = vi.fn()
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      message: {
        role: 'assistant',
        content: '[SEM_FERRAMENTA] O Spotify é um serviço de música.'
      }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe(
      'O Spotify é um serviço de música.'
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(execute).not.toHaveBeenCalled()
  })

  it('accepts an unmarked conversational answer only after local classification', async () => {
    const execute = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Uma explicação normal.' }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({ decision: 'respond', confidence: 0.95, reason: 'Pergunta conceitual.' })
        }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Uma explicação normal.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns an obviously conversational answer without a classifier round', async () => {
    const conceptualMessages: ChatMessage[] = [{
      id: 'clear-conversation',
      role: 'user',
      content: 'Me explica o que é o Spotify.',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn()
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      message: { role: 'assistant', content: 'O Spotify é um serviço de música e podcasts.' }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(conceptualMessages, DEFAULT_SETTINGS)).resolves.toBe(
      'O Spotify é um serviço de música e podcasts.'
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(execute).not.toHaveBeenCalled()
  })

  it('blocks an unnecessary tool call when the semantic classifier identifies conversation', async () => {
    const conceptualMessages: ChatMessage[] = [{
      id: 'conceptual-question',
      role: 'user',
      content: 'Me explica o que é o Spotify.',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: 'O Spotify é um serviço de streaming de música.',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_web', arguments: { query: 'O que é Spotify?' } }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({ decision: 'respond', confidence: 0.97, reason: 'Explicação.' })
        }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(conceptualMessages, DEFAULT_SETTINGS)).resolves.toBe(
      'O Spotify é um serviço de streaming de música.'
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('retries as conversation when an empty false-positive tool call is blocked', async () => {
    const conceptualMessages: ChatMessage[] = [{
      id: 'empty-false-positive',
      role: 'user',
      content: 'Qual a diferença entre Brave e Chrome?',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_web', arguments: { query: 'Brave versus Chrome' } }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({ decision: 'respond', confidence: 0.98, reason: 'Comparação conceitual.' })
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: '[SEM_FERRAMENTA] Brave bloqueia mais rastreadores por padrão; Chrome prioriza integração com o ecossistema Google.'
        }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(conceptualMessages, DEFAULT_SETTINGS)).resolves.toBe(
      'Brave bloqueia mais rastreadores por padrão; Chrome prioriza integração com o ecossistema Google.'
    )
    expect(execute).not.toHaveBeenCalled()
    const conversationBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body)) as {
      tools?: unknown[]
      messages: Array<{ content?: string }>
    }
    expect(conversationBody.tools).toBeUndefined()
    expect(conversationBody.messages.at(-1)?.content).toContain('sem ferramentas')
  })

  it('renders observed controls and keeps the same chain for a following UI action', async () => {
    const uiMessages: ChatMessage[] = [{
      id: 'observe-and-act',
      role: 'user',
      content: 'No Spotify, observe os controles e clique em Sua Biblioteca.',
      createdAt: new Date(0).toISOString()
    }]
    const execute = vi.fn(async (name: string, _arguments: unknown, _context?: unknown) => name === 'computer_observe'
      ? {
          ok: true,
          status: 'confirmed' as const,
          message: 'Controles observados.',
          details: {
            windowTitle: 'Spotify Premium',
            controls: [
              { name: 'Sua Biblioteca', controlType: 'Button', enabled: true },
              { name: 'Play', controlType: 'Button', enabled: true }
            ]
          }
        }
      : {
          ok: false,
          status: 'dispatched' as const,
          message: 'O controle “Sua Biblioteca” foi acionado.'
        })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'computer_observe', arguments: { application: 'Spotify' } }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: {
              name: 'computer_action',
              arguments: {
                action: 'click',
                application: 'Spotify',
                target: 'Sua Biblioteca',
                controlType: 'Button'
              }
            }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'A biblioteca foi aberta.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(uiMessages, DEFAULT_SETTINGS, undefined, 'ui-request')

    expect(answer).toContain('Controles visíveis em Spotify Premium')
    expect(answer).toContain('Sua Biblioteca (botão)')
    expect(answer).toContain('Play (botão)')
    expect(answer).toContain('O controle “Sua Biblioteca” foi acionado.')
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0][2]).toMatchObject({ chainId: 'ui-request', round: 1 })
    expect(execute.mock.calls[1][2]).toMatchObject({ chainId: 'ui-request', round: 2 })
  })

  it('never preserves a success promise when required tool calling still returns no call', async () => {
    const execute = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Vou fazer agora.' }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: JSON.stringify({ decision: 'needs_tool', confidence: 0.99, reason: 'Ação.' })
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { role: 'assistant', content: 'Pronto, concluído.' } }]
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(messages, DEFAULT_SETTINGS)
    expect(answer).toContain('Nenhuma ação foi executada')
    expect(answer).not.toContain('concluído')
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects unknown tools without invoking the executor', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'não deveria executar' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{ type: 'function', function: { name: 'delete_everything', arguments: {} } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Essa ferramenta não está disponível.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toContain('não existe')
    expect(execute).not.toHaveBeenCalled()

    const retryBody = requestBody(fetchMock, 1)
    expect(retryBody.messages.at(-1)?.content).toContain('"code":"unknown_tool"')
    expect(retryBody.messages.at(-1)?.content).toContain('delete_everything')
  })

  it('returns invalid JSON arguments to the model without running the tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'não deveria executar' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_application', arguments: '{"application":' }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Não consegui interpretar o aplicativo.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toContain('JSON inválido')
    expect(execute).not.toHaveBeenCalled()
    expect(requestBody(fetchMock, 1).messages.at(-1)?.content).toContain('JSON inválido')
  })

  it('validates required arguments and enum values before execution', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'não deveria executar' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{ type: 'function', function: { name: 'open_application', arguments: {} } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_application', arguments: { application: 'calculadora_inventada' } }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Preciso de um aplicativo válido.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toContain('argumento obrigatório')
    expect(execute).not.toHaveBeenCalled()
    expect(requestBody(fetchMock, 1).messages.at(-1)?.content).toContain('argumento obrigatório')
    expect(requestBody(fetchMock, 2).messages.at(-1)?.content).toContain('não é aceito')
  })

  it('turns executor exceptions into tool failures and keeps the conversation alive', async () => {
    const execute = vi.fn(async () => {
      throw new Error('acesso negado')
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{ type: 'function', function: { name: 'current_datetime', arguments: {} } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Não consegui consultar a hora.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe(
      'Não consegui executar essa ação. A ferramenta current_datetime falhou: acesso negado.'
    )
    expect(requestBody(fetchMock, 1).messages.at(-1)?.content).toContain('tool_execution_failed')
    expect(requestBody(fetchMock, 1).messages.at(-1)?.content).toContain('acesso negado')
  })

  it('does not execute the same tool call more than once', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'Página aberta.' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_web', arguments: { query: 'Titi', browser: 'default' } }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_web', arguments: '{"browser":"default","query":"Titi"}' }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'A página já foi aberta uma vez.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(messages, DEFAULT_SETTINGS)
    expect(answer).toContain('Página aberta.')
    expect(answer).toContain('não foi executada novamente')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(requestBody(fetchMock, 2).messages.at(-1)?.content).toContain('repeated_tool_call')
  })

  it('preserves a real tool outcome when the following model round fails', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'Brave aberto e confirmado.' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'open_application', arguments: { application: 'chrome' } }
          }]
        }
      }))
      .mockRejectedValueOnce(new Error('conexão caiu'))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const answer = await provider.complete(messages, DEFAULT_SETTINGS)

    expect(execute).toHaveBeenCalledOnce()
    expect(answer).toContain('Brave aberto e confirmado.')
    expect(answer).toContain('resposta local foi interrompida')
    expect(answer).toContain('conexão caiu')
  })

  it('stops a tool loop after five rounds with a useful response', async () => {
    const execute = vi.fn(async (_name: string, args: unknown) => ({
      ok: true,
      message: `Ação ${String((args as { attempt: number }).attempt)} concluída.`
    }))
    const fetchMock = vi.fn()
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{
            type: 'function',
            function: { name: 'current_datetime', arguments: { attempt } }
          }]
        }
      }))
    }
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    const result = await provider.complete(messages, DEFAULT_SETTINGS)

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(execute).toHaveBeenCalledTimes(5)
    expect(result).toContain('Ação 5 concluída.')
    expect(result).toContain('após 5 rodadas')
    expect(result).toContain('evitar um ciclo sem fim')
  })

  it('refuses an excessive batch before any side effect', async () => {
    const execute = vi.fn(async () => ({ ok: true, message: 'não deveria executar' }))
    const toolCalls = Array.from({ length: 9 }, (_, attempt) => ({
      type: 'function',
      function: { name: 'current_datetime', arguments: { attempt } }
    }))
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      message: { role: 'assistant', tool_calls: toolCalls }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toContain('no máximo 8 ações')
    expect(execute).not.toHaveBeenCalled()
  })
})

function fakeTools(execute: ToolExecutor['execute']): ToolExecutor {
  return {
    definitions: [
      {
        type: 'function',
        function: {
          name: 'current_datetime',
          description: 'Obtém data e hora.',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'open_application',
          description: 'Abre um aplicativo.',
          parameters: {
            type: 'object',
            required: ['application'],
            properties: {
              application: { type: 'string', enum: ['codex', 'chrome', 'spotify'] }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify',
          description: 'Abre o Spotify quando necessário e controla a reprodução.',
          parameters: {
            type: 'object',
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['play', 'pause'] }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'open_web',
          description: 'Abre uma página.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              browser: { type: 'string', enum: ['default', 'chrome'] }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'computer_observe',
          description: 'Observa controles de um aplicativo.',
          parameters: {
            type: 'object',
            required: ['application'],
            properties: { application: { type: 'string' } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'computer_action',
          description: 'Aciona um controle observado.',
          parameters: {
            type: 'object',
            required: ['action', 'application', 'target'],
            properties: {
              action: { type: 'string', enum: ['click'] },
              application: { type: 'string' },
              target: { type: 'string' },
              controlType: { type: 'string', enum: ['Button'] }
            }
          }
        }
      }
    ],
    execute
  }
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex: number
): { messages: Array<{ content?: string }> } {
  return JSON.parse(String(fetchMock.mock.calls[callIndex][1]?.body)) as {
    messages: Array<{ content?: string }>
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

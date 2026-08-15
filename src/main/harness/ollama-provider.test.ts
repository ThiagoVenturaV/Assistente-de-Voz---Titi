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

  it('executes tool calls and returns the final assistant response', async () => {
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Agora são 10:30.')
    expect(execute).toHaveBeenCalledWith('current_datetime', {})

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { tools: unknown[] }
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      messages: Array<{ role: string; tool_name?: string; content?: string }>
    }
    expect(firstBody.tools).toHaveLength(3)
    expect(secondBody.messages).toContainEqual(expect.objectContaining({
      role: 'tool',
      tool_name: 'current_datetime',
      content: expect.stringContaining('sexta-feira')
    }))
  })

  it('passes a failed tool result back to the model instead of claiming success', async () => {
    const execute = vi.fn(async () => ({ ok: false, message: 'Aplicativo não encontrado.' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          tool_calls: [{ type: 'function', function: { name: 'open_application', arguments: { application: 'codex' } } }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'Não encontrei o aplicativo instalado.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider(fakeTools(execute))
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Não encontrei o aplicativo instalado.')

    const finalBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { messages: Array<{ content?: string }> }
    expect(finalBody.messages.at(-1)?.content).toContain('"ok":false')
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Essa ferramenta não está disponível.')
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Não consegui interpretar o aplicativo.')
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Preciso de um aplicativo válido.')
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('Não consegui consultar a hora.')
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
    await expect(provider.complete(messages, DEFAULT_SETTINGS)).resolves.toBe('A página já foi aberta uma vez.')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(requestBody(fetchMock, 2).messages.at(-1)?.content).toContain('repeated_tool_call')
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
              application: { type: 'string', enum: ['codex', 'chrome'] }
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

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
    expect(firstBody.tools).toHaveLength(1)
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
})

function fakeTools(execute: ToolExecutor['execute']): ToolExecutor {
  return {
    definitions: [{
      type: 'function',
      function: {
        name: 'current_datetime',
        description: 'Obtém data e hora.',
        parameters: { type: 'object', properties: {} }
      }
    }],
    execute
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

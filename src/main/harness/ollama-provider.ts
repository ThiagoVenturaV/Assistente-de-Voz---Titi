import type {
  ChatMessage,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'
import type { AssistantProvider } from './provider'
import type { ToolExecutor } from '../tools/contracts'

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

interface OllamaToolCall {
  type?: 'function'
  function: {
    index?: number
    name: string
    arguments?: unknown
  }
}

interface OllamaMessage {
  role: string
  content?: string
  thinking?: string
  tool_calls?: OllamaToolCall[]
  tool_name?: string
}

interface OllamaChatResponse {
  message?: OllamaMessage
  error?: string
}

export class OllamaProvider implements AssistantProvider {
  constructor(private readonly tools: ToolExecutor) {}

  async status(settings: TitiSettings): Promise<RuntimeStatus> {
    const endpoint = normalizeEndpoint(settings.provider.endpoint)
    try {
      const response = await fetchWithTimeout(`${endpoint}/api/tags`, undefined, 2500)
      if (!response.ok) {
        throw new Error(`Ollama respondeu com HTTP ${response.status}`)
      }
      const payload = (await response.json()) as OllamaTagsResponse
      const availableModels = (payload.models ?? [])
        .map((model) => model.name ?? model.model ?? '')
        .filter(Boolean)
      const hasSelectedModel = availableModels.some(
        (model) => model === settings.provider.model
      )

      return {
        provider: 'ollama',
        connected: true,
        model: settings.provider.model,
        availableModels,
        message: hasSelectedModel
          ? 'Ollama conectado e modelo pronto.'
          : availableModels.length
            ? 'Ollama conectado. Selecione um dos modelos instalados.'
            : 'Ollama conectado, mas ainda não há modelos instalados.',
        checkedAt: new Date().toISOString()
      }
    } catch {
      return disconnectedStatus(settings.provider.model)
    }
  }

  async complete(
    messages: ChatMessage[],
    settings: TitiSettings
  ): Promise<string> {
    const endpoint = normalizeEndpoint(settings.provider.endpoint)
    const agentMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt(settings.mascotName) },
      ...messages.map(({ role, content }) => ({ role, content }))
    ]
    const completedActions: string[] = []

    for (let turn = 0; turn < 5; turn += 1) {
      const payload = await requestChat(endpoint, settings, agentMessages, this.tools)
      const message = payload.message
      if (!message) throw new Error('O modelo local não retornou uma mensagem.')

      const toolCalls = message.tool_calls ?? []
      if (!toolCalls.length) {
        const content = message.content?.trim()
        if (content) return content
        if (completedActions.length) return completedActions.join('\n')
        throw new Error('O modelo local retornou uma resposta vazia.')
      }

      agentMessages.push({
        role: 'assistant',
        content: message.content ?? '',
        ...(message.thinking ? { thinking: message.thinking } : {}),
        tool_calls: toolCalls
      })

      for (const call of toolCalls) {
        const result = await this.tools.execute(call.function.name, call.function.arguments)
        completedActions.push(result.message)
        agentMessages.push({
          role: 'tool',
          tool_name: call.function.name,
          content: JSON.stringify(result)
        })
      }
    }

    return completedActions.length
      ? completedActions.join('\n')
      : 'Não consegui concluir a ação solicitada.'
  }
}

function systemPrompt(mascotName: string): string {
  return [
    `Você é ${mascotName}, um assistente pessoal local para Windows.`,
    'Responda em português brasileiro, com clareza, simpatia e objetividade.',
    'Você possui ferramentas reais para abrir aplicativos, navegar na web, controlar mídia e consultar a hora.',
    'Sempre chame a ferramenta adequada quando o usuário pedir uma ação no computador; não responda apenas com instruções.',
    'Considere o resultado da ferramenta como a única fonte de verdade e nunca afirme que executou algo se ela falhar.',
    'Só execute uma ferramenta quando a solicitação do usuário deixar a ação clara.',
    'Ações sensíveis, destrutivas, compras, mensagens e operações fora das ferramentas disponíveis exigem confirmação e não devem ser improvisadas.'
  ].join(' ')
}

async function requestChat(
  endpoint: string,
  settings: TitiSettings,
  messages: OllamaMessage[],
  tools: ToolExecutor
): Promise<OllamaChatResponse> {
  const response = await fetchWithTimeout(
    `${endpoint}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.provider.model,
        stream: false,
        think: false,
        keep_alive: '5m',
        messages,
        tools: tools.definitions,
        options: {
          temperature: 0.2,
          num_ctx: 8192
        }
      })
    },
    120_000
  )

  const payload = (await response.json()) as OllamaChatResponse
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Falha local: HTTP ${response.status}`)
  }
  return payload
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function disconnectedStatus(model: string): RuntimeStatus {
  return {
    provider: 'ollama',
    connected: false,
    model,
    availableModels: [],
    message: 'O mecanismo local está desconectado. Instale ou inicie o Ollama para conversar com o modelo.',
    checkedAt: new Date().toISOString()
  }
}

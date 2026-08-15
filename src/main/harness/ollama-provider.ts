import type {
  ChatMessage,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'
import type { AssistantProvider } from './provider'

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

export class OllamaProvider implements AssistantProvider {
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
          messages: [
            {
              role: 'system',
              content: systemPrompt(settings.mascotName)
            },
            ...messages.map(({ role, content }) => ({ role, content }))
          ],
          options: {
            temperature: 0.55,
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

    const content = payload.message?.content?.trim()
    if (!content) {
      throw new Error('O modelo local retornou uma resposta vazia.')
    }
    return content
  }
}

function systemPrompt(mascotName: string): string {
  return [
    `Você é ${mascotName}, um assistente pessoal local para Windows.`,
    'Responda em português brasileiro, com clareza, simpatia e objetividade.',
    'Nunca afirme que executou uma ação no computador sem receber a confirmação do harness.',
    'Quando uma ação sensível for necessária, explique-a e aguarde confirmação.'
  ].join(' ')
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

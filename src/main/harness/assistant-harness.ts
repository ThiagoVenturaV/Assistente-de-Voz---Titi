import type {
  ChatRequest,
  ChatResponse,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'
import { ConversationStore } from '../storage/conversation-store'
import { SettingsStore } from '../storage/settings-store'
import { OllamaProvider } from './ollama-provider'
import type { AssistantProvider } from './provider'

export class AssistantHarness {
  private readonly provider: AssistantProvider

  constructor(
    private readonly settings: SettingsStore,
    private readonly conversations: ConversationStore
  ) {
    this.provider = new OllamaProvider()
  }

  async status(): Promise<RuntimeStatus> {
    return this.provider.status(await this.settings.get())
  }

  async send(request: ChatRequest): Promise<ChatResponse> {
    const content = request.content.trim()
    if (!content) {
      throw new Error('Escreva uma mensagem antes de enviar.')
    }

    const settings = await this.settings.get()
    const conversation = request.conversationId
      ? await this.conversations.get(request.conversationId)
      : await this.conversations.create()

    if (!conversation) {
      throw new Error('A conversa selecionada não existe mais.')
    }

    const withUser = await this.conversations.addMessage(
      conversation.id,
      'user',
      content
    )
    const runtime = await this.provider.status(settings)

    let answer: string
    if (!runtime.connected) {
      answer = offlineMessage(settings)
    } else if (!runtime.availableModels.includes(settings.provider.model)) {
      answer = missingModelMessage(settings, runtime)
    } else {
      try {
        answer = await this.provider.complete(withUser.conversation.messages, settings)
      } catch (error) {
        answer = `Não consegui concluir a resposta local. ${errorMessage(error)}`
      }
    }

    const withAssistant = await this.conversations.addMessage(
      conversation.id,
      'assistant',
      answer
    )

    return {
      conversation: withAssistant.conversation,
      assistantMessage: withAssistant.message,
      runtime
    }
  }
}

function offlineMessage(settings: TitiSettings): string {
  return [
    `Oi! Eu sou ${settings.mascotName}. Minha interface e memória local já estão funcionando.`,
    `Para ativar a conversa com IA nesta máquina, precisamos instalar o Ollama e baixar o modelo **${settings.provider.model}**.`,
    'Você pode conferir a conexão em **Configurações → Inteligência local**.'
  ].join('\n\n')
}

function missingModelMessage(
  settings: TitiSettings,
  runtime: RuntimeStatus
): string {
  const installed = runtime.availableModels.length
    ? `Modelos encontrados: ${runtime.availableModels.join(', ')}.`
    : 'Nenhum modelo foi encontrado.'
  return `O Ollama está conectado, mas o modelo **${settings.provider.model}** não está disponível. ${installed}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado.'
}

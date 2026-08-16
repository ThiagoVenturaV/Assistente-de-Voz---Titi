import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/defaults'
import type { ChatMessage } from '../src/shared/contracts'
import { OllamaProvider } from '../src/main/harness/ollama-provider'
import { DesktopToolkit } from '../src/main/tools/desktop-toolkit'
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutor
} from '../src/main/tools/contracts'

const settings = structuredClone(DEFAULT_SETTINGS)
settings.provider.model = process.env.OLLAMA_MODEL?.trim() || 'qwen3.5:9b'
settings.provider.endpoint = process.env.OLLAMA_ENDPOINT?.trim() || 'http://127.0.0.1:11434'

describe.sequential('conversa real do OllamaProvider', () => {
  it('responde uma pergunta conceitual sem executar ferramenta', async () => {
    const tools = new RecordingTools()
    const answer = await new OllamaProvider(tools).complete(messages(
      'Me explica o que é o Spotify.'
    ), settings)

    expect(answer.length).toBeGreaterThan(20)
    expect(answer).not.toContain('[SEM_FERRAMENTA]')
    expect(tools.calls).toEqual([])
  }, 180_000)

  it('executa Play no Spotify pela frase natural composta', async () => {
    const tools = new RecordingTools()
    const answer = await new OllamaProvider(tools).complete(messages(
      'Titi, o Spotify não está rodando; abre ele e dá play na minha playlist.'
    ), settings, undefined, 'spotify-chain')

    expect(tools.calls.map(({ name }) => name)).toEqual(['spotify'])
    expect(tools.calls[0]?.argumentsValue).toMatchObject({ action: 'play' })
    expect(tools.calls[0]?.context?.chainId).toBe('spotify-chain')
    expect(answer).toContain('A música começou a tocar no Spotify.')
  }, 180_000)

  it('mantém contexto, corrige o navegador e consulta a hora', async () => {
    const tools = new RecordingTools()
    const provider = new OllamaProvider(tools)

    const correction = await provider.complete([
      message('user', 'Abra o Chrome.', 1),
      message('assistant', 'Chrome aberto.', 2),
      message('user', 'Na verdade, abre o Brave.', 3)
    ], settings, undefined, 'context-chain')
    const web = await provider.complete(messages(
      'Abra https://openai.com no Chrome.'
    ), settings, undefined, 'web-chain')
    const time = await provider.complete(messages(
      'Dá uma olhada que horas são agora.'
    ), settings, undefined, 'time-chain')

    expect(tools.calls.map(({ name }) => name)).toEqual([
      'open_application',
      'open_web',
      'current_datetime'
    ])
    expect(tools.calls[0]?.argumentsValue).toMatchObject({ application: 'Brave' })
    expect(tools.calls[1]?.argumentsValue).toMatchObject({ browser: 'chrome' })
    expect(correction).toContain('Brave aberto.')
    expect(web).toContain('Página aberta no Chrome.')
    expect(time).toContain('Horário local confirmado.')
  }, 240_000)

  it('observa e age em duas rodadas usando a mesma cadeia', async () => {
    const tools = new RecordingTools()
    const answer = await new OllamaProvider(tools).complete(messages(
      'No Spotify que já está aberto, observe os controles e clique no botão Sua Biblioteca.'
    ), settings, undefined, 'ui-chain')

    expect(tools.calls.map(({ name }) => name)).toEqual([
      'computer_observe',
      'computer_action'
    ])
    expect(tools.calls[0]?.context?.chainId).toBe('ui-chain')
    expect(tools.calls[1]?.context?.chainId).toBe('ui-chain')
    expect(tools.calls[1]?.argumentsValue).toMatchObject({
      action: 'click',
      target: 'Sua Biblioteca'
    })
    expect(answer).toContain('Controles visíveis em Spotify Premium')
    expect(answer).toContain('Sua Biblioteca (botão)')
    expect(answer).toContain('O controle “Sua Biblioteca” foi acionado.')
  }, 240_000)
})

interface RecordedCall {
  name: string
  argumentsValue: Record<string, unknown>
  context?: ToolExecutionContext
}

class RecordingTools implements ToolExecutor {
  readonly definitions = new DesktopToolkit().definitions
  readonly calls: RecordedCall[] = []

  async execute(
    name: string,
    argumentsValue: unknown,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const args = isRecord(argumentsValue) ? argumentsValue : {}
    this.calls.push({ name, argumentsValue: args, context })
    switch (name) {
      case 'spotify':
        return confirmed('A música começou a tocar no Spotify.')
      case 'open_application':
        return confirmed('Brave aberto.')
      case 'open_web':
        return confirmed('Página aberta no Chrome.')
      case 'current_datetime':
        return confirmed('Horário local confirmado.')
      case 'computer_observe':
        return {
          ...confirmed('Controles observados.'),
          details: {
            windowTitle: 'Spotify Premium',
            controls: [
              { name: 'Sua Biblioteca', controlType: 'Button', enabled: true },
              { name: 'Play', controlType: 'Button', enabled: true }
            ]
          }
        }
      case 'computer_action':
        return {
          ok: false,
          status: 'dispatched',
          message: 'O controle “Sua Biblioteca” foi acionado.'
        }
      default:
        return { ok: false, status: 'failed', message: `Ferramenta inesperada: ${name}.` }
    }
  }
}

function messages(content: string): ChatMessage[] {
  return [message('user', content, 1)]
}

function message(
  role: ChatMessage['role'],
  content: string,
  sequence: number
): ChatMessage {
  return {
    id: `message-${sequence}`,
    role,
    content,
    createdAt: new Date(sequence).toISOString()
  }
}

function confirmed(message: string): ToolExecutionResult {
  return { ok: true, status: 'confirmed', message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

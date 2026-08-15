import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalMemoryStore } from '../memory'
import { ConversationStore } from '../storage/conversation-store'
import { SettingsStore } from '../storage/settings-store'
import type { ToolExecutor } from '../tools/contracts'
import { AssistantHarness } from './assistant-harness'

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('AssistantHarness privacy', () => {
  it('keeps a conversation functional in memory without writing history', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    await settings.update({ keepHistory: false })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, fakeTools())

    const first = await harness.send({ content: 'Primeira mensagem privada' })
    const second = await harness.send({
      conversationId: first.conversation.id,
      content: 'Você ainda lembra desta conversa?'
    })

    expect(first.conversation.messages).toHaveLength(2)
    expect(second.conversation.messages).toHaveLength(4)
    expect(second.conversation.messages[0].content).toBe('Primeira mensagem privada')
    expect(await conversations.get(first.conversation.id)).not.toBeNull()
    expect(await new ConversationStore(directory).get(first.conversation.id)).toBeNull()
    await expect(access(join(directory, 'conversations.json'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})

describe('AssistantHarness deterministic tools', () => {
  it('cancela antes de gravar mensagem ou executar ferramenta', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    const controller = new AbortController()
    controller.abort()
    const harness = new AssistantHarness(settings, conversations, tools)

    await expect(harness.send({ content: 'abra o Brave' }, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(tools.execute).not.toHaveBeenCalled()
    await expect(conversations.list()).resolves.toEqual([])
  })

  it('devolve o controle imediatamente ao cancelar uma ferramenta pendente', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    let release!: () => void
    tools.execute.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ ok: true, message: 'Brave aberto.' })
    }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const controller = new AbortController()
    const harness = new AssistantHarness(settings, conversations, tools)

    const sending = harness.send({ content: 'abra o Brave' }, controller.signal)
    await vi.waitFor(() => expect(tools.execute).toHaveBeenCalledOnce())
    controller.abort()
    await expect(sending).rejects.toMatchObject({ name: 'AbortError' })
    release()
  })

  it('executa um comando explícito mesmo quando o modelo local está offline', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    tools.execute.mockResolvedValue({ ok: true, message: 'Brave aberto.' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, tools)

    const response = await harness.send({ content: 'abra o Brave' })

    expect(tools.execute).toHaveBeenCalledWith('open_application', { application: 'brave' })
    expect(response.assistantMessage.content).toBe('Brave aberto.')
    expect(response.runtime.connected).toBe(false)
  })

  it('expõe a falha real e não afirma sucesso quando a ferramenta falha', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    tools.execute.mockResolvedValue({
      ok: false,
      message: 'Não encontrei o Antigravity instalado neste computador.'
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, tools)

    const response = await harness.send({ content: 'abra o Antigravity' })

    expect(response.assistantMessage.content).toBe(
      'Não consegui executar essa ação. Não encontrei o Antigravity instalado neste computador.'
    )
  })

  it('não espera o Ollama e reutiliza uma única consulta de status em andamento', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    tools.execute.mockResolvedValue({ ok: true, message: 'Spotify aberto.' })
    let resolveStatus!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveStatus = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)
    const harness = new AssistantHarness(settings, conversations, tools)

    const response = await harness.send({ content: 'abra o Spotify' })

    expect(response.assistantMessage.content).toBe('Spotify aberto.')
    expect(response.runtime.message).toContain('segundo plano')
    expect(fetchMock).toHaveBeenCalledOnce()

    const settingsRead = vi.spyOn(settings, 'get')
    const statusPromise = harness.status()
    await settingsRead.mock.results[0].value
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledOnce()
    resolveStatus(jsonResponse({ models: [{ name: 'qwen3.5:9b' }] }))
    await expect(statusPromise).resolves.toMatchObject({ connected: true })
  })

  it('não dispara ferramenta determinística para uma pergunta sobre um aplicativo', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const tools = fakeTools()
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/api/tags')) {
        return jsonResponse({ models: [{ name: 'qwen3.5:9b' }] })
      }
      return jsonResponse({ message: { role: 'assistant', content: 'Explicação normal.' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const harness = new AssistantHarness(settings, conversations, tools)

    const response = await harness.send({ content: 'me ensina sobre Spotify' })

    expect(tools.execute).not.toHaveBeenCalled()
    expect(response.assistantMessage.content).toBe('Explicação normal.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('AssistantHarness conversation queues', () => {
  it('serializa envios da mesma conversa sem perder mensagens', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const conversation = await conversations.create({ persist: true })
    const tools = fakeTools()
    let releaseFirst!: () => void
    const firstTool = new Promise<void>((resolve) => { releaseFirst = resolve })
    tools.execute.mockImplementation(async (_name, argumentsValue) => {
      const application = (argumentsValue as { application?: string }).application
      if (application === 'brave') {
        await firstTool
        return { ok: true, message: 'Brave aberto.' }
      }
      return { ok: true, message: 'Spotify aberto.' }
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, tools)

    const first = harness.send({
      conversationId: conversation.id,
      content: 'abra o Brave'
    })
    await vi.waitFor(() => expect(tools.execute).toHaveBeenCalledTimes(1))
    const second = harness.send({
      conversationId: conversation.id,
      content: 'abra o Spotify'
    })

    const stateBeforeRelease = await Promise.race([
      second.then(() => 'settled' as const),
      delay(25).then(() => 'pending' as const)
    ])
    expect(stateBeforeRelease).toBe('pending')
    expect(tools.execute).toHaveBeenCalledTimes(1)

    releaseFirst()
    const [, secondResponse] = await Promise.all([first, second])
    expect(tools.execute).toHaveBeenCalledTimes(2)
    expect(secondResponse.conversation.messages.map(({ content }) => content)).toEqual([
      'abra o Brave',
      'Brave aberto.',
      'abra o Spotify',
      'Spotify aberto.'
    ])
  })

  it('mantém filas de conversas diferentes independentes', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const firstConversation = await conversations.create({ persist: true })
    const secondConversation = await conversations.create({ persist: true })
    const tools = fakeTools()
    let releaseFirst!: () => void
    const firstTool = new Promise<void>((resolve) => { releaseFirst = resolve })
    tools.execute.mockImplementation(async (_name, argumentsValue) => {
      const application = (argumentsValue as { application?: string }).application
      if (application === 'brave') {
        await firstTool
        return { ok: true, message: 'Brave aberto.' }
      }
      return { ok: true, message: 'Spotify aberto.' }
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, tools)

    const first = harness.send({
      conversationId: firstConversation.id,
      content: 'abra o Brave'
    })
    await vi.waitFor(() => expect(tools.execute).toHaveBeenCalledTimes(1))
    const second = harness.send({
      conversationId: secondConversation.id,
      content: 'abra o Spotify'
    })

    await expect(second).resolves.toMatchObject({
      assistantMessage: { content: 'Spotify aberto.' }
    })
    expect(tools.execute).toHaveBeenCalledTimes(2)
    releaseFirst()
    await first
  })
})

describe('AssistantHarness curated memory', () => {
  it('aprende uma preferência somente após um comando explícito', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const memory = new LocalMemoryStore(directory)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const harness = new AssistantHarness(settings, conversations, fakeTools(), memory)

    const response = await harness.send({
      content: 'Lembre que meu navegador preferido é o Brave.'
    })

    expect(response.assistantMessage.content).toBe(
      'Certo, salvei na memória: navegador preferido — Brave.'
    )
    expect(await memory.list({ kind: 'preference' })).toEqual([
      expect.objectContaining({
        kind: 'preference',
        key: 'navegador preferido',
        value: 'Brave',
        source: expect.objectContaining({ kind: 'user-statement' })
      })
    ])
  })

  it('não aprende uma afirmação comum ou ambígua', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const memory = new LocalMemoryStore(directory)
    vi.stubGlobal('fetch', connectedModel('Resposta normal.'))
    const harness = new AssistantHarness(settings, conversations, fakeTools(), memory)

    const response = await harness.send({
      content: 'Meu navegador preferido é o Brave.'
    })

    expect(response.assistantMessage.content).toBe('Resposta normal.')
    expect(await memory.list()).toEqual([])
  })

  it('injeta a memória curada no modelo quando o histórico está ativo', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const memory = new LocalMemoryStore(directory)
    await memory.rememberPreference(
      { key: 'navegador preferido', value: 'Brave' },
      { keepHistory: true, source: { kind: 'user-statement' } }
    )
    const fetchMock = connectedModel('Seu navegador é o Brave.')
    vi.stubGlobal('fetch', fetchMock)
    const harness = new AssistantHarness(settings, conversations, fakeTools(), memory)

    await harness.send({ content: 'Qual navegador eu prefiro?' })

    const chatCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/chat'))
    const body = JSON.parse(String((chatCall?.[1] as RequestInit | undefined)?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    expect(body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('navegador preferido: Brave')
      })
    ]))
  })

  it('não lê nem grava memória persistente quando o histórico está desligado', async () => {
    const directory = await createTemporaryDirectory()
    const settings = new SettingsStore(directory)
    const conversations = new ConversationStore(directory)
    const memory = new LocalMemoryStore(directory)
    await memory.rememberPreference(
      { key: 'navegador preferido', value: 'Brave' },
      { keepHistory: true, source: { kind: 'user-statement' } }
    )
    await settings.update({ keepHistory: false })
    const readSpy = vi.spyOn(memory, 'buildPromptContext')
    vi.stubGlobal('fetch', connectedModel('Não tenho uma preferência disponível.'))
    const harness = new AssistantHarness(settings, conversations, fakeTools(), memory)

    await harness.send({ content: 'Qual navegador eu prefiro?' })
    const learnResponse = await harness.send({
      content: 'Lembre que meu aplicativo de música preferido é o Spotify.'
    })

    expect(readSpy).not.toHaveBeenCalled()
    expect(learnResponse.assistantMessage.content).toContain('modo privado')
    expect(await memory.list()).toHaveLength(1)
    expect(await memory.list({ kind: 'preference' })).toEqual([
      expect.objectContaining({ value: 'Brave' })
    ])
  })
})

function fakeTools() {
  return {
    definitions: [] as ToolExecutor['definitions'],
    execute: vi.fn<ToolExecutor['execute']>()
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function connectedModel(answer: string) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input)
    return url.endsWith('/api/tags')
      ? jsonResponse({ models: [{ name: 'qwen3.5:9b' }] })
      : jsonResponse({ message: { role: 'assistant', content: answer } })
  })
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'titi-harness-privacy-'))
  temporaryDirectories.push(directory)
  return directory
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

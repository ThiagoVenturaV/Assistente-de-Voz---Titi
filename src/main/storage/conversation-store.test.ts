import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversationStore } from './conversation-store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('ConversationStore', () => {
  it('cria, nomeia, lista e remove uma conversa local', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-conversations-'))
    temporaryDirectories.push(directory)
    const store = new ConversationStore(directory)
    const conversation = await store.create()

    await store.addMessage(conversation.id, 'user', 'Planeje meu dia de trabalho')
    await store.addMessage(conversation.id, 'assistant', 'Vamos começar pelas prioridades.')

    const saved = await store.get(conversation.id)
    const list = await store.list()
    expect(saved?.messages).toHaveLength(2)
    expect(saved?.title).toBe('Planeje meu dia de trabalho')
    expect(list[0].preview).toBe('Vamos começar pelas prioridades.')

    await store.remove(conversation.id)
    expect(await store.get(conversation.id)).toBeNull()
  })

  it('mantém uma conversa privada apenas em memória durante a sessão', async () => {
    const directory = await createTemporaryDirectory()
    const store = new ConversationStore(directory)
    const conversation = await store.create()

    await store.addMessage(conversation.id, 'user', 'Isto não deve ser salvo', false)
    await store.addMessage(conversation.id, 'assistant', 'Continuo lembrando nesta sessão.', false)

    expect((await store.get(conversation.id))?.messages).toHaveLength(2)
    expect(await store.list()).toHaveLength(1)
    expect(await new ConversationStore(directory).get(conversation.id)).toBeNull()
    await expect(access(join(directory, 'conversations.json'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('não grava mensagens privadas ao continuar uma conversa já salva', async () => {
    const directory = await createTemporaryDirectory()
    const store = new ConversationStore(directory)
    const conversation = await store.create({ persist: true })
    await store.addMessage(conversation.id, 'user', 'Mensagem salva')

    await store.addMessage(conversation.id, 'user', 'Mensagem privada', false)
    await store.addMessage(
      conversation.id,
      'assistant',
      'Mesmo reativando, esta sessão permanece privada.',
      true
    )

    expect((await store.get(conversation.id))?.messages).toHaveLength(3)
    const persisted = await new ConversationStore(directory).get(conversation.id)
    expect(persisted?.messages.map(({ content }) => content)).toEqual([
      'Mensagem salva'
    ])
  })

  it('exports visible conversations and clears persisted and transient data', async () => {
    const directory = await createTemporaryDirectory()
    const store = new ConversationStore(directory)
    const saved = await store.create({ persist: true })
    const transient = await store.create()
    await store.addMessage(saved.id, 'user', 'Salva')
    await store.addMessage(transient.id, 'user', 'Privada', false)

    await expect(store.exportAll()).resolves.toHaveLength(2)
    await expect(store.clear()).resolves.toBe(2)
    await expect(store.list()).resolves.toEqual([])
    await expect(new ConversationStore(directory).list()).resolves.toEqual([])
  })
})

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'titi-conversations-'))
  temporaryDirectories.push(directory)
  return directory
}

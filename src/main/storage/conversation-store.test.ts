import { mkdtemp, rm } from 'node:fs/promises'
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
})

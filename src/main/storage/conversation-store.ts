import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  ChatMessage,
  Conversation,
  ConversationSummary,
  MessageRole
} from '../../shared/contracts'
import { JsonStore } from './json-store'

interface ConversationDatabase {
  conversations: Conversation[]
}

interface TransientConversation {
  conversation: Conversation
  privateSession: boolean
}

interface CreateConversationOptions {
  persist?: boolean
}

const EMPTY_DATABASE: ConversationDatabase = { conversations: [] }

export class ConversationStore {
  private readonly store: JsonStore<ConversationDatabase>
  private readonly transientConversations = new Map<string, TransientConversation>()

  constructor(userDataPath: string) {
    this.store = new JsonStore(
      join(userDataPath, 'conversations.json'),
      EMPTY_DATABASE
    )
  }

  async list(): Promise<ConversationSummary[]> {
    const database = await this.store.read()
    const conversations = new Map(
      database.conversations.map((conversation) => [conversation.id, conversation])
    )

    for (const { conversation } of this.transientConversations.values()) {
      conversations.set(conversation.id, conversation)
    }

    return [...conversations.values()]
      .map(({ id, title, updatedAt, preview }) => ({
        id,
        title,
        updatedAt,
        preview
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<Conversation | null> {
    const transient = this.transientConversations.get(id)
    if (transient) {
      return structuredClone(transient.conversation)
    }

    const database = await this.store.read()
    return database.conversations.find((item) => item.id === id) ?? null
  }

  async create(options: CreateConversationOptions = {}): Promise<Conversation> {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: randomUUID(),
      title: 'Nova conversa',
      preview: 'Converse com o Titi',
      updatedAt: now,
      messages: []
    }

    if (options.persist) {
      const database = await this.store.read()
      database.conversations.unshift(conversation)
      await this.store.write(database)
    } else {
      this.transientConversations.set(conversation.id, {
        conversation,
        privateSession: false
      })
    }

    return structuredClone(conversation)
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    persist = true
  ): Promise<{ conversation: Conversation; message: ChatMessage }> {
    const database = await this.store.read()
    const persistedConversation = database.conversations.find(
      (item) => item.id === conversationId
    )
    const transient = this.transientConversations.get(conversationId)
    const conversation = structuredClone(
      transient?.conversation ?? persistedConversation
    )

    if (!conversation) {
      throw new Error('Conversa não encontrada.')
    }

    const message: ChatMessage = {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString()
    }

    conversation.messages.push(message)
    conversation.updatedAt = message.createdAt
    conversation.preview = compact(content, 82)

    if (role === 'user' && conversation.title === 'Nova conversa') {
      conversation.title = compact(content, 42)
    }

    const privateSession = transient?.privateSession === true || !persist
    if (privateSession) {
      this.transientConversations.set(conversation.id, {
        conversation,
        privateSession: true
      })
    } else {
      const index = database.conversations.findIndex(
        (item) => item.id === conversation.id
      )
      if (index >= 0) {
        database.conversations[index] = conversation
      } else {
        database.conversations.unshift(conversation)
      }
      await this.store.write(database)
      this.transientConversations.delete(conversation.id)
    }

    return {
      conversation: structuredClone(conversation),
      message: structuredClone(message)
    }
  }

  async remove(id: string): Promise<void> {
    this.transientConversations.delete(id)
    const database = await this.store.read()
    database.conversations = database.conversations.filter(
      (conversation) => conversation.id !== id
    )
    await this.store.write(database)
  }

  async clear(): Promise<number> {
    const database = await this.store.read()
    const count = new Set([
      ...database.conversations.map(({ id }) => id),
      ...this.transientConversations.keys()
    ]).size
    this.transientConversations.clear()
    await this.store.write(structuredClone(EMPTY_DATABASE))
    return count
  }

  async exportAll(): Promise<Conversation[]> {
    const database = await this.store.read()
    const conversations = new Map(
      database.conversations.map((conversation) => [conversation.id, conversation])
    )
    for (const { conversation } of this.transientConversations.values()) {
      conversations.set(conversation.id, conversation)
    }
    return structuredClone(
      [...conversations.values()].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      )
    )
  }
}

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1).trimEnd()}…`
    : normalized
}

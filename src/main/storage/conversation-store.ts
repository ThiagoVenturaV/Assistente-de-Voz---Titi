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

const EMPTY_DATABASE: ConversationDatabase = { conversations: [] }

export class ConversationStore {
  private readonly store: JsonStore<ConversationDatabase>

  constructor(userDataPath: string) {
    this.store = new JsonStore(
      join(userDataPath, 'conversations.json'),
      EMPTY_DATABASE
    )
  }

  async list(): Promise<ConversationSummary[]> {
    const database = await this.store.read()
    return database.conversations
      .map(({ id, title, updatedAt, preview }) => ({
        id,
        title,
        updatedAt,
        preview
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<Conversation | null> {
    const database = await this.store.read()
    return database.conversations.find((item) => item.id === id) ?? null
  }

  async create(): Promise<Conversation> {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: randomUUID(),
      title: 'Nova conversa',
      preview: 'Converse com o Titi',
      updatedAt: now,
      messages: []
    }
    const database = await this.store.read()
    database.conversations.unshift(conversation)
    await this.store.write(database)
    return conversation
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string
  ): Promise<{ conversation: Conversation; message: ChatMessage }> {
    const database = await this.store.read()
    const conversation = database.conversations.find(
      (item) => item.id === conversationId
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

    await this.store.write(database)
    return { conversation, message }
  }

  async remove(id: string): Promise<void> {
    const database = await this.store.read()
    database.conversations = database.conversations.filter(
      (conversation) => conversation.id !== id
    )
    await this.store.write(database)
  }
}

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1).trimEnd()}…`
    : normalized
}

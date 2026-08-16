import type { ChatMessage, Conversation } from '../../shared/contracts'

export function createOptimisticConversation(
  conversation: Conversation,
  content: string,
  messageId: string,
  createdAt: string
): Conversation {
  const message: ChatMessage = {
    id: messageId,
    role: 'user',
    content,
    createdAt
  }

  return {
    ...conversation,
    title: conversation.title === 'Nova conversa' ? compact(content, 42) : conversation.title,
    preview: compact(content, 82),
    updatedAt: createdAt,
    messages: [...conversation.messages, message]
  }
}

export function formatActivityElapsed(startedAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1).trimEnd()}…`
    : normalized
}

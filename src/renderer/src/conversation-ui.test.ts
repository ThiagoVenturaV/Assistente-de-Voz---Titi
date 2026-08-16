import { describe, expect, it } from 'vitest'
import type { Conversation } from '../../shared/contracts'
import { createOptimisticConversation, formatActivityElapsed } from './conversation-ui'

const emptyConversation: Conversation = {
  id: 'conversation-1',
  title: 'Nova conversa',
  preview: 'Converse com o Titi',
  updatedAt: '2026-08-16T12:00:00.000Z',
  messages: []
}

describe('conversation UI', () => {
  it('shows the user message before the assistant response exists', () => {
    const optimistic = createOptimisticConversation(
      emptyConversation,
      'Abre o Spotify e dá play.',
      'pending-request-1',
      '2026-08-16T12:00:01.000Z'
    )

    expect(optimistic.messages).toEqual([
      expect.objectContaining({
        id: 'pending-request-1',
        role: 'user',
        content: 'Abre o Spotify e dá play.'
      })
    ])
    expect(optimistic.title).toBe('Abre o Spotify e dá play.')
    expect(emptyConversation.messages).toEqual([])
  })

  it('formats the thinking timer with stable minutes and seconds', () => {
    expect(formatActivityElapsed(10_000, 10_000)).toBe('0:00')
    expect(formatActivityElapsed(10_000, 75_400)).toBe('1:05')
    expect(formatActivityElapsed(10_000, 9_000)).toBe('0:00')
  })
})

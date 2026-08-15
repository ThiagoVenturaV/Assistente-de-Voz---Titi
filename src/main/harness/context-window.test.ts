import { describe, expect, it } from 'vitest'
import type { ChatMessage, MessageRole } from '../../shared/contracts'
import {
  estimatedContextCharacters,
  selectMessagesForContext
} from './context-window'

describe('selectMessagesForContext', () => {
  it('preserves system memory, the current request and a contiguous recent suffix', () => {
    const messages = [
      message('memory', 'system', 'preferência local'),
      message('old-user', 'user', 'mensagem antiga'.repeat(12)),
      message('old-assistant', 'assistant', 'resposta antiga'.repeat(12)),
      message('recent-user', 'user', 'pedido recente'),
      message('recent-assistant', 'assistant', 'resposta recente'),
      message('current', 'user', 'pedido atual')
    ]

    const selected = selectMessagesForContext(messages, 200)

    expect(selected.map(({ id }) => id)).toEqual([
      'memory',
      'recent-user',
      'recent-assistant',
      'current'
    ])
    expect(estimatedContextCharacters(selected)).toBeLessThanOrEqual(200)
  })

  it('never cuts protected messages even when they exceed the configured budget', () => {
    const memory = message('memory', 'system', 'm'.repeat(80))
    const current = message('current', 'user', 'u'.repeat(80))

    const selected = selectMessagesForContext([memory, current], 20)

    expect(selected).toEqual([memory, current])
    expect(selected[0].content).toHaveLength(80)
    expect(selected[1].content).toHaveLength(80)
  })

  it('returns whole messages without mutating the input', () => {
    const messages = [
      message('one', 'user', '1'.repeat(100)),
      message('two', 'assistant', '2'.repeat(100)),
      message('three', 'user', '3'.repeat(20))
    ]
    const snapshot = structuredClone(messages)

    expect(selectMessagesForContext(messages, 60)).toEqual([messages[2]])
    expect(messages).toEqual(snapshot)
  })
})

function message(id: string, role: MessageRole, content: string): ChatMessage {
  return { id, role, content, createdAt: new Date(0).toISOString() }
}

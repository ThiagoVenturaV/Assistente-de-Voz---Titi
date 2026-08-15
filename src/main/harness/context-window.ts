import type { ChatMessage } from '../../shared/contracts'

/**
 * Leaves room in the 8k model context for the fixed system prompt, tool
 * definitions, tool results and the answer. Protected messages are never
 * truncated; when they alone exceed the budget they are returned intact.
 */
export const DEFAULT_CONVERSATION_CONTEXT_CHARACTERS = 24_000

export function selectMessagesForContext(
  messages: ChatMessage[],
  maxCharacters = DEFAULT_CONVERSATION_CONTEXT_CHARACTERS
): ChatMessage[] {
  if (!messages.length) return []

  const budget = Math.max(0, Math.floor(maxCharacters))
  const latestIndex = messages.length - 1
  const selected = new Set<number>()
  let used = 0

  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role !== 'system') continue
    selected.add(index)
    used += messageCost(messages[index])
  }

  if (!selected.has(latestIndex)) {
    selected.add(latestIndex)
    used += messageCost(messages[latestIndex])
  }

  // Preserve one contiguous recent suffix. Skipping an oversized recent turn
  // and then including older messages would give the model a misleading gap.
  for (let index = latestIndex - 1; index >= 0; index -= 1) {
    if (selected.has(index)) continue
    const cost = messageCost(messages[index])
    if (used + cost > budget) break
    selected.add(index)
    used += cost
  }

  return messages.filter((_message, index) => selected.has(index))
}

export function estimatedContextCharacters(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + messageCost(message), 0)
}

function messageCost(message: ChatMessage): number {
  // Small structural allowance for role and JSON framing sent to Ollama.
  return message.content.length + 32
}

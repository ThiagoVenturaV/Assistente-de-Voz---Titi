export interface ExplicitProfileMemoryCommand {
  kind: 'fact' | 'preference'
  key: string
  value: string
}

const EXPLICIT_PREFIX = /^(?:por\s+favor,?\s*)?(?:lembre(?:-se)?\s+(?:de\s+)?que|guarde\s+na\s+mem[oó]ria\s+que)\s+(.+)$/iu
const OWNED_STATEMENT = /^(?:o\s+)?(?:meu|minha|meus|minhas)\s+(.+?)\s+(?:[ée]|s[aã]o)\s+(.+?)\s*[.!?]?$/iu

/**
 * Recognizes only an explicit command followed by a first-person owned fact.
 * Ordinary statements and questions intentionally return null.
 */
export function parseExplicitMemoryCommand(
  content: string
): ExplicitProfileMemoryCommand | null {
  const explicit = content.trim().match(EXPLICIT_PREFIX)
  if (!explicit) return null

  const statement = explicit[1].match(OWNED_STATEMENT)
  if (!statement) return null

  const key = cleanPart(statement[1], 100)
  let value = cleanPart(statement[2], 500)
  if (!key || !value || value.length < 2) return null

  const preference = /\bpreferid[oa]s?\b/iu.test(key)
  if (preference) value = value.replace(/^(?:o|a|os|as)\s+/iu, '').trim()
  if (!value) return null

  return {
    kind: preference ? 'preference' : 'fact',
    key,
    value
  }
}

function cleanPart(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit
    ? normalized.slice(0, limit).trimEnd()
    : normalized
}

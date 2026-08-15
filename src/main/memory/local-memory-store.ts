import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { JsonStore } from '../storage/json-store'
import type {
  JsonValue,
  LearnedRecipeEntry,
  LearnedRecipeInput,
  MemoryContextOptions,
  MemoryEntry,
  MemoryKind,
  MemoryListFilter,
  MemorySource,
  MemoryStoreLimits,
  MemoryWriteContext,
  MemoryWriteResult,
  ProfileMemoryEntry,
  ProfileMemoryInput,
  RecipeStep
} from './contracts'

interface MemoryDatabase {
  version: 1
  entries: MemoryEntry[]
}

const EMPTY_DATABASE: MemoryDatabase = { version: 1, entries: [] }

export const DEFAULT_MEMORY_LIMITS: MemoryStoreLimits = {
  facts: 100,
  preferences: 100,
  recipes: 60,
  keyCharacters: 100,
  valueCharacters: 500,
  recipeSteps: 8,
  toolArgumentsCharacters: 2_000
}

/**
 * Persistent, curated memory. It intentionally does not store chat messages.
 * The required MemoryWriteContext is the privacy boundary for all learning.
 */
export class LocalMemoryStore {
  private readonly store: JsonStore<MemoryDatabase>
  private readonly limits: MemoryStoreLimits
  private mutationQueue: Promise<void> = Promise.resolve()
  private lastTimestamp = 0

  constructor(userDataPath: string, limits: Partial<MemoryStoreLimits> = {}) {
    this.store = new JsonStore(
      join(userDataPath, 'memory.json'),
      EMPTY_DATABASE
    )
    this.limits = normalizeLimits({ ...DEFAULT_MEMORY_LIMITS, ...limits })
  }

  async rememberFact(
    input: ProfileMemoryInput,
    context: MemoryWriteContext
  ): Promise<MemoryWriteResult> {
    return this.rememberProfile('fact', input, context)
  }

  async rememberPreference(
    input: ProfileMemoryInput,
    context: MemoryWriteContext
  ): Promise<MemoryWriteResult> {
    return this.rememberProfile('preference', input, context)
  }

  async learnRecipe(
    input: LearnedRecipeInput,
    context: MemoryWriteContext
  ): Promise<MemoryWriteResult> {
    if (!context.keepHistory) {
      return { status: 'skipped', reason: 'private-session' }
    }
    if (!input.verification.ok) {
      return { status: 'skipped', reason: 'unverified-recipe' }
    }

    const now = this.timestamp()
    const candidate = sanitizeRecipe(input, context, now, this.limits)
    return this.mutate((database) => {
      const duplicate = database.entries.find((entry): entry is LearnedRecipeEntry =>
        entry.kind === 'recipe'
          && canonical(entry.trigger) === canonical(candidate.trigger)
      )

      if (duplicate) {
        const updated: LearnedRecipeEntry = {
          ...candidate,
          id: duplicate.id,
          createdAt: duplicate.createdAt
        }
        replaceEntry(database, updated)
        enforceLimits(database, this.limits)
        return { status: 'updated', entry: updated }
      }

      database.entries.push(candidate)
      enforceLimits(database, this.limits)
      return { status: 'created', entry: candidate }
    })
  }

  async list(filter: MemoryListFilter = {}): Promise<MemoryEntry[]> {
    await this.mutationQueue
    const database = await this.store.read()
    const entries = filter.kind
      ? database.entries.filter((entry) => entry.kind === filter.kind)
      : database.entries
    const limit = positiveInteger(filter.limit, entries.length)

    return structuredClone(entries)
      .sort(compareRecentFirst)
      .slice(0, limit)
  }

  async get(id: string): Promise<MemoryEntry | null> {
    await this.mutationQueue
    const database = await this.store.read()
    const entry = database.entries.find((candidate) => candidate.id === id)
    return entry ? structuredClone(entry) : null
  }

  /** Explicit user deletion remains available even when history is disabled. */
  async remove(id: string): Promise<boolean> {
    return this.mutate((database) => {
      const originalLength = database.entries.length
      database.entries = database.entries.filter((entry) => entry.id !== id)
      return database.entries.length !== originalLength
    })
  }

  /** Explicit user deletion remains available even when history is disabled. */
  async clear(kind?: MemoryKind): Promise<number> {
    return this.mutate((database) => {
      const originalLength = database.entries.length
      database.entries = kind
        ? database.entries.filter((entry) => entry.kind !== kind)
        : []
      return originalLength - database.entries.length
    })
  }

  /**
   * Produces a small, deterministic block ready for a system prompt. It never
   * reads conversation history and never includes provenance identifiers.
   */
  async buildPromptContext(options: MemoryContextOptions = {}): Promise<string> {
    const maxCharacters = positiveInteger(options.maxCharacters, 4_000)
    const entries = await this.list()
    const facts = takeKind(entries, 'fact', positiveInteger(options.facts, 20))
    const preferences = takeKind(
      entries,
      'preference',
      positiveInteger(options.preferences, 20)
    )
    const recipes = takeKind(entries, 'recipe', nonNegativeInteger(options.recipes, 10))
    const lines = [
      '# Memória local curada',
      'Use apenas quando for relevante. Não invente itens ausentes.'
    ]

    appendProfileSection(lines, 'Fatos do usuário', facts)
    appendProfileSection(lines, 'Preferências do usuário', preferences)
    appendRecipeSection(lines, recipes)

    if (lines.length === 2) {
      return ''
    }
    return truncateContext(lines.join('\n'), maxCharacters)
  }

  private async rememberProfile(
    kind: 'fact' | 'preference',
    input: ProfileMemoryInput,
    context: MemoryWriteContext
  ): Promise<MemoryWriteResult> {
    if (!context.keepHistory) {
      return { status: 'skipped', reason: 'private-session' }
    }

    const now = this.timestamp()
    const key = cleanText(input.key, this.limits.keyCharacters, 'chave')
    const value = cleanText(input.value, this.limits.valueCharacters, 'valor')
    return this.mutate((database) => {
      const duplicate = database.entries.find((entry): entry is ProfileMemoryEntry =>
        entry.kind === kind && canonical(entry.key) === canonical(key)
      )
      const entry: ProfileMemoryEntry = {
        id: duplicate?.id ?? randomUUID(),
        kind,
        key,
        value,
        source: createSource(context, now),
        createdAt: duplicate?.createdAt ?? now,
        updatedAt: now
      }

      if (duplicate) {
        replaceEntry(database, entry)
      } else {
        database.entries.push(entry)
      }
      enforceLimits(database, this.limits)
      return {
        status: duplicate ? 'updated' : 'created',
        entry
      }
    })
  }

  private async mutate<T>(operation: (database: MemoryDatabase) => T): Promise<T> {
    let result!: T
    const mutation = this.mutationQueue.then(async () => {
      const database = normalizeDatabase(await this.store.read())
      result = operation(database)
      await this.store.write(database)
    })
    this.mutationQueue = mutation.catch(() => undefined)
    await mutation
    return structuredClone(result)
  }

  private timestamp(): string {
    const timestamp = Math.max(Date.now(), this.lastTimestamp + 1)
    this.lastTimestamp = timestamp
    return new Date(timestamp).toISOString()
  }
}

function sanitizeRecipe(
  input: LearnedRecipeInput,
  context: MemoryWriteContext,
  now: string,
  limits: MemoryStoreLimits
): LearnedRecipeEntry {
  if (!input.steps.length) {
    throw new Error('Uma receita precisa ter pelo menos uma etapa verificada.')
  }
  if (input.steps.length > limits.recipeSteps) {
    throw new Error(`Uma receita pode ter no máximo ${limits.recipeSteps} etapas.`)
  }

  const steps = input.steps.map((step) => sanitizeStep(step, limits))
  return {
    id: randomUUID(),
    kind: 'recipe',
    name: cleanText(input.name, limits.keyCharacters, 'nome da receita'),
    trigger: cleanText(input.trigger, limits.valueCharacters, 'gatilho da receita'),
    summary: cleanText(input.summary, limits.valueCharacters, 'resumo da receita'),
    steps,
    verification: {
      verifiedAt: now,
      ...(input.verification.message
        ? { message: cleanText(input.verification.message, limits.valueCharacters, 'verificação') }
        : {})
    },
    source: createSource(context, now),
    createdAt: now,
    updatedAt: now
  }
}

function sanitizeStep(step: RecipeStep, limits: MemoryStoreLimits): RecipeStep {
  const tool = cleanText(step.tool, limits.keyCharacters, 'ferramenta')
  const argumentsSnapshot = redactSecrets(structuredClone(step.arguments))
  const serialized = JSON.stringify(argumentsSnapshot)
  if (serialized === undefined || serialized.length > limits.toolArgumentsCharacters) {
    throw new Error(
      `Os argumentos de uma etapa podem ter no máximo ${limits.toolArgumentsCharacters} caracteres.`
    )
  }
  return { tool, arguments: argumentsSnapshot as Record<string, JsonValue> }
}

function redactSecrets(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(redactSecrets)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      /api.?key|authorization|cookie|password|secret|token/i.test(key)
        ? '[não armazenado]'
        : redactSecrets(nested)
    ]))
  }
  return value
}

function createSource(context: MemoryWriteContext, now: string): MemorySource {
  return {
    ...structuredClone(context.source),
    capturedAt: context.source.capturedAt ?? now
  }
}

function normalizeDatabase(value: MemoryDatabase): MemoryDatabase {
  if (value?.version !== 1 || !Array.isArray(value.entries)) {
    return structuredClone(EMPTY_DATABASE)
  }
  return value
}

function replaceEntry(database: MemoryDatabase, entry: MemoryEntry): void {
  const index = database.entries.findIndex((candidate) => candidate.id === entry.id)
  if (index >= 0) {
    database.entries[index] = entry
  }
}

function enforceLimits(database: MemoryDatabase, limits: MemoryStoreLimits): void {
  const allowed: Record<MemoryKind, number> = {
    fact: limits.facts,
    preference: limits.preferences,
    recipe: limits.recipes
  }
  const keepIds = new Set<string>()

  for (const kind of ['fact', 'preference', 'recipe'] as const) {
    database.entries
      .filter((entry) => entry.kind === kind)
      .sort(compareRecentFirst)
      .slice(0, allowed[kind])
      .forEach((entry) => keepIds.add(entry.id))
  }
  database.entries = database.entries.filter((entry) => keepIds.has(entry.id))
}

function takeKind<K extends MemoryKind>(
  entries: MemoryEntry[],
  kind: K,
  limit: number
): Extract<MemoryEntry, { kind: K }>[] {
  return entries
    .filter((entry): entry is Extract<MemoryEntry, { kind: K }> => entry.kind === kind)
    .slice(0, limit)
}

function appendProfileSection(
  lines: string[],
  title: string,
  entries: ProfileMemoryEntry[]
): void {
  if (!entries.length) return
  lines.push('', `## ${title}`)
  entries.forEach((entry) => lines.push(`- ${entry.key}: ${entry.value}`))
}

function appendRecipeSection(lines: string[], entries: LearnedRecipeEntry[]): void {
  if (!entries.length) return
  lines.push('', '## Receitas verificadas')
  for (const entry of entries) {
    const steps = entry.steps.map((step) =>
      `${step.tool}(${JSON.stringify(step.arguments)})`
    ).join(' -> ')
    lines.push(`- ${entry.name} — quando: ${entry.trigger}; ${entry.summary}; etapas: ${steps}`)
  }
}

function truncateContext(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value
  if (maxCharacters <= 1) return '…'.slice(0, maxCharacters)
  return `${value.slice(0, maxCharacters - 1).trimEnd()}…`
}

function cleanText(value: string, maxCharacters: number, field: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    throw new Error(`O campo ${field} não pode ficar vazio.`)
  }
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters).trimEnd()
    : normalized
}

function canonical(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compareRecentFirst(left: MemoryEntry, right: MemoryEntry): number {
  return right.updatedAt.localeCompare(left.updatedAt)
    || right.createdAt.localeCompare(left.createdAt)
    || right.id.localeCompare(left.id)
}

function normalizeLimits(limits: MemoryStoreLimits): MemoryStoreLimits {
  return {
    facts: positiveInteger(limits.facts, DEFAULT_MEMORY_LIMITS.facts),
    preferences: positiveInteger(limits.preferences, DEFAULT_MEMORY_LIMITS.preferences),
    recipes: positiveInteger(limits.recipes, DEFAULT_MEMORY_LIMITS.recipes),
    keyCharacters: positiveInteger(
      limits.keyCharacters,
      DEFAULT_MEMORY_LIMITS.keyCharacters
    ),
    valueCharacters: positiveInteger(
      limits.valueCharacters,
      DEFAULT_MEMORY_LIMITS.valueCharacters
    ),
    recipeSteps: positiveInteger(limits.recipeSteps, DEFAULT_MEMORY_LIMITS.recipeSteps),
    toolArgumentsCharacters: positiveInteger(
      limits.toolArgumentsCharacters,
      DEFAULT_MEMORY_LIMITS.toolArgumentsCharacters
    )
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value! : fallback
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? value! : fallback
}

export type MemoryKind = 'fact' | 'preference' | 'recipe'

export type MemorySourceKind =
  | 'user-statement'
  | 'user-correction'
  | 'tool-success'
  | 'assistant-curation'
  | 'import'

export interface MemorySource {
  kind: MemorySourceKind
  capturedAt: string
  conversationId?: string
  messageId?: string
  tool?: string
  reference?: string
}

export interface MemoryWriteContext {
  /**
   * This is deliberately required on every learning operation. A private
   * session cannot accidentally leak into persistent memory because a caller
   * forgot to check the setting beforehand.
   */
  keepHistory: boolean
  source: Omit<MemorySource, 'capturedAt'> & { capturedAt?: string }
}

interface MemoryEntryBase {
  id: string
  kind: MemoryKind
  source: MemorySource
  createdAt: string
  updatedAt: string
}

export interface ProfileMemoryEntry extends MemoryEntryBase {
  kind: 'fact' | 'preference'
  key: string
  value: string
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface RecipeStep {
  tool: string
  arguments: Record<string, JsonValue>
}

export interface LearnedRecipeEntry extends MemoryEntryBase {
  kind: 'recipe'
  name: string
  trigger: string
  summary: string
  steps: RecipeStep[]
  verification: {
    verifiedAt: string
    message?: string
  }
}

export type MemoryEntry = ProfileMemoryEntry | LearnedRecipeEntry

export interface ProfileMemoryInput {
  key: string
  value: string
}

export interface LearnedRecipeInput {
  name: string
  trigger: string
  summary: string
  steps: RecipeStep[]
  verification: {
    ok: boolean
    message?: string
  }
}

export type MemoryWriteResult =
  | { status: 'created' | 'updated'; entry: MemoryEntry }
  | { status: 'skipped'; reason: 'private-session' | 'unverified-recipe' }

export interface MemoryListFilter {
  kind?: MemoryKind
  limit?: number
}

export interface MemoryContextOptions {
  maxCharacters?: number
  facts?: number
  preferences?: number
  recipes?: number
}

export interface MemoryStoreLimits {
  facts: number
  preferences: number
  recipes: number
  keyCharacters: number
  valueCharacters: number
  recipeSteps: number
  toolArgumentsCharacters: number
}

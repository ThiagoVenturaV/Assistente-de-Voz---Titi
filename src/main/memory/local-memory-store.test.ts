import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MemoryWriteContext } from './contracts'
import { LocalMemoryStore } from './local-memory-store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('LocalMemoryStore', () => {
  it('não grava nem aprende em uma sessão privada', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)
    const privateContext = context(false)

    expect(await store.rememberFact(
      { key: 'nome', value: 'Thiago' },
      privateContext
    )).toEqual({ status: 'skipped', reason: 'private-session' })
    expect(await store.learnRecipe(recipeInput(true), privateContext)).toEqual({
      status: 'skipped',
      reason: 'private-session'
    })
    expect(await store.list()).toEqual([])
    await expect(access(join(directory, 'memory.json'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('persiste fatos e preferências com origem e data', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)
    const writeContext: MemoryWriteContext = {
      keepHistory: true,
      source: {
        kind: 'user-statement',
        conversationId: 'conversation-1',
        capturedAt: '2026-08-15T15:00:00.000Z'
      }
    }

    await store.rememberFact({ key: 'Nome', value: 'Thiago' }, writeContext)
    await store.rememberPreference(
      { key: 'Navegador padrão', value: 'Brave' },
      writeContext
    )

    const reloaded = new LocalMemoryStore(directory)
    const entries = await reloaded.list()
    expect(entries).toHaveLength(2)
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'fact', key: 'Nome', value: 'Thiago' }),
      expect.objectContaining({
        kind: 'preference',
        key: 'Navegador padrão',
        value: 'Brave',
        source: expect.objectContaining({
          kind: 'user-statement',
          conversationId: 'conversation-1',
          capturedAt: '2026-08-15T15:00:00.000Z'
        })
      })
    ]))
  })

  it('deduplica por tipo e chave, preservando a criação e atualizando a origem', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)
    const first = await store.rememberPreference(
      { key: 'Navegador padrão', value: 'Chrome' },
      context(true)
    )
    const second = await store.rememberPreference(
      { key: ' navegador  padrao ', value: 'Brave' },
      {
        keepHistory: true,
        source: { kind: 'user-correction', messageId: 'correction-1' }
      }
    )

    expect(first.status).toBe('created')
    expect(second.status).toBe('updated')
    const entries = await store.list({ kind: 'preference' })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: first.status === 'created' ? first.entry.id : '',
      value: 'Brave',
      source: { kind: 'user-correction', messageId: 'correction-1' }
    })
  })

  it('só aprende receitas verificadas e atualiza a mesma intenção', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)

    expect(await store.learnRecipe(recipeInput(false), context(true))).toEqual({
      status: 'skipped',
      reason: 'unverified-recipe'
    })
    const first = await store.learnRecipe(recipeInput(true), context(true, 'tool-success'))
    const second = await store.learnRecipe({
      ...recipeInput(true),
      summary: 'Abre pelo executável localizado no usuário.',
      steps: [{
        tool: 'open_executable',
        arguments: { path: 'C:\\Users\\thiag\\AppData\\Local\\Spotify\\Spotify.exe' }
      }]
    }, context(true, 'tool-success'))

    expect(first.status).toBe('created')
    expect(second.status).toBe('updated')
    const recipes = await store.list({ kind: 'recipe' })
    expect(recipes).toHaveLength(1)
    expect(recipes[0]).toMatchObject({
      kind: 'recipe',
      summary: 'Abre pelo executável localizado no usuário.',
      verification: { message: 'O processo iniciou.' },
      source: { kind: 'tool-success', tool: 'open_application' }
    })
  })

  it('não persiste segredos encontrados nos argumentos de uma receita', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)

    await store.learnRecipe({
      ...recipeInput(true),
      steps: [{
        tool: 'web_request',
        arguments: {
          url: 'https://example.com',
          headers: { Authorization: 'Bearer private', 'X-Api-Key': 'private' },
          nested: [{ password: 'private', safe: 'visible' }]
        }
      }]
    }, context(true, 'tool-success'))

    const [recipe] = await store.list({ kind: 'recipe' })
    if (recipe?.kind !== 'recipe') throw new Error('Receita não criada no teste.')
    expect(recipe.steps[0].arguments).toEqual({
      url: 'https://example.com',
      headers: {
        Authorization: '[não armazenado]',
        'X-Api-Key': '[não armazenado]'
      },
      nested: [{ password: '[não armazenado]', safe: 'visible' }]
    })
  })

  it('aplica limites por categoria e conserva os itens mais recentes', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory, { facts: 2 })

    await store.rememberFact({ key: 'fato 1', value: 'a' }, context(true))
    await store.rememberFact({ key: 'fato 2', value: 'b' }, context(true))
    await store.rememberFact({ key: 'fato 3', value: 'c' }, context(true))

    const facts = await store.list({ kind: 'fact' })
    expect(facts).toHaveLength(2)
    expect(facts.map((entry) => 'key' in entry && entry.key)).toEqual([
      'fato 3',
      'fato 2'
    ])
  })

  it('lista, remove, limpa e produz contexto enxuto para o prompt', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)
    const fact = await store.rememberFact(
      { key: 'Nome do mascote', value: 'Titi' },
      context(true)
    )
    await store.rememberPreference(
      { key: 'Navegador', value: 'Brave' },
      context(true)
    )
    await store.learnRecipe(recipeInput(true), context(true, 'tool-success'))

    const prompt = await store.buildPromptContext({ maxCharacters: 1_000 })
    expect(prompt).toContain('Fatos do usuário')
    expect(prompt).toContain('Nome do mascote: Titi')
    expect(prompt).toContain('Preferências do usuário')
    expect(prompt).toContain('Receitas verificadas')
    expect(prompt).not.toContain('conversationId')
    expect(await store.buildPromptContext({ recipes: 0 })).not.toContain('Receitas verificadas')

    if (fact.status !== 'created') throw new Error('Fato não criado no teste.')
    expect(await store.remove(fact.entry.id)).toBe(true)
    expect(await store.remove('missing')).toBe(false)
    expect(await store.clear('preference')).toBe(1)
    expect(await store.list()).toHaveLength(1)
    expect(await store.clear()).toBe(1)
    expect(await store.buildPromptContext()).toBe('')
  })

  it('serializa escritas concorrentes sem perder memórias', async () => {
    const directory = await createTemporaryDirectory()
    const store = new LocalMemoryStore(directory)

    await Promise.all(Array.from({ length: 20 }, (_, index) =>
      store.rememberFact(
        { key: `fato ${index}`, value: `valor ${index}` },
        context(true)
      )
    ))

    expect(await store.list({ kind: 'fact' })).toHaveLength(20)
  })
})

function context(
  keepHistory: boolean,
  kind: MemoryWriteContext['source']['kind'] = 'user-statement'
): MemoryWriteContext {
  return {
    keepHistory,
    source: {
      kind,
      ...(kind === 'tool-success' ? { tool: 'open_application' } : {})
    }
  }
}

function recipeInput(ok: boolean) {
  return {
    name: 'Abrir Spotify',
    trigger: 'abrir o spotify',
    summary: 'Abre o aplicativo de música do usuário.',
    steps: [{ tool: 'open_application', arguments: { application: 'spotify' } }],
    verification: { ok, message: 'O processo iniciou.' }
  }
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'titi-memory-'))
  temporaryDirectories.push(directory)
  return directory
}

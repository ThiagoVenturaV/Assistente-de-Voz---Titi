import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonStore } from './json-store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('JsonStore recovery', () => {
  it('returns an independent fallback when the persisted JSON is corrupted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-json-store-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'settings.json')
    const fallback = { enabled: true, nested: { value: 'default' } }
    await writeFile(path, '{invalid json', 'utf8')
    const store = new JsonStore(path, fallback)

    const first = await store.read()
    first.nested.value = 'changed in memory'
    const second = await store.read()

    expect(second).toEqual(fallback)
    expect(second).not.toBe(fallback)
    expect(second.nested).not.toBe(fallback.nested)
  })

  it('recovers the last valid backup when the primary file is corrupted', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'settings.json')
    const store = new JsonStore(path, { value: 'fallback' })

    await store.write({ value: 'first' })
    await store.write({ value: 'second' })
    await writeFile(path, '{interrupted write', 'utf8')

    expect(await store.read()).toEqual({ value: 'first' })
    expect(JSON.parse(await readFile(`${path}.bak`, 'utf8'))).toEqual({
      value: 'first'
    })
  })

  it('recovers from the backup when an interruption leaves the primary absent', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'conversations.json')
    await writeFile(`${path}.bak`, JSON.stringify({ conversations: ['safe'] }), 'utf8')
    const store = new JsonStore(path, { conversations: [] as string[] })

    expect(await store.read()).toEqual({ conversations: ['safe'] })
  })

  it('serializes concurrent writes and leaves no temporary file behind', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'activity.json')
    const store = new JsonStore(path, { value: 0 })

    await Promise.all([
      store.write({ value: 1 }),
      store.write({ value: 2 }),
      store.write({ value: 3 })
    ])

    expect(await store.read()).toEqual({ value: 3 })
    await expect(access(`${path}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('purges the previous snapshot when data is explicitly deleted', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'conversations.json')
    const store = new JsonStore(path, { conversations: [] as string[] })

    await store.write({ conversations: ['sensitive'] })
    await store.write({ conversations: ['sensitive', 'newer'] })
    await store.purgeAndWrite({ conversations: [] })

    await expect(access(`${path}.bak`)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ conversations: [] })
  })

  it('rejects an oversized write without replacing the previous value', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'bounded.json')
    const store = new JsonStore(path, { value: 'fallback' }, 80)

    await store.write({ value: 'safe' })
    await expect(store.write({ value: 'x'.repeat(100) })).rejects.toThrow(/limite seguro/i)

    expect(await store.read()).toEqual({ value: 'safe' })
    await expect(access(`${path}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('ignores a persisted file larger than the configured read limit', async () => {
    const directory = await createTemporaryDirectory()
    const path = join(directory, 'oversized.json')
    await writeFile(path, JSON.stringify({ value: 'x'.repeat(100) }), 'utf8')
    const store = new JsonStore(path, { value: 'fallback' }, 80)

    expect(await store.read()).toEqual({ value: 'fallback' })
  })
})

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'titi-json-store-'))
  temporaryDirectories.push(directory)
  return directory
}

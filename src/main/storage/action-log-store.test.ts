import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolActionLogEntry } from '../../shared/contracts'
import { ActionLogStore } from './action-log-store'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('ActionLogStore', () => {
  it('registra ações mais recentes primeiro e permite limpar o histórico', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'titi-actions-'))
    directories.push(directory)
    const store = new ActionLogStore(directory)

    await store.record({ tool: 'open_web', arguments: { query: 'Titi' }, ok: true, message: 'Aberto.', durationMs: 12 })
    await store.record({ tool: 'unknown', arguments: {}, ok: false, message: 'Falhou.', durationMs: 4 })

    const entries = await store.list()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ tool: 'unknown', ok: false })
    expect(entries[1]).toMatchObject({ tool: 'open_web', ok: true })

    await store.clear()
    await expect(store.list()).resolves.toEqual([])
  })

  it('recovers the write queue after a transient persistence failure', async () => {
    let database = { entries: [] as ToolActionLogEntry[] }
    let attempts = 0
    const store = new ActionLogStore('unused', {
      read: async () => structuredClone(database),
      write: async (value) => {
        attempts += 1
        if (attempts === 1) throw new Error('disk busy')
        database = structuredClone(value)
      }
    })

    await expect(store.record({
      tool: 'current_datetime',
      arguments: {},
      ok: true,
      message: 'Primeira',
      durationMs: 1
    })).rejects.toThrow('disk busy')

    await expect(store.record({
      tool: 'current_datetime',
      arguments: {},
      ok: true,
      message: 'Segunda',
      durationMs: 1
    })).resolves.toBeUndefined()
    await expect(store.list()).resolves.toMatchObject([{ message: 'Segunda' }])
  })
})

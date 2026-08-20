import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { ToolActionLogEntry } from '../../shared/contracts'
import { JsonStore } from './json-store'

interface ActionLogDatabase {
  entries: ToolActionLogEntry[]
}

interface ActionLogPersistence {
  read(): Promise<ActionLogDatabase>
  write(value: ActionLogDatabase): Promise<void>
  purgeAndWrite?(value: ActionLogDatabase): Promise<void>
}

const EMPTY_DATABASE: ActionLogDatabase = { entries: [] }
const MAX_ENTRIES = 500

export class ActionLogStore {
  private readonly store: ActionLogPersistence
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string, persistence?: ActionLogPersistence) {
    this.store = persistence
      ?? new JsonStore(join(userDataPath, 'actions.json'), EMPTY_DATABASE)
  }

  async list(limit = 100): Promise<ToolActionLogEntry[]> {
    await this.writeQueue.catch(() => undefined)
    const database = await this.store.read()
    return database.entries.slice(0, Math.max(0, limit))
  }

  async record(entry: Omit<ToolActionLogEntry, 'id' | 'createdAt'>): Promise<void> {
    const action: ToolActionLogEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    }
    const operation = this.writeQueue.catch(() => undefined).then(async () => {
      const database = await this.store.read()
      database.entries.unshift(action)
      database.entries = database.entries.slice(0, MAX_ENTRIES)
      await this.store.write(database)
    })
    this.writeQueue = operation
    return operation
  }

  async clear(): Promise<void> {
    const operation = this.writeQueue.catch(() => undefined)
      .then(() => this.store.purgeAndWrite
        ? this.store.purgeAndWrite(structuredClone(EMPTY_DATABASE))
        : this.store.write(structuredClone(EMPTY_DATABASE)))
    this.writeQueue = operation
    return operation
  }
}

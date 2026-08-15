import {
  mkdir,
  open,
  readFile,
  rename,
  rm
} from 'node:fs/promises'
import { dirname } from 'node:path'

export class JsonStore<T> {
  private readonly backupPath: string
  private readonly temporaryPath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly fallback: T
  ) {
    this.backupPath = `${filePath}.bak`
    this.temporaryPath = `${filePath}.tmp`
  }

  async read(): Promise<T> {
    await this.writeQueue

    return await readJson<T>(this.filePath)
      ?? await readJson<T>(this.backupPath)
      ?? structuredClone(this.fallback)
  }

  async write(value: T): Promise<void> {
    const snapshot = structuredClone(value)
    const operation = this.writeQueue.then(() => this.writeAtomically(snapshot))

    // Uma falha deve ser devolvida ao chamador sem bloquear as próximas escritas.
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  private async writeAtomically(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const source = JSON.stringify(value, null, 2)

    try {
      const temporary = await open(this.temporaryPath, 'w')
      try {
        await temporary.writeFile(source, 'utf8')
        await temporary.sync()
      } finally {
        await temporary.close()
      }

      if (await hasValidJson(this.filePath)) {
        await rm(this.backupPath, { force: true })
        await rename(this.filePath, this.backupPath)
      } else {
        // Nunca substitui um backup válido por um arquivo principal corrompido.
        await rm(this.filePath, { force: true })
      }

      await rename(this.temporaryPath, this.filePath)
    } catch (error) {
      await rm(this.temporaryPath, { force: true })
      throw error
    }
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

async function hasValidJson(path: string): Promise<boolean> {
  return await readJson(path) !== null
}

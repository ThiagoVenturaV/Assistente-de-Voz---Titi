import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat
} from 'node:fs/promises'
import { dirname } from 'node:path'

export const MAX_JSON_STORE_BYTES = 64 * 1024 * 1024

export class JsonStore<T> {
  private readonly backupPath: string
  private readonly temporaryPath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly fallback: T,
    private readonly maximumBytes = MAX_JSON_STORE_BYTES
  ) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
      throw new Error('O limite do armazenamento JSON é inválido.')
    }
    this.backupPath = `${filePath}.bak`
    this.temporaryPath = `${filePath}.tmp`
  }

  async read(): Promise<T> {
    await this.writeQueue

    return await readJson<T>(this.filePath, this.maximumBytes)
      ?? await readJson<T>(this.backupPath, this.maximumBytes)
      ?? structuredClone(this.fallback)
  }

  async write(value: T): Promise<void> {
    const snapshot = structuredClone(value)
    const operation = this.writeQueue.then(() => this.writeAtomically(snapshot, true))

    // Uma falha deve ser devolvida ao chamador sem bloquear as próximas escritas.
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  async purgeAndWrite(value: T): Promise<void> {
    const snapshot = structuredClone(value)
    const operation = this.writeQueue.then(() => this.writeAtomically(snapshot, false))

    // Uma falha deve ser devolvida ao chamador sem bloquear as próximas escritas.
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  private async writeAtomically(value: T, preserveBackup: boolean): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const source = JSON.stringify(value, null, 2)
    if (Buffer.byteLength(source, 'utf8') > this.maximumBytes) {
      throw new Error('O armazenamento local excedeu o limite seguro de tamanho.')
    }

    try {
      await rm(this.temporaryPath, { force: true })
      const temporary = await open(this.temporaryPath, 'wx', 0o600)
      try {
        await temporary.writeFile(source, 'utf8')
        await temporary.sync()
      } finally {
        await temporary.close()
      }

      if (preserveBackup && await hasValidJson(this.filePath, this.maximumBytes)) {
        await rm(this.backupPath, { force: true })
        await rename(this.filePath, this.backupPath)
      } else {
        // Exclusões explícitas não podem deixar uma cópia recuperável em .bak.
        await rm(this.backupPath, { force: true })
      }

      // rename substitui o destino atomicamente; assim uma exclusão parcial
      // nunca deixa o banco inteiro ausente entre remoção e gravação.
      await rename(this.temporaryPath, this.filePath)
      if (!preserveBackup) await rm(this.backupPath, { force: true })
    } catch (error) {
      await rm(this.temporaryPath, { force: true })
      throw error
    }
  }
}

async function readJson<T>(path: string, maximumBytes: number): Promise<T | null> {
  try {
    const metadata = await stat(path)
    if (!metadata.isFile() || metadata.size > maximumBytes) return null
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

async function hasValidJson(path: string, maximumBytes: number): Promise<boolean> {
  return await readJson(path, maximumBytes) !== null
}

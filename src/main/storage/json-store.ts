import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export class JsonStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly fallback: T
  ) {}

  async read(): Promise<T> {
    try {
      const source = await readFile(this.filePath, 'utf8')
      return JSON.parse(source) as T
    } catch {
      return structuredClone(this.fallback)
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(value, null, 2), 'utf8')
  }
}

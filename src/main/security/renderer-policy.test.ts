import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('renderer document policy', () => {
  it('forces secure renderer hardening flags and navigation lock', async () => {
    const indexSource = await readFile(resolve('src/main/index.ts'), 'utf8')
    expect(indexSource).toMatch(/contextIsolation:\s*true/)
    expect(indexSource).toMatch(/sandbox:\s*true/)
    expect(indexSource).toMatch(/nodeIntegration:\s*false/)
    expect(indexSource).toMatch(/setWindowOpenHandler/)
    expect(indexSource).toMatch(/will-navigate/)
    expect(indexSource).toMatch(/event\.preventDefault\(\)/)
  })

  it('blocks executable objects, forms, frames and base URL rewriting', async () => {
    const html = await readFile(resolve('src/renderer/index.html'), 'utf8')
    const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1]

    expect(policy).toBeDefined()
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("connect-src 'self'")
    expect(policy).toContain("form-action 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toMatch(/connect-src[^;]*https?:\/\//)
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/)
  })
})

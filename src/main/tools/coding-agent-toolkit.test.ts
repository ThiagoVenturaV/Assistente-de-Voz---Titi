import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BoundedOutputExcerpt,
  CodingAgentToolkit,
  discoverWorkspaceRules,
  isProtectedSystemPath,
  redactSensitiveDiagnosticText,
  writeStagedAtomicFile
} from './coding-agent-toolkit'

describe('CodingAgentToolkit (Codex / Cursor / Antigravity behaviors)', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('retém head e tail em BoundedOutputExcerpt sem estourar memória', () => {
    const excerpt = new BoundedOutputExcerpt(10)
    excerpt.append(Buffer.from('1234567890ABCDEF', 'utf8'))
    expect(excerpt.truncated).toBe(true)
    expect(excerpt.observedBytes).toBe(16)
    expect(excerpt.text).toContain('12345')
    expect(excerpt.text).toContain('BCDEF')
  })

  it('redige tokens e credenciais em saídas de diagnóstico', () => {
    const raw = 'Authorization: Bearer my_secret_token_1234567890 e api_key=topsecret9988'
    const clean = redactSensitiveDiagnosticText(raw)
    expect(clean).toContain('Bearer [REDACTED]')
    expect(clean).toContain('api_key=[REDACTED]')
    expect(clean).not.toContain('my_secret_token_1234567890')
  })

  it('executa fluxo completo de código (write_file, read_file, edit_file, list_directory, search_files)', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'titi-agent-test-'))
    tempDirs.push(workDir)
    const toolkit = new CodingAgentToolkit()
    const filePath = join(workDir, 'src', 'greeter.ts')

    const writeRes = await toolkit.writeFileTool({
      path: filePath,
      content: 'export function greet(name: string): string {\n  return `Olá, ${name}!`\n}\n'
    })
    expect(writeRes.ok).toBe(true)
    expect(writeRes.status).toBe('confirmed')

    const readRes = await toolkit.readFileTool({ path: filePath, startLine: 1, endLine: 3 })
    expect(readRes.ok).toBe(true)
    expect(readRes.message).toContain('1: export function greet')

    const editRes = await toolkit.editFileTool({
      path: filePath,
      target: 'Olá, ${name}!',
      replacement: 'E aí, ${name}!'
    })
    expect(editRes.ok).toBe(true)
    expect(editRes.details?.beforeSha256).not.toBe(editRes.details?.afterSha256)

    const listRes = await toolkit.listDirectoryTool({ path: workDir, recursive: true })
    expect(listRes.ok).toBe(true)
    expect(listRes.message).toContain('greeter.ts')

    const searchRes = await toolkit.searchFilesTool({ path: workDir, query: 'E aí, ${name}' })
    expect(searchRes.ok).toBe(true)
    expect(searchRes.message).toContain('greeter.ts:2:')
  })

  it('executa comando no terminal PowerShell com supervisão e timeout', async () => {
    const toolkit = new CodingAgentToolkit()
    const res = await toolkit.executeTerminal({
      command: 'Write-Output "Titi-Agent-PowerShell-OK"'
    })
    expect(res.ok).toBe(true)
    expect(res.status).toBe('confirmed')
    expect(res.message).toContain('Titi-Agent-PowerShell-OK')
  })

  it('descobre regras de projeto estilo AGENTS.md / TITI.md / .cursorrules', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'titi-rules-test-'))
    tempDirs.push(workDir)
    await writeStagedAtomicFile(join(workDir, 'TITI.md'), '# Regras do Projeto Titi\n- Use TypeScript sempre.')

    const rules = await discoverWorkspaceRules(workDir)
    expect(rules).toContain('Diretrizes do projeto descobertas em TITI.md')
    expect(rules).toContain('Use TypeScript sempre')
  })

  it('protege caminhos críticos do sistema operacional contra gravação indevida', () => {
    expect(isProtectedSystemPath('C:\\Windows\\System32\\cmd.exe')).toBe(true)
    expect(isProtectedSystemPath('C:\\Users\\user\\.ssh\\id_ed25519')).toBe(true)
    expect(isProtectedSystemPath('C:\\Users\\user\\Projetos\\app.ts')).toBe(false)
  })
})

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BoundedOutputExcerpt,
  computeByteEntropy,
  inspectPeBinaryBuffer,
  isProtectedSystemPath,
  ReaHarnessToolkit,
  redactSensitiveDiagnosticText
} from './rea-harness-toolkit'

describe('ReaHarnessToolkit & REA primitives', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('retém head e tail limitados em BoundedOutputExcerpt como no REA', () => {
    const excerpt = new BoundedOutputExcerpt(10)
    excerpt.append(Buffer.from('1234567890ABCDEF', 'utf8'))
    expect(excerpt.truncated).toBe(true)
    expect(excerpt.observedBytes).toBe(16)
    expect(excerpt.text).toBe('12345 … [output omitted] … BCDEF')
  })

  it('redige credenciais em saídas de diagnóstico', () => {
    const raw = 'Authorization: Bearer secret_token_1234567890 e api_key=minha_chave_secreta_99'
    const clean = redactSensitiveDiagnosticText(raw)
    expect(clean).toContain('Bearer [REDACTED]')
    expect(clean).toContain('api_key=[REDACTED]')
    expect(clean).not.toContain('secret_token_1234567890')
  })

  it('executa fluxo completo de código (write_file, read_file, edit_file, list_directory, search_files)', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'titi-rea-test-'))
    tempDirs.push(workDir)
    const toolkit = new ReaHarnessToolkit()
    const filePath = join(workDir, 'src', 'hello.ts')

    const writeRes = await toolkit.writeFileTool({
      path: filePath,
      content: 'export function greet(name: string): string {\n  return `Olá, ${name}!`\n}\n'
    })
    expect(writeRes.ok).toBe(true)
    expect(writeRes.status).toBe('confirmed')

    const readRes = await toolkit.readFileTool({ path: filePath, startLine: 1, endLine: 3 })
    expect(readRes.ok).toBe(true)
    expect(readRes.message).toContain('1: export function greet')
    expect(readRes.details).toMatchObject({
      totalLines: 4,
      _meta: { provenance: { untrusted_content: true } }
    })

    const editRes = await toolkit.editFileTool({
      path: filePath,
      target: 'Olá, ${name}!',
      replacement: 'Bem-vindo ao Titi, ${name}!'
    })
    expect(editRes.ok).toBe(true)
    expect(editRes.details?.beforeSha256).not.toBe(editRes.details?.afterSha256)

    const listRes = await toolkit.listDirectoryTool({ path: workDir, recursive: true })
    expect(listRes.ok).toBe(true)
    expect(listRes.message).toContain('hello.ts')

    const searchRes = await toolkit.searchFilesTool({ path: workDir, query: 'Bem-vindo ao Titi' })
    expect(searchRes.ok).toBe(true)
    expect(searchRes.message).toContain('hello.ts:2:')
  })

  it('executa comando supervisionado no terminal com BoundedOutputExcerpt', async () => {
    const toolkit = new ReaHarnessToolkit()
    const res = await toolkit.executeTerminal({
      command: 'Write-Output "Titi-REA-Terminal-OK"'
    })
    expect(res.ok).toBe(true)
    expect(res.status).toBe('confirmed')
    expect(res.message).toContain('Titi-REA-Terminal-OK')
    expect(res.details).toMatchObject({
      exitCode: 0,
      _meta: { provenance: { untrusted_content: true } }
    })
  })

  it('inspeciona cabeçalho PE e entropia de bytes no padrão REA', async () => {
    const fakePe = Buffer.alloc(512, 0)
    // MZ magic
    fakePe[0] = 0x4d
    fakePe[1] = 0x5a
    // e_lfanew = 0x80
    fakePe.writeUInt32LE(0x80, 0x3c)
    // PE\0\0
    fakePe[0x80] = 0x50
    fakePe[0x81] = 0x45
    // Machine = x64 (0x8664), 1 section, OptionalHeader size = 240, characteristics = 0x0022
    fakePe.writeUInt16LE(0x8664, 0x84)
    fakePe.writeUInt16LE(1, 0x86)
    fakePe.writeUInt16LE(240, 0x94)
    fakePe.writeUInt16LE(0x0022, 0x96)
    // PE32+ magic (0x20b)
    fakePe.writeUInt16LE(0x20b, 0x98)
    fakePe.writeUInt32LE(0x1000, 0x98 + 16)
    fakePe.writeBigUInt64LE(0x140000000n, 0x98 + 24)
    fakePe.writeUInt16LE(2, 0x98 + 68)
    // Section .text at 0x98 + 240 = 0x188
    fakePe.write('.text\0\0\0', 0x188, 'utf8')
    fakePe.writeUInt32LE(0x200, 0x188 + 8)
    fakePe.writeUInt32LE(0x40, 0x188 + 16)
    fakePe.writeUInt32LE(0x1c0, 0x188 + 20)
    fakePe.write('KERNEL32.dll https://rea.tools', 0x1c0, 'utf8')

    const parsed = inspectPeBinaryBuffer(fakePe)
    expect(parsed).not.toBeNull()
    expect(parsed?.machine).toContain('x64')
    expect(parsed?.subsystem).toBe('WINDOWS_GUI')
    expect(parsed?.sections[0]?.name).toBe('.text')
    expect(parsed?.importedDlls).toContain('kernel32.dll')
    expect(computeByteEntropy(Buffer.from('AAAAAAAA', 'utf8'))).toBe(0)
    expect(computeByteEntropy(Buffer.from('ABCDEFGH', 'utf8'))).toBe(3)

    const workDir = await mkdtemp(join(tmpdir(), 'titi-rea-pe-'))
    tempDirs.push(workDir)
    const binPath = join(workDir, 'sample.exe')
    const toolkit = new ReaHarnessToolkit()
    await toolkit.writeFileTool({ path: binPath, content: fakePe.toString('latin1') })
    const inspectRes = await toolkit.inspectArtifactRea({ path: binPath })
    expect(inspectRes.ok).toBe(true)
    expect(inspectRes.message).toContain('Evidência REA para sample.exe')
  })

  it('protege caminhos críticos do sistema e credenciais', () => {
    expect(isProtectedSystemPath('C:\\Windows\\System32\\cmd.exe')).toBe(true)
    expect(isProtectedSystemPath('C:\\Users\\user\\.ssh\\id_rsa')).toBe(true)
    expect(isProtectedSystemPath('C:\\Users\\user\\Desktop\\projeto\\index.ts')).toBe(false)
  })
})

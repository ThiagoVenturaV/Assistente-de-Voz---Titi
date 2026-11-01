import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  unlink
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ToolExecutionResult } from './contracts'

/**
 * Metadata marker tagging tool outputs that originate from the local project,
 * workspace files, or child processes, preventing prompt injection.
 */
export const UNTRUSTED_WORKSPACE_DATA_META = Object.freeze({
  provenance: Object.freeze({
    untrusted_content: true,
    source: 'workspace_execution'
  })
})

/**
 * Byte-bounded head and tail buffer for process streams.
 * Prevents memory exhaustion while retaining the initial startup evidence and latest failures/diagnostics.
 */
export class BoundedOutputExcerpt {
  private head: Buffer = Buffer.alloc(0)
  private tail: Buffer = Buffer.alloc(0)
  private total = 0
  private readonly headLimit: number
  private readonly tailLimit: number

  constructor(readonly limit: number) {
    this.headLimit = Math.ceil(limit / 2)
    this.tailLimit = limit - this.headLimit
  }

  append(chunk: Buffer): void {
    this.total += chunk.byteLength
    const headCount = Math.min(chunk.byteLength, this.headLimit - this.head.byteLength)
    if (headCount > 0) {
      this.head = Buffer.concat([this.head, chunk.subarray(0, headCount)])
    }
    const rest = chunk.subarray(headCount)
    if (rest.byteLength > 0 && this.tailLimit > 0) {
      const retained = rest.subarray(-this.tailLimit)
      this.tail = Buffer.concat([
        this.tail.subarray(
          Math.max(0, this.tail.byteLength + retained.byteLength - this.tailLimit)
        ),
        retained
      ])
    }
  }

  get truncated(): boolean {
    return this.total > this.limit
  }

  get observedBytes(): number {
    return this.total
  }

  get text(): string {
    return this.truncated
      ? `${this.head.toString('utf8')} … [saída intermediária omitida] … ${this.tail.toString('utf8')}`
      : Buffer.concat([this.head, this.tail]).toString('utf8')
  }
}

export interface BoundedCommandResult {
  readonly exitCode: number | string | null
  readonly stdout: string
  readonly stderr: string
  readonly outputTruncated: boolean
  readonly durationMs: number
  readonly timedOut: boolean
}

export interface StableFileObservation {
  readonly path: string
  readonly sha256: string
  readonly bytes: number
  readonly isBinary: boolean
}

const DEFAULT_OUTPUT_LIMIT_BYTES = 32 * 1024
const DEFAULT_TERMINAL_TIMEOUT_MS = 30_000
const MAX_TERMINAL_TIMEOUT_MS = 120_000
const MAX_READ_LINES = 400
const MAX_READ_BYTES = 256 * 1024
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'release',
  '.next',
  '.turbo',
  'coverage',
  '.gemini',
  '.codex'
])

const RULE_FILE_CANDIDATES = [
  'TITI.md',
  'AGENTS.md',
  '.cursorrules',
  'GEMINI.md'
]

/**
 * Automatically discovers workspace guidelines/rules files (e.g. TITI.md, AGENTS.md, .cursorrules, GEMINI.md)
 * walking up to the project root, mirroring Cursor, Codex, and Antigravity.
 */
export async function discoverWorkspaceRules(startDir = process.cwd()): Promise<string | null> {
  try {
    let current = resolve(startDir)
    for (let depth = 0; depth < 5; depth += 1) {
      for (const candidate of RULE_FILE_CANDIDATES) {
        const fullPath = join(current, candidate)
        const content = await readFile(fullPath, 'utf8').catch(() => null)
        if (content && content.trim()) {
          const excerpt = content.trim().slice(0, 4_000)
          return `Diretrizes do projeto descobertas em ${candidate}:\n${excerpt}`
        }
      }
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  } catch {
    // Ignore discovery errors
  }
  return null
}

/**
 * Redacts common inline tokens or passwords in command output.
 */
export function redactSensitiveDiagnosticText(text: string): string {
  return text
    .replace(
      /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}\b/gi,
      '$1[REDACTED]'
    )
    .replace(
      /\b((?:api[_-]?key|token|secret|password|passwd|authorization)\s*[:=]\s*["']?)[^\s"'&]{8,}/gi,
      '$1[REDACTED]'
    )
}

/**
 * Reads a file's stable byte identity (SHA-256) and binary check from its descriptor.
 */
export async function observeStableFile(
  targetPath: string,
  signal?: AbortSignal
): Promise<StableFileObservation> {
  const resolved = resolve(targetPath)
  const handle = await open(resolved, 'r')
  try {
    const initial = await handle.stat()
    if (!initial.isFile()) {
      throw new Error(`O caminho não é um arquivo regular: ${resolved}`)
    }
    const hash = createHash('sha256')
    const chunk = Buffer.allocUnsafe(64 * 1024)
    const header = Buffer.alloc(Math.min(512, initial.size))
    let position = 0

    while (position < initial.size) {
      signal?.throwIfAborted()
      const toRead = Math.min(chunk.byteLength, initial.size - position)
      const { bytesRead } = await handle.read(chunk, 0, toRead, position)
      if (bytesRead === 0) break
      if (position < header.byteLength) {
        const copyLen = Math.min(bytesRead, header.byteLength - position)
        chunk.copy(header, position, 0, copyLen)
      }
      hash.update(chunk.subarray(0, bytesRead))
      position += bytesRead
    }

    const isBinary = header.includes(0x00)
    return {
      path: resolved,
      sha256: hash.digest('hex'),
      bytes: position,
      isBinary
    }
  } finally {
    await handle.close().catch(() => undefined)
  }
}

/**
 * Staged atomic file write (write to temporary sibling, verify descriptor, rename).
 * Eliminates race conditions and prevents partial/corrupted files.
 */
export async function writeStagedAtomicFile(
  targetPath: string,
  content: string,
  createDirs = true,
  signal?: AbortSignal
): Promise<{ path: string; bytes: number; sha256: string }> {
  signal?.throwIfAborted()
  const resolved = resolve(targetPath)
  const dir = dirname(resolved)
  if (createDirs) {
    await mkdir(dir, { recursive: true })
  }

  const stagePath = join(dir, `.${basename(resolved)}.${randomUUID()}.titi-stage.tmp`)
  const bytesBuffer = Buffer.from(content, 'utf8')
  const expectedSha256 = createHash('sha256').update(bytesBuffer).digest('hex')

  const handle = await open(stagePath, 'wx')
  let closed = false
  try {
    await handle.writeFile(bytesBuffer)
    const stagedStat = await handle.stat()
    if (stagedStat.size !== bytesBuffer.byteLength) {
      throw new Error('Falha na verificação de integridade do arquivo temporário.')
    }
    await handle.close()
    closed = true
    await rename(stagePath, resolved)
    return {
      path: resolved,
      bytes: bytesBuffer.byteLength,
      sha256: expectedSha256
    }
  } catch (error) {
    if (!closed) {
      await handle.close().catch(() => undefined)
    }
    await unlink(stagePath).catch(() => undefined)
    throw error
  }
}

/**
 * Supervised process execution with bounded output capture and process-tree termination.
 */
export async function execSupervisedCommand(
  command: string,
  options: {
    cwd?: string
    timeoutMs?: number
    outputLimitBytes?: number
    signal?: AbortSignal
  } = {}
): Promise<BoundedCommandResult> {
  const startedAt = Date.now()
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd()
  const timeoutMs = Math.max(
    1_000,
    Math.min(MAX_TERMINAL_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TERMINAL_TIMEOUT_MS)
  )
  const limit = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES

  const executable = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh'
  const args = process.platform === 'win32'
    ? [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`
    ]
    : ['-c', command]

  return new Promise<BoundedCommandResult>((resolvePromise, rejectPromise) => {
    if (options.signal?.aborted) {
      rejectPromise(abortError(options.signal))
      return
    }

    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    const stdout = new BoundedOutputExcerpt(limit)
    const stderr = new BoundedOutputExcerpt(limit)
    let timedOut = false
    let spawnErr: Error | null = null

    const killProcessTree = (): void => {
      if (!child.pid) return
      if (process.platform === 'win32') {
        spawn('taskkill.exe', ['/T', '/F', '/PID', String(child.pid)], {
          stdio: 'ignore',
          windowsHide: true
        }).on('error', () => {
          child.kill()
        })
      } else {
        child.kill('SIGKILL')
      }
    }

    const onAbort = (): void => {
      killProcessTree()
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const timer = setTimeout(() => {
      timedOut = true
      killProcessTree()
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => stdout.append(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.append(chunk))
    child.on('error', (err) => {
      spawnErr = err
    })

    child.on('close', (code, sig) => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)

      if (options.signal?.aborted) {
        rejectPromise(abortError(options.signal))
        return
      }

      resolvePromise({
        exitCode: spawnErr ? spawnErr.message : (code ?? sig),
        stdout: redactSensitiveDiagnosticText(stdout.text.trimEnd()),
        stderr: redactSensitiveDiagnosticText(stderr.text.trimEnd()),
        outputTruncated: stdout.truncated || stderr.truncated,
        durationMs: Date.now() - startedAt,
        timedOut
      })
    })
  })
}

/**
 * Coding Agent Toolkit for Titi.
 * Provides the same core capabilities as Codex, Claude Code, Antigravity, and Cursor.
 */
export class CodingAgentToolkit {
  async executeTerminal(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const command = typeof args.command === 'string' ? args.command.trim() : ''
    if (!command) {
      return { ok: false, status: 'failed', message: 'Informe o comando a ser executado em command.' }
    }
    const cwd = typeof args.cwd === 'string' && args.cwd.trim()
      ? resolve(args.cwd.trim())
      : process.cwd()
    const timeoutMs = typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs)
      ? args.timeoutMs
      : DEFAULT_TERMINAL_TIMEOUT_MS

    const outcome = await execSupervisedCommand(command, { cwd, timeoutMs, signal })
    const succeeded = !outcome.timedOut && outcome.exitCode === 0
    const combinedOutput = [
      outcome.stdout ? `STDOUT:\n${outcome.stdout}` : '',
      outcome.stderr ? `STDERR:\n${outcome.stderr}` : ''
    ].filter(Boolean).join('\n\n') || '(sem saída de texto)'

    const statusLine = outcome.timedOut
      ? `Comando excedeu o tempo limite (${outcome.durationMs}ms).`
      : `Comando finalizado com código ${String(outcome.exitCode)} em ${outcome.durationMs}ms.`

    return {
      ok: succeeded,
      status: outcome.timedOut ? 'timed_out' : succeeded ? 'confirmed' : 'failed',
      message: `${statusLine}\n${combinedOutput}`,
      details: {
        command,
        cwd,
        exitCode: outcome.exitCode,
        durationMs: outcome.durationMs,
        outputTruncated: outcome.outputTruncated,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        _meta: UNTRUSTED_WORKSPACE_DATA_META
      }
    }
  }

  async readFileTool(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
    if (!rawPath) {
      return { ok: false, status: 'failed', message: 'Informe o caminho do arquivo em path.' }
    }
    const resolved = resolve(rawPath)
    const observation = await observeStableFile(resolved, signal)

    if (observation.isBinary && observation.bytes > 0) {
      return {
        ok: true,
        status: 'confirmed',
        message: `Arquivo binário detectado em ${resolved} (${observation.bytes} bytes, SHA-256: ${observation.sha256}).`,
        details: {
          ...observation,
          _meta: UNTRUSTED_WORKSPACE_DATA_META
        }
      }
    }

    const handle = await open(resolved, 'r')
    let rawText = ''
    try {
      const readLen = Math.min(observation.bytes, MAX_READ_BYTES)
      const buf = Buffer.alloc(readLen)
      const { bytesRead } = await handle.read(buf, 0, readLen, 0)
      rawText = buf.subarray(0, bytesRead).toString('utf8')
    } finally {
      await handle.close().catch(() => undefined)
    }

    const allLines = rawText.split(/\r?\n/)
    const startLine = typeof args.startLine === 'number' && Number.isFinite(args.startLine)
      ? Math.max(1, Math.trunc(args.startLine))
      : 1
    const requestedEnd = typeof args.endLine === 'number' && Number.isFinite(args.endLine)
      ? Math.max(startLine, Math.trunc(args.endLine))
      : startLine + MAX_READ_LINES - 1
    const endLine = Math.min(allLines.length, requestedEnd, startLine + MAX_READ_LINES - 1)

    const numbered = allLines
      .slice(startLine - 1, endLine)
      .map((line, idx) => `${startLine + idx}: ${line}`)
      .join('\n')

    return {
      ok: true,
      status: 'confirmed',
      message: `Arquivo ${resolved} (linhas ${startLine}-${endLine} de ${allLines.length}, SHA-256: ${observation.sha256.slice(0, 12)}):\n${numbered}`,
      details: {
        path: resolved,
        sha256: observation.sha256,
        bytes: observation.bytes,
        startLine,
        endLine,
        totalLines: allLines.length,
        truncated: endLine < allLines.length || observation.bytes > MAX_READ_BYTES,
        content: numbered,
        _meta: UNTRUSTED_WORKSPACE_DATA_META
      }
    }
  }

  async writeFileTool(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
    if (!rawPath) {
      return { ok: false, status: 'failed', message: 'Informe o caminho do arquivo em path.' }
    }
    if (typeof args.content !== 'string') {
      return { ok: false, status: 'failed', message: 'Informe o conteúdo textual em content.' }
    }

    const written = await writeStagedAtomicFile(rawPath, args.content, true, signal)
    return {
      ok: true,
      status: 'confirmed',
      message: `Arquivo gravado com segurança em ${written.path} (${written.bytes} bytes, SHA-256: ${written.sha256.slice(0, 12)}).`,
      details: written
    }
  }

  async editFileTool(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
    const target = typeof args.target === 'string' ? args.target : ''
    const replacement = typeof args.replacement === 'string' ? args.replacement : ''
    const replaceAll = args.replaceAll === true

    if (!rawPath || !target) {
      return {
        ok: false,
        status: 'failed',
        message: 'Informe path e o trecho exato target que deve ser substituído.'
      }
    }

    const resolved = resolve(rawPath)
    const beforeObs = await observeStableFile(resolved, signal)
    const currentContent = await readFile(resolved, 'utf8')

    if (!currentContent.includes(target)) {
      const normalizedTarget = target.replace(/\r\n/g, '\n')
      const normalizedCurrent = currentContent.replace(/\r\n/g, '\n')
      if (!normalizedCurrent.includes(normalizedTarget)) {
        return {
          ok: false,
          status: 'failed',
          message: `O trecho target não foi encontrado em ${resolved}. Use read_file para conferir o conteúdo exato antes de editar.`
        }
      }
      const usesCrlf = currentContent.includes('\r\n')
      const updatedNormalized = replaceAll
        ? normalizedCurrent.split(normalizedTarget).join(replacement.replace(/\r\n/g, '\n'))
        : normalizedCurrent.replace(normalizedTarget, replacement.replace(/\r\n/g, '\n'))
      const finalContent = usesCrlf ? updatedNormalized.replace(/\n/g, '\r\n') : updatedNormalized
      const written = await writeStagedAtomicFile(resolved, finalContent, false, signal)
      return {
        ok: true,
        status: 'confirmed',
        message: `Arquivo editado com sucesso em ${written.path} (SHA-256: ${beforeObs.sha256.slice(0, 8)} → ${written.sha256.slice(0, 8)}).`,
        details: {
          path: written.path,
          beforeSha256: beforeObs.sha256,
          afterSha256: written.sha256,
          bytes: written.bytes
        }
      }
    }

    const occurrences = currentContent.split(target).length - 1
    const updatedContent = replaceAll
      ? currentContent.split(target).join(replacement)
      : currentContent.replace(target, replacement)
    const written = await writeStagedAtomicFile(resolved, updatedContent, false, signal)

    return {
      ok: true,
      status: 'confirmed',
      message: `Arquivo editado com sucesso em ${written.path} (${replaceAll ? occurrences : 1} substituição, SHA-256: ${beforeObs.sha256.slice(0, 8)} → ${written.sha256.slice(0, 8)}).`,
      details: {
        path: written.path,
        replacementsCount: replaceAll ? occurrences : 1,
        beforeSha256: beforeObs.sha256,
        afterSha256: written.sha256,
        bytes: written.bytes
      }
    }
  }

  async listDirectoryTool(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const rawPath = typeof args.path === 'string' && args.path.trim()
      ? args.path.trim()
      : process.cwd()
    const resolved = resolve(rawPath)
    const recursive = args.recursive === true
    const maxEntries = typeof args.maxEntries === 'number' && Number.isFinite(args.maxEntries)
      ? Math.max(1, Math.min(200, Math.trunc(args.maxEntries)))
      : 80

    const entries: Array<{ path: string; kind: 'file' | 'directory'; bytes?: number }> = []

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (entries.length >= maxEntries || depth > 5) return
      signal?.throwIfAborted()
      const items = await readdir(dir, { withFileTypes: true })
      for (const item of items) {
        if (entries.length >= maxEntries) break
        if (item.isDirectory() && IGNORED_DIRECTORIES.has(item.name) && depth > 0) continue
        const full = join(dir, item.name)
        const rel = relative(resolved, full) || item.name
        if (item.isDirectory()) {
          entries.push({ path: rel, kind: 'directory' })
          if (recursive) {
            await walk(full, depth + 1)
          }
        } else if (item.isFile()) {
          const info = await stat(full).catch(() => null)
          entries.push({
            path: rel,
            kind: 'file',
            ...(info ? { bytes: info.size } : {})
          })
        }
      }
    }

    await walk(resolved, 0)
    const lines = entries.map((e) => (
      e.kind === 'directory' ? `[DIR]  ${e.path}` : `[FILE] ${e.path}${e.bytes !== undefined ? ` (${e.bytes} B)` : ''}`
    ))

    return {
      ok: true,
      status: 'confirmed',
      message: `Conteúdo de ${resolved} (${entries.length} itens):\n${lines.join('\n')}`,
      details: {
        path: resolved,
        count: entries.length,
        entries
      }
    }
  }

  async searchFilesTool(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) {
      return { ok: false, status: 'failed', message: 'Informe o texto ou padrão a buscar em query.' }
    }
    const rootDir = typeof args.path === 'string' && args.path.trim()
      ? resolve(args.path.trim())
      : process.cwd()
    const filePattern = typeof args.filePattern === 'string' ? args.filePattern.trim().toLowerCase() : ''
    const maxResults = typeof args.maxResults === 'number' && Number.isFinite(args.maxResults)
      ? Math.max(1, Math.min(100, Math.trunc(args.maxResults)))
      : 30

    const matches: Array<{ file: string; line: number; text: string }> = []
    const needle = query.toLowerCase()

    const scanDir = async (dir: string, depth: number): Promise<void> => {
      if (matches.length >= maxResults || depth > 6) return
      signal?.throwIfAborted()
      const dirents = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const d of dirents) {
        if (matches.length >= maxResults) break
        if (d.isDirectory()) {
          if (IGNORED_DIRECTORIES.has(d.name)) continue
          await scanDir(join(dir, d.name), depth + 1)
        } else if (d.isFile()) {
          if (filePattern && !d.name.toLowerCase().includes(filePattern.replace(/\*/g, ''))) {
            continue
          }
          const full = join(dir, d.name)
          const rel = relative(rootDir, full)
          if (rel.toLowerCase().includes(needle) && matches.length < maxResults) {
            matches.push({ file: rel, line: 0, text: '[nome de arquivo correspondente]' })
          }
          const info = await stat(full).catch(() => null)
          if (!info || info.size > 512 * 1024) continue
          const buf = await readFile(full).catch(() => null)
          if (!buf || buf.subarray(0, 512).includes(0x00)) continue
          const lines = buf.toString('utf8').split(/\r?\n/)
          for (let i = 0; i < lines.length; i += 1) {
            if (lines[i]!.toLowerCase().includes(needle)) {
              matches.push({
                file: rel,
                line: i + 1,
                text: lines[i]!.trim().slice(0, 180)
              })
              if (matches.length >= maxResults) break
            }
          }
        }
      }
    }

    await scanDir(rootDir, 0)
    if (matches.length === 0) {
      return {
        ok: true,
        status: 'confirmed',
        message: `Nenhuma ocorrência encontrada para "${query}" em ${rootDir}.`,
        details: { path: rootDir, query, matches: [] }
      }
    }

    const formatted = matches
      .map((m) => (m.line > 0 ? `${m.file}:${m.line}: ${m.text}` : `${m.file} ${m.text}`))
      .join('\n')

    return {
      ok: true,
      status: 'confirmed',
      message: `Encontradas ${matches.length} ocorrências para "${query}" em ${rootDir}:\n${formatted}`,
      details: {
        path: rootDir,
        query,
        matches,
        _meta: UNTRUSTED_WORKSPACE_DATA_META
      }
    }
  }
}

export function isProtectedSystemPath(rawPath: string): boolean {
  const trimmed = rawPath.trim()
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return true
  const resolved = isAbsolute(trimmed) ? resolve(trimmed) : resolve(process.cwd(), trimmed)
  const lower = resolved.toLowerCase()
  return (
    lower.startsWith('c:\\windows\\') ||
    lower === 'c:\\windows' ||
    lower.startsWith('c:\\program files\\windows defender') ||
    lower.includes('\\.ssh\\id_') ||
    lower.includes('\\.aws\\credentials') ||
    lower.endsWith('\\sam') ||
    lower.endsWith('\\ntds.dit')
  )
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('A operação foi interrompida.')
  error.name = 'AbortError'
  throw error
}

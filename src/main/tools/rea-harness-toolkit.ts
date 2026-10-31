import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  unlink
} from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ToolExecutionResult } from './contracts'

/**
 * Metadata marker ported from REA (`src/server/toolResultEncoding.ts`)
 * tagging tool outputs that contain untrusted target/file/process content.
 */
export const TARGET_CONTENT_RESULT_META = Object.freeze({
  provenance: Object.freeze({
    untrusted_content: true,
    source: 'analysis_target'
  })
})

/**
 * Byte-bounded head and tail output buffer ported from REA
 * (`src/process/BoundedOutputExcerpt.ts`).
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
      ? `${this.head.toString('utf8')} … [output omitted] … ${this.tail.toString('utf8')}`
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
  readonly magicHex: string
  readonly formatHint: 'pe-executable' | 'zip-archive' | 'elf-binary' | 'asar-archive' | 'pdf' | 'utf8-text' | 'binary'
}

export interface PeBinaryInspection {
  readonly machine: string
  readonly subsystem: string
  readonly is64Bit: boolean
  readonly characteristics: string[]
  readonly timestampIso: string | null
  readonly entryPointRva: string
  readonly imageBase: string
  readonly sections: Array<{
    name: string
    virtualSize: number
    rawSize: number
    entropy: number
  }>
  readonly importedDlls: string[]
  readonly notableStrings: string[]
}

export interface AsarArchiveInspection {
  readonly headerSize: number
  readonly totalEntries: number
  readonly sampleFiles: string[]
  readonly packageJson?: {
    name?: string
    version?: string
    main?: string
  }
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
  'coverage'
])

/**
 * Redacts common inline bearer tokens or credential assignments in diagnostic output,
 * inspired by REA's `ProviderDiagnosticRedaction.ts`.
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
 * Computes Shannon byte entropy (0.00 to 8.00 bits/byte) as used in REA's
 * binary/section entropy analysis (`registerByteEntropyTool.ts`).
 */
export function computeByteEntropy(buffer: Buffer): number {
  if (buffer.byteLength === 0) return 0
  const counts = new Uint32Array(256)
  for (let i = 0; i < buffer.byteLength; i += 1) {
    counts[buffer[i]!] += 1
  }
  let entropy = 0
  const len = buffer.byteLength
  for (let i = 0; i < 256; i += 1) {
    const count = counts[i]!
    if (count === 0) continue
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return Number(entropy.toFixed(3))
}

/**
 * Observes a file's stable byte identity (SHA-256), size, and magic header bytes
 * from a single file descriptor, following REA's `StableFileHash.ts`.
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
    const header = Buffer.alloc(Math.min(16, initial.size))
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

    const magicHex = header.subarray(0, 8).toString('hex')
    const formatHint = classifyMagicHeader(header)

    return {
      path: resolved,
      sha256: hash.digest('hex'),
      bytes: position,
      magicHex,
      formatHint
    }
  } finally {
    await handle.close().catch(() => undefined)
  }
}

function classifyMagicHeader(header: Buffer): StableFileObservation['formatHint'] {
  if (header.byteLength >= 2 && header[0] === 0x4d && header[1] === 0x5a) {
    return 'pe-executable'
  }
  if (header.byteLength >= 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    return 'zip-archive'
  }
  if (header.byteLength >= 4 && header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) {
    return 'elf-binary'
  }
  if (header.byteLength >= 4 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return 'pdf'
  }
  if (header.byteLength >= 8 && header.readUInt32LE(0) === 4) {
    const jsonSize = header.readUInt32LE(4)
    if (jsonSize > 8 && jsonSize < 64 * 1024 * 1024) {
      return 'asar-archive'
    }
  }
  const hasNullByte = header.includes(0x00)
  return hasNullByte ? 'binary' : 'utf8-text'
}

/**
 * Staged atomic file write ported from REA's `OwnedStagedOutput.ts`.
 * Writes to a sibling `.tmp` file, verifies descriptor size & SHA-256, closes the handle,
 * and renames atomically into the target path.
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
 * Supervised command execution with REA's `BoundedOutputExcerpt` and Windows process-tree cleanup.
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
 * Inspects a Windows PE (`.exe` / `.dll`) binary header, sections, entropy, imports, and strings,
 * following REA's PE inspection contracts (`registerPeImportsTool.ts`, `registerByteEntropyTool.ts`).
 */
export function inspectPeBinaryBuffer(buffer: Buffer): PeBinaryInspection | null {
  if (buffer.byteLength < 0x40 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return null
  }
  const peOffset = buffer.readUInt32LE(0x3c)
  if (peOffset + 24 > buffer.byteLength) return null
  if (
    buffer[peOffset] !== 0x50 ||
    buffer[peOffset + 1] !== 0x45 ||
    buffer[peOffset + 2] !== 0x00 ||
    buffer[peOffset + 3] !== 0x00
  ) {
    return null
  }

  const coffOffset = peOffset + 4
  const machineCode = buffer.readUInt16LE(coffOffset)
  const numberOfSections = buffer.readUInt16LE(coffOffset + 2)
  const timeDateStamp = buffer.readUInt32LE(coffOffset + 4)
  const sizeOfOptionalHeader = buffer.readUInt16LE(coffOffset + 16)
  const characteristicsBits = buffer.readUInt16LE(coffOffset + 18)

  const machineMap: Record<number, string> = {
    0x8664: 'x64 (IMAGE_FILE_MACHINE_AMD64)',
    0x014c: 'x86 (IMAGE_FILE_MACHINE_I386)',
    0xaa64: 'ARM64 (IMAGE_FILE_MACHINE_ARM64)'
  }
  const machine = machineMap[machineCode] ?? `0x${machineCode.toString(16)}`

  const characteristics: string[] = []
  if (characteristicsBits & 0x0002) characteristics.push('EXECUTABLE_IMAGE')
  if (characteristicsBits & 0x0020) characteristics.push('LARGE_ADDRESS_AWARE')
  if (characteristicsBits & 0x2000) characteristics.push('DLL')

  const optionalOffset = coffOffset + 20
  let is64Bit = false
  let entryPointRva = '0x0'
  let imageBase = '0x0'
  let subsystem = 'unknown'

  if (sizeOfOptionalHeader >= 24 && optionalOffset + sizeOfOptionalHeader <= buffer.byteLength) {
    const magic = buffer.readUInt16LE(optionalOffset)
    is64Bit = magic === 0x20b
    const entryPoint = buffer.readUInt32LE(optionalOffset + 16)
    entryPointRva = `0x${entryPoint.toString(16)}`
    if (is64Bit && optionalOffset + 72 <= buffer.byteLength) {
      const base = buffer.readBigUInt64LE(optionalOffset + 24)
      imageBase = `0x${base.toString(16)}`
      const subsysCode = buffer.readUInt16LE(optionalOffset + 68)
      subsystem = formatPeSubsystem(subsysCode)
    } else if (!is64Bit && optionalOffset + 72 <= buffer.byteLength) {
      const base = buffer.readUInt32LE(optionalOffset + 28)
      imageBase = `0x${base.toString(16)}`
      const subsysCode = buffer.readUInt16LE(optionalOffset + 68)
      subsystem = formatPeSubsystem(subsysCode)
    }
  }

  const sectionTableOffset = optionalOffset + sizeOfOptionalHeader
  const sections: PeBinaryInspection['sections'] = []
  for (let i = 0; i < Math.min(numberOfSections, 16); i += 1) {
    const secOffset = sectionTableOffset + i * 40
    if (secOffset + 40 > buffer.byteLength) break
    const rawName = buffer.subarray(secOffset, secOffset + 8)
    const zeroIdx = rawName.indexOf(0)
    const name = rawName.subarray(0, zeroIdx >= 0 ? zeroIdx : 8).toString('utf8').trim() || `sec_${i}`
    const virtualSize = buffer.readUInt32LE(secOffset + 8)
    const rawSize = buffer.readUInt32LE(secOffset + 16)
    const rawPtr = buffer.readUInt32LE(secOffset + 20)
    const sliceEnd = Math.min(buffer.byteLength, rawPtr + Math.min(rawSize, 256 * 1024))
    const sectionSlice = rawPtr < sliceEnd ? buffer.subarray(rawPtr, sliceEnd) : Buffer.alloc(0)
    sections.push({
      name,
      virtualSize,
      rawSize,
      entropy: computeByteEntropy(sectionSlice)
    })
  }

  const textSample = buffer.subarray(0, Math.min(buffer.byteLength, 2 * 1024 * 1024)).toString('latin1')
  const dllMatches = textSample.match(/\b[A-Za-z0-9_-]{2,40}\.dll\b/gi) ?? []
  const importedDlls = [...new Set(dllMatches.map((d) => d.toLowerCase()))].slice(0, 25)

  const asciiMatches = textSample.match(/[A-Za-z0-9_./:\\-]{8,90}/g) ?? []
  const notableStrings = [...new Set(
    asciiMatches.filter((s) => (
      /https?:\/\/|\.asar|electron|FuseV1|pdb|Microsoft|Windows|llama|ollaya|laya/i.test(s)
    ))
  )].slice(0, 20)

  return {
    machine,
    subsystem,
    is64Bit,
    characteristics,
    timestampIso: timeDateStamp > 0 ? new Date(timeDateStamp * 1000).toISOString() : null,
    entryPointRva,
    imageBase,
    sections,
    importedDlls,
    notableStrings
  }
}

function formatPeSubsystem(code: number): string {
  switch (code) {
    case 2: return 'WINDOWS_GUI'
    case 3: return 'WINDOWS_CUI (Console)'
    default: return `0x${code.toString(16)}`
  }
}

/**
 * Inspects an Electron ASAR archive header JSON inventory, following REA's
 * `analyze_javascript_application` / Electron archive inspection.
 */
export async function inspectAsarArchive(filePath: string): Promise<AsarArchiveInspection | null> {
  const handle = await open(filePath, 'r')
  try {
    const prefix = Buffer.alloc(16)
    const { bytesRead } = await handle.read(prefix, 0, 16, 0)
    if (bytesRead < 16) return null
    const headerPayloadSize = prefix.readUInt32LE(4)
    const jsonLength = prefix.readUInt32LE(12)
    if (jsonLength <= 0 || jsonLength > 32 * 1024 * 1024 || jsonLength > headerPayloadSize) {
      return null
    }
    const jsonBuf = Buffer.alloc(jsonLength)
    await handle.read(jsonBuf, 0, jsonLength, 16)
    const headerObj = JSON.parse(jsonBuf.toString('utf8')) as {
      files?: Record<string, unknown>
    }
    const sampleFiles: string[] = []
    let totalEntries = 0
    let pkgMeta: AsarArchiveInspection['packageJson']

    const walk = (node: Record<string, unknown>, currentPrefix: string): void => {
      for (const [name, value] of Object.entries(node)) {
        totalEntries += 1
        const relPath = currentPrefix ? `${currentPrefix}/${name}` : name
        if (sampleFiles.length < 30) {
          sampleFiles.push(relPath)
        }
        if (value && typeof value === 'object' && 'files' in value && value.files && typeof value.files === 'object') {
          walk(value.files as Record<string, unknown>, relPath)
        }
      }
    }

    if (headerObj.files && typeof headerObj.files === 'object') {
      walk(headerObj.files, '')
      const pkgEntry = headerObj.files['package.json'] as { offset?: string | number; size?: number } | undefined
      if (pkgEntry && pkgEntry.size && pkgEntry.size > 0 && pkgEntry.size < 128 * 1024 && pkgEntry.offset !== undefined) {
        const dataOffset = 8 + headerPayloadSize + Number(pkgEntry.offset)
        const pkgBuf = Buffer.alloc(pkgEntry.size)
        await handle.read(pkgBuf, 0, pkgEntry.size, dataOffset)
        try {
          const parsedPkg = JSON.parse(pkgBuf.toString('utf8')) as {
            name?: string
            version?: string
            main?: string
          }
          pkgMeta = {
            ...(parsedPkg.name ? { name: parsedPkg.name } : {}),
            ...(parsedPkg.version ? { version: parsedPkg.version } : {}),
            ...(parsedPkg.main ? { main: parsedPkg.main } : {})
          }
        } catch {
          // Ignore malformed package.json inside ASAR
        }
      }
    }

    return {
      headerSize: headerPayloadSize,
      totalEntries,
      sampleFiles,
      ...(pkgMeta ? { packageJson: pkgMeta } : {})
    }
  } catch {
    return null
  } finally {
    await handle.close().catch(() => undefined)
  }
}

export class ReaHarnessToolkit {
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
        _meta: TARGET_CONTENT_RESULT_META
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

    if (observation.formatHint !== 'utf8-text' && observation.bytes > 0) {
      return {
        ok: true,
        status: 'confirmed',
        message: `Arquivo binário observado (${observation.formatHint}): ${resolved} (${observation.bytes} bytes, SHA-256: ${observation.sha256}). Use rea_inspect para análise estrutural.`,
        details: {
          ...observation,
          binary: true,
          _meta: TARGET_CONTENT_RESULT_META
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
        _meta: TARGET_CONTENT_RESULT_META
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
        _meta: TARGET_CONTENT_RESULT_META
      }
    }
  }

  async inspectArtifactRea(
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : ''
    if (!rawPath) {
      return { ok: false, status: 'failed', message: 'Informe o caminho do binário, ASAR, pacote ou diretório em path.' }
    }
    const resolved = resolve(rawPath)
    const targetStat = await stat(resolved)

    if (targetStat.isDirectory()) {
      const asarCandidate = join(resolved, 'resources', 'app.asar')
      const pkgCandidate = join(resolved, 'package.json')
      const observations: Record<string, unknown> = {
        targetPath: resolved,
        kind: 'directory'
      }
      const asarInfo = await inspectAsarArchive(asarCandidate).catch(() => null)
      if (asarInfo) {
        observations.electronAsar = asarInfo
      }
      const pkgText = await readFile(pkgCandidate, 'utf8').catch(() => null)
      if (pkgText) {
        try {
          const pkg = JSON.parse(pkgText) as Record<string, unknown>
          observations.packageJson = {
            name: pkg.name,
            version: pkg.version,
            main: pkg.main,
            scripts: pkg.scripts ? Object.keys(pkg.scripts as Record<string, unknown>) : []
          }
        } catch {
          // ignore
        }
      }
      return {
        ok: true,
        status: 'confirmed',
        message: `Inspeção REA de diretório concluída em ${resolved}: ${JSON.stringify(observations)}`,
        details: {
          ...observations,
          _meta: TARGET_CONTENT_RESULT_META
        }
      }
    }

    const observation = await observeStableFile(resolved, signal)
    const details: Record<string, unknown> = {
      observation,
      _meta: TARGET_CONTENT_RESULT_META
    }
    const summaryLines = [
      `Evidência REA para ${basename(resolved)}:`,
      `- Caminho: ${observation.path}`,
      `- Formato detectado: ${observation.formatHint} (magic: 0x${observation.magicHex})`,
      `- Tamanho: ${observation.bytes} bytes | SHA-256: ${observation.sha256}`
    ]

    if (observation.formatHint === 'pe-executable' || extname(resolved).toLowerCase() === '.exe' || extname(resolved).toLowerCase() === '.dll') {
      const handle = await open(resolved, 'r')
      try {
        const sampleLen = Math.min(observation.bytes, 4 * 1024 * 1024)
        const buf = Buffer.alloc(sampleLen)
        await handle.read(buf, 0, sampleLen, 0)
        const peInfo = inspectPeBinaryBuffer(buf)
        if (peInfo) {
          details.peAnalysis = peInfo
          summaryLines.push(
            `- Arquitetura PE: ${peInfo.machine} | Subsistema: ${peInfo.subsystem} | EntryPoint: ${peInfo.entryPointRva} | ImageBase: ${peInfo.imageBase}`,
            `- Seções (${peInfo.sections.length}): ${peInfo.sections.map((s) => `${s.name} (entropia ${s.entropy})`).join(', ')}`,
            `- DLLs importadas (${peInfo.importedDlls.length}): ${peInfo.importedDlls.slice(0, 10).join(', ')}`
          )
        }
      } finally {
        await handle.close().catch(() => undefined)
      }
    }

    if (observation.formatHint === 'asar-archive' || extname(resolved).toLowerCase() === '.asar') {
      const asarInfo = await inspectAsarArchive(resolved)
      if (asarInfo) {
        details.asarAnalysis = asarInfo
        summaryLines.push(
          `- Arquivo Electron ASAR: ${asarInfo.totalEntries} entradas empacotadas (header ${asarInfo.headerSize} B)`,
          ...(asarInfo.packageJson ? [`- Pacote: ${asarInfo.packageJson.name ?? '?'}@${asarInfo.packageJson.version ?? '?'} (main: ${asarInfo.packageJson.main ?? '?'})`] : []),
          `- Amostra de arquivos: ${asarInfo.sampleFiles.slice(0, 10).join(', ')}`
        )
      }
    }

    return {
      ok: true,
      status: 'confirmed',
      message: summaryLines.join('\n'),
      details
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

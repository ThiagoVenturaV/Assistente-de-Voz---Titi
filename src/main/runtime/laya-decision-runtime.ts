import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { mkdir, open, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const OLLAYA_VERSION = '0.18.0'
export const OLLAYA_ARCHIVE_URL =
  'https://github.com/ollaya-dev/ollaya/releases/download/v0.18.0/ollaya-windows-amd64.zip'
export const OLLAYA_ARCHIVE_SHA256 =
  '1ae38f48800ab2d9587f062118f4f5f844943986ae56f353a7157677332fa6ae'
export const OLLAYA_EXE_SHA256 =
  '33a0b18965951128ebef49f41d147669648ea79b91058e250f4440c609eb6bba'
export const OLLAYA_DIRECTML_SHA256 =
  '9c9e6d822561c6c41b90e6994b3e8857cf1d66dbfb1e0c4c799c7c89b4e92da1'
export const LAYA_DEFAULT_MODEL = 'laya:multilingual'
export const OLLAYA_DEFAULT_ENDPOINT = 'http://127.0.0.1:11435'

export type LayaIntentCategory =
  | 'open_app_or_site'
  | 'control_media_or_screen'
  | 'system_datetime'
  | 'explanation_or_question'
  | 'greeting_or_chat'

export interface LayaToolNeedDecision {
  decision: 'needs_tool' | 'respond'
  confidence: number
  category: LayaIntentCategory
  durationMs: number
}

export interface LayaCandidateControl {
  id: string
  name: string
  controlType: string
  automationId?: string
  enabled?: boolean
}

export interface LayaTargetDecisionResult {
  choice: string
  confidence: number
  probabilities: Record<string, number>
  durationMs: number
}

export interface LayaDeciderMetrics {
  model: string
  calls: number
  inferenceSeconds: number
  loadSeconds: number
  remoteTokens: null
}

export interface LayaTargetDecisionRouter {
  chooseTarget(
    instruction: string,
    candidates: LayaCandidateControl[],
    windowTitle: string,
    signal?: AbortSignal
  ): Promise<LayaTargetDecisionResult>
  metrics(): LayaDeciderMetrics
}

export interface ToolNeedDecisionRouter extends Partial<LayaTargetDecisionRouter> {
  decideToolNeed(
    userRequest: string,
    signal?: AbortSignal
  ): Promise<LayaToolNeedDecision | null>
}

export const LAYA_INTENT_QUESTIONS = {
  intent: {
    type: 'choice',
    instructions: 'Qual é o tipo de pedido do usuário?',
    criteria: {
      open_app_or_site:
        'Comando imperativo para abrir aplicativo, acessar site, pesquisar na internet, rodar comando de terminal, ler/editar arquivos ou inspecionar binários com REA',
      control_media_or_screen:
        'Comando imperativo para tocar/pausar música no Spotify, buscar código/arquivos ou clicar/observar a tela do Windows',
      system_datetime:
        'Pergunta sobre o horário atual do relógio ou a data de hoje',
      explanation_or_question:
        'Pedido para explicar um conceito, responder uma dúvida geral, ensinar como algo funciona ou dar opinião',
      greeting_or_chat:
        'Cumprimento, saudação, agradecimento ou bate-papo casual'
    }
  }
} as const

interface OllayaChoiceAnswer {
  choice?: string
  confidence?: number
  probabilities?: Record<string, number>
}

interface OllayaDecideResponse {
  answers?: {
    intent?: OllayaChoiceAnswer & {
      probabilities?: Partial<Record<LayaIntentCategory, number>>
    }
    target?: OllayaChoiceAnswer
  }
  eval_duration?: number
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'find', 'open', 'stop', 'when', 'page', 'are', 'this',
  'qual', 'quais', 'para', 'com', 'uma', 'uns', 'umas', 'dos', 'das', 'nos', 'nas', 'por',
  'controle', 'botao', 'seleciona', 'aciona', 'clica', 'clicar', 'abrir', 'janela'
])

function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function significantWords(text: string): Set<string> {
  const result = new Set<string>()
  for (const word of foldText(text).split(' ')) {
    if (!word) continue
    const stem = word.slice(0, 5)
    if ((word.length > 2 || /^\d+$/.test(word)) && !STOP_WORDS.has(word) && !STOP_WORDS.has(stem)) {
      result.add(stem)
    }
  }
  return result
}

export function shortlistControls<T extends { name: string; controlType: string; automationId?: string }>(
  candidates: readonly T[],
  queryText: string,
  limit = 20
): T[] {
  if (candidates.length <= limit) return [...candidates]
  const targetWords = significantWords(queryText)
  const scored = candidates.map((item, index) => {
    const itemWords = significantWords(`${item.controlType} ${item.name} ${item.automationId ?? ''}`)
    let overlap = 0
    for (const w of itemWords) {
      if (targetWords.has(w)) overlap += 1
    }
    return { item, index, score: overlap }
  })
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
  const keptIndices = new Set(scored.slice(0, limit).map((entry) => entry.index))
  return candidates.filter((_, index) => keptIndices.has(index))
}

export function validateLayaChoiceAnswer(
  answer: OllayaChoiceAnswer | undefined,
  candidateIds: readonly string[]
): { choice: string; confidence: number; probabilities: Record<string, number> } {
  if (!candidateIds.length || candidateIds.length > 20) {
    throw new Error('O Laya requer entre 1 e 20 candidatos observados; refine o seletor.')
  }
  const idSet = new Set(candidateIds)
  if (idSet.size !== candidateIds.length) {
    throw new Error('IDs de candidatos duplicados.')
  }
  if (!answer || typeof answer !== 'object') {
    throw new Error('Decisão local inválida; nenhuma ação executada.')
  }
  const choice = String(answer.choice ?? '')
  const confidence = Number(answer.confidence)
  const rawProbabilities = answer.probabilities
  if (!rawProbabilities || typeof rawProbabilities !== 'object') {
    throw new Error('Decisão local sem distribuição de probabilidades.')
  }
  const probKeys = Object.keys(rawProbabilities)
  if (probKeys.length !== idSet.size || !probKeys.every((k) => idSet.has(k)) || !idSet.has(choice)) {
    throw new Error('Decisão local retornou candidato fora do conjunto observado.')
  }

  const probabilities: Record<string, number> = {}
  let sum = 0
  let maxProb = -1
  for (const id of candidateIds) {
    const value = Number(rawProbabilities[id])
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Probabilidade fora do intervalo válido na decisão local.')
    }
    probabilities[id] = value
    sum += value
    if (value > maxProb) maxProb = value
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Confiança inválida na decisão local.')
  }
  if (Math.abs(sum - 1) >= 0.02) {
    throw new Error('Soma das probabilidades inválida na decisão local.')
  }
  if (probabilities[choice] < maxProb - 1e-6) {
    throw new Error('A escolha retornada pelo Laya não corresponde à maior probabilidade.')
  }
  return { choice, confidence, probabilities }
}

interface OllayaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

export function resolveOllayaRuntimeDir(resourcesPath?: string): string {
  const override = process.env.TITI_OLLAYA_RUNTIME_DIR?.trim()
  if (override) return override

  if (resourcesPath) {
    const bundled = join(resourcesPath, 'runtime', 'ollaya')
    if (hasMinimumSize(join(bundled, 'bin', 'ollaya.exe'), 10_000_000)) {
      return bundled
    }
  }

  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (localAppData) {
    return join(localAppData, 'Titi', 'runtime', 'ollaya')
  }

  return join(resourcesPath ?? process.cwd(), 'runtime', 'ollaya')
}

function hasMinimumSize(filePath: string, minimumBytes: number): boolean {
  try {
    const stat = statSync(filePath)
    return stat.isFile() && stat.size >= minimumBytes
  } catch {
    return false
  }
}

export function interpretLayaIntentProbabilities(
  probabilities: Partial<Record<LayaIntentCategory, number>>
): {
  decision: 'needs_tool' | 'respond'
  confidence: number
  category: LayaIntentCategory
} {
  const entries: Array<[LayaIntentCategory, number]> = [
    ['open_app_or_site', Number(probabilities.open_app_or_site ?? 0)],
    ['control_media_or_screen', Number(probabilities.control_media_or_screen ?? 0)],
    ['system_datetime', Number(probabilities.system_datetime ?? 0)],
    ['explanation_or_question', Number(probabilities.explanation_or_question ?? 0)],
    ['greeting_or_chat', Number(probabilities.greeting_or_chat ?? 0)]
  ]

  let topCategory: LayaIntentCategory = 'explanation_or_question'
  let topScore = -1
  for (const [category, score] of entries) {
    if (score > topScore) {
      topScore = score
      topCategory = category
    }
  }

  const pTool =
    (probabilities.open_app_or_site ?? 0) +
    (probabilities.control_media_or_screen ?? 0) +
    (probabilities.system_datetime ?? 0)
  const pRespond =
    (probabilities.explanation_or_question ?? 0) +
    (probabilities.greeting_or_chat ?? 0)

  const decision = pTool >= pRespond ? 'needs_tool' : 'respond'
  const rawConfidence = decision === 'needs_tool' ? pTool : pRespond
  const confidence = Math.min(1, Math.max(0, Number(rawConfidence.toFixed(4))))

  return {
    decision,
    confidence,
    category: topCategory
  }
}

export class LayaDecisionRuntime implements ToolNeedDecisionRouter, LayaTargetDecisionRouter {
  private readonly resourcesPath?: string
  private readonly endpoint: string
  private ownedProcess: ChildProcess | null = null
  private startingPromise: Promise<boolean> | null = null
  private setupPromise: Promise<void> | null = null
  private modelReadyCache = false
  private callCount = 0
  private inferenceMsTotal = 0
  private loadMsTotal = 0

  constructor(resourcesPath?: string, endpoint = OLLAYA_DEFAULT_ENDPOINT) {
    this.resourcesPath = resourcesPath
    this.endpoint = endpoint.replace(/\/+$/, '')
  }

  get runtimeDir(): string {
    return resolveOllayaRuntimeDir(this.resourcesPath)
  }

  get binDir(): string {
    return join(this.runtimeDir, 'bin')
  }

  get executablePath(): string {
    return join(this.binDir, 'ollaya.exe')
  }

  get directMlPath(): string {
    return join(this.binDir, 'DirectML.dll')
  }

  hasBinaryInstalled(): boolean {
    return (
      hasMinimumSize(this.executablePath, 20_000_000) &&
      hasMinimumSize(this.directMlPath, 10_000_000)
    )
  }

  hasModelsInstalled(): boolean {
    if (this.modelReadyCache) return true
    if (!this.hasBinaryInstalled()) return false
    const userProfile = process.env.USERPROFILE?.trim()
    if (!userProfile) return false
    const manifestDir = join(
      userProfile,
      '.ollaya',
      'models',
      'manifests',
      'ollaya.dev',
      'library',
      'laya'
    )
    return hasMinimumSize(join(manifestDir, 'multilingual'), 50)
  }

  async ensureModels(
    onProgress?: (percent: number, label: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throwIfAborted(signal)
    if (this.hasModelsInstalled()) return
    if (this.setupPromise) return this.setupPromise

    const task = this.prepareRuntimeAndModel(onProgress, signal)
    this.setupPromise = task
    try {
      await task
    } finally {
      if (this.setupPromise === task) {
        this.setupPromise = null
      }
    }
  }

  private async prepareRuntimeAndModel(
    onProgress?: (percent: number, label: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.hasBinaryInstalled()) {
      await this.downloadAndExtractOllaya(
        (percent) => onProgress?.(Math.round(percent * 0.2), 'motor de decisão Laya (Ollaya)'),
        signal
      )
    }

    const started = await this.ensureServer(signal)
    if (!started) {
      throw new Error('Não foi possível iniciar o servidor local de decisão Laya (Ollaya).')
    }

    if (await this.checkModelInstalledViaApi(signal)) {
      this.modelReadyCache = true
      onProgress?.(100, 'modelo de decisão Laya')
      return
    }

    await this.pullModel(
      LAYA_DEFAULT_MODEL,
      (percent) => onProgress?.(20 + Math.round(percent * 0.8), 'modelo de decisão Laya (System 1)'),
      signal
    )
    this.modelReadyCache = true
    onProgress?.(100, 'modelo de decisão Laya')
  }

  async ensureServer(signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal)
    if (await this.isServerHealthy(signal)) return true
    if (!this.hasBinaryInstalled()) return false
    if (this.startingPromise) return this.startingPromise

    const startTask = this.spawnServer(signal)
    this.startingPromise = startTask
    try {
      return await startTask
    } finally {
      if (this.startingPromise === startTask) {
        this.startingPromise = null
      }
    }
  }

  async decideToolNeed(
    userRequest: string,
    signal?: AbortSignal
  ): Promise<LayaToolNeedDecision | null> {
    const trimmed = userRequest.trim()
    if (!trimmed) {
      return {
        decision: 'respond',
        confidence: 1,
        category: 'greeting_or_chat',
        durationMs: 0
      }
    }

    try {
      if (!this.hasBinaryInstalled()) return null
      const running = await this.ensureServer(signal)
      if (!running) return null

      const startedAt = performance.now()
      const response = await fetch(`${this.endpoint}/api/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LAYA_DEFAULT_MODEL,
          state: trimmed,
          questions: LAYA_INTENT_QUESTIONS,
          keep_alive: '5m'
        }),
        signal: signal ?? AbortSignal.timeout(3_500)
      })

      if (!response.ok) return null
      const payload = (await response.json()) as OllayaDecideResponse
      const probabilities = payload.answers?.intent?.probabilities
      if (!probabilities) return null

      this.modelReadyCache = true
      const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
      this.callCount += 1
      this.inferenceMsTotal += durationMs
      const interpreted = interpretLayaIntentProbabilities(probabilities)
      return {
        ...interpreted,
        durationMs
      }
    } catch {
      return null
    }
  }

  async chooseTarget(
    instruction: string,
    candidates: LayaCandidateControl[],
    windowTitle: string,
    signal?: AbortSignal
  ): Promise<LayaTargetDecisionResult> {
    throwIfAborted(signal)
    if (!candidates.length || candidates.length > 20) {
      throw new Error('O Laya requer entre 1 e 20 candidatos observados; refine o seletor.')
    }
    const ids = candidates.map((item) => String(item.id))
    if (new Set(ids).size !== ids.length) {
      throw new Error('IDs de candidatos duplicados.')
    }

    if (!this.hasBinaryInstalled()) {
      throw new Error('O motor local de decisão Laya (Ollaya) não está instalado.')
    }
    const loadStarted = performance.now()
    const running = await this.ensureServer(signal)
    if (!running) {
      throw new Error('Não foi possível conectar ao servidor local Laya (Ollaya).')
    }
    this.loadMsTotal += Math.max(0, performance.now() - loadStarted)

    const criteria: Record<string, string> = {}
    for (const item of candidates) {
      const role = String(item.controlType || '').replace(/^AX/, '').trim()
      const label = String(item.name || '').trim().slice(0, 120)
      criteria[String(item.id)] = `${role} ${label}`.trim()
    }

    const cleanWindow = String(windowTitle || '').trim().slice(0, 200)
    const cleanInstruction = String(instruction || '').trim().slice(0, 1000)
    const state = cleanWindow
      ? `Janela: ${cleanWindow}\nInstrução: ${cleanInstruction}`
      : `Instrução: ${cleanInstruction}`

    const questions = {
      target: {
        type: 'choice',
        instructions: 'Which control matches the instruction?',
        criteria
      }
    }

    const startedAt = performance.now()
    const response = await fetch(`${this.endpoint}/api/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LAYA_DEFAULT_MODEL,
        state,
        questions,
        keep_alive: '5m'
      }),
      signal: signal ?? AbortSignal.timeout(5_000)
    })

    if (!response.ok) {
      throw new Error(`Falha na decisão local Laya (HTTP ${response.status}).`)
    }

    const payload = (await response.json()) as OllayaDecideResponse
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
    this.callCount += 1
    this.inferenceMsTotal += durationMs
    this.modelReadyCache = true

    const validated = validateLayaChoiceAnswer(payload.answers?.target, ids)
    return {
      ...validated,
      durationMs
    }
  }

  metrics(): LayaDeciderMetrics {
    return {
      model: LAYA_DEFAULT_MODEL,
      calls: this.callCount,
      inferenceSeconds: Number((this.inferenceMsTotal / 1000).toFixed(3)),
      loadSeconds: Number((this.loadMsTotal / 1000).toFixed(3)),
      remoteTokens: null
    }
  }

  async unload(): Promise<void> {
    try {
      await fetch(`${this.endpoint}/api/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LAYA_DEFAULT_MODEL,
          keep_alive: 0
        }),
        signal: AbortSignal.timeout(2_500)
      })
    } catch {
      // Ignore if daemon is already stopped.
    }
  }

  dispose(): void {
    const child = this.ownedProcess
    this.ownedProcess = null
    if (child && child.exitCode === null && !child.killed) {
      try {
        child.kill()
      } catch {
        // Ignore kill race.
      }
    }
  }

  private async isServerHealthy(signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/`, {
        signal: signal ?? AbortSignal.timeout(1_200)
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async checkModelInstalledViaApi(signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: signal ?? AbortSignal.timeout(2_500)
      })
      if (!response.ok) return false
      const payload = (await response.json()) as OllayaTagsResponse
      return (payload.models ?? []).some((entry) => {
        const name = (entry.name ?? entry.model ?? '').toLowerCase()
        return name === 'laya:multilingual' || name === 'laya:latest' || name === 'laya'
      })
    } catch {
      return false
    }
  }

  private async spawnServer(signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal)
    const parsed = new URL(this.endpoint)
    const child = spawn(this.executablePath, ['serve'], {
      cwd: this.binDir,
      detached: false,
      windowsHide: true,
      shell: false,
      stdio: 'ignore',
      env: {
        ...process.env,
        OLLAYA_HOST: parsed.host
      }
    })
    child.unref()
    this.ownedProcess = child
    child.once('exit', () => {
      if (this.ownedProcess === child) {
        this.ownedProcess = null
      }
    })

    const deadline = Date.now() + 12_000
    while (Date.now() < deadline) {
      throwIfAborted(signal)
      if (child.exitCode !== null) return false
      if (await this.isServerHealthy(signal)) return true
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    return false
  }

  private async pullModel(
    modelName: string,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throwIfAborted(signal)
    const response = await fetch(`${this.endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, stream: true }),
      signal
    })
    if (!response.ok || !response.body) {
      throw new Error(`Falha ao baixar ${modelName} no Ollaya (${response.status}).`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        throwIfAborted(signal)
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue
          const event = JSON.parse(line) as {
            status?: string
            error?: string
            total?: number
            completed?: number
          }
          if (event.error) {
            throw new Error(`Erro ao baixar ${modelName}: ${event.error}`)
          }
          if (
            typeof event.total === 'number' &&
            event.total > 0 &&
            typeof event.completed === 'number'
          ) {
            const percent = Math.min(99, Math.max(0, Math.round((event.completed / event.total) * 100)))
            onProgress?.(percent)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    onProgress?.(100)
  }

  private async downloadAndExtractOllaya(
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throwIfAborted(signal)
    await mkdir(this.binDir, { recursive: true })
    const tempArchive = join(tmpdir(), `titi-ollaya-${process.pid}.zip`)
    const tempExtract = join(tmpdir(), `titi-ollaya-extract-${process.pid}`)

    await unlink(tempArchive).catch(() => undefined)
    await rm(tempExtract, { recursive: true, force: true }).catch(() => undefined)

    try {
      const response = await fetch(OLLAYA_ARCHIVE_URL, { redirect: 'follow', signal })
      if (!response.ok || !response.body) {
        throw new Error(`Falha ao baixar Ollaya (${response.status}).`)
      }

      const totalBytes = Number(response.headers.get('content-length') ?? 0)
      const digest = createHash('sha256')
      const file = await open(tempArchive, 'w')
      let receivedBytes = 0

      try {
        const reader = response.body.getReader()
        while (true) {
          throwIfAborted(signal)
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          await file.write(value)
          digest.update(value)
          receivedBytes += value.byteLength
          if (totalBytes > 0 && onProgress) {
            onProgress(Math.min(95, Math.round((receivedBytes / totalBytes) * 95)))
          }
        }
      } finally {
        await file.close()
      }

      const actualSha256 = digest.digest('hex').toLowerCase()
      if (actualSha256 !== OLLAYA_ARCHIVE_SHA256) {
        throw new Error('Hash SHA-256 inválido para o pacote oficial do Ollaya.')
      }

      await mkdir(tempExtract, { recursive: true })
      await extractZipArchive(tempArchive, tempExtract, signal)

      const { copyFile } = await import('node:fs/promises')
      await copyFile(join(tempExtract, 'bin', 'ollaya.exe'), this.executablePath)
      await copyFile(join(tempExtract, 'bin', 'DirectML.dll'), this.directMlPath)
      onProgress?.(100)
    } finally {
      await unlink(tempArchive).catch(() => undefined)
      await rm(tempExtract, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

function extractZipArchive(
  archivePath: string,
  destinationDir: string,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
      ],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    )
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Falha ao extrair pacote do Ollaya (código ${code}).`))
    })
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Operação cancelada.')
    error.name = 'AbortError'
    throw error
  }
}

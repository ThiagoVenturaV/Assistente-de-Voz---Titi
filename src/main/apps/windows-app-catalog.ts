import { spawn } from 'node:child_process'
import {
  access,
  opendir
} from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, normalize, resolve } from 'node:path'
import { shell } from 'electron'
import { JsonStore } from '../storage/json-store'
import type { ToolExecutionStatus } from '../tools/contracts'

export type AppLaunchRecipe =
  | { kind: 'shortcut'; path: string }
  | { kind: 'executable'; path: string }
  | { kind: 'app-id'; appId: string }
  | { kind: 'protocol'; uri: 'spotify:' }

export type AppDiscoverySource =
  | 'learned'
  | 'start-menu'
  | 'windows-apps'
  | 'start-apps'
  | 'known-app'
  | 'installed-program'

export interface DiscoveredWindowsApp {
  id: string
  displayName: string
  aliases: string[]
  recipe: AppLaunchRecipe
  source: Exclude<AppDiscoverySource, 'learned'>
}

export interface AppLaunchEvidence {
  accepted: true
  method: AppLaunchRecipe['kind']
  verified: boolean
  processId?: number
}

export interface AppRecipeLauncher {
  launch(recipe: AppLaunchRecipe, signal?: AbortSignal): Promise<AppLaunchEvidence>
}

export interface WindowsAppCatalogOpenResult {
  ok: boolean
  status?: ToolExecutionStatus
  message: string
  details?: Record<string, unknown>
}

export interface ApplicationCatalog {
  open(requestedName: string, signal?: AbortSignal): Promise<WindowsAppCatalogOpenResult>
}

interface LearnedAppSkill {
  id: string
  name: string
  aliases: string[]
  procedure: {
    action: 'launch-discovered-application'
    target: AppLaunchRecipe
  }
  discoveredFrom: Exclude<AppDiscoverySource, 'learned'>
  successfulLaunches: number
  createdAt: string
  lastUsedAt: string
}

interface AppSkillFile {
  version: 1
  skills: LearnedAppSkill[]
}

interface CatalogEntry extends Omit<DiscoveredWindowsApp, 'source'> {
  source: AppDiscoverySource
  learnedSkill?: LearnedAppSkill
}

export interface WindowsAppCatalogOptions {
  environment?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  recipeFilePath?: string
  launcher?: AppRecipeLauncher
  startMenuRoots?: string[]
  windowsAppsRoot?: string
  installRoots?: string[]
  getStartApps?: () => Promise<Array<{ name: string; appId: string }>>
  shouldLearn?: () => Promise<boolean>
  now?: () => Date
}

const SKILL_FILE: AppSkillFile = { version: 1, skills: [] }
const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_SKILLS = 200
const MAX_SCAN_ENTRIES = 12_000
const MAX_INSTALL_DEPTH = 4
const APP_ID_PATTERN = /^[\p{L}\p{N}._!:\-]+$/u
const SAFE_PROTOCOLS = new Set(['spotify:'])
const UNSAFE_NAME_PATTERN = /[\\/\0]|^[a-z]:|\.(?:exe|lnk|cmd|bat|ps1)$/i
const UNSAFE_EXECUTABLE_STEMS = new Set([
  'cmd',
  'powershell',
  'pwsh',
  'regedit',
  'wscript',
  'cscript',
  'mshta',
  'rundll32'
])
const UNSAFE_LAUNCH_TARGET_STEMS = new Set([
  ...UNSAFE_EXECUTABLE_STEMS,
  'bash',
  'bitsadmin',
  'certutil',
  'cmstp',
  'conhost',
  'control',
  'csi',
  'deno',
  'dfsvc',
  'diskshadow',
  'eventvwr',
  'explorer',
  'forfiles',
  'hh',
  'installutil',
  'jsc',
  'mavinject',
  'mmc',
  'msbuild',
  'msiexec',
  'msdt',
  'node',
  'perl',
  'presentationhost',
  'python',
  'pythonw',
  'regasm',
  'regsvcs',
  'regsvr32',
  'ruby',
  'sc',
  'schtasks',
  'sh',
  'wmic',
  'windowsterminal',
  'wsl',
  'wt'
])
const BLOCKED_REQUESTED_APPLICATIONS = new Set([
  ...UNSAFE_LAUNCH_TARGET_STEMS,
  'command prompt',
  'prompt de comando',
  'terminal',
  'windows terminal',
  'registry editor',
  'editor do registro'
])
const NOISY_EXECUTABLE_WORDS = [
  'uninstall',
  'unins',
  'update',
  'updater',
  'helper',
  'crash',
  'report',
  'setup',
  'install'
]

const KNOWN_APP_ALIASES: Record<string, string[]> = {
  chrome: ['chrome', 'google chrome', 'navegador chrome'],
  brave: ['brave', 'brave browser', 'navegador brave'],
  spotify: ['spotify', 'aplicativo de musica', 'app de musica'],
  chatgpt: ['chatgpt', 'chat gpt', 'aplicativo do chatgpt', 'openai chatgpt'],
  codex: ['codex', 'codex app', 'aplicativo do codex', 'openai codex'],
  antigravity: ['antigravity', 'anti gravity', 'google antigravity', 'editor antigravity']
}

export class WindowsAppCatalog implements ApplicationCatalog {
  private readonly environment: NodeJS.ProcessEnv
  private readonly platform: NodeJS.Platform
  private readonly launcher: AppRecipeLauncher
  private readonly startMenuRoots: string[]
  private readonly windowsAppsRoot: string
  private readonly installRoots: string[]
  private readonly getStartApps: () => Promise<Array<{ name: string; appId: string }>>
  private readonly shouldLearn: () => Promise<boolean>
  private readonly now: () => Date
  private readonly skillStore: JsonStore<AppSkillFile>
  private cachedEntries: CatalogEntry[] | null = null
  private cachedAt = 0
  private refreshPromise: Promise<CatalogEntry[]> | null = null

  constructor(options: WindowsAppCatalogOptions = {}) {
    this.environment = options.environment ?? process.env
    this.platform = options.platform ?? process.platform
    const roaming = this.environment.APPDATA
      ?? this.environment.LOCALAPPDATA
      ?? process.cwd()
    const recipeFilePath = options.recipeFilePath
      ?? join(roaming, 'Titi', 'app-skills.json')
    this.skillStore = new JsonStore(recipeFilePath, SKILL_FILE)
    this.launcher = options.launcher ?? new WindowsAppLauncher(this.platform)
    this.startMenuRoots = options.startMenuRoots ?? defaultStartMenuRoots(this.environment)
    this.windowsAppsRoot = options.windowsAppsRoot
      ?? join(this.environment.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps')
    this.installRoots = options.installRoots ?? defaultInstallRoots(this.environment)
    this.getStartApps = options.getStartApps ?? (() => readWindowsStartApps(this.platform))
    this.shouldLearn = options.shouldLearn ?? (async () => true)
    this.now = options.now ?? (() => new Date())
  }

  async open(requestedName: string, signal?: AbortSignal): Promise<WindowsAppCatalogOpenResult> {
    throwIfAborted(signal)
    const validationError = validateRequestedName(requestedName)
    if (validationError) return { ok: false, status: 'failed', message: validationError }

    const query = normalizeAppName(requestedName)
    let entries = await this.index()
    throwIfAborted(signal)
    let match = bestMatch(entries, query)

    if (!match || match.score < 70) {
      const targeted = await discoverInstalledExecutables(
        query,
        this.installRoots,
        this.platform
      )
      entries = deduplicateEntries([...entries, ...targeted])
      throwIfAborted(signal)
      match = bestMatch(entries, query)
    }

    if (!match || match.score < 60) {
      // Force one fresh pass so an application installed during this session is found.
      entries = await this.index(true)
      throwIfAborted(signal)
      match = bestMatch(entries, query)
    }

    if (!match || match.score < 60) {
      return {
        ok: false,
        status: 'failed',
        message: `Não encontrei “${requestedName.trim()}” entre os aplicativos instalados. Atualizei o catálogo, mas não executei nenhum caminho ou comando informado pelo modelo.`
      }
    }

    if (match.ambiguous) {
      return {
        ok: false,
        status: 'failed',
        message: `Encontrei mais de um aplicativo compatível com “${requestedName.trim()}”. Nenhum foi aberto para evitar escolher o alvo errado.`
      }
    }

    if (!await this.isRecipeCurrentlyTrusted(match.entry.recipe)) {
      return {
        ok: false,
        status: 'failed',
        message: `Encontrei ${match.entry.displayName}, mas a origem deixou de ser confiável. Nenhum aplicativo foi aberto.`
      }
    }

    try {
      throwIfAborted(signal)
      const evidence = signal
        ? await this.launcher.launch(match.entry.recipe, signal)
        : await this.launcher.launch(match.entry.recipe)
      throwIfAborted(signal)
      const canLearn = await this.shouldLearn().catch(() => false)
      throwIfAborted(signal)
      const skill = canLearn && evidence.verified
        ? await this.rememberSuccessfulLaunch(match.entry, query)
        : null
      return {
        ok: evidence.verified,
        status: evidence.verified ? 'confirmed' : 'dispatched',
        message: evidence.verified
          ? canLearn
            ? `${match.entry.displayName} aberto e processo confirmado. Aprendi uma forma segura de abrir este aplicativo novamente.`
            : `${match.entry.displayName} aberto e processo confirmado. Como o histórico está desativado, não guardei essa forma de abrir.`
          : `Enviei ao Windows o pedido para abrir ${match.entry.displayName}, mas não consegui confirmar uma janela ou processo. Não vou afirmar que abriu nem guardar essa receita.`,
        details: {
          applicationId: skill?.id ?? match.entry.id,
          application: match.entry.displayName,
          learned: Boolean(skill),
          verified: evidence.verified,
          ...(skill ? { successfulLaunches: skill.successfulLaunches } : {}),
          evidence
        }
      }
    } catch (error) {
      throwIfAborted(signal)
      return {
        ok: false,
        status: 'failed',
        message: `Encontrei ${match.entry.displayName}, mas o Windows não confirmou a abertura. ${errorMessage(error)}`
      }
    }
  }

  async recognitionVocabulary(): Promise<string[]> {
    const entries = await this.index()
    return uniqueDisplayValues(entries.flatMap((entry) => [
      entry.displayName,
      ...entry.aliases
    ])).slice(0, 200)
  }

  private async isRecipeCurrentlyTrusted(recipe: AppLaunchRecipe): Promise<boolean> {
    if (!await isRecipeStillTrusted(recipe, this.trustedRoots())) return false
    if (recipe.kind === 'app-id') {
      const apps = await this.getStartApps().catch(() => [])
      return apps.some(({ appId }) => appId === recipe.appId)
    }
    if (recipe.kind === 'protocol') {
      const apps = await this.getStartApps().catch(() => [])
      return recipe.uri === 'spotify:'
        && apps.some(({ name, appId }) =>
          normalizeAppName(name).includes('spotify')
          || normalizeAppName(appId).includes('spotify')
        )
    }
    return true
  }

  async index(force = false): Promise<CatalogEntry[]> {
    const cacheFresh = this.cachedEntries
      && Date.now() - this.cachedAt < CACHE_TTL_MS
    if (!force && cacheFresh) return this.cachedEntries ?? []
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.buildIndex()
    try {
      const entries = await this.refreshPromise
      this.cachedEntries = entries
      this.cachedAt = Date.now()
      return entries
    } finally {
      this.refreshPromise = null
    }
  }

  private async buildIndex(): Promise<CatalogEntry[]> {
    const [skills, shortcuts, aliases, startApps] = await Promise.all([
      this.readSkills(),
      discoverStartMenuShortcuts(this.startMenuRoots, this.platform),
      discoverExecutionAliases(this.windowsAppsRoot, this.platform),
      this.getStartApps().then(toStartAppEntries).catch(() => [])
    ])

    const learned = skills.skills
      .filter((skill) => isLearnedSkill(skill))
      .map<CatalogEntry>((skill) => ({
        id: skill.id,
        displayName: skill.name,
        aliases: skill.aliases,
        recipe: skill.procedure.target,
        source: 'learned',
        learnedSkill: skill
      }))

    return deduplicateEntries([
      ...learned,
      ...shortcuts,
      ...aliases,
      ...startApps
    ])
  }

  private trustedRoots(): string[] {
    return [...this.startMenuRoots, this.windowsAppsRoot, ...this.installRoots]
  }

  private async rememberSuccessfulLaunch(
    entry: CatalogEntry,
    requestedAlias: string
  ): Promise<LearnedAppSkill> {
    const skills = await this.readSkills()
    const timestamp = this.now().toISOString()
    const recipeKey = serializeRecipe(entry.recipe)
    const existing = skills.skills.find((skill) =>
      skill.id === entry.id
      || serializeRecipe(skill.procedure.target) === recipeKey
    )

    const learned: LearnedAppSkill = existing
      ? {
          ...existing,
          name: entry.displayName,
          aliases: uniqueAliases([...existing.aliases, ...entry.aliases, requestedAlias]),
          successfulLaunches: existing.successfulLaunches + 1,
          lastUsedAt: timestamp
        }
      : {
          id: stableId(entry.displayName, entry.recipe),
          name: entry.displayName,
          aliases: uniqueAliases([...entry.aliases, requestedAlias]),
          procedure: {
            action: 'launch-discovered-application',
            target: entry.recipe
          },
          discoveredFrom: entry.source === 'learned'
            ? entry.learnedSkill?.discoveredFrom ?? 'installed-program'
            : entry.source,
          successfulLaunches: 1,
          createdAt: timestamp,
          lastUsedAt: timestamp
        }

    const nextSkills = [
      learned,
      ...skills.skills.filter((skill) =>
        skill.id !== existing?.id && skill.id !== learned.id
      )
    ].slice(0, MAX_SKILLS)

    await this.writeSkills({ version: 1, skills: nextSkills })
    this.cachedEntries = null
    return learned
  }

  private async readSkills(): Promise<AppSkillFile> {
    const parsed: unknown = await this.skillStore.read()
    return isSkillFile(parsed) ? parsed : structuredClone(SKILL_FILE)
  }

  private async writeSkills(value: AppSkillFile): Promise<void> {
    await this.skillStore.write(value)
  }
}

export class WindowsAppLauncher implements AppRecipeLauncher {
  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly inspectShortcut: (path: string) => Promise<string | null> = inspectWindowsShortcut
  ) {}

  async launch(recipe: AppLaunchRecipe, signal?: AbortSignal): Promise<AppLaunchEvidence> {
    throwIfAborted(signal)
    if (this.platform !== 'win32') {
      throw new Error('A descoberta de aplicativos está disponível somente no Windows.')
    }

    switch (recipe.kind) {
      case 'shortcut': {
        if (extname(recipe.path).toLocaleLowerCase() !== '.lnk') {
          throw new Error('Atalhos ClickOnce não são executados nesta versão por segurança.')
        }
        const targetPath = await this.inspectShortcut(recipe.path)
        if (!isSafeShortcutTarget(targetPath)) {
          throw new Error('O atalho aponta para um executor ou destino que não é permitido.')
        }
        throwIfAborted(signal)
        const failure = await shell.openPath(recipe.path)
        throwIfAborted(signal)
        if (failure) throw new Error(failure)
        return { accepted: true, method: 'shortcut', verified: false }
      }
      case 'executable': {
        try {
          return {
            accepted: true,
            method: 'executable',
            verified: true,
            processId: await spawnAndConfirm(recipe.path, [], 400, signal)
          }
        } catch (error) {
          throwIfAborted(signal)
          const existingProcessId = await findRunningExecutableProcess(recipe.path)
            .catch(() => null)
          if (existingProcessId) {
            return {
              accepted: true,
              method: 'executable',
              verified: true,
              processId: existingProcessId
            }
          }
          throw error
        }
      }
      case 'app-id':
        if (!APP_ID_PATTERN.test(recipe.appId)) throw new Error('Identificador de aplicativo inválido.')
        await spawnAndConfirm('explorer.exe', [`shell:AppsFolder\\${recipe.appId}`], 0, signal)
        return { accepted: true, method: 'app-id', verified: false }
      case 'protocol':
        if (!SAFE_PROTOCOLS.has(recipe.uri)) throw new Error('Protocolo de aplicativo inválido.')
        throwIfAborted(signal)
        await shell.openExternal(recipe.uri)
        throwIfAborted(signal)
        return { accepted: true, method: 'protocol', verified: false }
    }
  }
}

export function normalizeAppName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function validateRequestedName(value: string): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (
    !trimmed
    || trimmed.length > 80
    || UNSAFE_NAME_PATTERN.test(trimmed)
    || BLOCKED_REQUESTED_APPLICATIONS.has(normalizeAppName(trimmed))
  ) {
    return 'Valor inválido para application.'
  }
  return null
}

function defaultStartMenuRoots(environment: NodeJS.ProcessEnv): string[] {
  return uniquePaths([
    environment.ProgramData
      ? join(environment.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      : '',
    environment.APPDATA
      ? join(environment.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      : ''
  ])
}

function defaultInstallRoots(environment: NodeJS.ProcessEnv): string[] {
  return uniquePaths([
    environment.ProgramFiles ?? 'C:\\Program Files',
    environment['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    environment.LOCALAPPDATA ? join(environment.LOCALAPPDATA, 'Programs') : ''
  ])
}

async function discoverStartMenuShortcuts(
  roots: string[],
  platform: NodeJS.Platform
): Promise<DiscoveredWindowsApp[]> {
  if (platform !== 'win32') return []
  const files = await collectFiles(roots, 8, MAX_SCAN_ENTRIES)
  return files
    .filter((path) => extname(path).toLocaleLowerCase() === '.lnk')
    .map((path) => {
      const displayName = basename(path, extname(path))
      return createEntry(displayName, { kind: 'shortcut', path }, 'start-menu')
    })
    .filter((entry): entry is DiscoveredWindowsApp => entry !== null)
}

async function discoverExecutionAliases(
  root: string,
  platform: NodeJS.Platform
): Promise<DiscoveredWindowsApp[]> {
  if (platform !== 'win32' || !root) return []
  const files = await collectFiles([root], 1, 2_000)
  return files
    .filter((path) => extname(path).toLocaleLowerCase() === '.exe')
    .map((path) => {
      const displayName = basename(path, extname(path))
      return createEntry(displayName, { kind: 'executable', path }, 'windows-apps')
    })
    .filter((entry): entry is DiscoveredWindowsApp => entry !== null)
}

async function discoverInstalledExecutables(
  query: string,
  roots: string[],
  platform: NodeJS.Platform
): Promise<DiscoveredWindowsApp[]> {
  if (platform !== 'win32') return []
  const files = await collectFiles(roots, MAX_INSTALL_DEPTH, MAX_SCAN_ENTRIES)
  return files
    .filter((path) => extname(path).toLocaleLowerCase() === '.exe')
    .filter((path) => {
      const stem = normalizeAppName(basename(path, extname(path)))
      const parent = normalizeAppName(basename(dirname(path)))
      if (NOISY_EXECUTABLE_WORDS.some((word) => stem.includes(word))) return false
      return similarityScore([stem, parent], query) >= 70
    })
    .map((path) => {
      const displayName = basename(path, extname(path))
      return createEntry(displayName, { kind: 'executable', path }, 'installed-program')
    })
    .filter((entry): entry is DiscoveredWindowsApp => entry !== null)
}

function toStartAppEntries(
  apps: Array<{ name: string; appId: string }>
): DiscoveredWindowsApp[] {
  return apps
    .filter(({ appId }) => APP_ID_PATTERN.test(appId))
    .map(({ name, appId }) => {
      const entry = createEntry(name, { kind: 'app-id', appId }, 'start-apps')
      if (entry && /^OpenAI\.Codex_/i.test(appId)) {
        entry.aliases = uniqueAliases([
          ...entry.aliases,
          ...KNOWN_APP_ALIASES.codex,
          ...KNOWN_APP_ALIASES.chatgpt
        ])
      }
      return entry
    })
    .filter((entry): entry is DiscoveredWindowsApp => entry !== null)
}

async function readWindowsStartApps(
  platform: NodeJS.Platform
): Promise<Array<{ name: string; appId: string }>> {
  if (platform !== 'win32') return []
  const script = 'Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'
  const output = await captureProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    script
  ])
  const parsed = JSON.parse(output || '[]') as unknown
  const values = Array.isArray(parsed) ? parsed : [parsed]
  return values.flatMap((value) => {
    if (!isRecord(value)) return []
    const name = typeof value.Name === 'string' ? value.Name.trim() : ''
    const appId = typeof value.AppID === 'string' ? value.AppID.trim() : ''
    return name && appId ? [{ name, appId }] : []
  })
}

function createEntry(
  displayName: string,
  recipe: AppLaunchRecipe,
  source: Exclude<AppDiscoverySource, 'learned'>
): DiscoveredWindowsApp | null {
  const normalized = normalizeAppName(displayName)
  if (!normalized || isUnsafeExecutableName(displayName, recipe)) return null
  const aliases = aliasesFor(normalized)
  return {
    id: stableId(displayName, recipe),
    displayName: displayName.trim(),
    aliases: uniqueAliases([normalized, ...aliases]),
    recipe,
    source
  }
}

function aliasesFor(normalizedName: string): string[] {
  const aliases: string[] = []
  for (const [canonical, knownAliases] of Object.entries(KNOWN_APP_ALIASES)) {
    const normalizedAliases = knownAliases.map(normalizeAppName)
    if (
      normalizedName === canonical
      || normalizedName.includes(canonical)
      || normalizedAliases.includes(normalizedName)
    ) {
      aliases.push(...normalizedAliases)
    }
  }
  return aliases
}

function isUnsafeExecutableName(name: string, recipe: AppLaunchRecipe): boolean {
  if (recipe.kind !== 'executable') return false
  const stem = normalizeAppName(basename(name, extname(name)))
  return UNSAFE_LAUNCH_TARGET_STEMS.has(stem)
}

function bestMatch(
  entries: CatalogEntry[],
  query: string
): { entry: CatalogEntry; score: number; ambiguous: boolean } | null {
  let bestScore = -1
  const bestEntries: CatalogEntry[] = []
  const knownQuery = isKnownApplicationAlias(query)
  for (const entry of entries) {
    const score = knownQuery && !matchesKnownIdentity(entry, query)
      ? 0
      : similarityScore(entry.aliases, query)
      + (entry.source === 'learned' ? 5 : 0)
    if (score > bestScore) {
      bestScore = score
      bestEntries.length = 0
      bestEntries.push(entry)
    } else if (score === bestScore) {
      bestEntries.push(entry)
    }
  }
  return bestEntries.length > 0
    ? { entry: bestEntries[0], score: bestScore, ambiguous: bestEntries.length > 1 }
    : null
}

function isKnownApplicationAlias(query: string): boolean {
  return Object.values(KNOWN_APP_ALIASES)
    .flat()
    .map(normalizeAppName)
    .includes(query)
}

function matchesKnownIdentity(entry: CatalogEntry, query: string): boolean {
  if (
    entry.source === 'start-menu'
    || (entry.source === 'learned' && entry.learnedSkill?.discoveredFrom === 'start-menu')
  ) return false
  const displayName = normalizeAppName(entry.displayName)
  const matchingGroups = Object.entries(KNOWN_APP_ALIASES)
    .filter(([, aliases]) => aliases.map(normalizeAppName).includes(query))
    .map(([canonical, aliases]) => [canonical, ...aliases].map(normalizeAppName))
  if (matchingGroups.some((aliases) => aliases.includes(displayName))) return true
  return entry.recipe.kind === 'app-id'
    && /^OpenAI\.Codex_/i.test(entry.recipe.appId)
    && matchingGroups.some((aliases) => aliases.includes('codex') || aliases.includes('chatgpt'))
}

function similarityScore(aliases: string[], query: string): number {
  let best = 0
  const queryTokens = new Set(query.split(' ').filter(Boolean))
  for (const aliasValue of aliases) {
    const alias = normalizeAppName(aliasValue)
    if (alias === query) return 100
    if (alias.replaceAll(' ', '') === query.replaceAll(' ', '')) return 96
    if (alias.startsWith(query) || query.startsWith(alias)) best = Math.max(best, 82)
    if (alias.includes(query) || query.includes(alias)) best = Math.max(best, 74)
    const aliasTokens = new Set(alias.split(' ').filter(Boolean))
    const overlap = [...queryTokens].filter((token) => aliasTokens.has(token)).length
    if (overlap) {
      best = Math.max(best, Math.round(60 * overlap / Math.max(queryTokens.size, aliasTokens.size)))
    }
  }
  return best
}

function deduplicateEntries(entries: CatalogEntry[]): CatalogEntry[] {
  const byRecipe = new Map<string, CatalogEntry>()
  for (const entry of entries) {
    const key = serializeRecipe(entry.recipe)
    const existing = byRecipe.get(key)
    if (!existing || sourcePriority(entry.source) > sourcePriority(existing.source)) {
      byRecipe.set(key, existing
        ? { ...entry, aliases: uniqueAliases([...entry.aliases, ...existing.aliases]) }
        : entry)
    } else {
      existing.aliases = uniqueAliases([...existing.aliases, ...entry.aliases])
    }
  }
  return [...byRecipe.values()]
}

function sourcePriority(source: AppDiscoverySource): number {
  return ({
    learned: 5,
    'start-apps': 4,
    'known-app': 3,
    'start-menu': 3,
    'windows-apps': 2,
    'installed-program': 1
  })[source]
}

async function collectFiles(
  roots: string[],
  maxDepth: number,
  maxEntries: number
): Promise<string[]> {
  const results: string[] = []
  const queue = uniquePaths(roots).map((path) => ({ path, depth: 0 }))
  let inspected = 0

  while (queue.length && inspected < maxEntries) {
    const current = queue.shift()
    if (!current) break
    try {
      const directory = await opendir(current.path)
      for await (const entry of directory) {
        inspected += 1
        if (inspected > maxEntries) break
        const path = join(current.path, entry.name)
        if (entry.isFile()) results.push(path)
        else if (entry.isDirectory() && current.depth < maxDepth) {
          queue.push({ path, depth: current.depth + 1 })
        }
      }
    } catch {
      // A source may not exist or may be unreadable. Continue with the next source.
    }
  }
  return results
}

async function isRecipeStillTrusted(
  recipe: AppLaunchRecipe,
  trustedRoots: string[]
): Promise<boolean> {
  if (recipe.kind === 'app-id') return APP_ID_PATTERN.test(recipe.appId)
  if (recipe.kind === 'protocol') return SAFE_PROTOCOLS.has(recipe.uri)
  const extension = extname(recipe.path).toLocaleLowerCase()
  const extensionAllowed = recipe.kind === 'shortcut'
    ? extension === '.lnk'
    : extension === '.exe'
  if (!extensionAllowed || !isInsideRoots(recipe.path, trustedRoots)) return false
  try {
    await access(recipe.path)
    return true
  } catch {
    return false
  }
}

function isInsideRoots(path: string, roots: string[]): boolean {
  const target = normalize(resolve(path)).toLocaleLowerCase()
  return uniquePaths(roots).some((root) => {
    const resolvedRoot = normalize(resolve(root)).toLocaleLowerCase()
    return target === resolvedRoot || target.startsWith(`${resolvedRoot}\\`)
  })
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean).map((path) => normalize(resolve(path))))]
}

function uniqueAliases(aliases: string[]): string[] {
  return [...new Set(aliases.map(normalizeAppName).filter(Boolean))]
}

function uniqueDisplayValues(values: string[]): string[] {
  const unique = new Map<string, string>()
  for (const value of values) {
    const clean = value.replace(/\s+/g, ' ').trim()
    const key = clean.toLocaleLowerCase('pt-BR')
    if (clean && clean.length <= 80 && !unique.has(key)) unique.set(key, clean)
  }
  return [...unique.values()]
}

function stableId(name: string, recipe: AppLaunchRecipe): string {
  const source = `${normalizeAppName(name)}:${serializeRecipe(recipe)}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `app-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function serializeRecipe(recipe: AppLaunchRecipe): string {
  return recipe.kind === 'app-id'
    ? `app-id:${recipe.appId}`
    : recipe.kind === 'protocol'
      ? `protocol:${recipe.uri}`
      : `${recipe.kind}:${normalize(resolve(recipe.path)).toLocaleLowerCase()}`
}

function isSkillFile(value: unknown): value is AppSkillFile {
  return isRecord(value)
    && value.version === 1
    && Array.isArray(value.skills)
    && value.skills.every(isLearnedSkill)
}

function isLearnedSkill(value: unknown): value is LearnedAppSkill {
  if (!isRecord(value) || !isRecord(value.procedure)) return false
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.aliases)
    && value.aliases.every((alias) => typeof alias === 'string')
    && value.procedure.action === 'launch-discovered-application'
    && isRecipe(value.procedure.target)
    && ['start-menu', 'windows-apps', 'start-apps', 'known-app', 'installed-program'].includes(
      String(value.discoveredFrom)
    )
    && typeof value.successfulLaunches === 'number'
    && Number.isInteger(value.successfulLaunches)
    && value.successfulLaunches >= 0
    && typeof value.createdAt === 'string'
    && typeof value.lastUsedAt === 'string'
}

function isRecipe(value: unknown): value is AppLaunchRecipe {
  if (!isRecord(value)) return false
  if (value.kind === 'app-id') {
    return typeof value.appId === 'string' && APP_ID_PATTERN.test(value.appId)
  }
  if (value.kind === 'protocol') {
    return value.uri === 'spotify:'
  }
  if (value.kind === 'shortcut' || value.kind === 'executable') {
    return typeof value.path === 'string' && value.path.length > 0
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function spawnAndConfirm(
  executable: string,
  args: string[],
  verificationDelayMs = 400,
  signal?: AbortSignal
): Promise<number> {
  throwIfAborted(signal)
  return await new Promise<number>((resolveLaunch, rejectLaunch) => {
    const child = spawn(executable, args, {
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsHide: true
    })
    let settled = false
    let timer: NodeJS.Timeout | null = null
    const finish = (error?: Error, processId?: number): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      if (error) rejectLaunch(error)
      else resolveLaunch(processId ?? 0)
    }
    const abort = (): void => {
      child.kill()
      finish(abortError(signal))
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.once('spawn', () => {
      child.unref()
      const processId = child.pid
      if (!processId) {
        finish(new Error('O Windows não retornou o processo iniciado.'))
        return
      }
      if (verificationDelayMs === 0) {
        finish(undefined, processId)
        return
      }
      timer = setTimeout(() => {
        if (child.exitCode === null) finish(undefined, processId)
        else finish(new Error('O processo encerrou antes de confirmar a abertura.'))
      }, verificationDelayMs)
      child.once('exit', () => {
        finish(new Error('O processo encerrou antes de confirmar a abertura.'))
      })
    })
    child.once('error', (error) => finish(error))
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const error = new Error('A abertura do aplicativo foi interrompida antes da confirmação.')
  error.name = 'AbortError'
  return error
}

async function captureProcess(executable: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolveOutput, rejectOutput) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      output += chunk
      if (output.length > 2_000_000) child.kill()
    })
    child.once('error', rejectOutput)
    child.once('exit', (code) => {
      if (code === 0) resolveOutput(output)
      else rejectOutput(new Error('O Windows não retornou a lista de aplicativos.'))
    })
  })
}

async function findRunningExecutableProcess(path: string): Promise<number | null> {
  const script = [
    '$target=[IO.Path]::GetFullPath($args[0])',
    '$match=Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $target } | Select-Object -First 1 -ExpandProperty ProcessId',
    'if ($match) { Write-Output $match }'
  ].join('; ')
  const output = await captureProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    script,
    path
  ])
  const processId = Number(output.trim())
  return Number.isInteger(processId) && processId > 0 ? processId : null
}

async function inspectWindowsShortcut(path: string): Promise<string | null> {
  const script = [
    '$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($args[0])',
    'if ($shortcut.TargetPath) { Write-Output $shortcut.TargetPath }'
  ].join('; ')
  const output = await captureProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    script,
    path
  ])
  return output.trim() || null
}

function isSafeShortcutTarget(value: string | null): boolean {
  if (!value || !isAbsolute(value) || extname(value).toLocaleLowerCase() !== '.exe') return false
  const stem = normalizeAppName(basename(value, extname(value)))
  return Boolean(stem) && !UNSAFE_LAUNCH_TARGET_STEMS.has(stem)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}

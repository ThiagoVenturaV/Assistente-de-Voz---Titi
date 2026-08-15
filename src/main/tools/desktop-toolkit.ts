import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { shell } from 'electron'
import {
  WindowsAppCatalog,
  type ApplicationCatalog
} from '../apps/windows-app-catalog'
import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutor
} from './contracts'

type KnownApplication = 'chrome' | 'brave' | 'spotify' | 'codex' | 'antigravity'
type BrowserChoice = 'default' | 'chrome' | 'brave'
type MediaAction = 'play_pause' | 'next' | 'previous' | 'volume_up' | 'volume_down' | 'mute'

const WINDOWS_MEDIA_KEYS: Record<MediaAction, number> = {
  play_pause: 0xb3,
  next: 0xb0,
  previous: 0xb1,
  volume_up: 0xaf,
  volume_down: 0xae,
  mute: 0xad
}

export class DesktopToolkit implements ToolExecutor {
  constructor(private readonly appCatalog: ApplicationCatalog = new WindowsAppCatalog()) {}

  readonly definitions: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'open_application',
        description: 'Descobre e abre pelo nome um aplicativo instalado no Windows. Use para Spotify, Brave, ChatGPT, Codex, Antigravity e também aplicativos novos. O Titi procura somente em fontes confiáveis do Windows e aprende a receita após uma abertura bem-sucedida.',
        parameters: {
          type: 'object',
          required: ['application'],
          properties: {
            application: {
              type: 'string',
              description: 'Nome comum do aplicativo, sem caminho, executável, argumentos ou comando.'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'open_web',
        description: 'Abre um endereço ou pesquisa na web. Use url para navegar diretamente ou query para pesquisar. Nunca invente que abriu a página sem chamar esta ferramenta.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Endereço HTTP ou HTTPS para abrir.' },
            query: { type: 'string', description: 'Termo a pesquisar no Google.' },
            browser: {
              type: 'string',
              enum: ['default', 'chrome', 'brave'],
              description: 'Navegador preferido. O padrão usa a escolha do Windows.'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'spotify',
        description: 'Abre o Spotify, pesquisa músicas, artistas ou playlists e controla a reprodução usando as teclas de mídia do Windows.',
        parameters: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: ['open', 'search', 'play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'mute']
            },
            query: { type: 'string', description: 'Busca usada somente com action=search.' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'current_datetime',
        description: 'Obtém a data e a hora atuais deste computador.',
        parameters: { type: 'object', properties: {} }
      }
    }
  ]

  async execute(name: string, argumentsValue: unknown): Promise<ToolExecutionResult> {
    const args = parseArguments(argumentsValue)
    try {
      switch (name) {
        case 'open_application':
          return await this.openApplication(requiredString(args.application, 'application'))
        case 'open_web':
          return await this.openWeb(args)
        case 'spotify':
          return await this.controlSpotify(args)
        case 'current_datetime':
          return currentDateTime()
        default:
          return { ok: false, message: `Ferramenta desconhecida: ${name}.` }
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'A ferramenta falhou de forma inesperada.'
      }
    }
  }

  private async openApplication(application: string): Promise<ToolExecutionResult> {
    return await this.appCatalog.open(application)
  }

  private async openWeb(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const browser = optionalEnum(args.browser, ['default', 'chrome', 'brave']) ?? 'default'
    const query = optionalString(args.query)
    const requestedUrl = optionalString(args.url)
    if (!query && !requestedUrl) {
      return { ok: false, message: 'Informe um endereço ou termo de pesquisa.' }
    }

    const url = query
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
      : normalizeHttpUrl(requestedUrl ?? '')

    if (browser === 'default') {
      await shell.openExternal(url)
    } else {
      const executable = await findExecutable(applicationCandidates(browser))
      if (!executable) {
        return { ok: false, message: `Não encontrei o ${displayName(browser)} instalado.` }
      }
      await launchDetached(executable, [url])
    }

    return {
      ok: true,
      message: query ? `Pesquisa aberta: ${query}.` : `Página aberta: ${url}.`,
      details: { browser, url }
    }
  }

  private async controlSpotify(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const action = requiredEnum(args.action, ['open', 'search', 'play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'mute'], 'action')
    if (action === 'open') return this.openApplication('spotify')
    if (action === 'search') {
      const query = optionalString(args.query)
      if (!query) return { ok: false, message: 'Informe o que deseja pesquisar no Spotify.' }
      await shell.openExternal(`spotify:search:${encodeURIComponent(query)}`)
      return { ok: true, message: `Pesquisa aberta no Spotify: ${query}.` }
    }

    await pressWindowsMediaKey(action)
    const labels: Record<MediaAction, string> = {
      play_pause: 'Reprodução alternada.',
      next: 'Próxima faixa acionada.',
      previous: 'Faixa anterior acionada.',
      volume_up: 'Volume aumentado.',
      volume_down: 'Volume reduzido.',
      mute: 'Mudo alternado.'
    }
    return { ok: true, message: labels[action] }
  }
}

export function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim()
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('Somente endereços HTTP ou HTTPS podem ser abertos.')
  }
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || !parsed.hostname
    || parsed.username
    || parsed.password
  ) {
    throw new Error('Somente endereços HTTP ou HTTPS sem credenciais podem ser abertos.')
  }
  return parsed.toString()
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function requiredString(value: unknown, field: string): string {
  const parsed = optionalString(value)
  if (parsed) return parsed
  throw new Error(`Valor inválido para ${field}.`)
}

function requiredEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T
  throw new Error(`Valor inválido para ${field}.`)
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined
}

function applicationCandidates(application: Exclude<KnownApplication, 'spotify' | 'codex'> | 'chrome' | 'brave'): string[] {
  const local = process.env.LOCALAPPDATA ?? ''
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const candidates: Record<'chrome' | 'brave' | 'antigravity', string[]> = {
    chrome: [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ],
    brave: [
      join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    ],
    antigravity: [join(local, 'Programs', 'Antigravity', 'Antigravity.exe')]
  }
  return candidates[application]
}

async function findExecutable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next known installation path.
    }
  }
  return null
}

async function launchDetached(executable: string, args: string[] = []): Promise<void> {
  await new Promise<void>((resolveLaunch, rejectLaunch) => {
    const child = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.once('spawn', () => {
      child.unref()
      resolveLaunch()
    })
    child.once('error', rejectLaunch)
  })
}

async function pressWindowsMediaKey(action: MediaAction): Promise<void> {
  if (process.platform !== 'win32') throw new Error('O controle de mídia está disponível somente no Windows.')
  const key = WINDOWS_MEDIA_KEYS[action]
  const script = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class TitiMediaKey { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); }'",
    `[TitiMediaKey]::keybd_event(${key},0,0,[UIntPtr]::Zero)`,
    `[TitiMediaKey]::keybd_event(${key},0,2,[UIntPtr]::Zero)`
  ].join('; ')
  await new Promise<void>((resolvePress, rejectPress) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], {
      windowsHide: true,
      stdio: 'ignore'
    })
    child.once('error', rejectPress)
    child.once('exit', (code) => code === 0 ? resolvePress() : rejectPress(new Error('O Windows não aceitou o comando de mídia.')))
  })
}

function currentDateTime(): ToolExecutionResult {
  const now = new Date()
  return {
    ok: true,
    message: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'long'
    }).format(now),
    details: { iso: now.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  }
}

function displayName(application: KnownApplication): string {
  return ({ chrome: 'Chrome', brave: 'Brave', spotify: 'Spotify', codex: 'Codex App', antigravity: 'Antigravity' })[application]
}

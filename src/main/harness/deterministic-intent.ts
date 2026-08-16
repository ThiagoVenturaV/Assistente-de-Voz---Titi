import { knownWebsiteUrl } from '../tools/website-destination'

export type DeterministicToolCall =
  | {
    name: 'open_application'
    arguments: {
      application: string
    }
  }
  | {
    name: 'open_web'
    arguments: {
      url?: string
      query?: string
      browser: 'default' | 'chrome' | 'brave'
    }
  }
  | {
    name: 'spotify'
    arguments: {
      action: 'search' | 'play' | 'pause' | 'play_pause' | 'next' | 'previous' | 'volume_up' | 'volume_down' | 'mute'
      query?: string
    }
  }
  | {
    name: 'computer_look'
    arguments: {
      goal: string
    }
  }

type BrowserChoice = 'default' | 'chrome' | 'brave'
type KnownApplication = 'chrome' | 'brave' | 'spotify' | 'codex' | 'antigravity'

const OPEN_COMMAND = /^(?:abra|abre|abrir|inicie|inicia|iniciar|execute|executa|executar|rode|roda|rodar)\s+(.+)$/iu
const WEB_OPEN_COMMAND = /^(?:abra|abre|abrir|acesse|acessa|acessar|entre\s+(?:em|no|na)|navegue\s+(?:para|at[eé])|v[aá]\s+para)\s+(.+)$/iu
const BROWSER_DESTINATION_COMMAND = /^(?:abra|abre|abrir|inicie|inicia|iniciar)\s+(?:(?:o|um)\s+)?(?:(?:navegador)\s+)?(google chrome|chrome|brave browser|brave)\s+(?:e|,)\s+(?:abra|abre|acesse|acessa|entre|entra|navegue|vai|v[aá])(?:\s+(?:em|no|na|para|at[eé]))?\s+(.+)$/iu
const SEARCH_COMMAND = /^(?:pesquise|pesquisa|pesquisar|procure|procura|procurar|busque|busca|buscar)\s+(.+)$/iu
const SPOTIFY_SEARCH_COMMAND = /^(?:pesquise|pesquisa|pesquisar|procure|procura|procurar|busque|busca|buscar|toque|tocar)\s+(.+?)\s+(?:no|na|pelo|pela)\s+(?:app(?:licativo)?\s+(?:do\s+)?)?spotify$/iu
const DESKTOP_LOOK_COMMANDS = [
  /^(?:olhe|olha|veja|v[eê]|observe)\s+(?:em\s+|nas?\s+)?(?:(?:tod[oa]s?\s+(?:[oa]s\s+)?(?:minhas?\s+)?)|(?:minhas?\s+))?(?:telas?|monitores?)\s+(?:e\s+|,\s*)?(?:confirme|diga|veja|confira|verifique)\s+se\s+(.+)$/iu,
  /^(?:confira|verifique|veja)\s+(?:em\s+|nas?\s+)(?:(?:tod[oa]s?\s+(?:[oa]s\s+)?(?:minhas?\s+)?)|(?:minhas?\s+))?(?:telas?|monitores?)\s+se\s+(.+)$/iu
]

const APPLICATION_ALIASES: Record<string, KnownApplication> = {
  chrome: 'chrome',
  'google chrome': 'chrome',
  brave: 'brave',
  'brave browser': 'brave',
  'navegador brave': 'brave',
  spotify: 'spotify',
  codex: 'codex',
  'codex app': 'codex',
  'app codex': 'codex',
  chatgpt: 'codex',
  'chat gpt': 'codex',
  'chatgpt app': 'codex',
  'app chatgpt': 'codex',
  antigravity: 'antigravity',
  'anti gravity': 'antigravity'
}
const BLOCKED_GENERIC_APPLICATIONS = new Set([
  'cmd',
  'command prompt',
  'prompt de comando',
  'powershell',
  'pwsh',
  'terminal',
  'windows terminal',
  'regedit',
  'registry editor',
  'editor do registro',
  'wscript',
  'cscript',
  'mshta',
  'rundll32'
])

/**
 * Routes only short, explicit desktop commands. Everything conversational,
 * instructional or compound remains with the language model.
 */
export function resolveDeterministicIntent(input: string): DeterministicToolCall | null {
  const request = stripRequestFraming(input)
  if (!request) return null

  const browserDestination = resolveBrowserDestination(request)
  if (browserDestination) return browserDestination

  const desktopLook = resolveDesktopLook(request)
  if (desktopLook) return desktopLook
  if (hasCompoundAction(request)) return null

  const media = resolveMediaControl(request)
  if (media) return media

  const spotifySearch = resolveSpotifySearch(request)
  if (spotifySearch) return spotifySearch

  const application = resolveApplicationOpen(request)
  if (application) return application

  const webOpen = resolveWebOpen(request)
  if (webOpen) return webOpen

  return resolveWebSearch(request)
}

function resolveDesktopLook(request: string): DeterministicToolCall | null {
  for (const command of DESKTOP_LOOK_COMMANDS) {
    const match = request.match(command)
    if (!match) continue

    const subject = stripTrailingCourtesy(match[1])
      .replace(/[.!?]+$/u, '')
      .trim()
    if (subject.length < 2 || subject.length > 240 || hasCompoundAction(subject)) return null

    return {
      name: 'computer_look',
      arguments: { goal: `Verifique em todos os monitores se ${subject}` }
    }
  }
  return null
}

function resolveBrowserDestination(request: string): DeterministicToolCall | null {
  const match = request.match(BROWSER_DESTINATION_COMMAND)
  if (!match) return null

  const browserName = fold(match[1])
  const browser: BrowserChoice = browserName.includes('brave') ? 'brave' : 'chrome'
  const destination = stripTrailingCourtesy(match[2])
    .replace(/^(?:o|a)\s+(?:site|endere[cç]o|url)(?:\s+(?:do|da|de))?\s+/iu, '')
    .replace(/^(?:o|a)\s+/iu, '')
  const url = exactWebDestination(destination) ?? knownWebsiteUrl(destination)
  if (!url) return null

  return {
    name: 'open_web',
    arguments: { url, browser }
  }
}

function resolveApplicationOpen(request: string): DeterministicToolCall | null {
  const match = request.match(OPEN_COMMAND)
  if (!match) return null

  const targetWithKind = stripTrailingCourtesy(match[1])
    .replace(/^(?:o|a|um|uma)\s+/iu, '')
  const hasExplicitApplicationKind = /^(?:app|aplicativo|programa|navegador)(?:\s+(?:do|da))?\s+/iu
    .test(targetWithKind)
  const target = targetWithKind
    .replace(/^(?:app|aplicativo|programa|navegador)(?:\s+(?:do|da))?\s+/iu, '')
    .trim()
  const candidate = fold(target)
  const application = APPLICATION_ALIASES[candidate]
  if (typeof application === 'string') {
    return {
      name: 'open_application',
      arguments: { application }
    }
  }

  if (!hasExplicitApplicationKind || !isSafeGenericApplicationName(target)) return null

  return {
    name: 'open_application',
    arguments: { application: target }
  }
}

function isSafeGenericApplicationName(value: string): boolean {
  const normalized = fold(value)
  const possibleWebTarget = extractBrowser(value).content
  if (
    !normalized
    || normalized.length > 80
    || exactWebDestination(value)
    || exactWebDestination(possibleWebTarget)
    || /[\\/\u0000-\u001f\u007f]/u.test(value)
    || /^[a-z]:|\.(?:exe|lnk|cmd|bat|ps1)$/iu.test(value)
    || /^[a-z][a-z\d+.-]*:/iu.test(value)
    || /(?:^|\s)--?[\w-]+(?:\s|$)/u.test(value)
    || /^(?:algum|qualquer|meu|minha|site|pagina|arquivo|pasta|documento|projeto)\b/iu.test(normalized)
    || BLOCKED_GENERIC_APPLICATIONS.has(normalized)
  ) return false
  return normalized.split(' ').length <= 8
}

function resolveWebOpen(request: string): DeterministicToolCall | null {
  const match = request.match(WEB_OPEN_COMMAND)
  if (!match) return null

  let destination = stripTrailingCourtesy(match[1])
    .replace(/^(?:o|a)\s+(?:site|endere[cç]o|url)(?:\s+(?:do|da|de))?\s+/iu, '')
  const selected = extractBrowser(destination)
  destination = selected.content

  const url = exactWebDestination(destination) ?? knownWebsiteUrl(destination)
  if (!url) return null
  return {
    name: 'open_web',
    arguments: { url, browser: selected.browser }
  }
}

function resolveWebSearch(request: string): DeterministicToolCall | null {
  const match = request.match(SEARCH_COMMAND)
  if (!match) return null

  let query = stripTrailingCourtesy(match[1])
    .replace(/^(?:(?:na|pela)\s+web|no\s+google)\s+(?:por\s+)?/iu, '')
  const selected = extractBrowser(query)
  query = selected.content
    .replace(/\s+(?:(?:na|pela)\s+web|no\s+google)$/iu, '')
    .replace(/^(?:por|sobre)\s+/iu, '')
    .trim()

  if (!isUsefulQuery(query)) return null
  return {
    name: 'open_web',
    arguments: { query, browser: selected.browser }
  }
}

function resolveSpotifySearch(request: string): DeterministicToolCall | null {
  const match = request.match(SPOTIFY_SEARCH_COMMAND)
  if (!match) return null
  const query = match[1].replace(/^(?:por|sobre)\s+/iu, '').trim()
  if (!isUsefulQuery(query)) return null
  return {
    name: 'spotify',
    arguments: { action: 'search', query }
  }
}

function resolveMediaControl(request: string): DeterministicToolCall | null {
  const command = fold(stripTrailingCourtesy(request).replace(/[.!?]+$/u, ''))
  const suffix = '(?: (?:no|do) spotify)?'

  if (new RegExp(`^(?:pause|pausar|pare|parar)(?: (?:a |o |na |no )?(?:musica|faixa|reproducao|som))?${suffix}$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'pause' } }
  }
  if (new RegExp(`^(?:continue|continuar|retome|retomar|de play|da play|dar play|play|reproduza|reproduzir|toque|tocar)(?: (?:a |o |na |no )?(?:musica|faixa|reproducao|som))?${suffix}$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'play' } }
  }
  if (new RegExp(`^(?:proxima|proxima musica|proxima faixa|pule (?:a )?(?:musica|faixa)|pular (?:a )?(?:musica|faixa)|avance (?:a )?(?:musica|faixa)|avancar (?:a )?(?:musica|faixa))${suffix}$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'next' } }
  }
  if (new RegExp(`^(?:musica anterior|faixa anterior|volte (?:a )?(?:musica|faixa)|voltar (?:a )?(?:musica|faixa)|retorne (?:a )?(?:musica|faixa))${suffix}$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'previous' } }
  }
  if (new RegExp(`^(?:aumente|aumentar|suba|subir) (?:o )?(?:volume|som)(?: (?:do )?spotify)?$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'volume_up' } }
  }
  if (new RegExp(`^(?:abaixe|abaixar|diminua|diminuir|reduza|reduzir) (?:o )?(?:volume|som)(?: (?:do )?spotify)?$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'volume_down' } }
  }
  if (new RegExp(`^(?:mute|mutar|silencie|silenciar|tire o som)(?: (?:o |do )?spotify)?$`, 'u').test(command)) {
    return { name: 'spotify', arguments: { action: 'mute' } }
  }
  return null
}

function extractBrowser(value: string): { content: string; browser: BrowserChoice } {
  const prefixed = value.match(/^(?:no|pelo|usando(?:\s+o)?)\s+(brave|chrome)\s+(.+)$/iu)
  if (prefixed) {
    return { content: prefixed[2].trim(), browser: fold(prefixed[1]) as BrowserChoice }
  }

  const suffixed = value.match(/^(.+?)\s+(?:no|pelo|usando(?:\s+o)?)\s+(brave|chrome)$/iu)
  if (suffixed) {
    return { content: suffixed[1].trim(), browser: fold(suffixed[2]) as BrowserChoice }
  }
  return { content: value.trim(), browser: 'default' }
}

function exactWebDestination(value: string): string | null {
  const candidate = value
    .trim()
    .replace(/^["'“”]+|["'“”.,;!?]+$/gu, '')
  if (/^https?:\/\/[^\s]+$/iu.test(candidate)) return candidate
  if (/^(?:www\.)?(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:\/[^\s]*)?$/iu.test(candidate)) {
    return candidate
  }
  return null
}

function stripRequestFraming(value: string): string {
  let request = value.replace(/\s+/gu, ' ').trim()
  request = request.replace(/^(?:(?:oi|ei)\s+)?titi\s*[,!:;-]?\s*/iu, '')
  request = request.replace(/^por\s+favor\s*[,;:-]?\s*/iu, '')
  request = request.replace(/^(?:(?:voc[eê]\s+)?(?:pode|poderia)|consegue)\s+/iu, '')
  request = request.replace(/^(?:eu\s+)?(?:quero|gostaria)\s+(?:que\s+(?:voc[eê]\s+)?)?/iu, '')
  return stripTrailingCourtesy(request)
}

function stripTrailingCourtesy(value: string): string {
  let result = value.trim()
  let previous = ''
  while (result !== previous) {
    previous = result
    result = result.replace(/\s+(?:por\s+favor|pra\s+mim|para\s+mim|agora)\s*[.!?]*$/iu, '').trim()
  }
  return result
}

function hasCompoundAction(value: string): boolean {
  return /\b(?:e|depois|ent[aã]o)\s+(?:abra|abre|abrir|acesse|acessar|pesquise|pesquisar|procure|procurar|busque|buscar|pause|pausar|toque|tocar|aumente|abaixe|mute|silencie)\b/iu.test(value)
}

function isUsefulQuery(value: string): boolean {
  return value.trim().length >= 2 && !hasCompoundAction(value)
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[.!?]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
}

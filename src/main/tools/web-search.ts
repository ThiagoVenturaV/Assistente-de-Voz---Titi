import {
  shortlistControls,
  type LayaCandidateControl,
  type LayaTargetDecisionRouter
} from '../runtime/laya-decision-runtime'
import type { ToolExecutionResult } from './contracts'

export interface WebSearchResultItem {
  id: string
  title: string
  url: string
  snippet: string
}

export interface WebSearchResponse {
  query: string
  provider: 'duckduckgo' | 'wikipedia'
  results: WebSearchResultItem[]
  selectedResultId?: string
  layaConfidence?: number
  topExcerpt?: string
}

const SEARCH_TIMEOUT_MS = 8_000
const EXCERPT_TIMEOUT_MS = 3_500
const MAX_EXCERPT_BYTES = 200_000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) TitiAssistant/0.2 Safari/537.36'

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '-',
  '&mdash;': '—'
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash);/gi, (match) => (
      HTML_ENTITIES[match.toLowerCase()] ?? match
    ))
    .replace(/&#(\d+);/g, (_match, dec: string) => {
      const code = Number.parseInt(dec, 10)
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : ' '
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : ' '
    })
}

export function sanitizeWebText(raw: string, maxChars = 400): string {
  const withoutScripts = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  const decoded = decodeHtmlEntities(withoutScripts)
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\b(?:ignore\s+(?:all\s+)?(?:previous\s+)?instructions|desconsidere\s+as\s+instrucoes)\b/gi, '[filtrado]')
    .replace(/\s+/g, ' ')
    .trim()
  if (decoded.length <= maxChars) return decoded
  return `${decoded.slice(0, maxChars - 1).trimEnd()}…`
}

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    if (!parsed.hostname || parsed.username || parsed.password) return false
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:')
    ) {
      return false
    }
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4Match) {
      const first = Number(ipv4Match[1])
      const second = Number(ipv4Match[2])
      if (first === 172 && second >= 16 && second <= 31) return false
      if (first === 100 && second >= 64 && second <= 127) return false
    }
    return true
  } catch {
    return false
  }
}

export function unwrapSearchResultUrl(rawHref: string): string | null {
  const decoded = decodeHtmlEntities(rawHref).trim()
  if (!decoded) return null

  const normalizedHref = decoded.startsWith('//') ? `https:${decoded}` : decoded
  try {
    const base = new URL(normalizedHref, 'https://html.duckduckgo.com')
    const uddg = base.searchParams.get('uddg')
    const candidate = uddg ? uddg.trim() : base.toString()
    if (!isSafePublicHttpsUrl(candidate)) return null
    const finalUrl = new URL(candidate)
    if (finalUrl.hostname.endsWith('duckduckgo.com')) return null
    return finalUrl.toString()
  } catch {
    return null
  }
}

export function parseDuckDuckGoHtml(html: string, maxResults = 5): WebSearchResultItem[] {
  const results: WebSearchResultItem[] = []
  const seenUrls = new Set<string>()
  const limit = Math.max(1, Math.min(10, maxResults))

  const anchorPattern = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(html)) !== null && results.length < limit) {
    const rawHref = match[1] ?? ''
    const rawTitle = match[2] ?? ''
    const url = unwrapSearchResultUrl(rawHref)
    if (!url || seenUrls.has(url)) continue

    const title = sanitizeWebText(rawTitle, 140)
    if (!title) continue

    const afterAnchor = html.slice(match.index + match[0].length, match.index + match[0].length + 2500)
    const snippetMatch = afterAnchor.match(
      /<(?:a|div|span)\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i
    )
    const snippet = snippetMatch ? sanitizeWebText(snippetMatch[1] ?? '', 320) : ''

    seenUrls.add(url)
    results.push({
      id: `r${results.length + 1}`,
      title,
      url,
      snippet
    })
  }

  return results
}

export function parseWikipediaSearchJson(
  payload: unknown,
  lang: 'pt' | 'en' = 'pt',
  maxResults = 5
): WebSearchResultItem[] {
  if (!payload || typeof payload !== 'object') return []
  const queryObj = (payload as { query?: { search?: unknown } }).query
  const searchArray = Array.isArray(queryObj?.search) ? queryObj.search : []
  const limit = Math.max(1, Math.min(10, maxResults))
  const results: WebSearchResultItem[] = []

  for (const item of searchArray) {
    if (!item || typeof item !== 'object' || results.length >= limit) continue
    const record = item as { title?: unknown; snippet?: unknown }
    const title = typeof record.title === 'string' ? sanitizeWebText(record.title, 140) : ''
    if (!title) continue
    const snippet = typeof record.snippet === 'string' ? sanitizeWebText(record.snippet, 320) : ''
    const encodedTitle = encodeURIComponent(title.replace(/\s+/g, '_'))
    const url = `https://${lang}.wikipedia.org/wiki/${encodedTitle}`
    results.push({
      id: `r${results.length + 1}`,
      title: `${title} (Wikipédia)`,
      url,
      snippet
    })
  }

  return results
}

export function extractReadableExcerpt(html: string, maxChars = 850): string {
  const paragraphMatches = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []
  const paragraphs: string[] = []
  for (const p of paragraphMatches) {
    const cleaned = sanitizeWebText(p, 450)
    if (cleaned.length >= 60) {
      paragraphs.push(cleaned)
    }
    if (paragraphs.join(' ').length >= maxChars) break
  }

  if (paragraphs.length > 0) {
    return sanitizeWebText(paragraphs.join(' '), maxChars)
  }
  return sanitizeWebText(html, maxChars)
}

export class WebSearchClient {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly layaDecisionRouter?: LayaTargetDecisionRouter
  ) {}

  async search(
    rawQuery: string,
    maxResults = 5,
    signal?: AbortSignal
  ): Promise<WebSearchResponse> {
    const query = rawQuery.trim()
    if (!query) {
      throw new Error('Informe um termo de pesquisa válido.')
    }
    const clampedMax = Math.max(1, Math.min(10, Math.trunc(maxResults) || 5))

    let results: WebSearchResultItem[] = await this.searchDuckDuckGo(query, clampedMax, signal).catch(
      (): WebSearchResultItem[] => []
    )
    let provider: 'duckduckgo' | 'wikipedia' = 'duckduckgo'

    if (results.length === 0) {
      provider = 'wikipedia'
      results = await this.searchWikipedia(query, 'pt', clampedMax, signal).catch(
        (): WebSearchResultItem[] => []
      )
      if (results.length === 0) {
        results = await this.searchWikipedia(query, 'en', clampedMax, signal).catch(
          (): WebSearchResultItem[] => []
        )
      }
    }

    let selectedResultId: string | undefined
    let layaConfidence: number | undefined

    if (results.length > 1 && this.layaDecisionRouter) {
      try {
        const candidates: LayaCandidateControl[] = results.map((item) => ({
          id: item.id,
          controlType: 'Result',
          name: `${item.title} — ${item.snippet.slice(0, 90)}`,
          enabled: true
        }))
        const shortlisted = shortlistControls(candidates, query, 10)
        const decision = await this.layaDecisionRouter.chooseTarget(
          `Melhor resultado para: ${query}`,
          shortlisted,
          'Pesquisa na Web',
          signal
        )
        selectedResultId = decision.choice
        layaConfidence = decision.confidence
        const chosenIndex = results.findIndex((item) => item.id === decision.choice)
        if (chosenIndex > 0) {
          const [chosen] = results.splice(chosenIndex, 1)
          if (chosen) results.unshift(chosen)
        }
      } catch {
        // Fallback to natural search ranking when Laya is offline or declines.
      }
    }

    let topExcerpt: string | undefined
    const topResult = results[0]
    if (topResult && topResult.url.startsWith('https://') && isSafePublicHttpsUrl(topResult.url)) {
      topExcerpt = await this.fetchTopExcerpt(topResult.url, signal).catch(() => undefined)
    }

    return {
      query,
      provider,
      results,
      ...(selectedResultId ? { selectedResultId } : {}),
      ...(layaConfidence !== undefined ? { layaConfidence } : {}),
      ...(topExcerpt ? { topExcerpt } : {})
    }
  }

  formatToolResult(response: WebSearchResponse): ToolExecutionResult {
    if (response.results.length === 0) {
      return {
        ok: false,
        status: 'failed',
        message: `Não encontrei resultados públicos na internet para "${response.query}".`,
        details: {
          query: response.query,
          provider: response.provider,
          results: []
        }
      }
    }

    const lines: string[] = [
      `Resultados da pesquisa na web para "${response.query}":`
    ]
    for (const [index, item] of response.results.entries()) {
      const snippetPart = item.snippet ? ` — ${item.snippet}` : ''
      lines.push(`${index + 1}. ${item.title}${snippetPart} (${item.url})`)
    }
    if (response.topExcerpt) {
      lines.push(`Trecho principal verificado: ${response.topExcerpt}`)
    }

    return {
      ok: true,
      status: 'confirmed',
      message: lines.join('\n'),
      details: {
        query: response.query,
        provider: response.provider,
        ...(response.selectedResultId ? { selectedResultId: response.selectedResultId } : {}),
        ...(response.layaConfidence !== undefined ? { layaConfidence: response.layaConfidence } : {}),
        ...(response.topExcerpt ? { topExcerpt: response.topExcerpt } : {}),
        results: response.results.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          snippet: item.snippet
        }))
      }
    }
  }

  private async searchDuckDuckGo(
    query: string,
    maxResults: number,
    signal?: AbortSignal
  ): Promise<WebSearchResultItem[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=br-pt`
    const html = await this.fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, MAX_EXCERPT_BYTES, signal)
    return parseDuckDuckGoHtml(html, maxResults)
  }

  private async searchWikipedia(
    query: string,
    lang: 'pt' | 'en',
    maxResults: number,
    signal?: AbortSignal
  ): Promise<WebSearchResultItem[]> {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=${maxResults}`
    const text = await this.fetchTextWithTimeout(url, SEARCH_TIMEOUT_MS, MAX_EXCERPT_BYTES, signal)
    const parsed = JSON.parse(text) as unknown
    return parseWikipediaSearchJson(parsed, lang, maxResults)
  }

  private async fetchTopExcerpt(url: string, signal?: AbortSignal): Promise<string | undefined> {
    if (!isSafePublicHttpsUrl(url)) return undefined
    const html = await this.fetchTextWithTimeout(url, EXCERPT_TIMEOUT_MS, MAX_EXCERPT_BYTES, signal)
    const excerpt = extractReadableExcerpt(html, 750)
    return excerpt.length >= 50 ? excerpt : undefined
  }

  private async fetchTextWithTimeout(
    url: string,
    timeoutMs: number,
    maxBytes: number,
    externalSignal?: AbortSignal
  ): Promise<string> {
    if (!isSafePublicHttpsUrl(url)) {
      throw new Error('URL bloqueada pela proteção de rede.')
    }
    const controller = new AbortController()
    const onExternalAbort = (): void => controller.abort(externalSignal?.reason)
    if (externalSignal?.aborted) onExternalAbort()
    else externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
    const timer = setTimeout(() => controller.abort(new Error('Tempo limite de pesquisa excedido.')), timeoutMs)

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      if (response.url && !isSafePublicHttpsUrl(response.url)) {
        throw new Error('Redirecionamento para endereço não público bloqueado.')
      }
      const rawText = await response.text()
      return rawText.length > maxBytes ? rawText.slice(0, maxBytes) : rawText
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }
  }
}

import { TITI_RENDERER_BASE_URL } from './renderer-protocol'

export interface TrustedRendererLocation {
  baseUrl: string
  kind: 'development' | 'packaged'
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function resolveTrustedRendererLocation(
  packaged: boolean,
  configuredUrl: string | undefined
): TrustedRendererLocation {
  if (packaged || !configuredUrl) {
    return {
      baseUrl: TITI_RENDERER_BASE_URL,
      kind: 'packaged'
    }
  }

  let url: URL
  try {
    url = new URL(configuredUrl)
  } catch {
    throw new Error('ELECTRON_RENDERER_URL deve ser uma URL local valida.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol)
    || !LOOPBACK_HOSTS.has(url.hostname.toLocaleLowerCase())
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error('ELECTRON_RENDERER_URL deve usar HTTP(S) em loopback, sem credenciais, busca ou fragmento.')
  }

  return { baseUrl: url.href, kind: 'development' }
}

export function rendererUrlWithHash(location: TrustedRendererLocation, hash: string): string {
  const url = new URL(location.baseUrl)
  url.hash = hash
  return url.href
}

export function isTrustedRendererFrameUrl(
  actualValue: string,
  location: TrustedRendererLocation
): boolean {
  try {
    const actual = new URL(actualValue)
    const expected = new URL(location.baseUrl)
    return actual.protocol === expected.protocol
      && actual.username === ''
      && actual.password === ''
      && actual.search === ''
      && actual.origin === expected.origin
      && actual.host === expected.host
      && actual.pathname === expected.pathname
  } catch {
    return false
  }
}

export function safeExternalHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:'
      || !url.hostname
      || url.username
      || url.password
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

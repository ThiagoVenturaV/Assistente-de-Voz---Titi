import { isAbsolute, relative, resolve, sep } from 'node:path'

export const TITI_RENDERER_SCHEME = 'titi'
export const TITI_RENDERER_HOST = 'app'
export const TITI_RENDERER_BASE_URL = `${TITI_RENDERER_SCHEME}://${TITI_RENDERER_HOST}/index.html`

export function resolveRendererAssetPath(
  requestUrl: string,
  rendererRoot: string
): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (
    url.protocol !== `${TITI_RENDERER_SCHEME}:`
    || url.hostname !== TITI_RENDERER_HOST
    || url.username
    || url.password
    || url.port
    || url.search
  ) return null

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname).replaceAll('\\', '/')
  } catch {
    return null
  }
  if (!pathname.startsWith('/') || pathname.includes(String.fromCharCode(0))) return null

  const segments = (pathname === '/' ? '/index.html' : pathname)
    .split('/')
    .filter(Boolean)
  const candidate = resolve(rendererRoot, ...segments)
  const relativePath = relative(rendererRoot, candidate)
  if (
    !relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)
  ) return null

  return candidate
}

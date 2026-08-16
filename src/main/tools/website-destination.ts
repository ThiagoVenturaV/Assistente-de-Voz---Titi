const KNOWN_WEBSITES = new Map<string, string>([
  ['youtube', 'https://www.youtube.com/'],
  ['youtube brasil', 'https://www.youtube.com/'],
  ['google', 'https://www.google.com/'],
  ['gmail', 'https://mail.google.com/'],
  ['google maps', 'https://maps.google.com/'],
  ['maps', 'https://maps.google.com/'],
  ['github', 'https://github.com/'],
  ['chatgpt', 'https://chatgpt.com/'],
  ['chat gpt', 'https://chatgpt.com/'],
  ['openai', 'https://openai.com/'],
  ['instagram', 'https://www.instagram.com/'],
  ['facebook', 'https://www.facebook.com/'],
  ['whatsapp web', 'https://web.whatsapp.com/'],
  ['reddit', 'https://www.reddit.com/'],
  ['twitter', 'https://x.com/'],
  ['x', 'https://x.com/'],
  ['twitch', 'https://www.twitch.tv/'],
  ['netflix', 'https://www.netflix.com/'],
  ['linkedin', 'https://www.linkedin.com/'],
  ['tik tok', 'https://www.tiktok.com/'],
  ['tiktok', 'https://www.tiktok.com/'],
  ['amazon', 'https://www.amazon.com.br/'],
  ['mercado livre', 'https://www.mercadolivre.com.br/']
])

export function knownWebsiteUrl(value: string): string | null {
  return KNOWN_WEBSITES.get(normalizeWebsiteName(value)) ?? null
}

function normalizeWebsiteName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/^\s*(?:(?:o|a)\s+)?(?:site|pagina|url)(?:\s+(?:do|da))?\s+/u, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}

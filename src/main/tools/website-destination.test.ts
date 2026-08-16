import { describe, expect, it } from 'vitest'
import { knownWebsiteUrl } from './website-destination'

describe('knownWebsiteUrl', () => {
  it.each([
    ['YouTube', 'https://www.youtube.com/'],
    ['o site do GitHub', 'https://github.com/'],
    ['WhatsApp Web', 'https://web.whatsapp.com/'],
    ['Google Maps', 'https://maps.google.com/']
  ])('resolve %s sem passar por busca', (name, url) => {
    expect(knownWebsiteUrl(name)).toBe(url)
  })

  it('não inventa endereço para um nome desconhecido', () => {
    expect(knownWebsiteUrl('site inventado da firma')).toBeNull()
  })
})

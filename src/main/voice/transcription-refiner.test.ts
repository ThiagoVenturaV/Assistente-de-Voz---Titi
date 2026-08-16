import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  applyNameReplacements,
  LocalTranscriptionRefiner,
  needsContextualNameRefinement,
  recognitionGlossary,
  replaceKnownPhoneticAliases
} from './transcription-refiner'

describe('LocalTranscriptionRefiner', () => {
  it('corrige aliases fonéticos conhecidos sem chamar um modelo generativo', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Spotify'],
      fetchMock
    )

    await expect(refiner.refine('O títido para o esportes feio.'))
      .resolves.toBe('O Titi para o Spotify.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aceita do modelo somente substituição de nome por item do vocabulário', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          replacements: [{ source: 'Nebola Editor', target: 'Nebula Editor', confidence: 0.96 }]
        })
      }
    }), { status: 200 }))
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Nebula Editor'],
      fetchMock
    )

    await expect(refiner.refine('Titi, abre o Nebola Editor.'))
      .resolves.toBe('Titi, abre o Nebula Editor.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('não chama o modelo para conversa geral ou nome já reconhecido', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Spotify'],
      fetchMock
    )

    await expect(refiner.refine('Quero conversar sobre reconhecimento de voz.'))
      .resolves.toBe('Quero conversar sobre reconhecimento de voz.')
    await expect(refiner.refine('Não abra o Spotify e não dê play.'))
      .resolves.toBe('Não abra o Spotify e não dê play.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falha aberto para a transcrição bruta se o Ollama estiver indisponível', async () => {
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Nebula Editor'],
      async () => { throw new Error('offline') }
    )

    await expect(refiner.refine('Abre o Nebola Editor.')).resolves.toBe('Abre o Nebola Editor.')
  })

  it('propaga cancelamento em vez de devolver texto potencialmente obsoleto', async () => {
    const controller = new AbortController()
    controller.abort()
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => []
    )

    await expect(refiner.refine('texto', controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('transcription name guards', () => {
  const glossary = recognitionGlossary(DEFAULT_SETTINGS, ['spotify', 'Nebula Editor'])

  it('inclui nomes do produto e aplicativos sem duplicar maiúsculas diferentes', () => {
    expect(glossary).toContain('Spotify')
    expect(glossary).toContain('Nebula Editor')
    expect(glossary.filter((value) => value.toLowerCase() === 'spotify')).toHaveLength(1)
  })

  it('corrige somente aliases conhecidos presentes no vocabulário fechado', () => {
    expect(replaceKnownPhoneticAliases(
      'pod5, Google Trome e anti-dravite',
      glossary
    )).toBe('Spotify, Google Chrome e Antigravity')
    expect(replaceKnownPhoneticAliases('anti-dravite', ['Spotify'])).toBe('anti-dravite')
  })

  it('só pede contexto para comando com nome ainda desconhecido', () => {
    expect(needsContextualNameRefinement('Abre o Nebola Editor.', glossary)).toBe(true)
    expect(needsContextualNameRefinement('Abre o Spotify.', glossary)).toBe(false)
    expect(needsContextualNameRefinement('Nebola Editor é um nome estranho.', glossary)).toBe(false)
  })

  it('bloqueia alteração de verbo, negação, número e destino fora do vocabulário', () => {
    expect(applyNameReplacements(
      'Não abra o Nebola Editor versão 3.',
      glossary,
      {
        replacements: [
          { source: 'abra', target: 'Spotify', confidence: 0.99 },
          { source: 'Não', target: 'Spotify', confidence: 0.99 },
          { source: '3', target: 'Spotify', confidence: 0.99 },
          { source: 'Nebola Editor', target: 'Aplicativo Inventado', confidence: 0.99 }
        ]
      }
    )).toBe('Não abra o Nebola Editor versão 3.')
  })

  it('rejeita substituição foneticamente distante mesmo com confiança alta', () => {
    expect(applyNameReplacements(
      'Abre o editor de texto.',
      glossary,
      { replacements: [{ source: 'editor de texto', target: 'Spotify', confidence: 0.99 }] }
    )).toBe('Abre o editor de texto.')
  })

  it('aceita uma palavra única e inequívoca de um nome composto conhecido', () => {
    expect(applyNameReplacements(
      'Abre o Nebola Editor.',
      glossary,
      { replacements: [{ source: 'Nebola', target: 'Nebula', confidence: 0.95 }] }
    )).toBe('Abre o Nebula Editor.')
  })
})

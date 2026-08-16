import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  LocalTranscriptionRefiner,
  recognitionGlossary,
  shouldAcceptRefinement
} from './transcription-refiner'

describe('LocalTranscriptionRefiner', () => {
  it('corrige um nome foneticamente provável usando vocabulário local', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          text: 'Abre o Spotify e dá play.',
          confidence: 0.96
        })
      }
    }), { status: 200 }))
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Spotify'],
      fetchMock
    )

    await expect(refiner.refine('Abriu-te pod5 e da Play.'))
      .resolves.toBe('Abre o Spotify e dá play.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('mantém a fala original quando a correção é incerta', async () => {
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => ['Antigravity'],
      async () => new Response(JSON.stringify({
        message: { content: JSON.stringify({ text: 'Abra o Antigravity.', confidence: 0.4 }) }
      }), { status: 200 })
    )

    await expect(refiner.refine('Abre o anti-dravite.'))
      .resolves.toBe('Abre o anti-dravite.')
  })

  it('falha aberto para a transcrição bruta se o Ollama estiver indisponível', async () => {
    const refiner = new LocalTranscriptionRefiner(
      async () => DEFAULT_SETTINGS,
      async () => [],
      async () => { throw new Error('offline') }
    )

    await expect(refiner.refine('texto original')).resolves.toBe('texto original')
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

describe('transcription refinement guards', () => {
  it('inclui nomes do produto e aplicativos sem duplicar maiúsculas diferentes', () => {
    const glossary = recognitionGlossary(DEFAULT_SETTINGS, ['spotify', 'Nebula Editor'])

    expect(glossary).toContain('Spotify')
    expect(glossary).toContain('Nebula Editor')
    expect(glossary.filter((value) => value.toLowerCase() === 'spotify')).toHaveLength(1)
  })

  it('rejeita reescrita distante mesmo com confiança alta', () => {
    expect(shouldAcceptRefinement('bom dia', {
      text: 'Abra o navegador e compre um produto.',
      confidence: 0.99
    })).toBe(false)
  })
})

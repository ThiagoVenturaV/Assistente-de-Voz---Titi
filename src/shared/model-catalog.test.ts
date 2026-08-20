import { describe, expect, it } from 'vitest'
import { localModelDownloadLabel, SUPPORTED_LOCAL_MODELS } from './model-catalog'

describe('catálogo de modelos locais', () => {
  it('mantém o perfil rápido com o tamanho correto no onboarding', () => {
    expect(localModelDownloadLabel('qwen3:4b-instruct')).toBe('cerca de 2,5 GB')
  })

  it('mantém o perfil de qualidade separado', () => {
    expect(SUPPORTED_LOCAL_MODELS.find(({ profile }) => profile === 'quality'))
      .toMatchObject({ name: 'qwen3.5:9b', approximateDownloadGb: 6.6 })
  })

  it('não inventa tamanho para um modelo avançado desconhecido', () => {
    expect(localModelDownloadLabel('modelo-local:custom')).toBe('tamanho informado pelo Ollama')
  })
})

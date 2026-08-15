import { describe, expect, it } from 'vitest'
import { parseExplicitMemoryCommand } from './explicit-memory-command'

describe('parseExplicitMemoryCommand', () => {
  it('reconhece uma preferência inequívoca e remove o artigo do valor', () => {
    expect(parseExplicitMemoryCommand(
      'Lembre que meu navegador preferido é o Brave.'
    )).toEqual({
      kind: 'preference',
      key: 'navegador preferido',
      value: 'Brave'
    })
  })

  it('reconhece um fato pessoal após pedido explícito', () => {
    expect(parseExplicitMemoryCommand(
      'Por favor, guarde na memória que minha cidade é Fortaleza'
    )).toEqual({
      kind: 'fact',
      key: 'cidade',
      value: 'Fortaleza'
    })
  })

  it.each([
    'Meu navegador preferido é o Brave.',
    'Você lembra qual é meu navegador preferido?',
    'Talvez meu navegador preferido seja o Brave.',
    'Não lembre que meu navegador preferido é o Brave.',
    'Lembre que abrir o Brave é importante.',
    'Lembre disso para mim.',
    'Lembre que meu navegador talvez seja o Brave.'
  ])('não aprende automaticamente a frase ambígua: %s', (content) => {
    expect(parseExplicitMemoryCommand(content)).toBeNull()
  })
})

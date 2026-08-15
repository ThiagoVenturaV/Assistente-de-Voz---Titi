import { describe, expect, it } from 'vitest'
import { resolveDeterministicIntent } from './deterministic-intent'

describe('resolveDeterministicIntent', () => {
  it.each([
    ['abra o Spotify', 'spotify'],
    ['Titi, pode abrir o Brave pra mim?', 'brave'],
    ['inicie o Google Chrome', 'chrome'],
    ['quero que você abra o Codex App', 'codex'],
    ['abra o aplicativo do ChatGPT', 'codex'],
    ['por favor, execute o Antigravity', 'antigravity']
  ] as const)('roteia o comando explícito %s', (content, application) => {
    expect(resolveDeterministicIntent(content)).toEqual({
      name: 'open_application',
      arguments: { application }
    })
  })

  it('routes an explicit newly installed application through the safe catalog', () => {
    expect(resolveDeterministicIntent('abra o aplicativo Obsidian')).toEqual({
      name: 'open_application',
      arguments: { application: 'Obsidian' }
    })
  })

  it.each([
    'abra Obsidian',
    'como abrir o aplicativo Obsidian?',
    'abra o programa C:\\Windows\\System32\\cmd.exe',
    'abra o aplicativo calc.exe',
    'abra o programa powershell',
    'abra o aplicativo Obsidian --disable-security',
    'abra o aplicativo file:///C:/Windows/notepad.exe'
  ])('não roteia nome genérico sem tipo explícito, pergunta, caminho ou comando: %s', (content) => {
    expect(resolveDeterministicIntent(content)).toBeNull()
  })

  it.each([
    [
      'abra https://example.com/docs no Brave',
      { url: 'https://example.com/docs', browser: 'brave' }
    ],
    [
      'acesse o site openai.com',
      { url: 'openai.com', browser: 'default' }
    ],
    [
      'abra no Chrome www.github.com',
      { url: 'www.github.com', browser: 'chrome' }
    ]
  ])('abre um destino web inequívoco: %s', (content, argumentsValue) => {
    expect(resolveDeterministicIntent(content)).toEqual({
      name: 'open_web',
      arguments: argumentsValue
    })
  })

  it.each([
    [
      'pesquise na web por previsão do tempo em Fortaleza',
      { query: 'previsão do tempo em Fortaleza', browser: 'default' }
    ],
    [
      'procure documentação do TypeScript no Brave',
      { query: 'documentação do TypeScript', browser: 'brave' }
    ]
  ])('roteia uma pesquisa explícita: %s', (content, argumentsValue) => {
    expect(resolveDeterministicIntent(content)).toEqual({
      name: 'open_web',
      arguments: argumentsValue
    })
  })

  it.each([
    ['pause a música', { action: 'play_pause' }],
    ['próxima música', { action: 'next' }],
    ['volte a faixa', { action: 'previous' }],
    ['aumente o volume do Spotify', { action: 'volume_up' }],
    ['abaixe o som', { action: 'volume_down' }],
    ['silencie o Spotify', { action: 'mute' }],
    ['toque Elis Regina no Spotify', { action: 'search', query: 'Elis Regina' }]
  ])('roteia o controle de música %s', (content, argumentsValue) => {
    expect(resolveDeterministicIntent(content)).toEqual({
      name: 'spotify',
      arguments: argumentsValue
    })
  })

  it.each([
    'me ensina sobre Spotify',
    'como abrir o Spotify?',
    'você sabe abrir o Brave?',
    'o que é o Antigravity?',
    'eu uso o Codex todos os dias',
    'abra o Spotify e abra o Brave',
    'pesquise gatos e depois abra o Spotify',
    'abra algum navegador',
    'acesse meu site favorito',
    'abra meu projeto'
  ])('deixa pedidos informativos ou ambíguos para o modelo: %s', (content) => {
    expect(resolveDeterministicIntent(content)).toBeNull()
  })
})

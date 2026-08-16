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
    ],
    [
      'entre no YouTube pelo Brave',
      { url: 'https://www.youtube.com/', browser: 'brave' }
    ],
    [
      'abra o site do GitHub',
      { url: 'https://github.com/', browser: 'default' }
    ]
  ])('abre um destino web inequívoco: %s', (content, argumentsValue) => {
    expect(resolveDeterministicIntent(content)).toEqual({
      name: 'open_web',
      arguments: argumentsValue
    })
  })

  it.each([
    [
      'Abre o Brave e entra no YouTube.',
      { url: 'https://www.youtube.com/', browser: 'brave' }
    ],
    [
      'abra o navegador Google Chrome e acesse o GitHub',
      { url: 'https://github.com/', browser: 'chrome' }
    ],
    [
      'abre o Brave e vai para youtube.com',
      { url: 'youtube.com', browser: 'brave' }
    ]
  ])('reduz navegador mais destino a uma única navegação: %s', (content, argumentsValue) => {
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
    ['pause a música', { action: 'pause' }],
    ['dê play na música', { action: 'play' }],
    ['continue a reprodução no Spotify', { action: 'play' }],
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
    'Olhe todas as minhas telas e confirme se o YouTube está aberto em algum monitor.',
    'Veja todos os monitores e diga se o Spotify está aberto.',
    'Confira em todas as telas se o Brave está visível.'
  ])('roteia a observação explícita de todos os monitores: %s', (content) => {
    const result = resolveDeterministicIntent(content)
    expect(result?.name).toBe('computer_look')
    expect(result?.arguments).toHaveProperty('goal')
  })

  it.each([
    'olhe a tela',
    'confira se o YouTube está aberto',
    'olhe todos os monitores e abra o Spotify'
  ])('não promove observação ambígua ou com ação: %s', (content) => {
    expect(resolveDeterministicIntent(content)).toBeNull()
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

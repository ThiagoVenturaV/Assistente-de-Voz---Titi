#!/usr/bin/env node

const options = readOptions(process.argv.slice(2))
const endpoint = normalizeEndpoint(
  options.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://127.0.0.1:11434'
)
const model = options.model ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:9b'
const NO_TOOL_NEEDED_PREFIX = '[SEM_FERRAMENTA]'
const actionCases = [
  {
    prompt: 'Abra o Spotify.',
    plans: [
      [{ name: 'spotify', arguments: { action: 'open' } }],
      [{ name: 'open_application', arguments: { application: 'spotify' } }]
    ]
  },
  {
    prompt: 'Abre o Brave para mim, por favor.',
    plans: [[{ name: 'open_application', arguments: { application: 'brave' } }]]
  },
  {
    prompt: 'Abra o aplicativo Calculadora.',
    plans: [
      [{ name: 'open_application', arguments: { application: 'Calculadora' } }],
      [{ name: 'open_application', arguments: { application: 'calculadora' } }]
    ]
  },
  {
    prompt: 'Titi, o Spotify não está rodando; abre ele e dá play na minha playlist.',
    plans: [[{ name: 'spotify', arguments: { action: 'play' } }]]
  },
  {
    prompt: 'Abre o Spotify e dá play.',
    plans: [[{ name: 'spotify', arguments: { action: 'play' } }]]
  },
  {
    prompt: 'Não quero explicação: coloca uma música para tocar no app de música.',
    plans: [[{ name: 'spotify', arguments: { action: 'play' } }]]
  },
  {
    prompt: 'Pausa essa música aí um instante.',
    plans: [[{ name: 'spotify', arguments: { action: 'pause' } }]]
  },
  {
    prompt: 'Procura documentação do TypeScript no Brave.',
    plans: [[{ name: 'open_web', arguments: { browser: 'brave' } }]]
  },
  {
    prompt: 'Abra https://openai.com no Chrome.',
    plans: [[{ name: 'open_web', arguments: { url: 'https://openai.com', browser: 'chrome' } }]]
  },
  {
    prompt: 'Procura a playlist This Is Daft Punk no Spotify.',
    plans: [[{ name: 'spotify', arguments: { action: 'search' } }]]
  },
  {
    prompt: 'Dá uma olhada que horas são agora.',
    plans: [[{ name: 'current_datetime', arguments: {} }]]
  },
  {
    prompt: 'Quais controles estão visíveis no Spotify que já está aberto?',
    plans: [[{ name: 'computer_observe', arguments: { application: 'spotify' } }]]
  },
  {
    prompt: 'Quero trabalhar no meu agente de código; abre o Antigravity.',
    plans: [[{ name: 'open_application', arguments: { application: 'antigravity' } }]]
  }
]
const conversationCases = [
  'Me explica o que é o Spotify.',
  'Qual a diferença entre Brave e Chrome?'
]
const contextualCases = [
  {
    label: 'mantém o assunto e aplica a escolha de navegador no turno seguinte',
    messages: [
      { role: 'user', content: 'Quero consultar a documentação do TypeScript.' },
      { role: 'assistant', content: 'Posso pesquisar a documentação para você.' },
      { role: 'user', content: 'Então pesquisa isso no Brave.' }
    ],
    plans: [[{ name: 'open_web', arguments: { browser: 'brave' } }]]
  },
  {
    label: 'entende uma correção natural sem repetir a ação anterior',
    messages: [
      { role: 'user', content: 'Abra o Chrome.' },
      { role: 'assistant', content: 'Chrome aberto.' },
      { role: 'user', content: 'Na verdade, abre o Brave.' }
    ],
    plans: [[{ name: 'open_application', arguments: { application: 'brave' } }]]
  },
  {
    label: 'resolve uma referência curta ao estado de reprodução',
    messages: [
      { role: 'user', content: 'Coloca uma música para tocar no Spotify.' },
      { role: 'assistant', content: 'A música começou a tocar no Spotify.' },
      { role: 'user', content: 'Agora pausa ela um instante.' }
    ],
    plans: [[{ name: 'spotify', arguments: { action: 'pause' } }]]
  }
]

const tools = [
  {
    type: 'function',
    function: {
      name: 'open_application',
      description: 'Descobre e abre pelo nome um aplicativo instalado no Windows. Para abrir ou controlar o Spotify use a ferramenta spotify.',
      parameters: {
        type: 'object',
        required: ['application'],
        properties: {
          application: {
            type: 'string',
            description: 'Nome comum do aplicativo, sem caminho, executável, argumentos ou comando.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_web',
      description: 'Abre um endereço ou pesquisa na web usando url ou query.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          query: { type: 'string' },
          browser: { type: 'string', enum: ['default', 'chrome', 'brave'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'spotify',
      description: 'Abre o Spotify quando necessário, pesquisa músicas, artistas ou playlists e controla a reprodução.',
      parameters: {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: [
              'open',
              'search',
              'play',
              'pause',
              'play_pause',
              'next',
              'previous',
              'volume_up',
              'volume_down',
              'mute'
            ],
            description: 'Use open somente para abrir sem reproduzir. Use play quando o pedido disser tocar, reproduzir ou dar play; play já abre o Spotify quando necessário. Use search somente com query.'
          },
          query: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'computer_observe',
      description: 'Observa somente os controles visíveis e acessíveis de um aplicativo aberto no Windows. Use antes de computer_action.',
      parameters: {
        type: 'object',
        required: ['application'],
        properties: {
          application: { type: 'string', description: 'Nome comum do aplicativo aberto.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'computer_action',
      description: 'Aciona por acessibilidade um controle visível que foi observado no aplicativo Windows.',
      parameters: {
        type: 'object',
        required: ['action', 'application', 'target'],
        properties: {
          action: { type: 'string', enum: ['click'] },
          application: { type: 'string' },
          target: { type: 'string' },
          controlType: {
            type: 'string',
            enum: ['Button', 'CheckBox', 'Hyperlink', 'ListItem', 'MenuItem', 'RadioButton', 'TabItem']
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'current_datetime',
      description: 'Obtém a data e a hora atuais deste computador.',
      parameters: { type: 'object', properties: {} }
    }
  }
]

console.log(`QA de tool calling — ${model} em ${endpoint}`)
console.log('Nenhuma ferramenta será executada; apenas a resposta JSON do modelo será validada.\n')

let failures = 0
for (const testCase of actionCases) {
  const { prompt, plans } = testCase
  try {
    const response = await askModel(prompt)
    let calls = toolCallsFromNative(response)
    let mode = 'auto'
    if (!matchesAnyPlan(calls, plans)) {
      const recovered = await askModelWithRequiredTools(prompt)
      calls = toolCallsFromOpenAI(recovered)
      mode = 'recuperação obrigatória'
    }

    if (!matchesAnyPlan(calls, plans)) {
      failures += 1
      console.error(`FALHOU  ${prompt}`)
      console.error(`  Esperado: ${JSON.stringify(plans)}`)
      console.error(`  Recebido: ${JSON.stringify(calls)}`)
    } else {
      console.log(`OK      ${prompt} → ${summarizeCalls(calls)} [${mode}]`)
    }
  } catch (error) {
    failures += 1
    console.error(`ERRO    ${prompt}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const prompt of conversationCases) {
  try {
    const response = await askModel(prompt)
    const calls = toolCallsFromNative(response)
    const content = response?.message?.content?.trim() ?? ''
    const followsNoToolProtocol = !calls.length && content.startsWith(NO_TOOL_NEEDED_PREFIX)
    const decision = followsNoToolProtocol ? null : await classifyToolNeed(prompt)
    const handledAsConversation = followsNoToolProtocol
      || (decision?.decision === 'respond' && Number(decision.confidence) >= 0.55)
    if (!handledAsConversation) {
      failures += 1
      console.error(`FALHOU  ${prompt}`)
      console.error(`  Esperado: conversa sem efeito, diretamente ou após classificação semântica`)
      console.error(`  Recebido: chamadas=${JSON.stringify(calls)}, conteúdo=${JSON.stringify(content)}, classificação=${JSON.stringify(decision)}`)
    } else {
      const mode = followsNoToolProtocol ? 'protocolo direto' : 'bloqueio semântico'
      console.log(`OK      ${prompt} → conversa sem ferramenta [${mode}]`)
    }
  } catch (error) {
    failures += 1
    console.error(`ERRO    ${prompt}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const testCase of contextualCases) {
  const { label, messages, plans } = testCase
  const prompt = messages.at(-1)?.content ?? ''
  try {
    let response = await askModelMessages(messages)
    let calls = toolCallsFromNative(response)
    let mode = 'auto contextual'
    if (!matchesAnyPlan(calls, plans)) {
      response = await askModelWithRequiredToolsMessages(messages)
      calls = toolCallsFromOpenAI(response)
      mode = 'recuperação contextual obrigatória'
    }

    if (!matchesAnyPlan(calls, plans)) {
      failures += 1
      console.error(`FALHOU  ${label}`)
      console.error(`  Esperado: ${JSON.stringify(plans)}`)
      console.error(`  Recebido: ${JSON.stringify(calls)}`)
    } else {
      console.log(`OK      ${label} → ${summarizeCalls(calls)} [${mode}]`)
    }
  } catch (error) {
    failures += 1
    console.error(`ERRO    ${label}`)
    console.error(`  Pedido atual: ${prompt}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

try {
  const workflow = await validateObserveThenActWorkflow()
  console.log(`OK      observa e age usando o controle retornado → ${workflow} [fluxo em duas rodadas]`)
} catch (error) {
  failures += 1
  console.error('FALHOU  observa e age usando o controle retornado')
  console.error(`  ${error instanceof Error ? error.message : String(error)}`)
}

const totalChecks = actionCases.length + conversationCases.length + contextualCases.length + 1
if (failures) {
  console.error(`\n${failures} de ${totalChecks} verificações falharam.`)
  process.exitCode = 1
} else {
  console.log(`\n${totalChecks} de ${totalChecks} verificações passaram.`)
}

async function askModel(prompt) {
  return askModelMessages([{ role: 'user', content: prompt }])
}

async function askModelMessages(messages) {
  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: '5m',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente local do Windows. Interprete linguagem natural, correções, referências e pedidos compostos. Quando o usuário pedir uma ação ou observação no computador, chame uma ou mais ferramentas reais e nunca apenas prometa. Para o Spotify, action=open apenas abre sem reproduzir; se o pedido disser tocar, reproduzir ou dar play, use action=play, que já abre o aplicativo. Nunca combine spotify com open_application para o mesmo pedido. Para apenas abrir um navegador sem página nem busca, use open_application; open_web exige url ou query. Para operar uma interface sem ferramenta específica, use computer_observe primeiro e computer_action somente com um nome de controle exato que foi observado. Somente quando nenhuma ferramenta for necessária, comece a resposta exatamente com ${NO_TOOL_NEEDED_PREFIX}.`
        },
        ...messages
      ],
      tools,
      options: { temperature: 0, num_ctx: 4096 }
    }),
    signal: AbortSignal.timeout(120_000)
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.error ? `: ${payload.error}` : ''
    throw new Error(`Ollama respondeu com HTTP ${response.status}${detail}`)
  }
  if (payload?.error) throw new Error(payload.error)
  return payload
}

async function askModelWithRequiredTools(prompt) {
  return askModelWithRequiredToolsMessages([{ role: 'user', content: prompt }])
}

async function askModelWithRequiredToolsMessages(messages) {
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'Interprete o pedido pela linguagem natural e pelo contexto anterior e chame todas as ferramentas necessárias. Não narre nem prometa; uma ou mais chamadas são obrigatórias. No Spotify, action=open apenas abre sem reproduzir; se o pedido disser tocar, reproduzir ou dar Play, use action=play, que já abre o aplicativo. Nunca combine spotify com open_application para o mesmo pedido. Para apenas abrir um navegador sem página nem busca, use open_application; open_web exige url ou query. Para operar uma interface sem ferramenta específica, use computer_observe antes de computer_action.'
        },
        ...messages
      ],
      tools,
      tool_choice: 'required',
      temperature: 0
    }),
    signal: AbortSignal.timeout(120_000)
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.error?.message ?? payload?.error
    throw new Error(`Ollama compatível respondeu com HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return payload
}

async function validateObserveThenActWorkflow() {
  const messages = [{
    role: 'user',
    content: 'No Spotify que já está aberto, observe os controles e clique no botão Sua Biblioteca.'
  }]
  let response = await askModelMessages(messages)
  let calls = toolCallsFromNative(response)
  if (!calls.some((call) => call?.function?.name === 'computer_observe')) {
    response = await askModelWithRequiredToolsMessages(messages)
    calls = toolCallsFromOpenAI(response)
  }

  const observeIndex = calls.findIndex((call) => call?.function?.name === 'computer_observe')
  if (observeIndex < 0) {
    throw new Error(`computer_observe não foi chamado: ${JSON.stringify(calls)}`)
  }
  const actionInFirstRound = calls.findIndex((call) => {
    if (call?.function?.name !== 'computer_action') return false
    const args = parseArguments(call.function.arguments)
    return args?.action === 'click'
      && fold(args.application) === 'spotify'
      && fold(args.target) === 'sua biblioteca'
  })
  if (actionInFirstRound > observeIndex) return summarizeCalls(calls)

  const observeCall = calls[observeIndex]
  messages.push({
    role: 'assistant',
    content: '',
    tool_calls: [observeCall]
  })
  messages.push({
    role: 'tool',
    tool_name: 'computer_observe',
    content: JSON.stringify({
      ok: true,
      status: 'confirmed',
      message: 'Controles visíveis observados no Spotify.',
      details: {
        windowTitle: 'Spotify Premium',
        controls: [
          { name: 'Sua Biblioteca', controlType: 'Button', enabled: true },
          { name: 'Play', controlType: 'Button', enabled: true }
        ]
      }
    })
  })

  response = await askModelMessages(messages)
  calls = toolCallsFromNative(response)
  if (!calls.some(isExpectedLibraryClick)) {
    response = await askModelWithRequiredToolsMessages(messages)
    calls = toolCallsFromOpenAI(response)
  }
  if (!calls.some(isExpectedLibraryClick)) {
    throw new Error(`computer_action não usou o controle observado: ${JSON.stringify(calls)}`)
  }
  return `computer_observe({"application":"spotify"}) → ${summarizeCalls(calls)}`
}

function isExpectedLibraryClick(call) {
  if (call?.function?.name !== 'computer_action') return false
  const args = parseArguments(call.function.arguments)
  return args?.action === 'click'
    && fold(args.application) === 'spotify'
    && fold(args.target) === 'sua biblioteca'
}

function fold(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    : ''
}

async function classifyToolNeed(prompt) {
  const format = {
    type: 'object',
    additionalProperties: false,
    required: ['decision', 'confidence', 'reason'],
    properties: {
      decision: { type: 'string', enum: ['needs_tool', 'respond'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reason: { type: 'string' }
    }
  }
  const capabilities = tools.map(({ function: definition }) => ({
    name: definition.name,
    description: definition.description
  }))
  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: '5m',
      format,
      options: { temperature: 0, num_ctx: 4096 },
      messages: [
        {
          role: 'system',
          content: `Classifique somente o pedido direto. Use needs_tool quando o usuário quer executar, alterar, abrir, controlar, observar ou consultar o estado atual do computador com uma capacidade disponível. Use respond para conversa, explicação, opinião ou pergunta conceitual. Linguagem informal e pedidos compostos continuam sendo needs_tool. Responda apenas conforme este JSON Schema: ${JSON.stringify(format)}`
        },
        {
          role: 'user',
          content: `Capacidades: ${JSON.stringify(capabilities)}\nPedido: ${JSON.stringify(prompt)}`
        }
      ]
    }),
    signal: AbortSignal.timeout(120_000)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? `Classificador respondeu com HTTP ${response.status}`)
  }
  return JSON.parse(payload?.message?.content ?? '{}')
}

function toolCallsFromNative(response) {
  return Array.isArray(response?.message?.tool_calls) ? response.message.tool_calls : []
}

function toolCallsFromOpenAI(response) {
  const calls = response?.choices?.[0]?.message?.tool_calls
  return Array.isArray(calls) ? calls : []
}

function matchesAnyPlan(calls, plans) {
  return plans.some((plan) => plan.every((expected) => calls.some((call) => {
    if (call?.function?.name !== expected.name) return false
    const actual = parseArguments(call.function.arguments)
    return actual && Object.entries(expected.arguments).every(([key, value]) => (
      equivalentArgument(key, actual[key], value)
    ))
  })))
}

function equivalentArgument(key, actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return actual === expected
  if (key === 'url') {
    return actual.replace(/\/$/u, '') === expected.replace(/\/$/u, '')
  }
  return fold(actual) === fold(expected)
}

function summarizeCalls(calls) {
  return calls.map((call) => `${call?.function?.name}(${JSON.stringify(parseArguments(call?.function?.arguments) ?? {})})`).join(' → ')
}

function parseArguments(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readOptions(args) {
  const result = {}
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--') {
      continue
    } else if (argument === '--endpoint' || argument === '--model') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`Informe um valor depois de ${argument}.`)
      }
      result[argument.slice(2)] = value
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      console.log([
        'Uso: pnpm qa:ollama-tools -- [--endpoint URL] [--model NOME]',
        '',
        'Variáveis equivalentes: OLLAMA_ENDPOINT e OLLAMA_MODEL.',
        'Este QA nunca executa as ferramentas retornadas pelo modelo.'
      ].join('\n'))
      process.exit(0)
    } else {
      throw new Error(`Opção desconhecida: ${argument}`)
    }
  }
  return result
}

function normalizeEndpoint(value) {
  const parsed = new URL(value.trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('O endpoint precisa usar HTTP ou HTTPS.')
  }
  parsed.username = ''
  parsed.password = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

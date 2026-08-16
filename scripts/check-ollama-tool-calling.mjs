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
    prompt: 'Titi, o Spotify não está rodando; abre ele e dá play na minha playlist.',
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
    prompt: 'Dá uma olhada que horas são agora.',
    plans: [[{ name: 'current_datetime', arguments: {} }]]
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

const tools = [
  {
    type: 'function',
    function: {
      name: 'open_application',
      description: 'Abre um aplicativo conhecido no Windows. Use para Chrome, Brave, Codex ou Antigravity; para abrir ou controlar o Spotify use a ferramenta spotify.',
      parameters: {
        type: 'object',
        required: ['application'],
        properties: {
          application: {
            type: 'string',
            enum: ['chrome', 'brave', 'spotify', 'codex', 'antigravity'],
            description: 'Aplicativo que será aberto.'
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
            ]
          },
          query: { type: 'string' }
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
    const canClassifySafely = (calls.length > 0 && Boolean(content)) || calls.length === 0
    const decision = followsNoToolProtocol || !canClassifySafely
      ? null
      : await classifyToolNeed(prompt)
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

if (failures) {
  console.error(`\n${failures} de ${actionCases.length + conversationCases.length} verificações falharam.`)
  process.exitCode = 1
} else {
  console.log(`\n${actionCases.length + conversationCases.length} de ${actionCases.length + conversationCases.length} verificações passaram.`)
}

async function askModel(prompt) {
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
          content: `Você é um assistente local do Windows. Interprete linguagem natural, correções, referências e pedidos compostos. Quando o usuário pedir uma ação ou observação no computador, chame uma ou mais ferramentas reais e nunca apenas prometa. Para abrir ou controlar o Spotify, use diretamente spotify; action=play já abre o aplicativo, então não combine com open_application. Somente quando nenhuma ferramenta for necessária, comece a resposta exatamente com ${NO_TOOL_NEEDED_PREFIX}.`
        },
        { role: 'user', content: prompt }
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
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'Interprete o pedido pela linguagem natural e chame todas as ferramentas necessárias. Não narre nem prometa; uma ou mais chamadas são obrigatórias. Para abrir e dar Play no Spotify, chame somente spotify com action=play, pois ela já abre o aplicativo.'
        },
        { role: 'user', content: prompt }
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
    return actual && Object.entries(expected.arguments).every(([key, value]) => actual[key] === value)
  })))
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

#!/usr/bin/env node

const options = readOptions(process.argv.slice(2))
const endpoint = normalizeEndpoint(
  options.endpoint ?? process.env.OLLAMA_ENDPOINT ?? 'http://127.0.0.1:11434'
)
const model = options.model ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:9b'
const cases = [
  ['Abra o Spotify.', 'spotify'],
  ['Abra o Brave.', 'brave'],
  ['Abra o Codex.', 'codex'],
  ['Abra o Antigravity.', 'antigravity']
]

const tools = [
  {
    type: 'function',
    function: {
      name: 'open_application',
      description: 'Abre um aplicativo conhecido no Windows. Use sempre que o usuário pedir para abrir Chrome, Brave, Spotify, Codex ou Antigravity.',
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
      description: 'Pesquisa e controla uma reprodução já aberta. Para abrir o aplicativo, use open_application.',
      parameters: {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: [
              'search',
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
for (const [prompt, expectedApplication] of cases) {
  try {
    const response = await askModel(prompt)
    const calls = Array.isArray(response?.message?.tool_calls)
      ? response.message.tool_calls
      : []
    const matchingCall = calls.find((call) => {
      const name = call?.function?.name
      const argumentsValue = parseArguments(call?.function?.arguments)
      return name === 'open_application'
        && argumentsValue?.application === expectedApplication
    })

    if (!matchingCall) {
      failures += 1
      console.error(`FALHOU  ${prompt}`)
      console.error(`  Esperado: open_application({ application: "${expectedApplication}" })`)
      console.error(`  Recebido: ${JSON.stringify(calls)}`)
    } else {
      console.log(`OK      ${prompt} → open_application(${expectedApplication})`)
    }
  } catch (error) {
    failures += 1
    console.error(`ERRO    ${prompt}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures) {
  console.error(`\n${failures} de ${cases.length} verificações falharam.`)
  process.exitCode = 1
} else {
  console.log(`\n${cases.length} de ${cases.length} verificações passaram.`)
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
          content: 'Você é um assistente do Windows. Quando o usuário pedir para abrir qualquer aplicativo, use sempre open_application. Reserve spotify para pesquisa e controles de uma reprodução já aberta. Responda chamando exatamente uma das ferramentas fornecidas.'
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

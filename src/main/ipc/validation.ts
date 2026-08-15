import type { ChatRequest, MascotState, TitiSettings } from '../../shared/contracts'
import { isSafePushToTalkShortcut } from '../voice/global-push-to-talk'

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MODEL_PATTERN = /^[\p{L}\p{N}._/:@+\-]{1,120}$/u
const MASCOT_STATES = new Set<MascotState>([
  'idle', 'listening', 'thinking', 'speaking', 'success', 'error', 'standby', 'review'
])

export function validatedConversationId(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error('Identificador de conversa inválido.')
  }
  return value
}

export function validatedChatRequest(value: unknown): ChatRequest {
  if (!isRecord(value)) throw new Error('Pedido de conversa inválido.')
  const content = typeof value.content === 'string' ? value.content.trim() : ''
  if (!content || content.length > 50_000) {
    throw new Error('A mensagem precisa ter entre 1 e 50.000 caracteres.')
  }
  return {
    content,
    ...(value.requestId === undefined
      ? {}
      : { requestId: validatedRequestId(value.requestId) }),
    ...(value.conversationId === undefined
      ? {}
      : { conversationId: validatedConversationId(value.conversationId) })
  }
}

export function validatedRequestId(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error('Identificador de pedido inválido.')
  }
  return value
}

export function validatedSettingsPatch(value: unknown): Partial<TitiSettings> {
  if (!isRecord(value)) throw new Error('Configurações inválidas.')
  rejectUnknownKeys(value, [
    'version', 'onboardingComplete', 'mascotName', 'launchAtStartup',
    'showFloatingMascot', 'keepHistory', 'confirmSensitiveActions', 'provider', 'voice'
  ])
  const result: Partial<TitiSettings> = {}
  if ('version' in value) {
    if (value.version !== 1) throw new Error('Versão de configuração inválida.')
    result.version = 1
  }
  for (const key of [
    'onboardingComplete', 'launchAtStartup', 'showFloatingMascot',
    'keepHistory', 'confirmSensitiveActions'
  ] as const) {
    if (key in value) {
      if (typeof value[key] !== 'boolean') throw new Error(`Valor inválido para ${key}.`)
      result[key] = value[key]
    }
  }
  if ('mascotName' in value) {
    const mascotName = cleanText(value.mascotName, 40)
    if (!mascotName) throw new Error('O nome do mascote é inválido.')
    result.mascotName = mascotName
  }
  if ('provider' in value) result.provider = validatedProvider(value.provider)
  if ('voice' in value) result.voice = validatedVoice(value.voice)
  return result
}

export function validatedBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Valor inválido para ${field}.`)
  return value
}

export function validatedMascotState(value: unknown): MascotState {
  if (typeof value !== 'string' || !MASCOT_STATES.has(value as MascotState)) {
    throw new Error('Estado do mascote inválido.')
  }
  return value as MascotState
}

export function validatedWavAudio(value: unknown): ArrayBuffer {
  if (!(value instanceof ArrayBuffer) || value.byteLength < 44 || value.byteLength > 64 * 1024 * 1024) {
    throw new Error('Áudio inválido ou maior que 64 MB.')
  }
  return value
}

function validatedProvider(value: unknown): TitiSettings['provider'] {
  if (!isRecord(value)) throw new Error('Provedor inválido.')
  rejectUnknownKeys(value, ['kind', 'endpoint', 'model'])
  if (value.kind !== 'ollama') throw new Error('Somente o provedor local está disponível nesta versão.')
  if (typeof value.endpoint !== 'string') throw new Error('Endereço local inválido.')
  let endpoint: URL
  try {
    endpoint = new URL(value.endpoint.trim())
  } catch {
    throw new Error('Endereço local inválido.')
  }
  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
  if (!['http:', 'https:'].includes(endpoint.protocol) || !localHosts.has(endpoint.hostname.toLocaleLowerCase())) {
    throw new Error('Nesta versão, o modelo deve usar um endereço local deste computador.')
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('O endereço local não pode conter credenciais ou parâmetros.')
  }
  if (typeof value.model !== 'string' || !MODEL_PATTERN.test(value.model.trim())) {
    throw new Error('Nome de modelo inválido.')
  }
  return { kind: 'ollama', endpoint: endpoint.toString().replace(/\/$/, ''), model: value.model.trim() }
}

function validatedVoice(value: unknown): TitiSettings['voice'] {
  if (!isRecord(value)) throw new Error('Configurações de voz inválidas.')
  rejectUnknownKeys(value, ['enabled', 'pushToTalkShortcut', 'liveMode', 'speechRate', 'inputDeviceId'])
  if (typeof value.enabled !== 'boolean' || typeof value.liveMode !== 'boolean') {
    throw new Error('Estado da voz inválido.')
  }
  if (typeof value.pushToTalkShortcut !== 'string' || !isSafePushToTalkShortcut(value.pushToTalkShortcut)) {
    throw new Error('Atalho de voz inválido.')
  }
  if (typeof value.speechRate !== 'number' || !Number.isFinite(value.speechRate)
    || value.speechRate < 0.7 || value.speechRate > 1.4) {
    throw new Error('Velocidade da fala inválida.')
  }
  if (
    typeof value.inputDeviceId !== 'string'
    || value.inputDeviceId.length > 512
    || /[\u0000-\u001f\u007f]/.test(value.inputDeviceId)
  ) {
    throw new Error('Dispositivo de entrada inválido.')
  }
  return {
    enabled: value.enabled,
    liveMode: value.liveMode,
    pushToTalkShortcut: value.pushToTalkShortcut.trim(),
    speechRate: value.speechRate,
    inputDeviceId: value.inputDeviceId
  }
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[]): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key))
  if (unexpected) throw new Error(`Campo de configuração desconhecido: ${unexpected}.`)
}

function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
    : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

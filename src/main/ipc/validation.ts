import type {
  ChatRequest,
  GameStandbyDecision,
  GameStandbyDecisionResponse,
  MascotState,
  TitiSettings
} from '../../shared/contracts'
import { isSafePushToTalkShortcut } from '../voice/global-push-to-talk'

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MODEL_PATTERN = /^[\p{L}\p{N}._/:@+\-]{1,120}$/u
const MASCOT_STATES = new Set<MascotState>([
  'idle', 'listening', 'thinking', 'speaking', 'success', 'error', 'standby', 'review'
])
const GAME_STANDBY_DECISIONS = new Set<GameStandbyDecision>(['complete', 'cancel', 'defer'])

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
    'showFloatingMascot', 'computerControlEnabled', 'keepHistory', 'provider', 'voice', 'games'
  ])
  const result: Partial<TitiSettings> = {}
  if ('version' in value) {
    if (value.version !== 1) throw new Error('Versão de configuração inválida.')
    result.version = 1
  }
  for (const key of [
    'onboardingComplete', 'launchAtStartup', 'showFloatingMascot',
    'computerControlEnabled', 'keepHistory'
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
  if ('games' in value) result.games = validatedGames(value.games)
  return result
}

export function validatedBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Valor inválido para ${field}.`)
  return value
}

export function validatedGameStandbyDecisionResponse(
  value: unknown
): GameStandbyDecisionResponse {
  if (!isRecord(value)) throw new Error('Decisão do modo standby inválida.')
  if (typeof value.requestId !== 'string' || !ID_PATTERN.test(value.requestId)) {
    throw new Error('Decisão do modo standby inválida.')
  }
  const decision = value.decision as GameStandbyDecision
  if (!GAME_STANDBY_DECISIONS.has(decision)) {
    throw new Error('Decisão do modo standby inválida.')
  }
  return { requestId: value.requestId, decision }
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

export function validatedPcmAudio(value: unknown): ArrayBuffer {
  if (
    !(value instanceof ArrayBuffer)
    || value.byteLength === 0
    || value.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0
    || value.byteLength > 16_000 * Float32Array.BYTES_PER_ELEMENT * 15
  ) {
    throw new Error('Bloco PCM inválido ou maior que 15 segundos.')
  }
  const samples = new Float32Array(value)
  for (const sample of samples) {
    if (!Number.isFinite(sample) || sample < -1 || sample > 1) {
      throw new Error('Bloco PCM contém amostras inválidas.')
    }
  }
  return value
}

export interface ValidatedVoiceSynthesisRequest {
  requestId: string
  text: string
  rate: number
}

export function validatedVoiceSynthesisRequest(
  requestIdValue: unknown,
  textValue: unknown,
  rateValue: unknown
): ValidatedVoiceSynthesisRequest {
  const requestId = validatedRequestId(requestIdValue)
  if (typeof textValue !== 'string' || textValue.length === 0 || textValue.length > 12_000) {
    throw new Error('Texto de síntese inválido ou maior que 12.000 caracteres.')
  }
  if (
    typeof rateValue !== 'number'
    || !Number.isFinite(rateValue)
    || rateValue < 0.7
    || rateValue > 1.4
  ) {
    throw new Error('Velocidade de síntese inválida.')
  }
  return { requestId, text: textValue, rate: rateValue }
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

function validatedGames(value: unknown): TitiSettings['games'] {
  if (!isRecord(value)) throw new Error('Configurações do modo jogo inválidas.')
  rejectUnknownKeys(value, ['standbyEnabled', 'executables'])
  if (typeof value.standbyEnabled !== 'boolean' || !Array.isArray(value.executables)) {
    throw new Error('Configurações do modo jogo inválidas.')
  }
  if (value.executables.length > 100) {
    throw new Error('A lista do modo jogo pode ter no máximo 100 executáveis.')
  }
  const executables = value.executables.map((item) => {
    if (typeof item !== 'string') throw new Error('Nome de executável de jogo inválido.')
    const executable = item.trim()
    if (
      !/^[\p{L}\p{N}][\p{L}\p{N}._ -]{0,79}$/u.test(executable)
      || executable.includes('..')
    ) {
      throw new Error('Use somente o nome do executável do jogo, sem caminho ou comando.')
    }
    return executable
  })
  return {
    standbyEnabled: value.standbyEnabled,
    executables: [...new Map(executables.map((item) => [item.toLocaleLowerCase(), item])).values()]
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

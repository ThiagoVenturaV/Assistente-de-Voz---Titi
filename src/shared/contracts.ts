export type MascotState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'standby'
  | 'review'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  preview: string
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[]
}

export type ProviderKind = 'ollama'

export interface TitiSettings {
  version: 1
  onboardingComplete: boolean
  mascotName: string
  launchAtStartup: boolean
  showFloatingMascot: boolean
  computerControlEnabled: boolean
  keepHistory: boolean
  confirmSensitiveActions: boolean
  provider: {
    kind: ProviderKind
    endpoint: string
    model: string
  }
  voice: {
    enabled: boolean
    pushToTalkShortcut: string
    liveMode: boolean
    speechRate: number
    inputDeviceId: string
  }
  games: {
    standbyEnabled: boolean
    executables: string[]
  }
}

export interface RuntimeStatus {
  provider: ProviderKind
  connected: boolean
  model: string
  availableModels: string[]
  message: string
  checkedAt: string
  engineInstalled?: boolean
  modelInstalled?: boolean
  setupAction?: 'install-engine' | 'start-engine' | 'download-model' | 'ready'
}

export interface RuntimeSetupProgress {
  stage: 'checking' | 'downloading-engine' | 'installing-engine' | 'starting-engine' | 'downloading-model' | 'ready' | 'cancelled' | 'error'
  message: string
  percent?: number
}

export interface ChatRequest {
  requestId?: string
  conversationId?: string
  content: string
}

export interface ChatResponse {
  conversation: Conversation
  assistantMessage: ChatMessage
  runtime: RuntimeStatus
}

export interface VoiceTranscription {
  text: string
  processingTimeMs: number
}

export interface VoicePartialTranscription extends VoiceTranscription {
  sessionId: string
  audioTimeMs: number
}

export interface VoiceSynthesis {
  wavAudio: ArrayBuffer
  processingTimeMs: number
  audioDurationMs: number
}

export interface ToolActionLogEntry {
  id: string
  tool: string
  status?: 'confirmed' | 'dispatched' | 'failed' | 'cancelled' | 'timed_out'
  chainId?: string
  runId?: string
  requestId?: string
  round?: number
  attempt?: number
  arguments: unknown
  ok: boolean
  message: string
  details?: unknown
  durationMs: number
  createdAt: string
}

export type CuratedMemoryKind = 'fact' | 'preference' | 'recipe'

export interface CuratedMemorySummary {
  id: string
  kind: CuratedMemoryKind
  title: string
  value: string
  source: string
  updatedAt: string
}

export type ToolConfirmationRisk = 'sensitive'

export interface ToolConfirmationRequest {
  id: string
  tool: string
  risk: ToolConfirmationRisk
  title: string
  description: string
  consequences: string[]
  expiresAt: string
}

export interface ToolConfirmationResponse {
  requestId: string
  approved: boolean
}

export interface TitiDesktopApi {
  settings: {
    get(): Promise<TitiSettings>
    update(patch: Partial<TitiSettings>): Promise<TitiSettings>
  }
  conversations: {
    list(): Promise<ConversationSummary[]>
    get(id: string): Promise<Conversation | null>
    create(): Promise<Conversation>
    remove(id: string): Promise<void>
    clear(): Promise<number>
    export(): Promise<string | null>
    send(request: ChatRequest): Promise<ChatResponse>
  }
  interaction: {
    stop(requestId?: string): Promise<boolean>
  }
  runtime: {
    status(): Promise<RuntimeStatus>
    prepare(): Promise<RuntimeStatus>
    cancel(): Promise<boolean>
    onSetupProgress(callback: (progress: RuntimeSetupProgress) => void): () => void
  }
  activity: {
    list(): Promise<ToolActionLogEntry[]>
    clear(): Promise<void>
  }
  memory: {
    list(): Promise<CuratedMemorySummary[]>
    remove(id: string): Promise<boolean>
    clear(): Promise<number>
  }
  tools: {
    respondToConfirmation(response: ToolConfirmationResponse): Promise<boolean>
    onConfirmationRequested(callback: (request: ToolConfirmationRequest) => void): () => void
    onConfirmationDismissed(callback: (requestId: string) => void): () => void
  }
  game: {
    isStandby(): Promise<boolean>
    onStandbyChanged(callback: (enabled: boolean) => void): () => void
  }
  voice: {
    transcribe(wavAudio: ArrayBuffer): Promise<VoiceTranscription>
    startStream(sessionId: string): Promise<void>
    pushStreamChunk(sessionId: string, pcmAudio: ArrayBuffer): Promise<void>
    finishStream(sessionId: string): Promise<VoiceTranscription>
    cancelStream(sessionId: string): Promise<void>
    onPartialTranscription(callback: (partial: VoicePartialTranscription) => void): () => void
    synthesize(requestId: string, text: string, rate: number): Promise<VoiceSynthesis>
    cancelSynthesis(requestId: string): Promise<void>
    setLiveMode(enabled: boolean): Promise<TitiSettings>
    onLiveModeChanged(callback: (enabled: boolean) => void): () => void
    onPushToTalkRequested(callback: () => void): () => void
  }
  mascot: {
    setState(state: MascotState): Promise<void>
    onStateChanged(callback: (state: MascotState) => void): () => void
    openApp(): Promise<void>
    hide(): Promise<void>
  }
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
  }
}

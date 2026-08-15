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
  stage: 'checking' | 'downloading-engine' | 'installing-engine' | 'starting-engine' | 'downloading-model' | 'ready' | 'error'
  message: string
  percent?: number
}

export interface ChatRequest {
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
    send(request: ChatRequest): Promise<ChatResponse>
  }
  runtime: {
    status(): Promise<RuntimeStatus>
    prepare(): Promise<RuntimeStatus>
    onSetupProgress(callback: (progress: RuntimeSetupProgress) => void): () => void
  }
  voice: {
    transcribe(wavAudio: ArrayBuffer): Promise<VoiceTranscription>
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

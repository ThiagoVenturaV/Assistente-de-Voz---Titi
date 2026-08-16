import { contextBridge, ipcRenderer } from 'electron'
import type {
  ChatRequest,
  MascotState,
  RuntimeSetupProgress,
  TitiDesktopApi,
  TitiSettings,
  ToolConfirmationRequest,
  ToolConfirmationResponse
} from '../shared/contracts'

const api: TitiDesktopApi = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<TitiSettings>) =>
      ipcRenderer.invoke('settings:update', patch)
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    get: (id: string) => ipcRenderer.invoke('conversations:get', id),
    create: () => ipcRenderer.invoke('conversations:create'),
    remove: (id: string) => ipcRenderer.invoke('conversations:remove', id),
    clear: () => ipcRenderer.invoke('conversations:clear'),
    export: () => ipcRenderer.invoke('conversations:export'),
    send: (request: ChatRequest) =>
      ipcRenderer.invoke('conversations:send', request)
  },
  interaction: {
    stop: (requestId?: string) => ipcRenderer.invoke('interaction:stop', requestId)
  },
  runtime: {
    status: () => ipcRenderer.invoke('runtime:status'),
    prepare: () => ipcRenderer.invoke('runtime:prepare'),
    cancel: () => ipcRenderer.invoke('runtime:cancel'),
    onSetupProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: RuntimeSetupProgress): void =>
        callback(progress)
      ipcRenderer.on('runtime:setup-progress', listener)
      return () => ipcRenderer.removeListener('runtime:setup-progress', listener)
    }
  },
  activity: {
    list: () => ipcRenderer.invoke('activity:list'),
    clear: () => ipcRenderer.invoke('activity:clear')
  },
  memory: {
    list: () => ipcRenderer.invoke('memory:list'),
    remove: (id: string) => ipcRenderer.invoke('memory:remove', id),
    clear: () => ipcRenderer.invoke('memory:clear')
  },
  tools: {
    respondToConfirmation: (response: ToolConfirmationResponse) =>
      ipcRenderer.invoke('tools:confirmation-response', response),
    onConfirmationRequested: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        request: ToolConfirmationRequest
      ): void => callback(request)
      ipcRenderer.on('tools:confirmation-requested', listener)
      return () => ipcRenderer.removeListener('tools:confirmation-requested', listener)
    },
    onConfirmationDismissed: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, requestId: string): void =>
        callback(requestId)
      ipcRenderer.on('tools:confirmation-dismissed', listener)
      return () => ipcRenderer.removeListener('tools:confirmation-dismissed', listener)
    }
  },
  game: {
    isStandby: () => ipcRenderer.invoke('game:is-standby'),
    onStandbyChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void =>
        callback(enabled)
      ipcRenderer.on('game:standby-changed', listener)
      return () => ipcRenderer.removeListener('game:standby-changed', listener)
    }
  },
  voice: {
    transcribe: (wavAudio: ArrayBuffer) =>
      ipcRenderer.invoke('voice:transcribe', wavAudio),
    startStream: (sessionId: string) => ipcRenderer.invoke('voice:start-stream', sessionId),
    pushStreamChunk: (sessionId: string, pcmAudio: ArrayBuffer) =>
      ipcRenderer.invoke('voice:stream-chunk', sessionId, pcmAudio),
    finishStream: (sessionId: string) => ipcRenderer.invoke('voice:finish-stream', sessionId),
    cancelStream: (sessionId: string) => ipcRenderer.invoke('voice:cancel-stream', sessionId),
    onPartialTranscription: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        partial: import('../shared/contracts').VoicePartialTranscription
      ): void => callback(partial)
      ipcRenderer.on('voice:partial-transcription', listener)
      return () => ipcRenderer.removeListener('voice:partial-transcription', listener)
    },
    synthesize: (requestId: string, text: string, rate: number) =>
      ipcRenderer.invoke('voice:synthesize', requestId, text, rate),
    cancelSynthesis: (requestId: string) =>
      ipcRenderer.invoke('voice:cancel-synthesis', requestId),
    setLiveMode: (enabled: boolean) => ipcRenderer.invoke('voice:set-live-mode', enabled),
    onLiveModeChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void => callback(enabled)
      ipcRenderer.on('voice:live-mode-changed', listener)
      return () => ipcRenderer.removeListener('voice:live-mode-changed', listener)
    },
    onPushToTalkRequested: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on('voice:push-to-talk-requested', listener)
      return () => ipcRenderer.removeListener('voice:push-to-talk-requested', listener)
    }
  },
  mascot: {
    setState: (state: MascotState) =>
      ipcRenderer.invoke('mascot:set-state', state),
    onStateChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, state: MascotState): void =>
        callback(state)
      ipcRenderer.on('mascot:state-changed', listener)
      return () => ipcRenderer.removeListener('mascot:state-changed', listener)
    },
    openApp: () => ipcRenderer.invoke('mascot:open-app'),
    hide: () => ipcRenderer.invoke('mascot:hide')
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close')
  }
}

contextBridge.exposeInMainWorld('titi', api)

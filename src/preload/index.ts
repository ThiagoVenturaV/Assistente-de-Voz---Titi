import { contextBridge, ipcRenderer } from 'electron'
import type {
  ChatRequest,
  MascotState,
  RuntimeSetupProgress,
  TitiDesktopApi,
  TitiSettings
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
    send: (request: ChatRequest) =>
      ipcRenderer.invoke('conversations:send', request)
  },
  runtime: {
    status: () => ipcRenderer.invoke('runtime:status'),
    prepare: () => ipcRenderer.invoke('runtime:prepare'),
    onSetupProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: RuntimeSetupProgress): void =>
        callback(progress)
      ipcRenderer.on('runtime:setup-progress', listener)
      return () => ipcRenderer.removeListener('runtime:setup-progress', listener)
    }
  },
  voice: {
    transcribe: (wavAudio: ArrayBuffer) =>
      ipcRenderer.invoke('voice:transcribe', wavAudio)
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

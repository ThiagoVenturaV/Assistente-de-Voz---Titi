import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  session,
  shell,
  type IpcMainInvokeEvent
} from 'electron'
import type { MascotState, TitiSettings } from '../shared/contracts'
import { AssistantHarness } from './harness/assistant-harness'
import { OllamaRuntimeManager } from './runtime/ollama-runtime-manager'
import { ConversationStore } from './storage/conversation-store'
import { SettingsStore } from './storage/settings-store'
import { WhisperTranscriber } from './voice/whisper-transcriber'

let mainWindow: BrowserWindow | null = null
let mascotWindow: BrowserWindow | null = null
let settingsStore: SettingsStore
let conversationStore: ConversationStore
let harness: AssistantHarness
let runtimeManager: OllamaRuntimeManager
let transcriber: WhisperTranscriber
let idleTimer: NodeJS.Timeout | null = null

const rendererUrl = process.env.ELECTRON_RENDERER_URL
const captureDirectory = process.env.TITI_CAPTURE_DIR

if (captureDirectory) {
  app.setPath('userData', join(resolve(captureDirectory), 'profile'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => showMainWindow())

app.whenReady().then(async () => {
  settingsStore = new SettingsStore(app.getPath('userData'))
  conversationStore = new ConversationStore(app.getPath('userData'))
  harness = new AssistantHarness(settingsStore, conversationStore)
  runtimeManager = new OllamaRuntimeManager(
    settingsStore,
    () => harness.status(),
    (progress) => broadcast('runtime:setup-progress', progress),
    app.getPath('temp')
  )
  transcriber = new WhisperTranscriber(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    app.getPath('temp')
  )

  registerIpcHandlers()
  configureMediaPermissions()
  createMainWindow()
  await createMascotWindow()
  void runtimeManager.ensureRunning().then(async (started) => {
    if (started) broadcast('runtime:status-changed', await runtimeManager.status())
  })
  if (captureDirectory) void captureQaScreens(resolve(captureDirectory))

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 880,
    minHeight: 620,
    show: false,
    frame: false,
    title: 'Titi',
    backgroundColor: '#101210',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  mainWindow.setMenuBarVisibility(false)
  lockNavigation(mainWindow)
  loadView(mainWindow, 'app')
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  return mainWindow
}

async function captureQaScreens(directory: string): Promise<void> {
  if (!mainWindow || !mascotWindow) return
  await Promise.all([waitForLoad(mainWindow), waitForLoad(mascotWindow)])
  await delay(1000)
  await mkdir(directory, { recursive: true })
  await writeCapture(mainWindow, join(directory, 'onboarding.png'))
  await writeCapture(mascotWindow, join(directory, 'mascot-idle.png'))
  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('.onboarding-next')?.click()"
  )
  await delay(350)
  await writeCapture(mainWindow, join(directory, 'onboarding-runtime.png'))

  await settingsStore.update({ onboardingComplete: true, mascotName: 'Titi' })
  mainWindow.reload()
  await waitForLoad(mainWindow)
  await delay(1000)
  await writeCapture(mainWindow, join(directory, 'home.png'))

  const conversation = await conversationStore.create()
  await conversationStore.addMessage(
    conversation.id,
    'user',
    'Olá Titi, você está funcionando localmente?'
  )
  await conversationStore.addMessage(
    conversation.id,
    'assistant',
    'Sim! Minha interface, memória, voz e modelo de conversa estão funcionando neste computador.'
  )
  mainWindow.reload()
  await waitForLoad(mainWindow)
  await delay(1000)
  await writeCapture(mainWindow, join(directory, 'conversation.png'))

  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('.sidebar-footer .sidebar-action')?.click()"
  )
  await delay(500)
  await writeCapture(mainWindow, join(directory, 'settings.png'))
  await mainWindow.webContents.executeJavaScript(
    "document.querySelectorAll('.settings-nav button')[1]?.click()"
  )
  await delay(300)
  await writeCapture(mainWindow, join(directory, 'settings-intelligence.png'))
  app.quit()
}

function waitForLoad(window: BrowserWindow): Promise<void> {
  if (!window.webContents.isLoading()) return Promise.resolve()
  return new Promise((resolveLoad) => {
    window.webContents.once('did-finish-load', () => resolveLoad())
  })
}

async function writeCapture(window: BrowserWindow, path: string): Promise<void> {
  const image = await window.webContents.capturePage()
  await writeFile(path, image.toPNG())
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function createMascotWindow(): Promise<void> {
  const settings = await settingsStore.get()
  const workArea = screen.getPrimaryDisplay().workArea
  const width = 224
  const height = 264

  mascotWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  mascotWindow.setAlwaysOnTop(true, 'floating')
  mascotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  lockNavigation(mascotWindow)
  loadView(mascotWindow, 'mascot')
  mascotWindow.once('ready-to-show', () => {
    if (settings.showFloatingMascot) mascotWindow?.showInactive()
  })
  mascotWindow.on('closed', () => {
    mascotWindow = null
  })
}

function loadView(window: BrowserWindow, hash: 'app' | 'mascot'): void {
  if (rendererUrl) {
    void window.loadURL(`${rendererUrl}#${hash}`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function lockNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}

function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => settingsStore.get())
  ipcMain.handle(
    'settings:update',
    async (_event, patch: Partial<TitiSettings>) => {
      const settings = await settingsStore.update(patch)
      app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup })
      syncMascotVisibility(settings)
      broadcast('settings:changed', settings)
      return settings
    }
  )

  ipcMain.handle('conversations:list', () => conversationStore.list())
  ipcMain.handle('conversations:get', (_event, id: string) =>
    conversationStore.get(id)
  )
  ipcMain.handle('conversations:create', () => conversationStore.create())
  ipcMain.handle('conversations:remove', (_event, id: string) =>
    conversationStore.remove(id)
  )
  ipcMain.handle('conversations:send', async (_event, request) => {
    setMascotState('thinking')
    try {
      const beforeSend = await runtimeManager.status()
      if (!beforeSend.connected && beforeSend.engineInstalled) {
        await runtimeManager.ensureRunning()
      }
      const response = await harness.send(request)
      response.runtime = await runtimeManager.enrich(response.runtime)
      setMascotState('speaking')
      scheduleIdle(Math.min(6000, Math.max(1800, response.assistantMessage.content.length * 18)))
      return response
    } catch (error) {
      setMascotState('error')
      scheduleIdle(2800)
      throw error
    }
  })

  ipcMain.handle('runtime:status', () => runtimeManager.status())
  ipcMain.handle('runtime:prepare', () => runtimeManager.prepare())
  ipcMain.handle('voice:transcribe', async (_event, wavAudio: ArrayBuffer) => {
    setMascotState('thinking')
    try {
      return await transcriber.transcribe(wavAudio)
    } catch (error) {
      setMascotState('error')
      scheduleIdle(2500)
      throw error
    }
  })
  ipcMain.handle('voice:start-live', async () => {
    const current = await settingsStore.get()
    const settings = await settingsStore.update({
      voice: { ...current.voice, enabled: true, liveMode: true }
    })
    broadcast('settings:changed', settings)
    requestLiveConversationFromMainWindow()
    return undefined
  })
  ipcMain.handle('mascot:set-state', (_event, state: MascotState) => {
    setMascotState(state)
  })
  ipcMain.handle('mascot:open-app', () => showMainWindow())
  ipcMain.handle('mascot:hide', () => mascotWindow?.hide())

  ipcMain.handle('window:minimize', (event) => ownerWindow(event)?.minimize())
  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = ownerWindow(event)
    if (!window) return false
    window.isMaximized() ? window.unmaximize() : window.maximize()
    return window.isMaximized()
  })
  ipcMain.handle('window:close', (event) => ownerWindow(event)?.close())
}

function configureMediaPermissions(): void {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    permission === 'media'
  )
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const wantsAudio = permission === 'media'
        && 'mediaTypes' in details
        && details.mediaTypes?.includes('audio')
      callback(Boolean(wantsAudio))
    }
  )
}

function ownerWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  mainWindow?.show()
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
}

function requestLiveConversationFromMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  if (!mainWindow) return
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('voice:live-requested')
    })
    return
  }
  mainWindow.webContents.send('voice:live-requested')
}

function syncMascotVisibility(settings: TitiSettings): void {
  if (!mascotWindow || mascotWindow.isDestroyed()) return
  settings.showFloatingMascot ? mascotWindow.showInactive() : mascotWindow.hide()
}

function setMascotState(state: MascotState): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  broadcast('mascot:state-changed', state)
}

function scheduleIdle(delay: number): void {
  idleTimer = setTimeout(() => setMascotState('idle'), delay)
}

function broadcast(channel: string, value: unknown): void {
  for (const window of [mainWindow, mascotWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, value)
    }
  }
}

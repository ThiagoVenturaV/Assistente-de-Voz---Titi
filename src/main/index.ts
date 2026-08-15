import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  type IpcMainInvokeEvent
} from 'electron'
import type {
  CuratedMemorySummary,
  MascotState,
  TitiSettings,
  ToolConfirmationRequest,
  ToolConfirmationResponse
} from '../shared/contracts'
import { WindowsAppCatalog } from './apps/windows-app-catalog'
import { GameStandbyMonitor } from './games/game-standby-monitor'
import {
  validatedBoolean,
  validatedChatRequest,
  validatedConversationId,
  validatedMascotState,
  validatedSettingsPatch,
  validatedWavAudio
} from './ipc/validation'
import { AssistantHarness } from './harness/assistant-harness'
import { LocalMemoryStore, type MemoryEntry } from './memory'
import { OllamaRuntimeManager } from './runtime/ollama-runtime-manager'
import { ConversationStore } from './storage/conversation-store'
import { ActionLogStore } from './storage/action-log-store'
import { SettingsStore } from './storage/settings-store'
import { AuditedToolExecutor } from './tools/audited-tool-executor'
import { ConfirmationToolExecutor } from './tools/confirmation-tool-executor'
import { DesktopToolkit } from './tools/desktop-toolkit'
import { ToolConfirmationBroker } from './tools/tool-confirmation-broker'
import { WhisperTranscriber } from './voice/whisper-transcriber'
import { GlobalPushToTalk } from './voice/global-push-to-talk'

let mainWindow: BrowserWindow | null = null
let mascotWindow: BrowserWindow | null = null
let settingsStore: SettingsStore
let conversationStore: ConversationStore
let actionLogStore: ActionLogStore
let memoryStore: LocalMemoryStore
let confirmationBroker: ToolConfirmationBroker
let harness: AssistantHarness
let runtimeManager: OllamaRuntimeManager
let gameStandbyMonitor: GameStandbyMonitor
let transcriber: WhisperTranscriber
let globalPushToTalk: GlobalPushToTalk
let idleTimer: NodeJS.Timeout | null = null
let resumeLiveModeAfterGame = false

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
  const userDataPath = app.getPath('userData')
  settingsStore = new SettingsStore(userDataPath)
  conversationStore = new ConversationStore(userDataPath)
  actionLogStore = new ActionLogStore(userDataPath)
  memoryStore = new LocalMemoryStore(userDataPath)
  const appCatalog = new WindowsAppCatalog({
    recipeFilePath: join(userDataPath, 'app-skills.json'),
    shouldLearn: async () => (await settingsStore.get()).keepHistory
  })
  confirmationBroker = new ToolConfirmationBroker(dispatchToolConfirmation)
  harness = new AssistantHarness(
    settingsStore,
    conversationStore,
    new AuditedToolExecutor(
      new ConfirmationToolExecutor(
        new DesktopToolkit(appCatalog),
        async (prompt) => {
          setMascotState('review')
          try {
            return await confirmationBroker.request(prompt)
          } finally {
            setMascotState('thinking')
          }
        }
      ),
      actionLogStore,
      async () => (await settingsStore.get()).keepHistory
    ),
    memoryStore
  )
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
  globalPushToTalk = new GlobalPushToTalk(globalShortcut, () => {
    if (gameStandbyMonitor?.isInStandby()) return
    showMainWindow()
    mainWindow?.webContents.send('voice:push-to-talk-requested')
  })
  const initialSettings = await settingsStore.get()
  try {
    globalPushToTalk.register(initialSettings.voice.pushToTalkShortcut)
  } catch {
    const fallbackShortcut = 'CommandOrControl+Alt+F9'
    try {
      globalPushToTalk.register(fallbackShortcut)
      await settingsStore.update({
        voice: { ...initialSettings.voice, pushToTalkShortcut: fallbackShortcut }
      })
    } catch {
      // The application remains fully usable through its visible voice buttons.
    }
  }
  gameStandbyMonitor = new GameStandbyMonitor({
    onEnter: enterGameStandby,
    onExit: exitGameStandby
  })

  registerIpcHandlers()
  configureMediaPermissions()
  createMainWindow()
  await createMascotWindow()
  gameStandbyMonitor.start()
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

app.on('before-quit', () => {
  confirmationBroker?.cancelAll()
  globalPushToTalk?.dispose()
  void gameStandbyMonitor?.stop({ restore: false })
  runtimeManager?.shutdownOwnedEngine()
})

async function enterGameStandby(): Promise<void> {
  const settings = await settingsStore.get()
  resumeLiveModeAfterGame = settings.voice.liveMode
  if (settings.voice.liveMode) {
    await settingsStore.update({
      voice: { ...settings.voice, liveMode: false }
    })
    notifyLiveModeChanged(false)
  }
  setMascotState('standby')
  mascotWindow?.hide()
  await runtimeManager.unloadSelectedModel()
}

async function exitGameStandby(): Promise<void> {
  const settings = await settingsStore.get()
  if (settings.showFloatingMascot) mascotWindow?.showInactive()
  setMascotState('idle')
  if (resumeLiveModeAfterGame) {
    resumeLiveModeAfterGame = false
    const latest = await settingsStore.get()
    await settingsStore.update({
      voice: { ...latest.voice, enabled: true, liveMode: true }
    })
    notifyLiveModeChanged(true)
  }
}

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
  const confirmationFlow = mainWindow.webContents.executeJavaScript(
    `window.titi.conversations.send(${JSON.stringify({
      conversationId: conversation.id,
      content: 'Abra o Brave'
    })})`
  )
  await delay(500)
  await writeCapture(mainWindow, join(directory, 'tool-confirmation.png'))
  await mainWindow.webContents.executeJavaScript(
    "document.querySelector('.tool-confirmation-dialog .secondary-button')?.click()"
  )
  await confirmationFlow
  for (const content of [
    'Abra o Brave',
    'Abra o Spotify',
    'Abra o Codex',
    'Abra o Antigravity'
  ]) {
    const approvedFlow = mainWindow.webContents.executeJavaScript(
      `window.titi.conversations.send(${JSON.stringify({
        conversationId: conversation.id,
        content
      })})`
    )
    await delay(500)
    await mainWindow.webContents.executeJavaScript(
      "document.querySelector('.tool-confirmation-dialog .primary-button')?.click()"
    )
    await approvedFlow
  }
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
  ipcMain.handle('settings:get', (event) => {
    requireRenderer(event)
    return settingsStore.get()
  })
  ipcMain.handle(
    'settings:update',
    async (event, value: unknown) => {
      requireRenderer(event, 'main')
      const patch = validatedSettingsPatch(value)
      const previous = await settingsStore.get()
      const nextShortcut = patch.voice?.pushToTalkShortcut
      if (nextShortcut && nextShortcut !== previous.voice.pushToTalkShortcut) {
        globalPushToTalk.register(nextShortcut)
      }
      const settings = await settingsStore.update(patch)
      app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup })
      syncMascotVisibility(settings)
      broadcast('settings:changed', settings)
      if (previous.voice.liveMode !== settings.voice.liveMode) {
        notifyLiveModeChanged(settings.voice.liveMode)
      }
      return settings
    }
  )

  ipcMain.handle('conversations:list', (event) => {
    requireRenderer(event, 'main')
    return conversationStore.list()
  })
  ipcMain.handle('conversations:get', (event, id: unknown) => {
    requireRenderer(event, 'main')
    return conversationStore.get(validatedConversationId(id))
  })
  ipcMain.handle('conversations:create', (event) => {
    requireRenderer(event, 'main')
    return conversationStore.create()
  })
  ipcMain.handle('conversations:remove', (event, id: unknown) => {
    requireRenderer(event, 'main')
    return conversationStore.remove(validatedConversationId(id))
  })
  ipcMain.handle('conversations:clear', (event) => {
    requireRenderer(event, 'main')
    return conversationStore.clear()
  })
  ipcMain.handle('conversations:export', async (event) => {
    requireRenderer(event, 'main')
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar conversas do Titi',
      defaultPath: `conversas-titi-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Arquivo JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    const exported = {
      product: 'Titi',
      exportedAt: new Date().toISOString(),
      conversations: await conversationStore.exportAll()
    }
    await writeFile(result.filePath, JSON.stringify(exported, null, 2), 'utf8')
    return result.filePath
  })
  ipcMain.handle('activity:list', (event) => {
    requireRenderer(event, 'main')
    return actionLogStore.list()
  })
  ipcMain.handle('activity:clear', (event) => {
    requireRenderer(event, 'main')
    return actionLogStore.clear()
  })
  ipcMain.handle('memory:list', async (event) => {
    requireRenderer(event, 'main')
    return (await memoryStore.list()).map(memorySummary)
  })
  ipcMain.handle('memory:remove', (event, id: unknown) => {
    requireRenderer(event, 'main')
    return memoryStore.remove(validatedConversationId(id))
  })
  ipcMain.handle('memory:clear', (event) => {
    requireRenderer(event, 'main')
    return memoryStore.clear()
  })
  ipcMain.handle(
    'tools:confirmation-response',
    (event, response: ToolConfirmationResponse) => {
      if (ownerWindow(event) !== mainWindow || !isToolConfirmationResponse(response)) return false
      return confirmationBroker.respond(response)
    }
  )
  ipcMain.handle('conversations:send', async (event, value: unknown) => {
    requireRenderer(event, 'main')
    const request = validatedChatRequest(value)
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

  ipcMain.handle('runtime:status', (event) => {
    requireRenderer(event, 'main')
    return runtimeManager.status()
  })
  ipcMain.handle('runtime:prepare', (event) => {
    requireRenderer(event, 'main')
    return runtimeManager.prepare()
  })
  ipcMain.handle('voice:transcribe', async (event, value: unknown) => {
    requireRenderer(event, 'main')
    const wavAudio = validatedWavAudio(value)
    setMascotState('thinking')
    try {
      return await transcriber.transcribe(wavAudio)
    } catch (error) {
      setMascotState('error')
      scheduleIdle(2500)
      throw error
    }
  })
  ipcMain.handle('voice:set-live-mode', async (event, value: unknown) => {
    requireRenderer(event)
    const enabled = validatedBoolean(value, 'liveMode')
    const current = await settingsStore.get()
    const settings = await settingsStore.update({
      voice: { ...current.voice, enabled: enabled || current.voice.enabled, liveMode: enabled }
    })
    broadcast('settings:changed', settings)
    notifyLiveModeChanged(enabled)
    return settings
  })
  ipcMain.handle('mascot:set-state', (event, value: unknown) => {
    requireRenderer(event)
    setMascotState(validatedMascotState(value))
  })
  ipcMain.handle('mascot:open-app', (event) => {
    requireRenderer(event)
    showMainWindow()
  })
  ipcMain.handle('mascot:hide', (event) => {
    requireRenderer(event)
    mascotWindow?.hide()
  })

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
  session.defaultSession.setPermissionCheckHandler((webContents, permission) =>
    permission === 'media'
      && webContents !== null
      && BrowserWindow.fromWebContents(webContents) === mainWindow
  )
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const fromMainWindow = BrowserWindow.fromWebContents(webContents) === mainWindow
      const wantsAudio = permission === 'media'
        && fromMainWindow
        && 'mediaTypes' in details
        && details.mediaTypes?.includes('audio')
      callback(Boolean(wantsAudio))
    }
  )
}

function ownerWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function requireRenderer(
  event: IpcMainInvokeEvent,
  scope: 'main' | 'any' = 'any'
): BrowserWindow {
  const owner = ownerWindow(event)
  const allowed = scope === 'main'
    ? owner === mainWindow
    : owner === mainWindow || owner === mascotWindow
  if (!owner || !allowed || owner.isDestroyed()) {
    throw new Error('Origem da solicitação não autorizada.')
  }
  return owner
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  mainWindow?.show()
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
}

function dispatchToolConfirmation(request: ToolConfirmationRequest): void {
  showMainWindow()
  const target = mainWindow
  if (!target || target.isDestroyed()) return
  const send = (): void => {
    if (!target.isDestroyed()) target.webContents.send('tools:confirmation-requested', request)
  }
  if (target.webContents.isLoading()) target.webContents.once('did-finish-load', send)
  else send()
}

function isToolConfirmationResponse(value: unknown): value is ToolConfirmationResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ToolConfirmationResponse>
  return typeof candidate.requestId === 'string'
    && candidate.requestId.length > 0
    && typeof candidate.approved === 'boolean'
}

function memorySummary(entry: MemoryEntry): CuratedMemorySummary {
  if (entry.kind === 'recipe') {
    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.name,
      value: entry.summary,
      source: memorySourceLabel(entry.source.kind),
      updatedAt: entry.updatedAt
    }
  }
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.key,
    value: entry.value,
    source: memorySourceLabel(entry.source.kind),
    updatedAt: entry.updatedAt
  }
}

function memorySourceLabel(source: MemoryEntry['source']['kind']): string {
  return ({
    'user-statement': 'Pedido explícito do usuário',
    'user-correction': 'Correção do usuário',
    'tool-success': 'Ação verificada',
    'assistant-curation': 'Curadoria local',
    import: 'Importação'
  })[source]
}

function notifyLiveModeChanged(enabled: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  for (const window of [mainWindow, mascotWindow]) {
    if (!window || window.isDestroyed()) continue
    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', () => {
        if (!window.isDestroyed()) window.webContents.send('voice:live-mode-changed', enabled)
      })
    } else {
      window.webContents.send('voice:live-mode-changed', enabled)
    }
  }
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

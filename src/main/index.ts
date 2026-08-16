import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
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
  validatedPcmAudio,
  validatedRequestId,
  validatedSettingsPatch,
  validatedVoiceSynthesisRequest,
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
import { WindowsUiAutomationController } from './tools/windows-ui-automation'
import { OllamaVisualComputerAgent } from './tools/visual-computer-agent'
import { ParakeetTranscriber, sanitizeTranscription } from './voice/parakeet-transcriber'
import { ParakeetStreamingTranscriber } from './voice/parakeet-streaming-transcriber'
import { LocalTranscriptionRefiner } from './voice/transcription-refiner'
import { GlobalPushToTalk } from './voice/global-push-to-talk'
import { SupertonicSynthesizer } from './voice/supertonic-synthesizer'

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
let transcriber: ParakeetTranscriber
let streamingTranscriber: ParakeetStreamingTranscriber
let transcriptionRefiner: LocalTranscriptionRefiner
let speechSynthesizer: SupertonicSynthesizer
let globalPushToTalk: GlobalPushToTalk
let idleTimer: NodeJS.Timeout | null = null
let gameStandbyTransitioning = false
const activeChatRequests = new Map<string, { controller: AbortController; ownerId: number }>()
const activeTranscriptions = new Map<number, AbortController>()
const activeVoiceStreams = new Map<string, { ownerId: number }>()
const activeSyntheses = new Map<string, { controller: AbortController; ownerId: number }>()

const rendererUrl = process.env.ELECTRON_RENDERER_URL

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
  const runtimeResourcesPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const computerController = new WindowsUiAutomationController(join(
    runtimeResourcesPath,
    'runtime',
    'windows-ui-automation',
    'windows-ui-automation.ps1'
  ))
  const visualComputerAgent = new OllamaVisualComputerAgent(
    computerController,
    () => settingsStore.get()
  )
  confirmationBroker = new ToolConfirmationBroker(
    dispatchToolConfirmation,
    45_000,
    (requestId) => broadcast('tools:confirmation-dismissed', requestId)
  )
  harness = new AssistantHarness(
    settingsStore,
    conversationStore,
    new AuditedToolExecutor(
      new ConfirmationToolExecutor(
        new DesktopToolkit(
          appCatalog,
          computerController,
          async () => (await settingsStore.get()).computerControlEnabled,
          visualComputerAgent
        ),
        async (prompt, context) => {
          setMascotState('review')
          try {
            return await confirmationBroker.request(prompt, context?.signal)
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
  transcriber = new ParakeetTranscriber(
    runtimeResourcesPath,
    app.getPath('temp')
  )
  streamingTranscriber = new ParakeetStreamingTranscriber(runtimeResourcesPath)
  speechSynthesizer = new SupertonicSynthesizer(runtimeResourcesPath)
  void speechSynthesizer.prepare().catch(() => {
    // A síntese repetirá a inicialização e exibirá o erro apenas se ambos os backends falharem.
  })
  transcriptionRefiner = new LocalTranscriptionRefiner(
    () => settingsStore.get(),
    () => appCatalog.recognitionVocabulary()
  )
  globalPushToTalk = new GlobalPushToTalk(globalShortcut, () => {
    if (isGameStandbyEffective()) return
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
    onExit: exitGameStandby,
    knownGames: initialSettings.games.executables
  })

  registerIpcHandlers()
  configureMediaPermissions()
  createMainWindow()
  await createMascotWindow()
  if (initialSettings.games.standbyEnabled) gameStandbyMonitor.start()
  void runtimeManager.ensureRunning().then(async (started) => {
    if (isGameStandbyEffective()) {
      await runtimeManager.unloadSelectedModel()
      return
    }
    if (started) broadcast('runtime:status-changed', await runtimeManager.status())
  })
  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  for (const { controller } of activeChatRequests.values()) controller.abort(abortReason())
  for (const controller of activeTranscriptions.values()) controller.abort(abortReason())
  activeChatRequests.clear()
  activeTranscriptions.clear()
  activeVoiceStreams.clear()
  for (const { controller } of activeSyntheses.values()) controller.abort(abortReason())
  activeSyntheses.clear()
  streamingTranscriber?.dispose()
  speechSynthesizer?.dispose()
  confirmationBroker?.cancelAll()
  globalPushToTalk?.dispose()
  void gameStandbyMonitor?.stop({ restore: false })
  runtimeManager?.cancelActiveWork(abortReason())
  runtimeManager?.shutdownOwnedEngine()
})

async function enterGameStandby(): Promise<void> {
  gameStandbyTransitioning = true
  setMascotState('standby', true)
  mascotWindow?.hide()
  broadcast('game:standby-changed', true)
  for (const { controller } of activeChatRequests.values()) {
    controller.abort(gameStandbyReason())
  }
  for (const controller of activeTranscriptions.values()) {
    controller.abort(gameStandbyReason())
  }
  for (const sessionId of activeVoiceStreams.keys()) streamingTranscriber.cancel(sessionId)
  activeVoiceStreams.clear()
  streamingTranscriber.dispose()
  for (const { controller } of activeSyntheses.values()) controller.abort(gameStandbyReason())
  activeSyntheses.clear()
  speechSynthesizer.dispose()
  confirmationBroker.cancelAll()
  runtimeManager.cancelActiveWork(gameStandbyReason())
  try {
    await runtimeManager.unloadSelectedModel()
  } finally {
    gameStandbyTransitioning = false
  }
}

async function exitGameStandby(): Promise<void> {
  gameStandbyTransitioning = true
  try {
    const settings = await settingsStore.get()
    if (settings.showFloatingMascot) mascotWindow?.showInactive()
    setMascotState('idle', true)
    broadcast('game:standby-changed', false)
  } finally {
    gameStandbyTransitioning = false
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
    if (settings.showFloatingMascot && !isGameStandbyEffective()) {
      mascotWindow?.showInactive()
    }
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
      gameStandbyMonitor.setKnownGames(settings.games.executables)
      if (previous.games.standbyEnabled !== settings.games.standbyEnabled) {
        if (settings.games.standbyEnabled) gameStandbyMonitor.start()
        else await gameStandbyMonitor.stop()
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
  ipcMain.handle('game:is-standby', (event) => {
    requireRenderer(event)
    return isGameStandbyEffective()
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
    assertNotInGameStandby()
    const request = validatedChatRequest(value)
    const requestId = request.requestId ?? randomUUID()
    if (activeChatRequests.has(requestId)) throw new Error('Este pedido já está em andamento.')
    const controller = new AbortController()
    activeChatRequests.set(requestId, { controller, ownerId: event.sender.id })
    setMascotState('thinking')
    try {
      const beforeSend = await runtimeManager.status(controller.signal)
      throwIfAborted(controller.signal)
      if (!beforeSend.connected && beforeSend.engineInstalled) {
        await runtimeManager.ensureRunning(controller.signal)
      }
      throwIfAborted(controller.signal)
      const response = await harness.send({ ...request, requestId }, controller.signal)
      throwIfAborted(controller.signal)
      response.runtime = await runtimeManager.enrich(response.runtime, controller.signal)
      throwIfAborted(controller.signal)
      setMascotState('speaking')
      scheduleIdle(Math.min(6000, Math.max(1800, response.assistantMessage.content.length * 18)))
      return response
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        setMascotState('idle')
        throw abortReason()
      }
      setMascotState('error')
      scheduleIdle(2800)
      throw error
    } finally {
      const active = activeChatRequests.get(requestId)
      if (active?.controller === controller) activeChatRequests.delete(requestId)
    }
  })

  ipcMain.handle('interaction:stop', (event, value: unknown) => {
    requireRenderer(event, 'main')
    const requestId = value === undefined ? undefined : validatedRequestId(value)
    let stopped = false
    for (const [id, active] of activeChatRequests) {
      if (active.ownerId !== event.sender.id || (requestId && id !== requestId)) continue
      active.controller.abort(abortReason())
      stopped = true
    }
    const transcription = activeTranscriptions.get(event.sender.id)
    if (transcription) {
      transcription.abort(abortReason())
      stopped = true
    }
    for (const [sessionId, active] of activeVoiceStreams) {
      if (active.ownerId !== event.sender.id) continue
      streamingTranscriber.cancel(sessionId)
      activeVoiceStreams.delete(sessionId)
      stopped = true
    }
    for (const [id, active] of activeSyntheses) {
      if (active.ownerId !== event.sender.id) continue
      active.controller.abort(abortReason())
      activeSyntheses.delete(id)
      stopped = true
    }
    if (runtimeManager.cancelActiveWork(abortReason())) stopped = true
    setMascotState('idle')
    return stopped
  })

  ipcMain.handle('runtime:status', (event) => {
    requireRenderer(event, 'main')
    return runtimeManager.status()
  })
  ipcMain.handle('runtime:prepare', (event) => {
    requireRenderer(event, 'main')
    assertNotInGameStandby()
    return runtimeManager.prepare()
  })
  ipcMain.handle('runtime:cancel', (event) => {
    requireRenderer(event, 'main')
    return runtimeManager.cancelActiveWork(abortReason())
  })
  ipcMain.handle('voice:transcribe', async (event, value: unknown) => {
    requireRenderer(event, 'main')
    assertNotInGameStandby()
    const wavAudio = validatedWavAudio(value)
    activeTranscriptions.get(event.sender.id)?.abort(abortReason())
    const controller = new AbortController()
    activeTranscriptions.set(event.sender.id, controller)
    setMascotState('thinking')
    try {
      const startedAt = performance.now()
      const transcription = await transcriber.transcribe(wavAudio, controller.signal)
      const text = await transcriptionRefiner.refine(transcription.text, controller.signal)
      return {
        text,
        processingTimeMs: Math.round(performance.now() - startedAt)
      }
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        setMascotState('idle')
        throw abortReason()
      }
      setMascotState('error')
      scheduleIdle(2500)
      throw error
    } finally {
      if (activeTranscriptions.get(event.sender.id) === controller) {
        activeTranscriptions.delete(event.sender.id)
      }
    }
  })
  ipcMain.handle('voice:start-stream', async (event, value: unknown) => {
    requireRenderer(event, 'main')
    assertNotInGameStandby()
    const sessionId = validatedRequestId(value)
    for (const [activeId, active] of activeVoiceStreams) {
      if (active.ownerId !== event.sender.id) continue
      streamingTranscriber.cancel(activeId)
      activeVoiceStreams.delete(activeId)
    }
    await streamingTranscriber.start(sessionId, (partial) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice:partial-transcription', partial)
      }
    })
    activeVoiceStreams.set(sessionId, { ownerId: event.sender.id })
  })
  ipcMain.handle('voice:stream-chunk', (event, sessionValue: unknown, audioValue: unknown) => {
    requireRenderer(event, 'main')
    assertNotInGameStandby()
    const sessionId = validatedRequestId(sessionValue)
    const active = activeVoiceStreams.get(sessionId)
    if (!active || active.ownerId !== event.sender.id) {
      throw new Error('A sessão incremental não está ativa.')
    }
    streamingTranscriber.push(sessionId, validatedPcmAudio(audioValue))
  })
  ipcMain.handle('voice:finish-stream', async (event, value: unknown) => {
    requireRenderer(event, 'main')
    assertNotInGameStandby()
    const sessionId = validatedRequestId(value)
    const active = activeVoiceStreams.get(sessionId)
    if (!active || active.ownerId !== event.sender.id) {
      throw new Error('A sessão incremental não está ativa.')
    }
    activeTranscriptions.get(event.sender.id)?.abort(abortReason())
    const controller = new AbortController()
    activeTranscriptions.set(event.sender.id, controller)
    const startedAt = performance.now()
    try {
      const transcription = await streamingTranscriber.finish(sessionId)
      const raw = sanitizeTranscription(transcription.text)
      const text = await transcriptionRefiner.refine(raw, controller.signal)
      return {
        text,
        processingTimeMs: Math.round(performance.now() - startedAt)
      }
    } finally {
      activeVoiceStreams.delete(sessionId)
      if (activeTranscriptions.get(event.sender.id) === controller) {
        activeTranscriptions.delete(event.sender.id)
      }
    }
  })
  ipcMain.handle('voice:cancel-stream', (event, value: unknown) => {
    requireRenderer(event, 'main')
    const sessionId = validatedRequestId(value)
    const active = activeVoiceStreams.get(sessionId)
    if (active?.ownerId === event.sender.id) {
      streamingTranscriber.cancel(sessionId)
      activeVoiceStreams.delete(sessionId)
    }
  })
  ipcMain.handle(
    'voice:synthesize',
    async (event, requestIdValue: unknown, textValue: unknown, rateValue: unknown) => {
      requireRenderer(event, 'main')
      assertNotInGameStandby()
      const request = validatedVoiceSynthesisRequest(requestIdValue, textValue, rateValue)
      if (activeSyntheses.has(request.requestId)) {
        throw new Error('Esta fala já está sendo preparada.')
      }
      for (const [id, active] of activeSyntheses) {
        if (active.ownerId !== event.sender.id) continue
        active.controller.abort(abortReason())
        activeSyntheses.delete(id)
      }
      const controller = new AbortController()
      activeSyntheses.set(request.requestId, { controller, ownerId: event.sender.id })
      try {
        return await speechSynthesizer.synthesize(
          request.requestId,
          request.text,
          request.rate,
          controller.signal
        )
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) throw abortReason()
        setMascotState('error')
        scheduleIdle(2500)
        throw error
      } finally {
        const active = activeSyntheses.get(request.requestId)
        if (active?.controller === controller) activeSyntheses.delete(request.requestId)
      }
    }
  )
  ipcMain.handle('voice:cancel-synthesis', (event, value: unknown) => {
    requireRenderer(event, 'main')
    const requestId = validatedRequestId(value)
    const active = activeSyntheses.get(requestId)
    if (active?.ownerId === event.sender.id) {
      active.controller.abort(abortReason())
      activeSyntheses.delete(requestId)
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

function abortReason(): Error {
  const error = new Error('A interação foi interrompida.')
  error.name = 'AbortError'
  return error
}

function gameStandbyReason(): Error {
  const error = new Error('A interação foi interrompida porque o modo jogo entrou em standby.')
  error.name = 'AbortError'
  return error
}

function assertNotInGameStandby(): void {
  if (!isGameStandbyEffective()) return
  throw new Error('O Titi está em standby para preservar os recursos durante o jogo.')
}

function isGameStandbyEffective(): boolean {
  return gameStandbyTransitioning || Boolean(gameStandbyMonitor?.isInStandby())
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
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
  if (isGameStandbyEffective()) return
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
  settings.showFloatingMascot && !isGameStandbyEffective()
    ? mascotWindow.showInactive()
    : mascotWindow.hide()
}

function setMascotState(state: MascotState, force = false): void {
  if (!force && isGameStandbyEffective() && state !== 'standby') return
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

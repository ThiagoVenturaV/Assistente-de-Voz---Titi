import { useEffect, useRef, useState } from 'react'
import type {
  Conversation,
  ConversationSummary,
  MascotState,
  RuntimeSetupProgress,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { MessageList } from './components/MessageList'
import { Onboarding } from './components/Onboarding'
import { GameStandbyDecisionModal } from './components/GameStandbyDecisionModal'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { ToolConfirmationModal } from './components/ToolConfirmationModal'
import { WindowControls } from './components/WindowControls'
import { createOptimisticConversation } from './conversation-ui'
import { PcmRecorder } from './voice/pcm-recorder'
import { resolveLiveVoiceCommand } from './voice/live-voice-command'

export function App(): React.JSX.Element {
  const [settings, setSettings] = useState<TitiSettings | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [current, setCurrent] = useState<Conversation | null>(null)
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceProcessing, setVoiceProcessing] = useState(false)
  const [mascotState, setMascotState] = useState<MascotState>('idle')
  const [activityStartedAt, setActivityStartedAt] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [preparingRuntime, setPreparingRuntime] = useState(false)
  const [gameStandby, setGameStandby] = useState(false)
  const recorder = useRef<PcmRecorder | null>(null)
  const recordingStarting = useRef(false)
  const recordingGeneration = useRef(0)
  const stopRequested = useRef(false)
  const liveRestartTimer = useRef<number | null>(null)
  const settingsRef = useRef<TitiSettings | null>(null)
  const currentRef = useRef<Conversation | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsFocusReturnRef = useRef<HTMLElement | null>(null)
  const settingsOpenRef = useRef(false)
  const sendingRef = useRef(false)
  const voiceProcessingRef = useRef(false)
  const interactionGeneration = useRef(0)
  const activeRequestId = useRef<string | null>(null)
  const activeSpeech = useRef<AbortController | null>(null)
  const activeVoiceStreamId = useRef<string | null>(null)
  const voiceChunkQueue = useRef<Promise<void>>(Promise.resolve())
  const gameStandbyRef = useRef(false)
  const preparingRuntimeRef = useRef(false)

  type SendMessageOptions = {
    baseConversation?: Conversation | null
    requestId?: string
    startedAt?: number
    skipOptimistic?: boolean
    optimisticConversation?: Conversation
  }

  function applyConversationState(
    conversation: Conversation,
    content: string,
    requestId: string,
    startedAt: number,
    skipOptimistic?: boolean,
    optimisticConversation?: Conversation
  ): Conversation {
    const messageId = `pending-${requestId}`
    const optimistic = skipOptimistic && optimisticConversation
      ? (optimisticConversation.id === messageId
        ? optimisticConversation
        : createOptimisticConversation(conversation, content, messageId, new Date(startedAt).toISOString()))
      : createOptimisticConversation(conversation, content, messageId, new Date(startedAt).toISOString())

    setCurrent(optimistic)
    currentRef.current = optimistic
    setActivityStartedAt(startedAt)
    setConversations((previous) => [
      {
        id: optimistic.id,
        title: optimistic.title,
        updatedAt: optimistic.updatedAt,
        preview: optimistic.preview
      },
      ...previous.filter(({ id }) => id !== optimistic.id)
    ])
    return optimistic
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      window.titi.settings.get(),
      window.titi.conversations.list(),
      window.titi.runtime.status(),
      window.titi.game.isStandby()
    ]).then(async ([loadedSettings, summaries, loadedRuntime, standby]) => {
      if (!active) return
      settingsRef.current = loadedSettings
      setSettings(loadedSettings)
      setConversations(summaries)
      setRuntime(loadedRuntime)
      gameStandbyRef.current = standby
      setGameStandby(standby)
      if (summaries[0]) {
        const firstConversation = await window.titi.conversations.get(summaries[0].id)
        currentRef.current = firstConversation
        setCurrent(firstConversation)
      }
    })
    const unsubscribe = window.titi.mascot.onStateChanged(setMascotState)
    const unsubscribeRuntime = window.titi.runtime.onSetupProgress(
      (progress: RuntimeSetupProgress) => setNotice(progress.message)
    )
    const unsubscribeLive = window.titi.voice.onLiveModeChanged((enabled) => {
      void window.titi.settings.get().then((latestSettings) => {
        settingsRef.current = latestSettings
        setSettings(latestSettings)
        if (latestSettings.voice.liveMode !== enabled) return
        if (enabled) scheduleLiveListening(100)
        else stopLiveListening()
      })
    })
    const unsubscribePushToTalk = window.titi.voice.onPushToTalkRequested(() => {
      if (gameStandbyRef.current || sendingRef.current || settingsRef.current?.voice.liveMode) return
      if (recorder.current || recordingStarting.current) endListening()
      else void beginListening(false)
    })
    const unsubscribePartialTranscription = window.titi.voice.onPartialTranscription((partial) => {
      if (partial.sessionId !== activeVoiceStreamId.current) return
      setDraft(partial.text)
      setNotice(partial.text ? `Ouvindo: “${partial.text}”` : 'Ouvindo…')
    })
    const unsubscribeGameStandby = window.titi.game.onStandbyChanged((enabled) => {
      gameStandbyRef.current = enabled
      setGameStandby(enabled)
      if (enabled) suspendForGame()
      else if (settingsRef.current?.voice.liveMode) scheduleLiveListening(100)
    })
    return () => {
      active = false
      unsubscribe()
      unsubscribeRuntime()
      unsubscribeLive()
      unsubscribePushToTalk()
      unsubscribePartialTranscription()
      unsubscribeGameStandby()
      clearLiveRestart()
      recorder.current?.cancel()
      cancelVoiceStream()
      activeSpeech.current?.abort()
      void window.titi.interaction.stop(activeRequestId.current ?? undefined)
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    voiceProcessingRef.current = voiceProcessing
  }, [voiceProcessing])

  useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  useEffect(() => {
    const handleStopKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyL' && !event.shiftKey && !event.repeat) {
        event.preventDefault()
        void toggleLiveMode()
        return
      }

      if (event.key === 'Escape' && settingsOpenRef.current) {
        event.preventDefault()
        closeSettingsPanel()
        return
      }

      if (event.key !== 'Escape' || !hasActiveInteraction()) return
      event.preventDefault()
      stopCurrentInteraction('Interação interrompida.')
    }

    window.addEventListener('keydown', handleStopKey)
    return () => {
      window.removeEventListener('keydown', handleStopKey)
    }
  }, [])

  useEffect(() => {
    const shouldListen = settings?.onboardingComplete
      && settings.voice.enabled
      && settings.voice.liveMode
      && !gameStandby
      && !listening
      && !sending
      && !voiceProcessing
    if (!shouldListen) return
    scheduleLiveListening(60)
    return clearLiveRestart
  }, [settings?.onboardingComplete, settings?.voice.enabled, settings?.voice.liveMode, gameStandby, listening, sending, voiceProcessing])

  function openSettingsPanel(): void {
    const focusTarget = document.activeElement
    settingsFocusReturnRef.current = focusTarget instanceof HTMLElement
      ? focusTarget
      : settingsButtonRef.current
    setSettingsOpen(true)
  }

  function closeSettingsPanel(): void {
    setSettingsOpen(false)
    const previousFocusTarget = settingsFocusReturnRef.current
    settingsFocusReturnRef.current = null
    if (!previousFocusTarget) return
    window.requestAnimationFrame(() => previousFocusTarget.focus())
  }

  async function refreshConversations(selectedId?: string): Promise<void> {
    const summaries = await window.titi.conversations.list()
    setConversations(summaries)
    if (selectedId) {
      const selected = await window.titi.conversations.get(selectedId)
      currentRef.current = selected
      setCurrent(selected)
    }
  }

  async function createConversation(): Promise<void> {
    const conversation = await window.titi.conversations.create()
    currentRef.current = conversation
    setCurrent(conversation)
    await refreshConversations(conversation.id)
  }

  async function selectConversation(id: string): Promise<void> {
    const selected = await window.titi.conversations.get(id)
    currentRef.current = selected
    setCurrent(selected)
  }

  async function removeConversation(id: string): Promise<void> {
    await window.titi.conversations.remove(id)
    const remaining = await window.titi.conversations.list()
    setConversations(remaining)
    if (current?.id === id) {
      const next = remaining[0] ? await window.titi.conversations.get(remaining[0].id) : null
      currentRef.current = next
      setCurrent(next)
    }
  }

  async function sendMessage(value = draft, options: SendMessageOptions = {}): Promise<void> {
    const content = value.trim()
    if (!content || sendingRef.current) return
    if (gameStandbyRef.current) {
      setNotice('O Titi está em standby para preservar os recursos durante o jogo.')
      return
    }
    setDraft('')
    const generation = ++interactionGeneration.current
    const requestId = options.requestId ?? crypto.randomUUID()
    const startedAt = options.startedAt ?? Date.now()
    const {
      baseConversation: explicitBaseConversation,
      skipOptimistic,
      optimisticConversation
    } = options
    const speechController = new AbortController()
    activeRequestId.current = requestId
    activeSpeech.current = speechController
    sendingRef.current = true
    setSending(true)
    setNotice(null)
    let baseConversation = explicitBaseConversation ?? currentRef.current
    try {
      if (!baseConversation) {
        baseConversation = await window.titi.conversations.create()
        if (generation !== interactionGeneration.current) return
        currentRef.current = baseConversation
      }

      if (baseConversation) {
        applyConversationState(
          baseConversation,
          content,
          requestId,
          startedAt,
          skipOptimistic,
          optimisticConversation
        )
      }

      const response = await window.titi.conversations.send({
        requestId,
        conversationId: baseConversation.id,
        content
      })
      if (generation !== interactionGeneration.current) return
      currentRef.current = response.conversation
      setCurrent(response.conversation)
      setRuntime(response.runtime)
      await refreshConversations(response.conversation.id)
      setActivityStartedAt(null)
      const activeSettings = settingsRef.current
      if (activeSettings?.voice.enabled) {
        await speakText(
          response.assistantMessage.content,
          activeSettings.voice.speechRate,
          speechController.signal
        )
      }
    } catch (error) {
      if (generation !== interactionGeneration.current) return
      setActivityStartedAt(null)
      if (baseConversation) {
        try {
          await refreshConversations(baseConversation.id)
        } catch {
          currentRef.current = baseConversation
          setCurrent(baseConversation)
        }
      }
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    } finally {
      if (generation !== interactionGeneration.current) return
      activeRequestId.current = null
      activeSpeech.current = null
      sendingRef.current = false
      setSending(false)
      setActivityStartedAt(null)
    }
  }

  async function saveSettings(patch: Partial<TitiSettings>): Promise<void> {
    const saved = await window.titi.settings.update(patch)
    settingsRef.current = saved
    setSettings(saved)
  }

  async function checkRuntime(): Promise<void> {
    setRuntime(await window.titi.runtime.status())
  }

  async function prepareRuntime(): Promise<void> {
    if (preparingRuntimeRef.current) return
    preparingRuntimeRef.current = true
    setPreparingRuntime(true)
    setNotice('Verificando o ambiente local…')
    try {
      setRuntime(await window.titi.runtime.prepare())
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não consegui preparar a IA local.')
    } finally {
      preparingRuntimeRef.current = false
      setPreparingRuntime(false)
    }
  }

  async function beginListening(autoStop = false): Promise<void> {
    if (gameStandbyRef.current) {
      setNotice('O microfone permanece pausado enquanto o modo jogo está ativo.')
      return
    }
    if (!settingsRef.current?.voice.enabled) {
      setNotice('Ative os recursos de voz nas configurações.')
      return
    }
    if (recorder.current || recordingStarting.current) return
    clearLiveRestart()
    const streamSessionId = crypto.randomUUID()
    activeVoiceStreamId.current = streamSessionId
    voiceChunkQueue.current = Promise.resolve()
    const nextRecorder = new PcmRecorder(
      autoStop
        ? (reason) => reason === 'silence'
          ? void finishListening()
          : cancelSilentListening()
        : undefined,
      settingsRef.current.voice.inputDeviceId,
      (pcmAudio) => {
        voiceChunkQueue.current = voiceChunkQueue.current
          .then(() => window.titi.voice.pushStreamChunk(streamSessionId, pcmAudio))
          .catch(() => undefined)
      },
      () => {
        if (recorder.current !== nextRecorder) return
        recordingGeneration.current += 1
        nextRecorder.cancel()
        recorder.current = null
        recordingStarting.current = false
        cancelVoiceStream()
        setListening(false)
        setVoiceProcessing(false)
        setNotice('O microfone foi desconectado ou perdeu a permissão. Abra Configurações → Voz para escolher outra entrada.')
        void window.titi.mascot.setState('idle')
        if (settingsRef.current?.voice.liveMode) {
          void window.titi.voice.setLiveMode(false).then((latestSettings) => {
            settingsRef.current = latestSettings
            setSettings(latestSettings)
          })
        }
      }
    )
    const generation = ++recordingGeneration.current
    recorder.current = nextRecorder
    recordingStarting.current = true
    stopRequested.current = false
    setNotice(null)
    activeSpeech.current?.abort()
    try {
      setNotice('Preparando reconhecimento contínuo…')
      await window.titi.voice.startStream(streamSessionId)
      await nextRecorder.start()
      if (generation !== recordingGeneration.current || recorder.current !== nextRecorder) {
        nextRecorder.cancel()
        return
      }
      recordingStarting.current = false
      setListening(true)
      void window.titi.mascot.setState('listening')
      if (stopRequested.current) await finishListening()
    } catch (error) {
      if (generation !== recordingGeneration.current) return
      recordingStarting.current = false
      recorder.current = null
      cancelVoiceStream()
      setListening(false)
      setNotice(error instanceof Error ? error.message : 'Não consegui acessar o microfone.')
      void window.titi.mascot.setState('error')
      if (settingsRef.current?.voice.liveMode) void window.titi.voice.setLiveMode(false)
    }
  }

  async function finishListening(): Promise<void> {
    const currentRecorder = recorder.current
    if (!currentRecorder) return
    const generation = recordingGeneration.current
    const streamSessionId = activeVoiceStreamId.current
    recorder.current = null
    setVoiceProcessing(true)
    setListening(false)
    setNotice('Transcrevendo sua fala localmente…')
    void window.titi.mascot.setState('thinking')
    try {
      const audio = await currentRecorder.stop()
      if (generation !== recordingGeneration.current) return
      await voiceChunkQueue.current
      if (generation !== recordingGeneration.current) return
      activeVoiceStreamId.current = null
      let transcription
      try {
        transcription = streamSessionId
          ? await window.titi.voice.finishStream(streamSessionId)
          : await window.titi.voice.transcribe(audio)
      } catch {
        transcription = await window.titi.voice.transcribe(audio)
      }
      if (generation !== recordingGeneration.current) return
      const messageText = transcription.text.trim()
      if (!messageText) {
        setNotice('Não foi possível extrair um texto da gravação.')
        void window.titi.mascot.setState('idle')
        return
      }

      if (
        settingsRef.current?.voice.liveMode
        && resolveLiveVoiceCommand(messageText) === 'stop'
      ) {
        setDraft('')
        setVoiceProcessing(false)
        const saved = await window.titi.voice.setLiveMode(false)
        settingsRef.current = saved
        setSettings(saved)
        setNotice('Conversa ao vivo encerrada por voz.')
        void window.titi.mascot.setState('idle')
        return
      }

      const requestId = crypto.randomUUID()
      const startedAt = Date.now()
      if (!currentRef.current) {
        const created = await window.titi.conversations.create()
        if (generation !== recordingGeneration.current) return
        currentRef.current = created
        setCurrent(created)
      }
      const baseConversation = currentRef.current
      let optimisticConversation: Conversation | undefined
      if (baseConversation) {
        optimisticConversation = applyConversationState(
          baseConversation,
          messageText,
          requestId,
          startedAt,
          true
        )
      }

      if (
        messageText
      ) {
        setDraft(messageText)
        setNotice(`Ouvi: “${messageText}”`)
      }
      await sendMessage(messageText, {
        requestId,
        baseConversation,
        startedAt,
        skipOptimistic: true,
        optimisticConversation
      })
    } catch (error) {
      if (generation !== recordingGeneration.current) return
      setNotice(error instanceof Error ? error.message : 'Não consegui transcrever a gravação.')
      void window.titi.mascot.setState('error')
      if (settingsRef.current?.voice.liveMode) void window.titi.voice.setLiveMode(false)
    } finally {
      if (generation === recordingGeneration.current) setVoiceProcessing(false)
    }
  }

  function endListening(): void {
    if (recordingStarting.current) {
      stopRequested.current = true
      return
    }
    if (listening) void finishListening()
  }

  function cancelSilentListening(): void {
    recorder.current?.cancel()
    recorder.current = null
    cancelVoiceStream()
    setListening(false)
    void window.titi.mascot.setState('idle')
    if (settingsRef.current?.voice.liveMode) {
      setNotice('Continuo ouvindo. Fale quando quiser.')
    } else {
      setNotice('Não ouvi nenhuma fala. Toque no modo ao vivo para tentar novamente.')
    }
  }

  async function toggleLiveMode(): Promise<void> {
    if (!settings) return
    const liveMode = !settings.voice.liveMode
    try {
      const saved = await window.titi.voice.setLiveMode(liveMode)
      settingsRef.current = saved
      setSettings(saved)
      setNotice(liveMode ? 'Modo ao vivo ativado. Fale quando o Titi começar a ouvir.' : null)
      if (liveMode) scheduleLiveListening(0)
      else stopCurrentInteraction('Modo ao vivo encerrado.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não consegui alterar o modo ao vivo.')
    }
  }

  function scheduleLiveListening(delay = 250): void {
    clearLiveRestart()
    liveRestartTimer.current = window.setTimeout(() => {
      liveRestartTimer.current = null
      if (gameStandbyRef.current || !settingsRef.current?.voice.liveMode || sendingRef.current || recorder.current) return
      void beginListening(true)
    }, delay)
  }

  function clearLiveRestart(): void {
    if (liveRestartTimer.current === null) return
    window.clearTimeout(liveRestartTimer.current)
    liveRestartTimer.current = null
  }

  function stopLiveListening(): void {
    clearLiveRestart()
    recordingGeneration.current += 1
    recorder.current?.cancel()
    recorder.current = null
    cancelVoiceStream()
    recordingStarting.current = false
    stopRequested.current = false
    setListening(false)
    voiceProcessingRef.current = false
    setVoiceProcessing(false)
    if (!sendingRef.current) void window.titi.mascot.setState('idle')
  }

  function hasActiveInteraction(): boolean {
    return Boolean(
      recorder.current
      || recordingStarting.current
      || sendingRef.current
      || voiceProcessingRef.current
      || activeRequestId.current
      || activeSpeech.current
      || settingsRef.current?.voice.liveMode
      || preparingRuntimeRef.current
    )
  }

  function stopCurrentInteraction(message = 'Interação interrompida.'): void {
    interactionGeneration.current += 1
    recordingGeneration.current += 1
    clearLiveRestart()
    const inFlightRequest = Boolean(activeRequestId.current && sendingRef.current)
    recorder.current?.cancel()
    recorder.current = null
    cancelVoiceStream()
    recordingStarting.current = false
    stopRequested.current = false
    activeSpeech.current?.abort()
    activeSpeech.current = null
    window.speechSynthesis?.cancel()
    const requestId = activeRequestId.current
    activeRequestId.current = null
    void window.titi.interaction.stop(requestId ?? undefined)
    if (preparingRuntimeRef.current) void window.titi.runtime.cancel()
    preparingRuntimeRef.current = false
    sendingRef.current = false
    voiceProcessingRef.current = false
    setSending(false)
    setActivityStartedAt(null)
    setListening(false)
    setVoiceProcessing(false)
    setNotice(
      inFlightRequest
        ? `${message} Se já estava em execução uma ferramenta com efeito externo, ela pode ter continuado até a confirmação.`
        : message
    )
    void window.titi.mascot.setState('idle')

    if (settingsRef.current?.voice.liveMode) {
      void window.titi.voice.setLiveMode(false).then((saved) => {
        settingsRef.current = saved
        setSettings(saved)
      }).catch(() => undefined)
    }
  }

  function suspendForGame(): void {
    interactionGeneration.current += 1
    recordingGeneration.current += 1
    clearLiveRestart()
    recorder.current?.cancel()
    recorder.current = null
    cancelVoiceStream()
    recordingStarting.current = false
    stopRequested.current = false
    activeSpeech.current?.abort()
    activeSpeech.current = null
    window.speechSynthesis?.cancel()
    const requestId = activeRequestId.current
    activeRequestId.current = null
    void window.titi.interaction.stop(requestId ?? undefined)
    if (preparingRuntimeRef.current) void window.titi.runtime.cancel()
    preparingRuntimeRef.current = false
    sendingRef.current = false
    voiceProcessingRef.current = false
    setSending(false)
    setActivityStartedAt(null)
    setListening(false)
    setVoiceProcessing(false)
    setNotice('Modo jogo ativo. Tarefas e microfone foram pausados; a descarga do modelo foi solicitada.')
  }

  function cancelVoiceStream(): void {
    const sessionId = activeVoiceStreamId.current
    activeVoiceStreamId.current = null
    voiceChunkQueue.current = Promise.resolve()
    if (sessionId) void window.titi.voice.cancelStream(sessionId).catch(() => undefined)
  }

  if (!settings) {
    return <div className="app-loading"><div className="loading-ring" /><span>Preparando o Titi…</span></div>
  }

  return (
    <div className="desktop-app">
      <Sidebar
        collapsed={sidebarCollapsed}
        conversations={conversations}
        selectedId={current?.id}
        settings={settings}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onCreate={createConversation}
        onSelect={selectConversation}
        onRemove={removeConversation}
        settingsButtonRef={settingsButtonRef}
        onOpenSettings={openSettingsPanel}
      />

      <main className="chat-area">
        <header className="titlebar drag-region">
          <div className="conversation-title no-drag">
            <strong>{current?.title ?? 'Nova conversa'}</strong>
            <span className={`connection-pill ${runtime?.connected && !gameStandby ? 'is-connected' : ''}`}>
              <i />{gameStandby ? 'Standby em jogo' : runtime?.connected ? 'Local conectado' : 'Local desconectado'}
            </span>
          </div>
          <WindowControls />
        </header>

        <div className="chat-scroll">
          {current?.messages.length ? (
            <MessageList
              messages={current.messages}
              mascotName={settings.mascotName}
              mascotState={mascotState}
              activityStartedAt={activityStartedAt}
            />
          ) : (
            <EmptyState
              mascotName={settings.mascotName}
              state={mascotState}
              onSuggestion={(value) => {
                setDraft(value)
                void sendMessage(value)
              }}
            />
          )}
        </div>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {listening
            ? 'Gravação em andamento.'
            : voiceProcessing
              ? 'Transcrevendo sua fala.'
              : sending
                ? 'Titi está pensando e executando a tarefa.'
                : 'Pronto para conversar.'}
        </div>
        {notice && <button className="notice" aria-label={`Dispensar aviso: ${notice}`} onClick={() => setNotice(null)}>{notice}<span aria-hidden="true">×</span></button>}
        <Composer
          value={draft}
          sending={sending}
          busy={sending || voiceProcessing || gameStandby}
          listening={listening}
          liveMode={settings.voice.liveMode}
          onChange={setDraft}
          onSend={() => sendMessage()}
          onStop={() => stopCurrentInteraction()}
          onListenStart={() => void beginListening(false)}
          onListenEnd={endListening}
          onListenTimeout={() => {
            setNotice('Tempo de escuta excedido. Fale novamente para reabrir o microfone.')
          }}
          onToggleLive={toggleLiveMode}
        />
      </main>

      {!settings.onboardingComplete && (
        <Onboarding
          settings={settings}
          runtime={runtime}
          preparingRuntime={preparingRuntime}
          onPrepareRuntime={prepareRuntime}
          onComplete={async (mascotName) => {
            await saveSettings({ mascotName, onboardingComplete: true })
            void window.titi.mascot.setState('success')
            window.setTimeout(() => window.titi.mascot.setState('idle'), 1800)
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          runtime={runtime}
          onClose={closeSettingsPanel}
          onSave={saveSettings}
          onCheckRuntime={checkRuntime}
          onPrepareRuntime={prepareRuntime}
          preparingRuntime={preparingRuntime}
        />
      )}

      <GameStandbyDecisionModal />
      <ToolConfirmationModal />
    </div>
  )
}

async function speakText(content: string, rate: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return
  const requestId = crypto.randomUUID()
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null
  let settled = false
  let timeout = 0

  const cleanup = (): void => {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  const abort = (): void => {
    void window.titi.voice.cancelSynthesis(requestId).catch(() => undefined)
    audio?.pause()
    audio = null
    cleanup()
  }
  signal?.addEventListener('abort', abort, { once: true })

  try {
    const synthesis = await window.titi.voice.synthesize(requestId, content, rate)
    if (signal?.aborted) return
    objectUrl = URL.createObjectURL(new Blob([synthesis.wavAudio], { type: 'audio/wav' }))
    audio = new Audio(objectUrl)
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', abortPlayback)
        audio?.pause()
        audio = null
        cleanup()
        void window.titi.mascot.setState('idle')
        error ? reject(error) : resolve()
      }
      const abortPlayback = (): void => finish()
      signal?.addEventListener('abort', abortPlayback, { once: true })
      audio!.onplay = () => void window.titi.mascot.setState('speaking')
      audio!.onended = () => finish()
      audio!.onerror = () => {
        const mediaErrorCode = audio?.error?.code
        finish(new Error(
          mediaErrorCode
            ? `Não consegui reproduzir a voz neural local (código ${mediaErrorCode}).`
            : 'Não consegui reproduzir a voz neural local.'
        ))
      }
      if (signal?.aborted) {
        finish()
        return
      }
      timeout = window.setTimeout(
        () => finish(new Error('A reprodução da resposta excedeu o tempo esperado.')),
        Math.max(15_000, Math.min(300_000, synthesis.audioDurationMs + 10_000))
      )
      void audio!.play().catch(() => finish(new Error('O Windows bloqueou a reprodução da voz local.')))
    })
  } catch (error) {
    if (!signal?.aborted) throw error
  } finally {
    cleanup()
  }
}

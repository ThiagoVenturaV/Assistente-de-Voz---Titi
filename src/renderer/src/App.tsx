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
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { ToolConfirmationModal } from './components/ToolConfirmationModal'
import { WindowControls } from './components/WindowControls'
import { PcmRecorder } from './voice/pcm-recorder'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [preparingRuntime, setPreparingRuntime] = useState(false)
  const recorder = useRef<PcmRecorder | null>(null)
  const recordingStarting = useRef(false)
  const recordingGeneration = useRef(0)
  const stopRequested = useRef(false)
  const liveRestartTimer = useRef<number | null>(null)
  const settingsRef = useRef<TitiSettings | null>(null)
  const currentRef = useRef<Conversation | null>(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      window.titi.settings.get(),
      window.titi.conversations.list(),
      window.titi.runtime.status()
    ]).then(async ([loadedSettings, summaries, loadedRuntime]) => {
      if (!active) return
      settingsRef.current = loadedSettings
      setSettings(loadedSettings)
      setConversations(summaries)
      setRuntime(loadedRuntime)
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
      if (sendingRef.current || settingsRef.current?.voice.liveMode) return
      if (recorder.current || recordingStarting.current) endListening()
      else void beginListening(false)
    })
    return () => {
      active = false
      unsubscribe()
      unsubscribeRuntime()
      unsubscribeLive()
      unsubscribePushToTalk()
      clearLiveRestart()
      recorder.current?.cancel()
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    const shouldListen = settings?.onboardingComplete
      && settings.voice.enabled
      && settings.voice.liveMode
      && !listening
      && !sending
      && !voiceProcessing
    if (!shouldListen) return
    scheduleLiveListening(60)
    return clearLiveRestart
  }, [settings?.onboardingComplete, settings?.voice.enabled, settings?.voice.liveMode, listening, sending, voiceProcessing])

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

  async function sendMessage(value = draft): Promise<void> {
    const content = value.trim()
    if (!content || sendingRef.current) return
    setDraft('')
    sendingRef.current = true
    setSending(true)
    setNotice(null)
    try {
      const response = await window.titi.conversations.send({
        conversationId: currentRef.current?.id,
        content
      })
      currentRef.current = response.conversation
      setCurrent(response.conversation)
      setRuntime(response.runtime)
      await refreshConversations(response.conversation.id)
      const activeSettings = settingsRef.current
      if (activeSettings?.voice.enabled) {
        await speakText(response.assistantMessage.content, activeSettings.voice.speechRate)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    } finally {
      sendingRef.current = false
      setSending(false)
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
    if (preparingRuntime) return
    setPreparingRuntime(true)
    setNotice('Verificando o ambiente local…')
    try {
      setRuntime(await window.titi.runtime.prepare())
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não consegui preparar a IA local.')
    } finally {
      setPreparingRuntime(false)
    }
  }

  async function beginListening(autoStop = false): Promise<void> {
    if (!settingsRef.current?.voice.enabled) {
      setNotice('Ative os recursos de voz nas configurações.')
      return
    }
    if (recorder.current || recordingStarting.current) return
    clearLiveRestart()
    const nextRecorder = new PcmRecorder(
      autoStop
        ? (reason) => reason === 'silence'
          ? void finishListening()
          : cancelSilentListening()
        : undefined
    )
    const generation = ++recordingGeneration.current
    recorder.current = nextRecorder
    recordingStarting.current = true
    stopRequested.current = false
    setNotice(null)
    window.speechSynthesis?.cancel()
    try {
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
      setListening(false)
      setNotice(error instanceof Error ? error.message : 'Não consegui acessar o microfone.')
      void window.titi.mascot.setState('error')
      if (settingsRef.current?.voice.liveMode) void window.titi.voice.setLiveMode(false)
    }
  }

  async function finishListening(): Promise<void> {
    const currentRecorder = recorder.current
    if (!currentRecorder) return
    recorder.current = null
    setVoiceProcessing(true)
    setListening(false)
    setNotice('Transcrevendo sua fala localmente…')
    void window.titi.mascot.setState('thinking')
    try {
      const audio = await currentRecorder.stop()
      const transcription = await window.titi.voice.transcribe(audio)
      setDraft(transcription.text)
      setNotice(`Ouvi: “${transcription.text}”`)
      await sendMessage(transcription.text)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não consegui transcrever a gravação.')
      void window.titi.mascot.setState('error')
      if (settingsRef.current?.voice.liveMode) void window.titi.voice.setLiveMode(false)
    } finally {
      setVoiceProcessing(false)
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
      else stopLiveListening()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não consegui alterar o modo ao vivo.')
    }
  }

  function scheduleLiveListening(delay = 250): void {
    clearLiveRestart()
    liveRestartTimer.current = window.setTimeout(() => {
      liveRestartTimer.current = null
      if (!settingsRef.current?.voice.liveMode || sendingRef.current || recorder.current) return
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
    recordingStarting.current = false
    stopRequested.current = false
    setListening(false)
    if (!sendingRef.current) void window.titi.mascot.setState('idle')
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="chat-area">
        <header className="titlebar drag-region">
          <div className="conversation-title no-drag">
            <strong>{current?.title ?? 'Nova conversa'}</strong>
            <span className={`connection-pill ${runtime?.connected ? 'is-connected' : ''}`}>
              <i />{runtime?.connected ? 'Local conectado' : 'Local desconectado'}
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
              sending={sending}
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

        {notice && <button className="notice" onClick={() => setNotice(null)}>{notice}<span>×</span></button>}
        <Composer
          value={draft}
          sending={sending}
          listening={listening}
          liveMode={settings.voice.liveMode}
          onChange={setDraft}
          onSend={() => sendMessage()}
          onListenStart={() => void beginListening(false)}
          onListenEnd={endListening}
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
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onCheckRuntime={checkRuntime}
          onPrepareRuntime={prepareRuntime}
          preparingRuntime={preparingRuntime}
        />
      )}

      <ToolConfirmationModal />
    </div>
  )
}

function speakText(content: string, rate: number): Promise<void> {
  if (!window.speechSynthesis || !('SpeechSynthesisUtterance' in window)) return Promise.resolve()
  window.speechSynthesis.cancel()
  const text = content
    .replace(/[*_`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim()
  if (!text) return Promise.resolve()

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      void window.titi.mascot.setState('idle')
      resolve()
    }
    const timeout = window.setTimeout(() => {
      window.speechSynthesis.cancel()
      finish()
    }, Math.max(8_000, Math.min(90_000, text.length * 90)))
    utterance.lang = 'pt-BR'
    utterance.rate = rate
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'pt-br')
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('pt'))
      ?? null
    utterance.onstart = () => void window.titi.mascot.setState('speaking')
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  })
}

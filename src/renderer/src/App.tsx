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
  const [mascotState, setMascotState] = useState<MascotState>('idle')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [preparingRuntime, setPreparingRuntime] = useState(false)
  const recorder = useRef<PcmRecorder | null>(null)
  const recordingStarting = useRef(false)
  const stopRequested = useRef(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      window.titi.settings.get(),
      window.titi.conversations.list(),
      window.titi.runtime.status()
    ]).then(async ([loadedSettings, summaries, loadedRuntime]) => {
      if (!active) return
      setSettings(loadedSettings)
      setConversations(summaries)
      setRuntime(loadedRuntime)
      if (summaries[0]) setCurrent(await window.titi.conversations.get(summaries[0].id))
    })
    const unsubscribe = window.titi.mascot.onStateChanged(setMascotState)
    const unsubscribeRuntime = window.titi.runtime.onSetupProgress(
      (progress: RuntimeSetupProgress) => setNotice(progress.message)
    )
    return () => {
      active = false
      unsubscribe()
      unsubscribeRuntime()
      recorder.current?.cancel()
      window.speechSynthesis?.cancel()
    }
  }, [])

  async function refreshConversations(selectedId?: string): Promise<void> {
    const summaries = await window.titi.conversations.list()
    setConversations(summaries)
    if (selectedId) setCurrent(await window.titi.conversations.get(selectedId))
  }

  async function createConversation(): Promise<void> {
    const conversation = await window.titi.conversations.create()
    setCurrent(conversation)
    await refreshConversations(conversation.id)
  }

  async function selectConversation(id: string): Promise<void> {
    setCurrent(await window.titi.conversations.get(id))
  }

  async function removeConversation(id: string): Promise<void> {
    await window.titi.conversations.remove(id)
    const remaining = await window.titi.conversations.list()
    setConversations(remaining)
    if (current?.id === id) {
      setCurrent(remaining[0] ? await window.titi.conversations.get(remaining[0].id) : null)
    }
  }

  async function sendMessage(value = draft): Promise<void> {
    const content = value.trim()
    if (!content || sending) return
    setDraft('')
    setSending(true)
    setNotice(null)
    try {
      const response = await window.titi.conversations.send({
        conversationId: current?.id,
        content
      })
      setCurrent(response.conversation)
      setRuntime(response.runtime)
      await refreshConversations(response.conversation.id)
      if (settings?.voice.enabled) {
        await speakText(response.assistantMessage.content, settings.voice.speechRate)
        if (settings.voice.liveMode) void beginListening(true)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  async function saveSettings(patch: Partial<TitiSettings>): Promise<void> {
    const saved = await window.titi.settings.update(patch)
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
    if (!settings?.voice.enabled) {
      setNotice('Ative os recursos de voz nas configurações.')
      return
    }
    if (recorder.current || recordingStarting.current) return
    const nextRecorder = new PcmRecorder(
      autoStop
        ? (reason) => reason === 'silence'
          ? void finishListening()
          : cancelSilentListening()
        : undefined
    )
    recorder.current = nextRecorder
    recordingStarting.current = true
    stopRequested.current = false
    setNotice(null)
    window.speechSynthesis?.cancel()
    try {
      await nextRecorder.start()
      recordingStarting.current = false
      setListening(true)
      void window.titi.mascot.setState('listening')
      if (stopRequested.current) await finishListening()
    } catch (error) {
      recordingStarting.current = false
      recorder.current = null
      setListening(false)
      setNotice(error instanceof Error ? error.message : 'Não consegui acessar o microfone.')
      void window.titi.mascot.setState('error')
    }
  }

  async function finishListening(): Promise<void> {
    const currentRecorder = recorder.current
    if (!currentRecorder) return
    recorder.current = null
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
    setNotice('Não ouvi nenhuma fala. Toque no modo ao vivo para tentar novamente.')
    void window.titi.mascot.setState('idle')
  }

  async function toggleLiveMode(): Promise<void> {
    if (!settings) return
    const liveMode = !settings.voice.liveMode
    await saveSettings({ voice: { ...settings.voice, liveMode } })
    setNotice(liveMode ? 'Modo ao vivo ativado. Fale quando o Titi começar a ouvir.' : null)
    if (liveMode) {
      void beginListening(true)
    } else if (recorder.current) {
      recorder.current.cancel()
      recorder.current = null
      setListening(false)
      void window.titi.mascot.setState('idle')
    }
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
    utterance.lang = 'pt-BR'
    utterance.rate = rate
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'pt-br')
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('pt'))
      ?? null
    utterance.onstart = () => void window.titi.mascot.setState('speaking')
    utterance.onend = () => {
      void window.titi.mascot.setState('idle')
      resolve()
    }
    utterance.onerror = () => {
      void window.titi.mascot.setState('idle')
      resolve()
    }
    window.speechSynthesis.speak(utterance)
  })
}

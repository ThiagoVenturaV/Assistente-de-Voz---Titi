import { useEffect, useState } from 'react'
import type {
  CuratedMemorySummary,
  RuntimeStatus,
  TitiSettings,
  ToolActionLogEntry
} from '../../../shared/contracts'
import {
  CheckIcon,
  CloseIcon,
  CpuIcon,
  LiveIcon,
  MonitorIcon,
  SettingsIcon,
  ShieldIcon
} from './icons'
import { MicrophoneSettings } from './MicrophoneSettings'

type SettingsSection =
  | 'general'
  | 'intelligence'
  | 'voice'
  | 'privacy'
  | 'memory'
  | 'activity'

interface SettingsPanelProps {
  settings: TitiSettings
  runtime: RuntimeStatus | null
  onClose(): void
  onSave(patch: Partial<TitiSettings>): Promise<void>
  onCheckRuntime(): Promise<void>
  onPrepareRuntime(): Promise<void>
  preparingRuntime: boolean
}

const sections: Array<{
  id: SettingsSection
  label: string
  icon: typeof SettingsIcon
}> = [
  { id: 'general', label: 'Geral', icon: SettingsIcon },
  { id: 'intelligence', label: 'Inteligência local', icon: CpuIcon },
  { id: 'voice', label: 'Voz', icon: LiveIcon },
  { id: 'privacy', label: 'Privacidade', icon: ShieldIcon },
  { id: 'memory', label: 'Memória', icon: CpuIcon },
  { id: 'activity', label: 'Atividade', icon: MonitorIcon }
]

export function SettingsPanel({
  settings,
  runtime,
  onClose,
  onSave,
  onCheckRuntime,
  onPrepareRuntime,
  preparingRuntime
}: SettingsPanelProps): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>('general')
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [clearHistoryOnSave, setClearHistoryOnSave] = useState(false)
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null)
  const [activity, setActivity] = useState<ToolActionLogEntry[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [memory, setMemory] = useState<CuratedMemorySummary[]>([])
  const [loadingMemory, setLoadingMemory] = useState(false)
  const [gameExecutables, setGameExecutables] = useState(
    settings.games.executables.join(', ')
  )

  useEffect(() => {
    setDraft(settings)
    setGameExecutables(settings.games.executables.join(', '))
  }, [settings])
  useEffect(() => {
    if (section !== 'activity') return
    setLoadingActivity(true)
    void window.titi.activity.list()
      .then(setActivity)
      .finally(() => setLoadingActivity(false))
  }, [section])
  useEffect(() => {
    if (section !== 'memory') return
    setLoadingMemory(true)
    void window.titi.memory.list()
      .then(setMemory)
      .finally(() => setLoadingMemory(false))
  }, [section])

  async function save(): Promise<void> {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        ...draft,
        games: {
          ...draft.games,
          executables: parseExecutableList(gameExecutables)
        }
      })
      if (clearHistoryOnSave) await window.titi.conversations.clear()
      onClose()
      if (clearHistoryOnSave) window.location.reload()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Configurações">
        <aside className="settings-nav">
          <h2>Configurações</h2>
          {sections.map(({ id, label, icon: Icon }) => (
            <button className={section === id ? 'is-active' : ''} key={id} onClick={() => setSection(id)}>
              <Icon /><span>{label}</span>
            </button>
          ))}
        </aside>

        <div className="settings-content">
          <header>
            <div>
              <p className="eyebrow">TITI DESKTOP</p>
              <h2>{sections.find((item) => item.id === section)?.label}</h2>
            </div>
            <button className="icon-button" title="Fechar" onClick={onClose}><CloseIcon /></button>
          </header>

          <div className="settings-scroll">
            {section === 'general' && (
              <>
                <SettingsGroup title="Identidade" description="Personalize como seu assistente aparece.">
                  <Field label="Nome do mascote" hint="Usado nas conversas e apresentações por voz.">
                    <input
                      value={draft.mascotName}
                      maxLength={24}
                      onChange={(event) => setDraft({ ...draft, mascotName: event.target.value })}
                    />
                  </Field>
                </SettingsGroup>
                <SettingsGroup title="Aplicativo" description="Comportamento do Titi no Windows.">
                  <Toggle
                    label="Mostrar mascote flutuante"
                    description="Mantém o Titi visível acima de outros aplicativos."
                    checked={draft.showFloatingMascot}
                    onChange={(showFloatingMascot) => setDraft({ ...draft, showFloatingMascot })}
                  />
                  <Toggle
                    label="Iniciar junto com o Windows"
                    description="Abre o Titi automaticamente após entrar na sua conta."
                    checked={draft.launchAtStartup}
                    onChange={(launchAtStartup) => setDraft({ ...draft, launchAtStartup })}
                  />
                  <Toggle
                    label="Permitir controle da interface"
                    description="Permite operar controles acessíveis e usar visão local no Play/Pause do Spotify. Na beta, só o Antigravity pede confirmação."
                    checked={draft.computerControlEnabled}
                    onChange={(computerControlEnabled) => setDraft({ ...draft, computerControlEnabled })}
                  />
                </SettingsGroup>
                <SettingsGroup title="Modo jogo" description="Pausa voz, modelo e tarefas enquanto um jogo reconhecido está em primeiro plano.">
                  <Toggle
                    label="Ativar standby durante jogos"
                    description="Jogos conhecidos já vêm incluídos; você pode acrescentar executáveis abaixo."
                    checked={draft.games.standbyEnabled}
                    onChange={(standbyEnabled) => setDraft({
                      ...draft,
                      games: { ...draft.games, standbyEnabled }
                    })}
                  />
                  <Field
                    label="Executáveis adicionais"
                    hint="Separe por vírgulas. Informe apenas nomes, como MeuJogo.exe; caminhos e comandos são bloqueados."
                  >
                    <input
                      value={gameExecutables}
                      spellCheck={false}
                      placeholder="MeuJogo.exe, OutroJogo.exe"
                      onChange={(event) => setGameExecutables(event.target.value)}
                    />
                  </Field>
                </SettingsGroup>
              </>
            )}

            {section === 'intelligence' && (
              <>
                <div className={`runtime-card ${runtime?.setupAction === 'ready' ? 'is-connected' : ''}`}>
                  <span className="runtime-icon"><CpuIcon /></span>
                  <div>
                    <strong>{runtimeTitle(runtime)}</strong>
                    <p>{runtimeDescription(runtime)}</p>
                  </div>
                  <button
                    disabled={preparingRuntime}
                    onClick={runtime?.setupAction === 'ready' ? onCheckRuntime : onPrepareRuntime}
                  >
                    {preparingRuntime ? 'Preparando…' : runtimeActionLabel(runtime)}
                  </button>
                </div>
                <SettingsGroup title="Ollama" description="O modelo roda no seu computador e as conversas não precisam sair dele.">
                  <Field label="Endereço local">
                    <input
                      value={draft.provider.endpoint}
                      spellCheck={false}
                      onChange={(event) => setDraft({
                        ...draft,
                        provider: { ...draft.provider, endpoint: event.target.value }
                      })}
                    />
                  </Field>
                  <Field label="Modelo" hint="Recomendação inicial para sua RTX 2060 Super de 8 GB.">
                    {runtime?.availableModels.length ? (
                      <select
                        value={draft.provider.model}
                        onChange={(event) => setDraft({
                          ...draft,
                          provider: { ...draft.provider, model: event.target.value }
                        })}
                      >
                        {!runtime.availableModels.includes(draft.provider.model) && <option>{draft.provider.model}</option>}
                        {runtime.availableModels.map((model) => <option key={model}>{model}</option>)}
                      </select>
                    ) : (
                      <input
                        value={draft.provider.model}
                        spellCheck={false}
                        onChange={(event) => setDraft({
                          ...draft,
                          provider: { ...draft.provider, model: event.target.value }
                        })}
                      />
                    )}
                  </Field>
                </SettingsGroup>
                <div className="future-note"><MonitorIcon /><div><strong>Outros provedores no futuro</strong><p>OpenAI conectada, chaves de API, llama.cpp e LM Studio entrarão pelo mesmo harness.</p></div></div>
              </>
            )}

            {section === 'voice' && (
              <SettingsGroup title="Conversa por voz" description="Fale naturalmente com o Titi sem depender da nuvem.">
                <Toggle
                  label="Ativar recursos de voz"
                  description="Permite captura pelo microfone e resposta falada."
                  checked={draft.voice.enabled}
                  onChange={(enabled) => setDraft({ ...draft, voice: { ...draft.voice, enabled } })}
                />
                <Toggle
                  label="Conversa ao vivo"
                  description="Continua ouvindo entre as respostas, até você encerrar."
                  checked={draft.voice.liveMode}
                  onChange={(liveMode) => setDraft({ ...draft, voice: { ...draft.voice, liveMode } })}
                />
                <MicrophoneSettings
                  deviceId={draft.voice.inputDeviceId}
                  disabled={!draft.voice.enabled}
                  onChange={(inputDeviceId) => setDraft({
                    ...draft,
                    voice: { ...draft.voice, inputDeviceId }
                  })}
                />
                <Field label="Atalho para falar" hint="Pressione uma vez para começar e outra para enviar. Use Ctrl, Alt ou Shift.">
                  <input
                    value={draft.voice.pushToTalkShortcut}
                    onChange={(event) => setDraft({
                      ...draft,
                      voice: { ...draft.voice, pushToTalkShortcut: event.target.value }
                    })}
                  />
                </Field>
                <Field label={`Velocidade da fala: ${draft.voice.speechRate.toFixed(1)}×`}>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.1"
                    value={draft.voice.speechRate}
                    onChange={(event) => setDraft({
                      ...draft,
                      voice: { ...draft.voice, speechRate: Number(event.target.value) }
                    })}
                  />
                </Field>
              </SettingsGroup>
            )}

            {section === 'privacy' && (
              <SettingsGroup title="Controle e dados" description="Você decide o que o Titi pode guardar e executar.">
                <Toggle
                  label="Guardar histórico local"
                  description="Mantém suas conversas somente neste computador."
                  checked={draft.keepHistory}
                  onChange={(keepHistory) => {
                    setDraft({ ...draft, keepHistory })
                    if (!keepHistory && settings.keepHistory) {
                      setClearHistoryOnSave(window.confirm(
                        'Além de tornar as próximas conversas privadas, deseja apagar as conversas já salvas?\n\nOK: apagar ao salvar. Cancelar: manter as antigas.'
                      ))
                    } else if (keepHistory) {
                      setClearHistoryOnSave(false)
                    }
                  }}
                />
                <div className="privacy-actions">
                  <button
                    className="secondary-button"
                    onClick={() => void window.titi.conversations.export().then((path) => {
                      if (path) setPrivacyNotice(`Cópia exportada para ${path}`)
                    })}
                  >Exportar conversas</button>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => {
                      if (!window.confirm('Apagar todas as conversas locais? Esta ação não pode ser desfeita.')) return
                      void window.titi.conversations.clear().then(() => window.location.reload())
                    }}
                  >Apagar conversas</button>
                </div>
                {clearHistoryOnSave && <p className="privacy-choice">As conversas antigas serão apagadas quando você salvar.</p>}
                {privacyNotice && <p className="privacy-choice">{privacyNotice}</p>}
                <div className="privacy-banner"><ShieldIcon /><div><strong>Confirmação simplificada durante a beta</strong><p>Os comandos executam direto; abrir ou controlar o Antigravity continua pedindo sua permissão.</p></div></div>
                <div className="privacy-banner"><ShieldIcon /><div><strong>Local por padrão</strong><p>Configurações e conversas são gravadas na pasta privada do aplicativo no Windows.</p></div></div>
              </SettingsGroup>
            )}

            {section === 'memory' && (
              <SettingsGroup
                title="O que o Titi lembra"
                description="Resumo local separado das conversas completas."
              >
                <div className="memory-explanation">
                  <ShieldIcon />
                  <div>
                    <strong>Memória não é o histórico</strong>
                    <p>
                      O histórico guarda conversas. A memória guarda somente fatos e
                      preferências pedidos por você e receitas já verificadas.
                      Com o histórico desligado, o agente não consulta nem aprende memórias.
                    </p>
                  </div>
                </div>
                <div className="activity-toolbar">
                  <span>{memory.length} {memory.length === 1 ? 'item lembrado' : 'itens lembrados'}</span>
                  <button
                    className="secondary-button"
                    disabled={!memory.length}
                    onClick={() => {
                      if (!window.confirm('Apagar toda a memória local curada do Titi?')) return
                      void window.titi.memory.clear().then(() => setMemory([]))
                    }}
                  >Apagar tudo</button>
                </div>
                <div className="memory-list">
                  {loadingMemory ? (
                    <p className="activity-empty">Carregando memória…</p>
                  ) : memory.length ? memory.map((entry) => (
                    <article key={entry.id}>
                      <div>
                        <span>{memoryKindLabel(entry.kind)}</span>
                        <strong>{entry.title}</strong>
                        <p>{entry.value}</p>
                        <small>{entry.source} · {formatActionTime(entry.updatedAt)}</small>
                      </div>
                      <button
                        className="memory-remove"
                        title={`Esquecer ${entry.title}`}
                        aria-label={`Esquecer ${entry.title}`}
                        onClick={() => void window.titi.memory.remove(entry.id).then((removed) => {
                          if (removed) setMemory((current) => current.filter((item) => item.id !== entry.id))
                        })}
                      ><CloseIcon /></button>
                    </article>
                  )) : (
                    <p className="activity-empty">
                      Nenhuma memória curada. Diga, por exemplo: “lembre que meu navegador preferido é o Brave”.
                    </p>
                  )}
                </div>
              </SettingsGroup>
            )}

            {section === 'activity' && (
              <SettingsGroup title="Ações no computador" description="Registro local das ferramentas usadas pelo Titi.">
                <div className="activity-toolbar">
                  <span>{activity.length} {activity.length === 1 ? 'ação registrada' : 'ações registradas'}</span>
                  <button
                    className="secondary-button"
                    disabled={!activity.length}
                    onClick={() => {
                      if (!window.confirm('Apagar todo o histórico local de ações do Titi?')) return
                      void window.titi.activity.clear().then(() => setActivity([]))
                    }}
                  >Limpar histórico</button>
                </div>
                <div className="activity-list">
                  {loadingActivity ? <p className="activity-empty">Carregando atividade…</p> : activity.length ? activity.map((entry) => (
                    <article className={activityClass(entry)} key={entry.id}>
                      <i />
                      <div><strong>{toolLabel(entry.tool)}</strong><p>{entry.message}</p><small>{activityLabels(entry).join(' · ')}</small></div>
                      <time dateTime={entry.createdAt}>{formatActionTime(entry.createdAt)}</time>
                    </article>
                  )) : <p className="activity-empty">O Titi ainda não executou nenhuma ferramenta.</p>}
                </div>
              </SettingsGroup>
            )}
          </div>

          <footer>
            {saveError && <p className="settings-save-error" role="alert">{saveError}</p>}
            <button className="secondary-button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" disabled={saving || !draft.mascotName.trim()} onClick={save}>
              <CheckIcon />{saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}

function runtimeTitle(runtime: RuntimeStatus | null): string {
  if (runtime?.setupAction === 'ready') return 'IA local pronta'
  if (runtime?.setupAction === 'download-model') return 'Modelo necessário'
  if (runtime?.setupAction === 'start-engine') return 'Ollama está parado'
  if (runtime?.setupAction === 'install-engine') return 'Ollama necessário'
  return 'Verificando a IA local'
}

function runtimeDescription(runtime: RuntimeStatus | null): string {
  if (!runtime) return 'Ainda não verificado.'
  if (runtime.setupAction === 'install-engine') return 'Instale o mecanismo oficial para usar modelos locais.'
  if (runtime.setupAction === 'start-engine') return 'O Titi pode iniciar o serviço local para você.'
  if (runtime.setupAction === 'download-model') return `${runtime.model} ainda não está baixado neste computador.`
  return runtime.message
}

function runtimeActionLabel(runtime: RuntimeStatus | null): string {
  if (runtime?.setupAction === 'install-engine') return 'Instalar'
  if (runtime?.setupAction === 'start-engine') return 'Iniciar'
  if (runtime?.setupAction === 'download-model') return 'Baixar modelo'
  return 'Verificar'
}

function SettingsGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="settings-group"><header><h3>{title}</h3><p>{description}</p></header><div className="settings-group-body">{children}</div></section>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return <label className="field"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>{children}</label>
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange(value: boolean): void }): React.JSX.Element {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>
}

function toolLabel(tool: string): string {
  return ({
    open_application: 'Abrir aplicativo',
    open_web: 'Abrir página ou pesquisa',
    spotify: 'Controlar música',
    computer_observe: 'Observar interface',
    computer_action: 'Acionar controle da interface',
    current_datetime: 'Consultar data e hora'
  } as Record<string, string>)[tool] ?? tool.replaceAll('_', ' ')
}

function formatActionTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function confirmationLabel(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null
  const status = (details as { confirmationStatus?: unknown }).confirmationStatus
  return ({
    approved: 'Permitida por você',
    denied: 'Não permitida por você',
    expired: 'Confirmação expirada',
    blocked: 'Bloqueada pela política de segurança'
  } as Record<string, string>)[String(status)] ?? null
}

function activityClass(entry: ToolActionLogEntry): string {
  if (entry.status === 'dispatched') return 'is-pending'
  if (entry.status === 'cancelled') return 'is-cancelled'
  return entry.ok ? 'is-success' : 'is-error'
}

function activityLabels(entry: ToolActionLogEntry): string[] {
  const status = ({
    confirmed: 'Efeito confirmado',
    dispatched: 'Pedido enviado; efeito não confirmado',
    failed: 'Falha',
    cancelled: 'Cancelada',
    timed_out: 'Tempo limite excedido'
  } as Record<string, string>)[String(entry.status)] ?? (entry.ok ? 'Concluída' : 'Falha')
  return [status, confirmationLabel(entry.details)].filter(
    (label): label is string => Boolean(label)
  )
}

function memoryKindLabel(kind: CuratedMemorySummary['kind']): string {
  return ({
    fact: 'Fato',
    preference: 'Preferência',
    recipe: 'Receita verificada'
  })[kind]
}

function parseExecutableList(value: string): string[] {
  return [...new Map(
    value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => [item.toLocaleLowerCase(), item])
  ).values()]
}

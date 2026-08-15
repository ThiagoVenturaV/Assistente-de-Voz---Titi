import { useEffect, useState } from 'react'
import type { RuntimeStatus, TitiSettings } from '../../../shared/contracts'
import {
  CheckIcon,
  CloseIcon,
  CpuIcon,
  LiveIcon,
  MonitorIcon,
  SettingsIcon,
  ShieldIcon
} from './icons'

type SettingsSection = 'general' | 'intelligence' | 'voice' | 'privacy'

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
  { id: 'privacy', label: 'Privacidade', icon: ShieldIcon }
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

  useEffect(() => setDraft(settings), [settings])

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
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
                <Field label="Atalho para falar" hint="O atalho global será conectado ao mecanismo local de voz.">
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
                  onChange={(keepHistory) => setDraft({ ...draft, keepHistory })}
                />
                <Toggle
                  label="Confirmar ações sensíveis"
                  description="Sempre pede permissão antes de enviar, apagar, comprar ou alterar algo importante."
                  checked={draft.confirmSensitiveActions}
                  onChange={(confirmSensitiveActions) => setDraft({ ...draft, confirmSensitiveActions })}
                />
                <div className="privacy-banner"><ShieldIcon /><div><strong>Local por padrão</strong><p>Configurações e conversas são gravadas na pasta privada do aplicativo no Windows.</p></div></div>
              </SettingsGroup>
            )}
          </div>

          <footer>
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

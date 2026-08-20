import { useState } from 'react'
import type { RuntimeStatus, TitiSettings } from '../../../shared/contracts'
import { localModelDownloadLabel } from '../../../shared/model-catalog'
import { TitiSprite } from './TitiSprite'
import { CheckIcon, CpuIcon, ShieldIcon, SparklesIcon } from './icons'
import { PUBLIC_PRIVACY_URL } from '../product-links'

interface OnboardingProps {
  settings: TitiSettings
  runtime: RuntimeStatus | null
  preparingRuntime: boolean
  onPrepareRuntime(): Promise<void>
  onComplete(name: string): Promise<void>
}

export function Onboarding({
  settings,
  runtime,
  preparingRuntime,
  onPrepareRuntime,
  onComplete
}: OnboardingProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.mascotName)
  const [finishing, setFinishing] = useState(false)
  const runtimeReady = runtime?.setupAction === 'ready'

  async function finish(): Promise<void> {
    setFinishing(true)
    try {
      await onComplete(name.trim())
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-aurora" />
      <div className="onboarding-card">
        <div className="onboarding-progress"><i className="is-active" /><i className={step >= 1 ? 'is-active' : ''} /></div>
        {step === 0 ? (
          <>
            <div className="onboarding-mascot"><TitiSprite size={150} state="speaking" label={name || 'Titi'} /></div>
            <p className="eyebrow">SEU NOVO COMPANHEIRO DIGITAL</p>
            <h1>Como você quer chamar seu mascote?</h1>
            <p>Esse nome aparece nas conversas, na voz e no pequeno mascote flutuante.</p>
            <input
              className="name-input"
              autoFocus
              maxLength={24}
              value={name}
              placeholder="Titi"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && name.trim() && setStep(1)}
            />
            <button className="primary-button onboarding-next" disabled={!name.trim()} onClick={() => setStep(1)}>
              Conhecer {name.trim() || 'meu assistente'}
            </button>
          </>
        ) : (
          <>
            <div className="onboarding-icon"><SparklesIcon /></div>
            <p className="eyebrow">PRONTO PARA COMEÇAR</p>
            <h1>{name}, no seu computador e sob seu controle.</h1>
            <p>Começamos de forma local. Você poderá trocar o modelo e conectar novas ferramentas nas configurações.</p>
            <div className="onboarding-features">
              <div className={runtimeReady ? '' : 'needs-setup'}>
                <CpuIcon />
                <span><strong>IA local</strong><small>{onboardingRuntimeText(runtime)}</small></span>
                {runtimeReady && <CheckIcon />}
              </div>
              <div><ShieldIcon /><span><strong>Privacidade</strong><small>Histórico salvo neste PC</small></span><CheckIcon /></div>
            </div>
            {runtimeReady ? (
              <button className="primary-button onboarding-next" disabled={finishing} onClick={finish}>
                {finishing ? 'Preparando…' : 'Entrar no Titi'}
              </button>
            ) : (
              <>
                <button className="primary-button onboarding-next" disabled={preparingRuntime} onClick={onPrepareRuntime}>
                  {preparingRuntime ? 'Preparando IA local…' : 'Preparar IA local'}
                </button>
                <button className="text-button" disabled={finishing} onClick={finish}>Configurar depois</button>
              </>
            )}
            <button className="text-button" onClick={() => setStep(0)}>Voltar</button>
            <a className="text-button onboarding-policy" href={PUBLIC_PRIVACY_URL} target="_blank" rel="noreferrer">Como o Titi trata seus dados</a>
          </>
        )}
      </div>
    </div>
  )
}

function onboardingRuntimeText(runtime: RuntimeStatus | null): string {
  if (runtime?.setupAction === 'ready') return `${runtime.model} pronto para usar`
  if (runtime?.setupAction === 'download-model') {
    return `${runtime.model} precisa ser baixado (${localModelDownloadLabel(runtime.model)})`
  }
  if (runtime?.setupAction === 'start-engine') return 'Ollama instalado; serviço será iniciado'
  if (runtime?.setupAction === 'install-engine') return 'Ollama e o modelo precisam ser instalados'
  return 'Verificando este computador…'
}

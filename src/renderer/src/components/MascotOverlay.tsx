import { useEffect, useState } from 'react'
import type { MascotState, TitiSettings } from '../../../shared/contracts'
import { TitiSprite } from './TitiSprite'
import { CloseIcon, LiveIcon, MessageIcon } from './icons'

const stateLabels: Record<MascotState, string> = {
  idle: 'Pronto quando você estiver',
  listening: 'Estou ouvindo…',
  thinking: 'Pensando…',
  speaking: 'Respondendo…',
  success: 'Tudo certo!',
  error: 'Algo não saiu como esperado',
  standby: 'Em standby',
  review: 'Revisando…'
}

export function MascotOverlay(): React.JSX.Element {
  const [state, setState] = useState<MascotState>('idle')
  const [settings, setSettings] = useState<TitiSettings | null>(null)

  useEffect(() => {
    void window.titi.settings.get().then(setSettings)
    return window.titi.mascot.onStateChanged(setState)
  }, [])

  const name = settings?.mascotName ?? 'Titi'

  return (
    <main className={`mascot-overlay mascot-overlay--${state}`}>
      <div className="mascot-drag-zone drag-region">
        <button className="overlay-close no-drag" title="Ocultar mascote" onClick={() => window.titi.mascot.hide()}><CloseIcon /></button>
        <button className="mascot-open no-drag" title={`Abrir ${name}`} onClick={() => window.titi.mascot.openApp()}>
          <span className="mascot-halo" />
          <TitiSprite state={state} size={148} label={name} />
        </button>
      </div>
      <div className="mascot-controls no-drag">
        <button className="mascot-status" onClick={() => window.titi.mascot.openApp()}>
          <span className={`status-pulse status-pulse--${state}`} />
          <span><strong>{name}</strong><small>{stateLabels[state]}</small></span>
          <MessageIcon />
        </button>
        <button
          className={`mascot-live ${state === 'listening' ? 'is-active' : ''}`}
          title="Iniciar conversa ao vivo"
          aria-label="Iniciar conversa ao vivo"
          disabled={state === 'thinking' || state === 'speaking'}
          onClick={() => window.titi.voice.startLiveConversation()}
        >
          <LiveIcon />
          <span>{state === 'listening' ? 'Ouvindo' : 'Ao vivo'}</span>
        </button>
      </div>
    </main>
  )
}

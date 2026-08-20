import { useEffect, useMemo, useState } from 'react'
import type {
  GameStandbyDecision,
  GameStandbyRequest
} from '../../../shared/contracts'
import { MonitorIcon } from './icons'

export function GameStandbyDecisionModal(): React.JSX.Element | null {
  const [requests, setRequests] = useState<GameStandbyRequest[]>([])
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const request = requests[0]

  useEffect(() => {
    const unsubscribeRequested = window.titi.game.onStandbyRequested((incoming) => {
      setRequests((current) => current.some(({ id }) => id === incoming.id)
        ? current
        : [...current, incoming])
    })
    return () => unsubscribeRequested()
  }, [])

  useEffect(() => {
    if (!request) return
    const interval = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [request])

  useEffect(() => {
    if (!request) return
    const secondsRemaining = Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - clock) / 1_000))
    if (secondsRemaining > 0) return
    setRequests((current) => current.filter(({ id }) => id !== request.id))
    setRespondingId((current) => current === request.id ? null : current)
  }, [clock, request])

  useEffect(() => {
    if (!request) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void respond('defer')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [request, respondingId])

  const secondsRemaining = useMemo(() => request
    ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - clock) / 1_000))
    : 0, [clock, request])

  async function respond(decision: GameStandbyDecision): Promise<void> {
    if (!request || respondingId) return
    setRespondingId(request.id)
    try {
      await window.titi.game.respondToStandbyDecision({
        requestId: request.id,
        decision
      })
    } finally {
      setRequests((current) => current.filter(({ id }) => id !== request.id))
      setRespondingId(null)
    }
  }

  if (!request) return null
  const responding = respondingId === request.id
  const gameName = request.executable || 'Aplicativo em tela'

  return (
    <div className="game-standby-backdrop" role="presentation">
      <section
        className="game-standby-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-standby-title"
      >
        <div className="game-standby-icon"><MonitorIcon /></div>
        <div className="game-standby-copy">
          <p className="eyebrow">Modo jogo detectado</p>
          <h2 id="game-standby-title">Entrar em modo standby no jogo?</h2>
          <p>
            O app <strong>{gameName}</strong> está em primeiro plano.
            Detectamos recursos de jogo e o Titi pode pausar ações até você voltar ao desktop.
          </p>
        </div>
        <p className="tool-confirmation-expiry" aria-live="polite">
          Sem resposta, entra automaticamente em {secondsRemaining}s.
        </p>
        <ul className="game-standby-actions">
          <li>Completar o que está em andamento antes de entrar em standby</li>
          <li>Interromper tudo imediatamente e entrar em standby</li>
          <li>Manter ativo por agora</li>
        </ul>
        <footer>
          <span className="game-standby-queue">{requests.length > 1 ? `${requests.length - 1} pendente` : ' '}</span>
          <div>
            <button
              autoFocus
              className="secondary-button"
              disabled={responding}
              onClick={() => void respond('complete')}
            >
              Concluir e pausar
            </button>
            <button
              className="secondary-button"
              disabled={responding}
              onClick={() => void respond('cancel')}
            >
              Interromper agora
            </button>
            <button
              className="primary-button"
              disabled={responding}
              onClick={() => void respond('defer')}
            >
              Deixar ativo
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

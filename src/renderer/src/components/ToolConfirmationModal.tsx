import { useEffect, useMemo, useState } from 'react'
import type { ToolConfirmationRequest } from '../../../shared/contracts'
import { ShieldIcon } from './icons'

export function ToolConfirmationModal(): React.JSX.Element | null {
  const [requests, setRequests] = useState<ToolConfirmationRequest[]>([])
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const request = requests[0]

  useEffect(() => {
    const unsubscribeRequest = window.titi.tools.onConfirmationRequested((incoming) => {
      setRequests((current) => current.some(({ id }) => id === incoming.id)
        ? current
        : [...current, incoming])
    })
    const unsubscribeDismiss = window.titi.tools.onConfirmationDismissed((requestId) => {
      setRequests((current) => current.filter(({ id }) => id !== requestId))
      setRespondingId((current) => current === requestId ? null : current)
    })
    return () => {
      unsubscribeRequest()
      unsubscribeDismiss()
    }
  }, [])

  useEffect(() => {
    if (!request) return
    const remaining = Math.max(0, new Date(request.expiresAt).getTime() - Date.now())
    const expiry = window.setTimeout(() => {
      setRequests((current) => current.filter(({ id }) => id !== request.id))
    }, remaining)
    const ticker = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => {
      window.clearTimeout(expiry)
      window.clearInterval(ticker)
    }
  }, [request])

  useEffect(() => {
    if (!request) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void respond(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [request, respondingId])

  const secondsRemaining = useMemo(() => request
    ? Math.max(0, Math.ceil((new Date(request.expiresAt).getTime() - clock) / 1_000))
    : 0, [clock, request])

  async function respond(approved: boolean): Promise<void> {
    if (!request || respondingId) return
    setRespondingId(request.id)
    try {
      await window.titi.tools.respondToConfirmation({
        requestId: request.id,
        approved
      })
    } finally {
      setRequests((current) => current.filter(({ id }) => id !== request.id))
      setRespondingId(null)
    }
  }

  if (!request) return null
  const responding = respondingId === request.id

  return (
    <div className="tool-confirmation-backdrop" role="presentation">
      <section
        className="tool-confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tool-confirmation-title"
        aria-describedby="tool-confirmation-description"
      >
        <div className="tool-confirmation-icon"><ShieldIcon /></div>
        <div className="tool-confirmation-copy">
          <p className="eyebrow">Sua confirmação é necessária</p>
          <h2 id="tool-confirmation-title">{request.title}</h2>
          <p id="tool-confirmation-description">{request.description}</p>
        </div>

        <ul className="tool-confirmation-effects">
          {request.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}
        </ul>

        <p className="tool-confirmation-expiry" aria-live="polite">
          Sem resposta, esta solicitação expira em {secondsRemaining}s e nada será executado.
        </p>

        <footer>
          {requests.length > 1 && <span>{requests.length - 1} solicitação pendente</span>}
          <div>
            <button
              autoFocus
              className="secondary-button"
              disabled={responding}
              onClick={() => void respond(false)}
            >
              Não permitir
            </button>
            <button
              className="primary-button"
              disabled={responding}
              onClick={() => void respond(true)}
            >
              Permitir uma vez
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

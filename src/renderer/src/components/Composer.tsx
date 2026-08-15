import { useRef } from 'react'
import { LiveIcon, MicIcon, SendIcon, StopIcon } from './icons'

interface ComposerProps {
  value: string
  sending: boolean
  busy: boolean
  listening: boolean
  liveMode: boolean
  onChange(value: string): void
  onSend(): void
  onStop(): void
  onListenStart(): void
  onListenEnd(): void
  onToggleLive(): void
}

export function Composer({
  value,
  sending,
  busy,
  listening,
  liveMode,
  onChange,
  onSend,
  onStop,
  onListenStart,
  onListenEnd,
  onToggleLive
}: ComposerProps): React.JSX.Element {
  const textarea = useRef<HTMLTextAreaElement>(null)

  function handleChange(next: string): void {
    onChange(next)
    if (textarea.current) {
      textarea.current.style.height = 'auto'
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 150)}px`
    }
  }

  return (
    <div className="composer-shell">
      <div className={`composer ${listening ? 'is-listening' : ''}`}>
        <textarea
          ref={textarea}
          value={value}
          rows={1}
          placeholder="Converse com o Titi…"
          aria-label="Mensagem"
          disabled={busy}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSend()
            }
          }}
        />
        <div className="composer-toolbar">
          <div className="composer-modes">
            <button
              className={`composer-control ${listening ? 'is-active' : ''}`}
              title="Segure para falar"
              disabled={busy}
              onPointerDown={onListenStart}
              onPointerUp={onListenEnd}
              onPointerLeave={() => listening && onListenEnd()}
            >
              <MicIcon />
              <span>{listening ? 'Ouvindo…' : 'Aperte para falar'}</span>
            </button>
            <button
              className={`composer-control composer-control--compact ${liveMode ? 'is-active' : ''}`}
              title="Conversa ao vivo"
              onClick={onToggleLive}
            >
              <LiveIcon />
            </button>
          </div>
          {busy ? (
            <button
              className="send-button stop-button"
              title="Parar interação (Esc)"
              aria-label="Parar interação"
              onClick={onStop}
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className="send-button"
              title="Enviar mensagem"
              disabled={!value.trim() || sending}
              onClick={onSend}
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
      <small className="composer-hint">O Titi pode cometer erros. Pressione Esc para interromper a interação atual.</small>
    </div>
  )
}

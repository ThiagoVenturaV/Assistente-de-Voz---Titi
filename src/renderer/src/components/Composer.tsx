import { useEffect, useRef } from 'react'
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
  onListenTimeout(): void
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
  onListenTimeout,
  onToggleLive
}: ComposerProps): React.JSX.Element {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const keyboardPushToTalk = useRef(false)
  const microphoneButtonRef = useRef<HTMLButtonElement>(null)
  const activePointerId = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)

  function handleChange(next: string): void {
    onChange(next)
    if (textarea.current) {
      textarea.current.style.height = 'auto'
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 150)}px`
    }
  }

  const clearHoldTimer = (): void => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const finishHold = (): void => {
    clearHoldTimer()
    onListenEnd()
  }

  const beginHold = (): void => {
    if (busy) return
    clearHoldTimer()
    onListenStart()
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      onListenTimeout()
      onListenEnd()
    }, 30_000)
  }

  useEffect(() => {
    const releasePointer = (pointerId: number): void => {
      if (!microphoneButtonRef.current) return
      if (microphoneButtonRef.current.hasPointerCapture(pointerId)) {
        microphoneButtonRef.current.releasePointerCapture(pointerId)
      }
    }

    const handlePointerUp = (event: PointerEvent): void => {
      if (activePointerId.current !== event.pointerId) return
      activePointerId.current = null
      releasePointer(event.pointerId)
      finishHold()
    }

    const handlePointerCancel = (event: PointerEvent): void => {
      if (activePointerId.current !== event.pointerId) return
      activePointerId.current = null
      releasePointer(event.pointerId)
      finishHold()
    }

    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true })
    return () => {
      clearHoldTimer()
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [])

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

            if ((event.ctrlKey || event.metaKey) && event.code === 'Space' && !event.repeat && !busy) {
              event.preventDefault()
              keyboardPushToTalk.current = true
              onListenStart()
            }
          }}
          onKeyUp={(event) => {
            if (event.code === 'Space' && keyboardPushToTalk.current) {
              event.preventDefault()
              keyboardPushToTalk.current = false
              if (listening) onListenEnd()
            }
          }}
          onBlur={() => {
            if (!keyboardPushToTalk.current) return
            keyboardPushToTalk.current = false
            if (listening) onListenEnd()
          }}
        />
        <div className="composer-toolbar">
          <div className="composer-modes">
            <button
              ref={microphoneButtonRef}
              className={`composer-control ${listening ? 'is-active' : ''}`}
              title="Segure para falar"
              aria-label="Gravar áudio (Ctrl+Espaço)"
              aria-keyshortcuts="Ctrl+Space"
              disabled={busy}
              onPointerDown={(event) => {
                if (busy || event.button !== 0 || activePointerId.current !== null) return
                event.preventDefault()
                activePointerId.current = event.pointerId
                try {
                  event.currentTarget.setPointerCapture(event.pointerId)
                } catch {
                  // Pointer capture is optional for older or emulated pointer stacks.
                }
                beginHold()
              }}
              onPointerUp={() => {
                if (activePointerId.current === null) return
                activePointerId.current = null
                finishHold()
              }}
              onPointerCancel={() => {
                if (activePointerId.current === null) return
                activePointerId.current = null
                finishHold()
              }}
              onKeyDown={(event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return
                if (event.repeat) return
                event.preventDefault()
                beginHold()
              }}
              onKeyUp={(event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return
                event.preventDefault()
                finishHold()
              }}
              onBlur={() => {
                if (activePointerId.current !== null || listening) {
                  activePointerId.current = null
                  finishHold()
                }
              }}
              onPointerLeave={() => {
                if (activePointerId.current === null) return
                clearHoldTimer()
              }}
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
      <small className="composer-hint">O Titi pode cometer erros. Pressione Ctrl+Espaço para gravar por voz e Esc para interromper.</small>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ChatMessage, MascotState } from '../../../shared/contracts'
import { formatActivityElapsed } from '../conversation-ui'

interface MessageListProps {
  messages: ChatMessage[]
  mascotName: string
  mascotState: MascotState
  activityStartedAt: number | null
}

export function MessageList({
  messages,
  mascotName,
  mascotState,
  activityStartedAt
}: MessageListProps): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (activityStartedAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activityStartedAt])

  return (
    <div className="messages" aria-live="polite">
      {messages.map((message) => (
        <article className={`message message--${message.role}`} key={message.id}>
          {message.role === 'assistant' && (
            <div className="message-avatar"><img src="./titi-icon.png" alt="" width={30} height={30} /></div>
          )}
          <div className="message-content">
            {message.role === 'assistant' && <strong className="message-author">{mascotName}</strong>}
            {message.content.split('\n').map((line, index) => (
              line ? <p key={`${message.id}-${index}`}>{formatInline(line)}</p> : <br key={`${message.id}-${index}`} />
            ))}
          </div>
        </article>
      ))}
      {activityStartedAt !== null && (
        <article className="message message--assistant">
          <div className={`message-avatar message-avatar--${mascotState}`}><img src="./titi-icon.png" alt="" width={30} height={30} /></div>
          <div className="message-content activity-indicator" aria-live="off">
            <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
            <small>Pensando e agindo há {formatActivityElapsed(activityStartedAt, now)}</small>
          </div>
        </article>
      )}
    </div>
  )
}

function formatInline(value: string): React.ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part
  )
}

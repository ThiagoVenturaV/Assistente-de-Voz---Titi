import type { ChatMessage, MascotState } from '../../../shared/contracts'
import { TitiSprite } from './TitiSprite'

interface MessageListProps {
  messages: ChatMessage[]
  mascotName: string
  mascotState: MascotState
  sending: boolean
}

export function MessageList({
  messages,
  mascotName,
  mascotState,
  sending
}: MessageListProps): React.JSX.Element {
  return (
    <div className="messages" aria-live="polite">
      {messages.map((message) => (
        <article className={`message message--${message.role}`} key={message.id}>
          {message.role === 'assistant' && (
            <div className="message-avatar"><TitiSprite size={38} state="idle" label={mascotName} /></div>
          )}
          <div className="message-content">
            {message.role === 'assistant' && <strong className="message-author">{mascotName}</strong>}
            {message.content.split('\n').map((line, index) => (
              line ? <p key={`${message.id}-${index}`}>{formatInline(line)}</p> : <br key={`${message.id}-${index}`} />
            ))}
          </div>
        </article>
      ))}
      {sending && (
        <article className="message message--assistant">
          <div className="message-avatar"><TitiSprite size={38} state={mascotState} label={mascotName} /></div>
          <div className="message-content typing-indicator"><i /><i /><i /></div>
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

import type { MascotState } from '../../../shared/contracts'
import { TitiSprite } from './TitiSprite'
import { MessageIcon, MonitorIcon, SparklesIcon } from './icons'

interface EmptyStateProps {
  mascotName: string
  state: MascotState
  onSuggestion(value: string): void
}

export function EmptyState({ mascotName, state, onSuggestion }: EmptyStateProps): React.JSX.Element {
  const suggestions = [
    { icon: MessageIcon, title: 'Vamos conversar', text: 'O que você consegue fazer?' },
    { icon: MonitorIcon, title: 'Meu computador', text: 'Verifique se o modelo local está pronto' },
    { icon: SparklesIcon, title: 'Organizar uma ideia', text: 'Me ajude a organizar um novo projeto' }
  ]

  return (
    <div className="empty-state">
      <div className="empty-mascot-glow">
        <TitiSprite state={state} size={126} label={mascotName} />
      </div>
      <p className="eyebrow">ASSISTENTE PESSOAL LOCAL</p>
      <h1>Oi, eu sou {mascotName}.</h1>
      <p className="empty-subtitle">Converse por texto ou voz. Eu cuido do resto com você no controle.</p>
      <div className="suggestion-grid">
        {suggestions.map(({ icon: Icon, title, text }) => (
          <button key={title} onClick={() => onSuggestion(text)}>
            <Icon />
            <span><strong>{title}</strong><small>{text}</small></span>
          </button>
        ))}
      </div>
    </div>
  )
}

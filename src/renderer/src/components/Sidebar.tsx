import type {
  ConversationSummary,
  TitiSettings
} from '../../../shared/contracts'
import {
  MessageIcon,
  MoreIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon
} from './icons'

interface SidebarProps {
  collapsed: boolean
  conversations: ConversationSummary[]
  selectedId?: string
  settings: TitiSettings
  onToggle(): void
  onCreate(): void
  onSelect(id: string): void
  onRemove(id: string): void
  onOpenSettings(): void
}

export function Sidebar({
  collapsed,
  conversations,
  selectedId,
  settings,
  onToggle,
  onCreate,
  onSelect,
  onRemove,
  onOpenSettings
}: SidebarProps): React.JSX.Element {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-top drag-region">
        <div className="brand no-drag">
          <img className="brand-icon" src="./titi-icon.png" alt="" width={34} height={34} />
          {!collapsed && <span>{settings.mascotName}</span>}
        </div>
        <button className="icon-button no-drag" title="Recolher barra lateral" onClick={onToggle}>
          <PanelIcon />
        </button>
      </div>

      <nav className="sidebar-actions" aria-label="Ações principais">
        <button className="sidebar-action sidebar-action--primary" onClick={onCreate}>
          <PlusIcon />
          {!collapsed && <span>Nova conversa</span>}
        </button>
        <button className="sidebar-action" disabled title="Busca será ativada com o índice local">
          <SearchIcon />
          {!collapsed && <span>Buscar</span>}
        </button>
      </nav>

      {!collapsed && (
        <div className="conversation-section">
          <div className="section-label">Conversas</div>
          <div className="conversation-list">
            {conversations.length === 0 && (
              <div className="conversation-empty">Suas conversas ficam somente neste computador.</div>
            )}
            {conversations.map((conversation) => (
              <div
                className={`conversation-row ${selectedId === conversation.id ? 'is-active' : ''}`}
                key={conversation.id}
              >
                <button className="conversation-select" onClick={() => onSelect(conversation.id)}>
                  <MessageIcon />
                  <span>
                    <strong>{conversation.title}</strong>
                    <small>{conversation.preview}</small>
                  </span>
                </button>
                <button
                  className="conversation-remove"
                  title="Excluir conversa"
                  onClick={() => onRemove(conversation.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={onOpenSettings}>
          <SettingsIcon />
          {!collapsed && <span>Configurações</span>}
        </button>
        {!collapsed && (
          <div className="profile-card">
            <span className="profile-dot">T</span>
            <span><strong>Perfil local</strong><small>Seus dados, seu PC</small></span>
            <MoreIcon />
          </div>
        )}
      </div>
    </aside>
  )
}

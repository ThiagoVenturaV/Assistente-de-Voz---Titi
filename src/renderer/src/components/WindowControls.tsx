import { CloseIcon, MaximizeIcon, MinimizeIcon } from './icons'

export function WindowControls(): React.JSX.Element {
  return (
    <div className="window-controls no-drag" aria-label="Controles da janela">
      <button title="Minimizar" onClick={() => window.titi.window.minimize()}>
        <MinimizeIcon />
      </button>
      <button title="Maximizar" onClick={() => window.titi.window.toggleMaximize()}>
        <MaximizeIcon />
      </button>
      <button className="window-close" title="Fechar" onClick={() => window.titi.window.close()}>
        <CloseIcon />
      </button>
    </div>
  )
}

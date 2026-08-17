import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MascotOverlay } from './components/MascotOverlay'

describe('mascot overlay close control', () => {
  it('renders an always-visible accessible close button', () => {
    const markup = renderToStaticMarkup(<MascotOverlay />)

    expect(markup).toContain('aria-label="Ocultar mascote"')
    expect(markup).toContain('style="display:grid"')
  })
})

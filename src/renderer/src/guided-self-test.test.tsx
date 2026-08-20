import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { GuidedSelfTest, createSelfTestSteps } from './components/GuidedSelfTest'

describe('guided self-test UI', () => {
  it('starts with all five real pipeline stages pending', () => {
    expect(createSelfTestSteps().map(({ id, status }) => [id, status])).toEqual([
      ['microphone', 'pending'],
      ['transcription', 'pending'],
      ['model', 'pending'],
      ['tool', 'pending'],
      ['speech', 'pending']
    ])
  })

  it('renders an accessible, explicit start action', () => {
    const markup = renderToStaticMarkup(<GuidedSelfTest settings={DEFAULT_SETTINGS} />)

    expect(markup).toContain('id="guided-self-test-title"')
    expect(markup).toContain('Iniciar autoteste')
    expect(markup).toContain('não abre aplicativos')
    expect(markup).toContain('Ferramenta segura')
    expect(markup).toContain('Voz local')
  })
})

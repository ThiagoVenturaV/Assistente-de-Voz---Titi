import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { VOICE_LANGUAGE_OPTIONS } from '../../shared/contracts'
import { Composer } from './components/Composer'

describe('controles de voz LFM3 na interface', () => {
  it('renderiza seletores de modo (streaming/tts), gênero (feminina/masculina) e idioma na barra principal', () => {
    const markup = renderToStaticMarkup(
      <Composer
        value=""
        sending={false}
        busy={false}
        listening={false}
        liveMode={false}
        voiceMode="streaming"
        voiceGender="female"
        voiceLanguage="pt"
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onListenStart={vi.fn()}
        onListenEnd={vi.fn()}
        onListenTimeout={vi.fn()}
        onToggleLive={vi.fn()}
        onVoiceModeChange={vi.fn()}
        onVoiceGenderChange={vi.fn()}
        onVoiceLanguageChange={vi.fn()}
      />
    )

    expect(markup).toContain('aria-label="Modo de voz"')
    expect(markup).toContain('value="streaming"')
    expect(markup).toContain('value="tts"')
    expect(markup).toContain('aria-label="Voz (feminina ou masculina)"')
    expect(markup).toContain('value="female"')
    expect(markup).toContain('value="male"')
    expect(markup).toContain('aria-label="Idioma da voz"')
    for (const option of VOICE_LANGUAGE_OPTIONS) {
      expect(markup).toContain(`value="${option.code}"`)
    }
  })
})

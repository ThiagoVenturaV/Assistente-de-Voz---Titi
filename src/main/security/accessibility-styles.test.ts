import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('alvos e movimento acessíveis', () => {
  it('mantém controles essenciais com 44 px e respeita movimento reduzido', async () => {
    const css = await readFile(
      new URL('../../renderer/src/styles.css', import.meta.url),
      'utf8'
    )

    for (const selector of [
      '.icon-button',
      '.conversation-remove',
      '.composer-control',
      '.send-button',
      '.settings-nav button',
      '.memory-remove',
      '.overlay-close'
    ]) {
      const start = css.indexOf(`${selector} {`)
      expect(start, `${selector} deve existir`).toBeGreaterThanOrEqual(0)
      expect(css.slice(start, start + 500), `${selector} precisa de alvo de 44 px`).toMatch(
        /(?:min-)?(?:width|height): 44px/
      )
    }
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(/animation-duration: \.01ms !important/)
    expect(css).toContain('.conversation-row:focus-within .conversation-remove')
  })
})

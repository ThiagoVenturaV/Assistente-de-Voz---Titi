import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('guided self-test styles', () => {
  it('styles every visible state and keeps its actions accessible', async () => {
    const css = await readFile(
      new URL('../../renderer/src/styles.css', import.meta.url),
      'utf8'
    )

    for (const selector of [
      '.guided-self-test',
      '.self-test-steps',
      '.self-test-steps li.is-running > i',
      '.self-test-steps li.is-passed > i',
      '.self-test-steps li.is-failed > i',
      '.self-test-notice',
      '.self-test-actions'
    ]) {
      expect(css, `${selector} deve ter estilo explícito`).toContain(selector)
    }
    expect(css).toContain('.primary-button, .secondary-button { min-height: 44px;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

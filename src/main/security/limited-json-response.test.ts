import { describe, expect, it } from 'vitest'
import { readLimitedJsonResponse } from './limited-json-response'

describe('limited local JSON responses', () => {
  it('parses a response below the configured limit', async () => {
    await expect(readLimitedJsonResponse<{ ok: boolean }>(
      new Response('{"ok":true}'),
      64
    )).resolves.toEqual({ ok: true })
  })

  it('rejects a declared body larger than the configured limit', async () => {
    const response = new Response('{}', { headers: { 'content-length': '65' } })
    await expect(readLimitedJsonResponse(response, 64)).rejects.toThrow(/limite permitido/i)
  })

  it('stops an undeclared body that grows beyond the configured limit', async () => {
    const response = new Response(JSON.stringify({ value: 'x'.repeat(100) }))
    await expect(readLimitedJsonResponse(response, 64)).rejects.toThrow(/limite permitido/i)
  })
})

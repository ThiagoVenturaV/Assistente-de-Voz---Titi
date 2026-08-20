import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import {
  CurrentDatetimeProbeExecutor,
  runGuidedSelfTestModelProbe
} from './guided-self-test'

describe('guided self-test model probe', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('exposes and executes only the harmless current_datetime tool', async () => {
    const now = new Date('2026-08-19T12:34:56.000Z')
    const executor = new CurrentDatetimeProbeExecutor(() => now)

    expect(executor.definitions.map(({ function: value }) => value.name)).toEqual([
      'current_datetime'
    ])
    await expect(executor.execute('current_datetime', {})).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      message: expect.stringContaining('Data e hora locais:')
    })
    await expect(executor.execute('open_application', { application: 'Spotify' })).resolves.toEqual({
      ok: false,
      status: 'failed',
      message: 'O autoteste bloqueou uma ferramenta fora da sonda segura.'
    })
  })

  it('runs OllamaProvider without exposing the desktop toolkit', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            type: 'function',
            function: { name: 'current_datetime', arguments: {} }
          }]
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        message: { role: 'assistant', content: 'A ferramenta confirmou a hora local.' }
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGuidedSelfTestModelProbe({
      settings: DEFAULT_SETTINGS,
      now: () => new Date('2026-08-19T12:34:56.000Z')
    })

    expect(result).toMatchObject({
      model: DEFAULT_SETTINGS.provider.model,
      tool: {
        name: 'current_datetime',
        called: true,
        ok: true,
        message: 'Consulta segura de data e hora concluída.'
      }
    })
    expect(result).not.toHaveProperty('response')
    expect(JSON.stringify(result)).not.toContain('12:34')
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      tools: Array<{ function: { name: string } }>
    }
    expect(request.tools.map(({ function: value }) => value.name)).toEqual([
      'current_datetime'
    ])
  })

  it('fails when the model does not call the safe tool', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      message: { role: 'assistant', content: '[SEM_FERRAMENTA] Agora é meio-dia.' }
    })))

    await expect(runGuidedSelfTestModelProbe({ settings: DEFAULT_SETTINGS })).rejects.toThrow(
      'O modelo respondeu sem chamar a ferramenta segura do autoteste.'
    )
  })

  it('forwards cancellation to the local provider', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })))

    const pending = runGuidedSelfTestModelProbe({
      settings: DEFAULT_SETTINGS,
      signal: controller.signal
    })
    await Promise.resolve()
    controller.abort(Object.assign(new Error('cancelado'), { name: 'AbortError' }))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

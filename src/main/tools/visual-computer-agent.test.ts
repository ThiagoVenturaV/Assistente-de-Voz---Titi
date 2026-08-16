import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import type { ComputerController } from './windows-ui-automation'
import {
  OllamaVisualComputerAgent,
  type VisionFetch
} from './visual-computer-agent'

describe('OllamaVisualComputerAgent', () => {
  it('does not click when the local visual model sees the requested state already active', async () => {
    const controller = makeController()
    const fetcher = visionFetch([
      { state: 'already_done', target: 'bottom_player_play_pause', confidence: 0.94, description: 'Pause está visível.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('play')).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { method: 'local_visual_model', verification: 'already_in_requested_state' }
    })
    expect(controller.click).not.toHaveBeenCalled()
  })

  it('clicks inside the captured Spotify window and verifies a second local capture', async () => {
    const controller = makeController()
    const fetcher = visionFetch([
      { state: 'needs_action', target: 'bottom_player_play_pause', confidence: 0.96, description: 'Botão Play central.' },
      { playerState: 'playing', confidence: 0.91, description: 'Pause agora está visível.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('play')).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: {
        method: 'local_visual_model',
        verification: 'verified_after_action',
        click: { x: 800, y: 844 }
      }
    })
    expect(controller.capture).toHaveBeenCalledTimes(3)
    expect(controller.click).toHaveBeenCalledWith('spotify', 800, 844, undefined)
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      messages: Array<{ images?: string[] }>
    }
    expect(request.messages[1].images).toEqual(['/9j/4A=='])
  })

  it('recalculates the relative click from the latest window size before acting', async () => {
    const controller = makeController()
    controller.capture
      .mockResolvedValueOnce(spotifyCapture(1200, 700))
      .mockResolvedValueOnce(spotifyCapture(1600, 900))
      .mockResolvedValueOnce(spotifyCapture(1600, 900))
    const fetcher = visionFetch([
      { state: 'needs_action', target: 'bottom_player_play_pause', confidence: 0.96, description: 'Botão Play central.' },
      { playerState: 'playing', confidence: 0.91, description: 'Pause agora está visível.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('play')).resolves.toMatchObject({ status: 'confirmed' })
    expect(controller.click).toHaveBeenCalledWith('spotify', 800, 844, undefined)
  })

  it('confirms Pause only when the enlarged player crop is classified as paused', async () => {
    const controller = makeController()
    const fetcher = visionFetch([
      { state: 'needs_action', target: 'bottom_player_play_pause', confidence: 0.93, description: 'Pause central.' },
      { playerState: 'paused', confidence: 0.92, description: 'Play agora está visível.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('pause')).resolves.toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { verification: 'verified_after_action' }
    })
  })

  it('reports a click as unverified when the enlarged crop still shows the old state', async () => {
    const controller = makeController()
    const fetcher = visionFetch([
      { state: 'needs_action', target: 'bottom_player_play_pause', confidence: 0.93, description: 'Play central.' },
      { playerState: 'paused', confidence: 0.92, description: 'O Play continua visível.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('play')).resolves.toMatchObject({
      ok: false,
      status: 'dispatched',
      details: { effectState: 'dispatched_unverified' }
    })
  })

  it('refuses an uncertain or unexpected visual target without clicking', async () => {
    const controller = makeController()
    const fetcher = visionFetch([
      { state: 'needs_action', target: 'none', confidence: 0.99, description: 'Alvo inseguro.' }
    ])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('play')).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      details: { effectState: 'not_started' }
    })
    expect(controller.click).not.toHaveBeenCalled()
  })

  it('never sends a visual capture to a non-local Ollama endpoint', async () => {
    const controller = makeController()
    const fetcher = visionFetch([])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => ({
        ...DEFAULT_SETTINGS,
        provider: { ...DEFAULT_SETTINGS.provider, endpoint: 'https://example.com' }
      }),
      fetcher
    )

    await expect(agent.act('play'))
      .rejects.toThrow('somente o Ollama local')
    expect(fetcher).not.toHaveBeenCalled()
    expect(controller.click).not.toHaveBeenCalled()
  })

  it('refuses to use the screenshot-and-click path for actions beyond Spotify Play/Pause', async () => {
    const controller = makeController()
    const fetcher = visionFetch([])
    const agent = new OllamaVisualComputerAgent(
      controller,
      async () => DEFAULT_SETTINGS,
      fetcher
    )

    await expect(agent.act('next' as never))
      .rejects.toThrow('limitado a Play e Pause no Spotify')
    expect(controller.capture).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('analisa todos os monitores localmente e não devolve as imagens no resultado', async () => {
    const controller = makeController()
    controller.captureDesktop = vi.fn(async () => ({
      screenCount: 2,
      screens: [
        { index: 0, primary: true, left: 0, top: 0, width: 1920, height: 1080, imageWidth: 1920, imageHeight: 1080, imageBase64: 'monitor-1' },
        { index: 1, primary: false, left: -2560, top: 0, width: 2560, height: 1440, imageWidth: 1920, imageHeight: 1080, imageBase64: 'monitor-2' }
      ]
    }))
    const fetcher = visionFetch([
      { state: 'confirmed', confidence: 0.94, summary: 'YouTube está aberto no Brave no segundo monitor.' }
    ])
    const agent = new OllamaVisualComputerAgent(controller, async () => DEFAULT_SETTINGS, fetcher)

    const result = await agent.observeDesktop('Confirmar que o YouTube abriu no Brave')

    expect(result).toMatchObject({
      ok: true,
      status: 'confirmed',
      details: { method: 'local_multi_monitor_vision', screenCount: 2 }
    })
    expect(JSON.stringify(result)).not.toContain('monitor-1')
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      messages: Array<{ images?: string[] }>
    }
    expect(request.messages[1].images).toEqual(['monitor-1', 'monitor-2'])
  })
})

function makeController(): ComputerController & {
  capture: ReturnType<typeof vi.fn>
  click: ReturnType<typeof vi.fn>
} {
  return {
    observe: vi.fn(async () => ({
      application: 'spotify', windowTitle: 'Spotify', processName: 'Spotify', controls: []
    })),
    invoke: vi.fn(async () => ({
      application: 'spotify',
      windowTitle: 'Spotify',
      processName: 'Spotify',
      invoked: true as const,
      control: { name: 'Play', controlType: 'Button', automationId: '', enabled: true }
    })),
    capture: vi.fn(async () => spotifyCapture(1600, 900)),
    click: vi.fn(async (_application: string, x: number, y: number) => ({
      application: 'spotify',
      windowTitle: 'Spotify Premium',
      processName: 'Spotify',
      clicked: true as const,
      x,
      y
    }))
  }
}

function spotifyCapture(width: number, height: number) {
  return {
    application: 'spotify',
    windowTitle: 'Spotify Premium',
    processName: 'Spotify',
    width,
    height,
    imageBase64: '/9j/2Q==',
    focusImageBase64: '/9j/4A=='
  }
}

function visionFetch(values: Array<Record<string, unknown>>) {
  let index = 0
  return vi.fn<VisionFetch>(async () => new Response(JSON.stringify({
    message: { content: JSON.stringify(values[index++]) }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }))
}

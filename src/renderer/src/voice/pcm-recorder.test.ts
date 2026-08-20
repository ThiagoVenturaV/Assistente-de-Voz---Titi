import { describe, expect, it, vi } from 'vitest'
import { microphoneConstraints, observeMicrophoneEnded, resampleForSpeechRecognition, resamplePcm } from './pcm-recorder'

describe('observeMicrophoneEnded', () => {
  it('avisa uma vez quando o dispositivo some e permite remover o listener', () => {
    const first = new EventTarget()
    const second = new EventTarget()
    const stream = {
      getAudioTracks: () => [first, second]
    } as unknown as MediaStream
    const ended = vi.fn()
    const detach = observeMicrophoneEnded(stream, ended)

    first.dispatchEvent(new Event('ended'))
    second.dispatchEvent(new Event('ended'))
    expect(ended).toHaveBeenCalledTimes(1)

    detach()
    first.dispatchEvent(new Event('ended'))
    expect(ended).toHaveBeenCalledTimes(1)
  })
})

describe('microphoneConstraints', () => {
  it('usa o microfone padrão quando nenhum dispositivo foi escolhido', () => {
    expect(microphoneConstraints()).toEqual({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
  })

  it('fixa exatamente o dispositivo escolhido pelo usuário', () => {
    expect(microphoneConstraints('usb-mic')).toMatchObject({
      audio: { deviceId: { exact: 'usb-mic' } }
    })
  })
})

describe('resamplePcm', () => {
  it('faz média das amostras ao reduzir de 48 kHz para 16 kHz', () => {
    const source = new Float32Array([1, 1, 1, -1, -1, -1])

    expect(Array.from(resamplePcm(source, 48_000, 16_000))).toEqual([1, -1])
  })

  it('preserva o áudio quando a taxa já é 16 kHz', () => {
    const source = new Float32Array([0.25, -0.25])

    expect(resamplePcm(source, 16_000, 16_000)).toBe(source)
  })

  it('usa o fallback determinístico fora do navegador', async () => {
    const source = new Float32Array([1, 1, 1, -1, -1, -1])

    await expect(resampleForSpeechRecognition(source, 48_000))
      .resolves.toEqual(new Float32Array([1, -1]))
  })
})

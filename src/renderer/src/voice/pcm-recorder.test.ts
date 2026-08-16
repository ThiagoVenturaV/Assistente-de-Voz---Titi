import { describe, expect, it } from 'vitest'
import { microphoneConstraints, resampleForWhisper, resamplePcm } from './pcm-recorder'

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

    await expect(resampleForWhisper(source, 48_000))
      .resolves.toEqual(new Float32Array([1, -1]))
  })
})

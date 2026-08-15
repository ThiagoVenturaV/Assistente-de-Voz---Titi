import { describe, expect, it } from 'vitest'
import { microphoneConstraints } from './pcm-recorder'

describe('microphoneConstraints', () => {
  it('usa o microfone padrão quando nenhum dispositivo foi escolhido', () => {
    expect(microphoneConstraints()).toEqual({
      audio: {
        channelCount: 1,
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

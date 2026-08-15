import { useEffect, useRef, useState } from 'react'
import { microphoneConstraints } from '../voice/pcm-recorder'

interface MicrophoneSettingsProps {
  deviceId: string
  disabled: boolean
  onChange(deviceId: string): void
}

export function MicrophoneSettings({
  deviceId,
  disabled,
  onChange
}: MicrophoneSettingsProps): React.JSX.Element {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [testing, setTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const [status, setStatus] = useState('Escolha uma entrada e faça um teste antes da conversa ao vivo.')
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    void refreshDevices()
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) return stopTest
    const refresh = (): void => void refreshDevices()
    mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      mediaDevices.removeEventListener('devicechange', refresh)
      stopTest()
    }
  }, [])

  useEffect(() => {
    if (disabled) stopTest()
  }, [disabled])

  async function refreshDevices(): Promise<void> {
    try {
      const available = await navigator.mediaDevices?.enumerateDevices()
      setDevices((available ?? []).filter((device) => device.kind === 'audioinput'))
    } catch {
      setDevices([])
      setStatus('Não consegui listar os microfones. Verifique a permissão do Windows.')
    }
  }

  async function startTest(): Promise<void> {
    if (disabled || testing) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Este computador não disponibilizou acesso ao microfone.')
      return
    }
    stopTest()
    setStatus('Solicitando acesso ao microfone…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        microphoneConstraints(deviceId)
      )
      const context = new AudioContext()
      await context.resume()
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      context.createMediaStreamSource(stream).connect(analyser)
      streamRef.current = stream
      contextRef.current = context
      setTesting(true)
      setStatus('Microfone ativo. Fale e confira o nível abaixo.')
      await refreshDevices()

      const samples = new Uint8Array(analyser.fftSize)
      const updateLevel = (): void => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) {
          const normalized = (sample - 128) / 128
          sum += normalized * normalized
        }
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4.5))
        frameRef.current = window.requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch (error) {
      stopTest()
      setStatus(microphoneErrorMessage(error))
    }
  }

  function stopTest(): void {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void contextRef.current?.close()
    contextRef.current = null
    setTesting(false)
    setLevel(0)
  }

  const selectedIsMissing = Boolean(deviceId) && !devices.some((device) => device.deviceId === deviceId)

  return (
    <div className="microphone-settings">
      <label className="field">
        <span>
          <strong>Microfone de entrada</strong>
          <small>O padrão do Windows acompanha a entrada escolhida no sistema.</small>
        </span>
        <select
          value={deviceId}
          disabled={disabled || testing}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Padrão do Windows</option>
          {selectedIsMissing && <option value={deviceId}>Microfone salvo (indisponível)</option>}
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microfone ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <div className="microphone-test">
        <div>
          <strong>Teste de entrada</strong>
          <small aria-live="polite">{status}</small>
          <div
            className="microphone-meter"
            role="progressbar"
            aria-label="Nível do microfone"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            <i style={{ transform: `scaleX(${level})` }} />
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => testing ? stopTest() : void startTest()}
        >
          {testing ? 'Parar teste' : 'Testar microfone'}
        </button>
      </div>
    </div>
  )
}

function microphoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'A permissão foi negada. Libere o microfone nas configurações de privacidade do Windows.'
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'O microfone escolhido não está disponível. Selecione outra entrada.'
    }
    if (error.name === 'NotReadableError') {
      return 'O microfone está ocupado por outro aplicativo. Feche-o e tente novamente.'
    }
  }
  return error instanceof Error && error.message
    ? `Não consegui testar o microfone. ${error.message}`
    : 'Não consegui testar o microfone.'
}

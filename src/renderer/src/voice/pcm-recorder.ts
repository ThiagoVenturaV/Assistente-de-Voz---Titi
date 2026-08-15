export class PcmRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: Float32Array[] = []
  private sampleRate = 48_000
  private startedAt = 0
  private lastSpeechAt = 0
  private heardSpeech = false
  private autoStopTriggered = false
  private noiseFloor = 0.003
  private calibrationEndsAt = 0

  constructor(private readonly onSilence?: (reason: 'silence' | 'timeout') => void) {}

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este dispositivo não disponibilizou acesso ao microfone.')
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    this.context = new AudioContext()
    await this.context.resume()
    this.startedAt = performance.now()
    this.calibrationEndsAt = this.startedAt + 350
    this.sampleRate = this.context.sampleRate
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.sink = this.context.createGain()
    this.sink.gain.value = 0
    this.processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0))
      this.chunks.push(samples)
      if (!this.onSilence || this.autoStopTriggered) return

      const now = performance.now()
      const volume = rootMeanSquare(samples)
      if (!this.heardSpeech && now < this.calibrationEndsAt) {
        this.noiseFloor = smoothNoiseFloor(this.noiseFloor, volume)
        return
      }
      const speechThreshold = Math.max(0.006, Math.min(0.03, this.noiseFloor * 2.8))
      if (volume >= speechThreshold) {
        this.heardSpeech = true
        this.lastSpeechAt = now
      } else if (!this.heardSpeech) {
        this.noiseFloor = smoothNoiseFloor(this.noiseFloor, volume)
      }
      const finishedUtterance = this.heardSpeech && now - this.lastSpeechAt >= 1650
      const waitedTooLong = !this.heardSpeech && now - this.startedAt >= 20_000
      if (finishedUtterance || waitedTooLong) {
        this.autoStopTriggered = true
        this.onSilence(finishedUtterance ? 'silence' : 'timeout')
      }
    }
    this.source.connect(this.processor)
    this.processor.connect(this.sink)
    this.sink.connect(this.context.destination)
  }

  async stop(): Promise<ArrayBuffer> {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.sink?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    await this.context?.close()

    const source = joinChunks(this.chunks)
    const resampled = resample(source, this.sampleRate, 16_000)
    this.reset()
    if (resampled.length < 3200) throw new Error('Segure o botão e fale por pelo menos um instante.')
    return encodeWav(resampled, 16_000)
  }

  cancel(): void {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.sink?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.context?.close()
    this.reset()
  }

  private reset(): void {
    this.context = null
    this.stream = null
    this.source = null
    this.processor = null
    this.sink = null
    this.chunks = []
    this.startedAt = 0
    this.lastSpeechAt = 0
    this.heardSpeech = false
    this.autoStopTriggered = false
    this.noiseFloor = 0.003
    this.calibrationEndsAt = 0
  }
}

function smoothNoiseFloor(current: number, sample: number): number {
  return Math.max(0.001, current * 0.82 + sample * 0.18)
}

function rootMeanSquare(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

function joinChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const joined = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return joined
}

function resample(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input
  const ratio = sourceRate / targetRate
  const output = new Float32Array(Math.round(input.length / ratio))
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio
    const before = Math.floor(position)
    const after = Math.min(before + 1, input.length - 1)
    const fraction = position - before
    output[index] = input[before] * (1 - fraction) + input[after] * fraction
  }
  return output
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return buffer
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

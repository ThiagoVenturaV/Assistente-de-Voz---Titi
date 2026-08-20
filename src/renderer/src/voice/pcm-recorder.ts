export class PcmRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private highPass: BiquadFilterNode | null = null
  private lowPass: BiquadFilterNode | null = null
  private processor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: Float32Array[] = []
  private liveChunks: Float32Array[] = []
  private liveSampleCount = 0
  private nextLiveChunkSamples = 0
  private sampleRate = 48_000
  private startedAt = 0
  private lastSpeechAt = 0
  private heardSpeech = false
  private autoStopTriggered = false
  private noiseFloor = 0.003
  private calibrationEndsAt = 0
  private consecutiveSpeechFrames = 0
  private detachDeviceEnded: (() => void) | null = null
  private endingIntentionally = false

  constructor(
    private readonly onSilence?: (reason: 'silence' | 'timeout') => void,
    private readonly inputDeviceId = '',
    private readonly onLiveChunk?: (pcmAudio: ArrayBuffer) => void,
    private readonly onDeviceEnded?: () => void
  ) {}

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este dispositivo não disponibilizou acesso ao microfone.')
    }
    this.stream = await navigator.mediaDevices.getUserMedia(
      microphoneConstraints(this.inputDeviceId)
    )
    this.detachDeviceEnded = observeMicrophoneEnded(this.stream, () => {
      if (this.endingIntentionally) return
      this.onDeviceEnded?.()
    })
    this.context = new AudioContext()
    await this.context.resume()
    this.startedAt = performance.now()
    this.calibrationEndsAt = this.startedAt + 350
    this.sampleRate = this.context.sampleRate
    this.nextLiveChunkSamples = this.sampleRate
    this.source = this.context.createMediaStreamSource(this.stream)
    this.highPass = this.context.createBiquadFilter()
    this.highPass.type = 'highpass'
    this.highPass.frequency.value = 80
    this.highPass.Q.value = 0.707
    this.lowPass = this.context.createBiquadFilter()
    this.lowPass.type = 'lowpass'
    this.lowPass.frequency.value = 7200
    this.lowPass.Q.value = 0.707
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.sink = this.context.createGain()
    this.sink.gain.value = 0
    this.processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0))
      this.chunks.push(samples)
      if (this.onLiveChunk) {
        this.liveChunks.push(samples)
        this.liveSampleCount += samples.length
        if (this.liveSampleCount >= this.nextLiveChunkSamples) this.emitLiveChunk()
      }
      if (!this.onSilence || this.autoStopTriggered) return

      const now = performance.now()
      const volume = rootMeanSquare(samples)
      if (!this.heardSpeech && now < this.calibrationEndsAt) {
        this.noiseFloor = smoothNoiseFloor(this.noiseFloor, volume)
        return
      }
      const speechThreshold = Math.max(0.006, Math.min(0.03, this.noiseFloor * 2.8))
      if (volume >= speechThreshold) {
        this.consecutiveSpeechFrames += 1
        if (this.heardSpeech || this.consecutiveSpeechFrames >= 3) {
          this.heardSpeech = true
          this.lastSpeechAt = now
        }
      } else if (!this.heardSpeech) {
        this.consecutiveSpeechFrames = 0
        this.noiseFloor = smoothNoiseFloor(this.noiseFloor, volume)
      }
      const finishedUtterance = this.heardSpeech && now - this.lastSpeechAt >= 1650
      const waitedWithoutSpeech = !this.heardSpeech && now - this.startedAt >= 20_000
      const reachedRecordingLimit = this.heardSpeech && now - this.startedAt >= 120_000
      const waitedTooLong = waitedWithoutSpeech || reachedRecordingLimit
      if (finishedUtterance || waitedTooLong) {
        this.autoStopTriggered = true
        this.onSilence(finishedUtterance ? 'silence' : 'timeout')
      }
    }
    this.source.connect(this.highPass)
    this.highPass.connect(this.lowPass)
    this.lowPass.connect(this.processor)
    this.processor.connect(this.sink)
    this.sink.connect(this.context.destination)
  }

  async stop(): Promise<ArrayBuffer> {
    this.endingIntentionally = true
    this.detachDeviceEnded?.()
    this.emitLiveChunk(true)
    this.processor?.disconnect()
    this.highPass?.disconnect()
    this.lowPass?.disconnect()
    this.source?.disconnect()
    this.sink?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    await this.context?.close()

    const source = joinChunks(this.chunks)
    const resampled = await resampleForSpeechRecognition(source, this.sampleRate)
    this.reset()
    if (resampled.length < 3200) throw new Error('Segure o botão e fale por pelo menos um instante.')
    return encodeWav(resampled, 16_000)
  }

  cancel(): void {
    this.endingIntentionally = true
    this.detachDeviceEnded?.()
    this.processor?.disconnect()
    this.highPass?.disconnect()
    this.lowPass?.disconnect()
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
    this.highPass = null
    this.lowPass = null
    this.processor = null
    this.sink = null
    this.chunks = []
    this.liveChunks = []
    this.liveSampleCount = 0
    this.nextLiveChunkSamples = 0
    this.startedAt = 0
    this.lastSpeechAt = 0
    this.heardSpeech = false
    this.autoStopTriggered = false
    this.noiseFloor = 0.003
    this.calibrationEndsAt = 0
    this.consecutiveSpeechFrames = 0
    this.detachDeviceEnded = null
    this.endingIntentionally = false
  }

  private emitLiveChunk(final = false): void {
    if (!this.onLiveChunk || this.liveSampleCount === 0) return
    if (final && this.liveSampleCount < Math.round(this.sampleRate * 0.1)) return
    const source = joinChunks(this.liveChunks)
    const resampled = resamplePcm(source, this.sampleRate, 16_000)
    this.liveChunks = []
    this.liveSampleCount = 0
    this.nextLiveChunkSamples = Math.round(this.sampleRate * 1.5)
    const copy = new Float32Array(resampled.length)
    copy.set(resampled)
    this.onLiveChunk(copy.buffer)
  }
}

export function observeMicrophoneEnded(stream: MediaStream, onEnded: () => void): () => void {
  const tracks = stream.getAudioTracks()
  let notified = false
  const handleEnded = (): void => {
    if (notified) return
    notified = true
    onEnded()
  }
  tracks.forEach((track) => track.addEventListener('ended', handleEnded))
  return () => tracks.forEach((track) => track.removeEventListener('ended', handleEnded))
}

export function microphoneConstraints(inputDeviceId = ''): MediaStreamConstraints {
  return {
    audio: {
      channelCount: 1,
      sampleRate: { ideal: 48_000 },
      sampleSize: { ideal: 16 },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {})
    }
  }
}

export async function resampleForSpeechRecognition(
  input: Float32Array,
  sourceRate: number
): Promise<Float32Array> {
  if (sourceRate === 16_000 || input.length === 0) return input
  if (typeof OfflineAudioContext === 'undefined') {
    return resamplePcm(input, sourceRate, 16_000)
  }

  try {
    const outputLength = Math.max(1, Math.round(input.length * 16_000 / sourceRate))
    const context = new OfflineAudioContext(1, outputLength, 16_000)
    const buffer = context.createBuffer(1, input.length, sourceRate)
    const channelData = new Float32Array(input.length)
    channelData.set(input)
    buffer.copyToChannel(channelData, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
    const rendered = await context.startRendering()
    return new Float32Array(rendered.getChannelData(0))
  } catch {
    return resamplePcm(input, sourceRate, 16_000)
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

export function resamplePcm(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return input
  if (input.length === 0) return input
  const ratio = sourceRate / targetRate
  const output = new Float32Array(Math.round(input.length / ratio))
  for (let index = 0; index < output.length; index += 1) {
    const start = index * ratio
    const end = Math.min((index + 1) * ratio, input.length)
    const firstSample = Math.floor(start)
    const lastSample = Math.min(Math.ceil(end), input.length)
    let weightedSum = 0
    let totalWeight = 0
    for (let sourceIndex = firstSample; sourceIndex < lastSample; sourceIndex += 1) {
      const overlap = Math.max(
        0,
        Math.min(end, sourceIndex + 1) - Math.max(start, sourceIndex)
      )
      weightedSum += input[sourceIndex] * overlap
      totalWeight += overlap
    }
    output[index] = totalWeight > 0 ? weightedSum / totalWeight : 0
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

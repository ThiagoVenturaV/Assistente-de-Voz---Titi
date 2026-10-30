import { join } from 'node:path'
import type { VoiceLanguage, VoiceTranscription } from '../../shared/contracts'
import {
  assertValidWavBuffer,
  Lfm3Runtime,
  LFM3_MMPROJ_FILE,
  LFM3_MODEL_FILE,
  sanitizeTranscription,
  throwIfAborted
} from './lfm3-runtime'

export { sanitizeTranscription }

export class ParakeetTranscriber {
  readonly executable: string
  readonly model: string
  readonly mmproj: string
  private readonly runtime: Lfm3Runtime
  private readonly ownsRuntime: boolean

  constructor(resourcesPath: string, _tempRoot?: string, sharedRuntime?: Lfm3Runtime) {
    this.executable = join(resourcesPath, 'runtime', 'lfm3', 'bin', 'llama-mtmd-cli.exe')
    this.model = join(resourcesPath, 'runtime', 'lfm3', 'models', LFM3_MODEL_FILE)
    this.mmproj = join(resourcesPath, 'runtime', 'lfm3', 'models', LFM3_MMPROJ_FILE)
    this.runtime = sharedRuntime ?? new Lfm3Runtime(resourcesPath)
    this.ownsRuntime = !sharedRuntime
  }

  async transcribe(
    audioBuffer: ArrayBuffer,
    signal?: AbortSignal,
    language: VoiceLanguage = 'pt'
  ): Promise<VoiceTranscription> {
    throwIfAborted(signal)
    assertValidWavBuffer(audioBuffer)
    return this.runtime.transcribeWav(audioBuffer, { language, signal })
  }

  dispose(): void {
    if (this.ownsRuntime) {
      this.runtime.dispose()
    }
  }
}

export { ParakeetTranscriber as Lfm3Transcriber }

export function parakeetArguments(
  model: string,
  inputPath: string,
  outputBase: string,
  language: VoiceLanguage = 'pt'
): string[] {
  return [
    '--model',
    model,
    '--file',
    inputPath,
    '--output-file',
    outputBase,
    '--output-txt',
    '--language',
    language,
    '--no-gpu',
    '--no-prints'
  ]
}

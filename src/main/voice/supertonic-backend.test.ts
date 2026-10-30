import { describe, expect, it, vi } from 'vitest'
import { encodePcm16Wav } from './local-speech'
import {
  Lfm3Runtime,
  applySpeechRateToPcm,
  assertValidWavBuffer,
  buildLfm3AsrSystemPrompt,
  lfm3ServerArguments
} from './lfm3-runtime'
import { SupertonicSynthesizer } from './supertonic-synthesizer'

describe('backend LFM3 de voz local', () => {
  it('resolve os caminhos locais dos binários e modelos LFM3', () => {
    const runtime = new Lfm3Runtime('C:\\Titi\\resources')
    expect(runtime.serverExecutable).toContain('llama-server.exe')
    expect(runtime.modelPath).toContain('LFM3-Audio-2B-Q4_K_M.gguf')
    expect(runtime.mmprojPath).toContain('mmproj-LFM3-Audio-2B-Q8_0.gguf')
    expect(buildLfm3AsrSystemPrompt('pt')).toBe('Perform ASR in Portuguese.')
    expect(buildLfm3AsrSystemPrompt('en-gb')).toBe('Perform ASR in British English.')
    expect(lfm3ServerArguments(runtime.modelPath, runtime.mmprojPath, 8123)).toContain('8123')
  })

  it('valida cabeçalhos WAV RIFF/WAVE e reamostra áudio com segurança', () => {
    const validWav = encodePcm16Wav(new Float32Array([0, 0.25, -0.25, 0.5]), 24_000)
    expect(() => assertValidWavBuffer(validWav)).not.toThrow()
    expect(() => assertValidWavBuffer(new ArrayBuffer(12))).toThrow('curta demais')

    const faster = applySpeechRateToPcm(new Float32Array(2_400), 1.2)
    expect(faster.length).toBe(2_000)
  })

  it('encaminha modo (streaming/tts), gênero (female/male) e idioma ao runtime LFM3', async () => {
    const fakeWav = encodePcm16Wav(new Float32Array(2_400), 24_000)
    const mockRuntime = {
      prepare: vi.fn().mockResolvedValue(undefined),
      synthesize: vi.fn().mockImplementation(async (requestId, _text, _rate, options) => {
        if (options.mode === 'streaming' && options.onChunk) {
          options.onChunk({
            requestId,
            pcmAudio: new Float32Array(480).buffer,
            sampleRate: 24_000
          })
        }
        return {
          wavAudio: fakeWav,
          processingTimeMs: 42,
          audioDurationMs: 100,
          backend: 'lfm3-streaming' as const
        }
      }),
      dispose: vi.fn()
    } as unknown as Lfm3Runtime

    const synthesizer = new SupertonicSynthesizer('C:\\recursos-de-teste', mockRuntime)
    await synthesizer.prepare()
    expect(mockRuntime.prepare).toHaveBeenCalledTimes(1)

    const chunks: Array<{ requestId: string; sampleRate: number }> = []
    const result = await synthesizer.synthesize(
      'pedido-1',
      'Olá, Tiago.',
      1.1,
      new AbortController().signal,
      {
        mode: 'streaming',
        gender: 'male',
        language: 'en',
        onChunk: (chunk) => chunks.push({ requestId: chunk.requestId, sampleRate: chunk.sampleRate })
      }
    )

    expect(result.backend).toBe('lfm3-streaming')
    expect(chunks).toEqual([{ requestId: 'pedido-1', sampleRate: 24_000 }])
    expect(mockRuntime.synthesize).toHaveBeenCalledWith(
      'pedido-1',
      'Olá, Tiago.',
      1.1,
      expect.objectContaining({
        mode: 'streaming',
        gender: 'male',
        language: 'en'
      })
    )

    synthesizer.dispose()
  })
})

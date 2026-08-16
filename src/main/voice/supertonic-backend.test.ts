import { beforeEach, describe, expect, it, vi } from 'vitest'

const workerState = vi.hoisted(() => ({
  scenarios: [] as Array<'ready' | 'startup-error' | 'pending'>,
  backends: [] as string[],
  terminateCount: 0
}))

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events')

  class MockWorker extends EventEmitter {
    private readonly backend: 'directml' | 'cpu'
    private terminated = false

    constructor(_filename: string, options: { workerData: { backend: 'directml' | 'cpu' } }) {
      super()
      this.backend = options.workerData.backend
      workerState.backends.push(this.backend)
      const scenario = workerState.scenarios.shift() ?? 'ready'
      if (scenario === 'ready') {
        queueMicrotask(() => this.emit('message', { type: 'ready', backend: this.backend }))
      } else if (scenario === 'startup-error') {
        queueMicrotask(() => {
          this.emit('error', new Error('provider indisponível'))
          this.emit('exit', 1)
        })
      }
    }

    postMessage(message: { type: string; requestId: string }): void {
      if (message.type !== 'synthesize' || this.terminated) return
      queueMicrotask(() => this.emit('message', {
        type: 'result',
        requestId: message.requestId,
        wavAudio: new ArrayBuffer(44),
        processingTimeMs: 10,
        audioDurationMs: 100,
        backend: this.backend
      }))
    }

    terminate(): Promise<number> {
      if (this.terminated) return Promise.resolve(0)
      this.terminated = true
      workerState.terminateCount += 1
      queueMicrotask(() => this.emit('exit', 0))
      return Promise.resolve(0)
    }
  }

  return { Worker: MockWorker }
})

import { SupertonicSynthesizer } from './supertonic-synthesizer'

describe('backend do Supertonic', () => {
  beforeEach(() => {
    workerState.scenarios = []
    workerState.backends = []
    workerState.terminateCount = 0
  })

  it('prefere DirectML e cai automaticamente para CPU se a GPU não iniciar', async () => {
    workerState.scenarios.push('startup-error', 'ready')
    const synthesizer = new SupertonicSynthesizer('C:\\recursos-de-teste')

    const result = await synthesizer.synthesize(
      'pedido-1',
      'Olá, Tiago.',
      1,
      new AbortController().signal
    )

    expect(workerState.backends).toEqual(['directml', 'cpu'])
    expect(result.backend).toBe('cpu')
    synthesizer.dispose()
  })

  it('não recria o worker durante um dispose ocorrido na inicialização', async () => {
    workerState.scenarios.push('pending')
    const synthesizer = new SupertonicSynthesizer('C:\\recursos-de-teste')
    const preparation = synthesizer.prepare()

    synthesizer.dispose()

    await expect(preparation).rejects.toMatchObject({ name: 'AbortError' })
    expect(workerState.backends).toEqual(['directml'])
    expect(workerState.terminateCount).toBe(1)
  })
})

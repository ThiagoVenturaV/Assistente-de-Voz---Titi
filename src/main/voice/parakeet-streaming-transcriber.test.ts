import { describe, expect, it } from 'vitest'
import {
  assertStreamPushAllowed,
  MAX_PENDING_STREAM_SAMPLES,
  MAX_STREAM_SAMPLES
} from './parakeet-streaming-transcriber'

describe('streaming transcription limits', () => {
  it('accepts bounded, acknowledged audio', () => {
    expect(() => assertStreamPushAllowed(16_000, 16_000, 8_000)).not.toThrow()
  })

  it('rejects a session longer than 120 seconds', () => {
    expect(() => assertStreamPushAllowed(MAX_STREAM_SAMPLES, MAX_STREAM_SAMPLES, 1))
      .toThrow('120 segundos')
  })

  it('rejects more than 30 seconds waiting in the worker queue', () => {
    expect(() => assertStreamPushAllowed(MAX_PENDING_STREAM_SAMPLES, 0, 1))
      .toThrow('mais rápido')
  })
})

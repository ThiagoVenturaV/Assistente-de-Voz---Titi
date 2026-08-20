export const SUPERTONIC_DEFAULT_VOICE_ID = 5
export const SUPERTONIC_QUALITY_STEPS = 8
export const SUPERTONIC_LANGUAGE = 'pt'

export interface SupertonicGenerationOptions extends Record<string, unknown> {
  sid: number
  speed: number
  numSteps: number
  extra: { lang: string }
}

export function createSupertonicGenerationOptions(rate: number): SupertonicGenerationOptions {
  return {
    sid: SUPERTONIC_DEFAULT_VOICE_ID,
    speed: rate,
    numSteps: SUPERTONIC_QUALITY_STEPS,
    extra: { lang: SUPERTONIC_LANGUAGE }
  }
}

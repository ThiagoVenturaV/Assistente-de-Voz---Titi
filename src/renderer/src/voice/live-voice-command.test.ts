import { describe, expect, it } from 'vitest'
import { resolveLiveVoiceCommand } from './live-voice-command'

describe('resolveLiveVoiceCommand', () => {
  it.each([
    'Para a conversa.',
    'Titi, pare de ouvir!',
    'Encerre o modo ao vivo, por favor.',
    'chega por hoje'
  ])('encerra o modo ao vivo sem enviar %j ao modelo', (phrase) => {
    expect(resolveLiveVoiceCommand(phrase)).toBe('stop')
  })

  it.each([
    'não para a conversa',
    'explique como parar a conversa',
    'pare a música',
    'eu disse chega por hoje, mas continue ouvindo'
  ])('não confunde uma frase comum com comando: %j', (phrase) => {
    expect(resolveLiveVoiceCommand(phrase)).toBeNull()
  })
})

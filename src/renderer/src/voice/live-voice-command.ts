export type LiveVoiceCommand = 'stop'

const STOP_PHRASES = new Set([
  'para',
  'pare',
  'parar',
  'para a live',
  'pare a live',
  'parar a live',
  'para a conversa',
  'pare a conversa',
  'parar a conversa',
  'pode parar a conversa',
  'encerra a conversa',
  'encerre a conversa',
  'encerrar a conversa',
  'finaliza a conversa',
  'finalize a conversa',
  'para de ouvir',
  'pare de ouvir',
  'parar de ouvir',
  'pode parar de ouvir',
  'desliga o modo ao vivo',
  'desligue o modo ao vivo',
  'desativar o modo ao vivo',
  'desative o modo ao vivo',
  'desliga o vivo',
  'desligue o vivo',
  'encerra o vivo',
  'encerre o vivo',
  'encerrar o vivo',
  'corta a conversa',
  'corta o vivo',
  'encerra o modo ao vivo',
  'encerre o modo ao vivo',
  'fim da conversa',
  'chega por agora',
  'chega por hoje'
])

export function resolveLiveVoiceCommand(value: string): LiveVoiceCommand | null {
  let normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  normalized = normalized
    .replace(/^titi\s+/, '')
    .replace(/\s+por favor$/, '')
    .trim()

  return STOP_PHRASES.has(normalized) ? 'stop' : null
}

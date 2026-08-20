export function prepareTextForSpeech(content: string): string {
  const withoutMarkup = content
    .normalize('NFC')
    .replace(/```[\s\S]*?```/g, ' Há um bloco de código no chat. ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(?:https?:\/\/|www\.)\S+/giu, ' O link está no chat. ')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/giu, speakEmailAddress)
    .replace(/\b(?:[a-z0-9-]+\.)+(?:com\.br|com|org|net|io|dev|app)\b/giu, speakDomain)
    .replace(/([#*0-9])\uFE0F?\u20E3/gu, '$1')
    .replace(/(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu, ' ')
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/^\s*(\d+)[.)]\s+/gmu, '$1: ')
    .replace(/^\s*[-+*]\s+/gmu, ' ')
    .replace(/[*_`#>|~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r?\n+/g, '. ')

  return normalizeBrazilianPortugueseSpeech(withoutMarkup)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([:;])\./g, '$1')
    .replace(/\.(?:\s+\.)+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/(?:O link está no chat\.\s*){2,}/g, 'O link está no chat. ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeBrazilianPortugueseSpeech(content: string): string {
  let spoken = content.normalize('NFC')

  spoken = spoken
    .replace(
      /\bvers(?:ão|ao)\s+(?:é\s+)?v?(\d+(?:\.\d+){1,3})(?:-([a-z]+)(?:[.-]?(\d+))?)?\b/giu,
      speakNamedVersion
    )
    .replace(
      /\bv(\d+(?:\.\d+){1,3})(?:-([a-z]+)(?:[.-]?(\d+))?)?\b/giu,
      speakPrefixedVersion
    )
    .replace(
      /\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})\b/g,
      speakDate
    )
    .replace(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/gu, speakBrazilianCurrency)
    .replace(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/giu, speakClockWithMinutes)
    .replace(/\b([01]?\d|2[0-3])h\b/giu, '$1 horas')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*%/gu, '$1 por cento')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*°\s*C\b/giu, '$1 graus Celsius')
    .replace(
      /\b(\d+(?:[.,]\d+)?)\s*(GiB|MiB|KiB|TB|GB|MB|KB|GHz|MHz|kHz|Hz|ms|kg|km)\b/giu,
      speakMeasurement
    )

  for (const [pattern, replacement] of BRAZILIAN_SPEECH_TERMS) {
    spoken = spoken.replace(pattern, replacement)
  }

  return spoken
    .replace(/\s*&\s*/g, ' e ')
    .replace(/\s+\+\s+/g, ' mais ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BRAZILIAN_SPEECH_TERMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpt[- ]BR\b/giu, 'português brasileiro'],
  [/\bChatGPT\b/giu, 'Chat gê pê tê'],
  [/\bDirectML\b/giu, 'Dáirect eme éle'],
  [/\bSupertonic\b/giu, 'Supertônic'],
  [/\bParakeet\b/giu, 'Páraquit'],
  [/\bOllama\b/giu, 'Olama'],
  [/\bQwen\b/giu, 'Cuén'],
  [/\bSpotify\b/giu, 'Ispótifai'],
  [/\bYouTube\b/giu, 'Iutúbi'],
  [/\bGitHub\b/giu, 'Guít Râb'],
  [/\bWhatsApp\b/giu, 'Uótsap'],
  [/\bHTTPS\b/g, 'agá tê tê pê ésse'],
  [/\bHTTP\b/g, 'agá tê tê pê'],
  [/\bHTML\b/g, 'agá tê eme éle'],
  [/\bHDMI\b/g, 'agá dê eme i'],
  [/\bCPU\b/g, 'cê pê u'],
  [/\bGPU\b/g, 'gê pê u'],
  [/\bVRAM\b/g, 'vê rãm'],
  [/\bRAM\b/g, 'rãm'],
  [/\bSSD\b/g, 'ésse ésse dê'],
  [/\bUSB\b/g, 'u ésse bê'],
  [/\bURL\b/g, 'u érre éle'],
  [/\bAPI\b/g, 'á pê i'],
  [/\bTTS\b/g, 'tê tê ésse'],
  [/\bSTT\b/g, 'ésse tê tê'],
  [/\bASR\b/g, 'á ésse érre'],
  [/\bLLM\b/g, 'éle éle eme'],
  [/\bSLM\b/g, 'ésse éle eme'],
  [/\bIA\b/g, 'i á'],
  [/\bRTX\b/g, 'érre tê xis'],
  [/\bNSIS\b/g, 'ene ésse i ésse'],
  [/\bJSON\b/g, 'djêisson'],
  [/\bWAV\b/g, 'uéiv'],
  [/\bPCM\b/g, 'pê cê eme'],
  [/\bASAR\b/g, 'ásar']
]

const MONTH_NAMES = [
  '',
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

const MEASUREMENT_NAMES: Record<string, readonly [string, string]> = {
  gib: ['gibibyte', 'gibibytes'],
  mib: ['mebibyte', 'mebibytes'],
  kib: ['kibibyte', 'kibibytes'],
  tb: ['terabyte', 'terabytes'],
  gb: ['gigabyte', 'gigabytes'],
  mb: ['megabyte', 'megabytes'],
  kb: ['quilobyte', 'quilobytes'],
  ghz: ['gigahertz', 'gigahertz'],
  mhz: ['megahertz', 'megahertz'],
  khz: ['quilohertz', 'quilohertz'],
  hz: ['hertz', 'hertz'],
  ms: ['milissegundo', 'milissegundos'],
  kg: ['quilograma', 'quilogramas'],
  km: ['quilômetro', 'quilômetros']
}

function speakNamedVersion(
  _match: string,
  numeric: string,
  label?: string,
  labelNumber?: string
): string {
  return `versão ${speakVersionParts(numeric, label, labelNumber)}`
}

function speakPrefixedVersion(
  _match: string,
  numeric: string,
  label?: string,
  labelNumber?: string
): string {
  return `versão ${speakVersionParts(numeric, label, labelNumber)}`
}

function speakVersionParts(numeric: string, label?: string, labelNumber?: string): string {
  return [
    numeric.split('.').join(' ponto '),
    label?.toLocaleLowerCase('pt-BR'),
    labelNumber
  ].filter(Boolean).join(' ')
}

function speakDate(_match: string, day: string, month: string, year: string): string {
  return `${Number(day)} de ${MONTH_NAMES[Number(month)]} de ${year}`
}

function speakBrazilianCurrency(
  _match: string,
  reais: string,
  centavos?: string
): string {
  const normalizedReais = reais.replaceAll('.', '')
  const realLabel = Number(normalizedReais) === 1 ? 'real' : 'reais'
  if (!centavos || Number(centavos) === 0) return `${normalizedReais} ${realLabel}`
  const normalizedCents = centavos.padEnd(2, '0')
  const centLabel = Number(normalizedCents) === 1 ? 'centavo' : 'centavos'
  return `${normalizedReais} ${realLabel} e ${normalizedCents} ${centLabel}`
}

function speakClockWithMinutes(_match: string, hours: string, minutes: string): string {
  const minuteLabel = Number(minutes) === 1 ? 'minuto' : 'minutos'
  return `${Number(hours)} horas e ${Number(minutes)} ${minuteLabel}`
}

function speakMeasurement(_match: string, value: string, unit: string): string {
  const names = MEASUREMENT_NAMES[unit.toLocaleLowerCase('en-US')]
  if (!names) return `${value} ${unit}`
  const normalized = Number(value.replace(',', '.'))
  return `${value} ${normalized === 1 ? names[0] : names[1]}`
}

function speakEmailAddress(value: string): string {
  return value
    .replace('@', ' arroba ')
    .replaceAll('.', ' ponto ')
    .replaceAll('_', ' sublinhado ')
    .replaceAll('-', ' hífen ')
}

function speakDomain(value: string): string {
  return value.replaceAll('.', ' ponto ')
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return buffer
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

import { useEffect, useRef, useState } from 'react'
import type {
  DiagnosticSelfTestModelResult,
  TitiSettings
} from '../../../shared/contracts'
import { PcmRecorder } from '../voice/pcm-recorder'

type SelfTestStepId = 'microphone' | 'transcription' | 'model' | 'tool' | 'speech'
type SelfTestStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
type SelfTestPhase = 'ready' | 'recording' | 'running' | 'confirm-audio' | 'complete' | 'failed' | 'cancelled'

interface SelfTestStep {
  id: SelfTestStepId
  label: string
  description: string
  status: SelfTestStepStatus
}

const TRANSCRIPTION_TIMEOUT_MS = 90_000
const MODEL_TIMEOUT_MS = 95_000
const SYNTHESIS_TIMEOUT_MS = 90_000
const MICROPHONE_START_TIMEOUT_MS = 15_000
const SPEECH_SAMPLE = 'O autoteste de voz do Titi está funcionando. Você consegue me ouvir?'

export function GuidedSelfTest({ settings }: { settings: TitiSettings }): React.JSX.Element {
  const [steps, setSteps] = useState(createSelfTestSteps)
  const [phase, setPhase] = useState<SelfTestPhase>('ready')
  const [notice, setNotice] = useState('O teste não abre aplicativos, não salva conversa e não envia dados.')
  const [transcription, setTranscription] = useState('')
  const [modelResult, setModelResult] = useState<DiagnosticSelfTestModelResult | null>(null)
  const recorderRef = useRef<PcmRecorder | null>(null)
  const runControllerRef = useRef<AbortController | null>(null)
  const runGenerationRef = useRef(0)
  const modelRequestIdRef = useRef<string | null>(null)
  const synthesisRequestIdRef = useRef<string | null>(null)
  const transcribingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    runGenerationRef.current += 1
    cleanupActiveRun()
  }, [])

  async function start(): Promise<void> {
    cleanupActiveRun()
    const generation = ++runGenerationRef.current
    const controller = new AbortController()
    runControllerRef.current = controller
    setSteps(setStepStatus(createSelfTestSteps(), 'microphone', 'running'))
    setPhase('recording')
    setTranscription('')
    setModelResult(null)
    setNotice('Diga uma frase curta. O teste termina automaticamente após uma pausa, ou você pode parar agora.')

    const nextRecorder = new PcmRecorder(
      (reason) => {
        if (generation !== runGenerationRef.current) return
        if (reason === 'timeout') {
          failStep('microphone', 'Não ouvi fala durante 20 segundos. Verifique a entrada escolhida.', generation)
        } else {
          void finishRecording(generation)
        }
      },
      settings.voice.inputDeviceId,
      undefined,
      () => failStep(
        'microphone',
        'O microfone foi desconectado ou perdeu a permissão durante o teste.',
        generation
      )
    )
    recorderRef.current = nextRecorder

    try {
      await withDeadline(
        nextRecorder.start(),
        MICROPHONE_START_TIMEOUT_MS,
        controller.signal,
        () => nextRecorder.cancel(),
        'O Windows demorou demais para liberar o microfone.'
      )
      if (generation !== runGenerationRef.current) nextRecorder.cancel()
    } catch (error) {
      if (!isCancelled(error, generation, runGenerationRef.current)) {
        failStep('microphone', errorMessage(error, 'Não consegui abrir o microfone.'), generation)
      }
    }
  }

  async function finishRecording(generation = runGenerationRef.current): Promise<void> {
    const currentRecorder = recorderRef.current
    if (!currentRecorder || generation !== runGenerationRef.current) return
    recorderRef.current = null
    const controller = runControllerRef.current
    if (!controller) return
    setPhase('running')
    setSteps((current) => setStepStatus(
      setStepStatus(current, 'microphone', 'passed'),
      'transcription',
      'running'
    ))
    setNotice('Transcrevendo a gravação localmente…')

    try {
      const wavAudio = await currentRecorder.stop()
      transcribingRef.current = true
      const result = await withDeadline(
        window.titi.voice.transcribe(wavAudio),
        TRANSCRIPTION_TIMEOUT_MS,
        controller.signal,
        () => void window.titi.voice.cancelTranscription(),
        'A transcrição excedeu 90 segundos.'
      )
      transcribingRef.current = false
      if (generation !== runGenerationRef.current) return
      const text = result.text.trim()
      if (!text) throw new Error('A transcrição terminou sem reconhecer texto.')
      setTranscription(text)
      setSteps((current) => setStepStatus(
        setStepStatus(current, 'transcription', 'passed'),
        'model',
        'running'
      ))
      setNotice('A fala foi reconhecida. Testando a IA local e a ferramenta segura de relógio…')
      await runModelAndSpeech(generation, controller)
    } catch (error) {
      transcribingRef.current = false
      if (!isCancelled(error, generation, runGenerationRef.current)) {
        failStep('transcription', errorMessage(error, 'Não consegui transcrever a gravação.'), generation)
      }
    }
  }

  async function runModelAndSpeech(
    generation: number,
    controller: AbortController
  ): Promise<void> {
    const modelRequestId = crypto.randomUUID()
    modelRequestIdRef.current = modelRequestId
    try {
      const result = await withDeadline(
        window.titi.diagnostics.runSelfTestModel(modelRequestId),
        MODEL_TIMEOUT_MS,
        controller.signal,
        () => void window.titi.diagnostics.cancelSelfTest(modelRequestId),
        'A prova da IA local excedeu 95 segundos.'
      )
      modelRequestIdRef.current = null
      if (generation !== runGenerationRef.current) return
      if (!result.tool.called || !result.tool.ok) {
        throw new SelfTestStageError('tool', 'A IA não executou a ferramenta segura de data e hora.')
      }
      setModelResult(result)
      setSteps((current) => setStepStatus(
        setStepStatus(
          setStepStatus(current, 'model', 'passed'),
          'tool',
          'passed'
        ),
        'speech',
        'running'
      ))
      setNotice('IA e ferramenta responderam. Preparando uma frase com a voz local…')
      await synthesizeAndPlay(generation, controller)
    } catch (error) {
      modelRequestIdRef.current = null
      if (isCancelled(error, generation, runGenerationRef.current)) return
      const stage = error instanceof SelfTestStageError ? error.stage : 'model'
      failStep(stage, errorMessage(error, 'A prova da IA local falhou.'), generation)
    }
  }

  async function synthesizeAndPlay(
    generation: number,
    controller: AbortController
  ): Promise<void> {
    const synthesisRequestId = crypto.randomUUID()
    synthesisRequestIdRef.current = synthesisRequestId
    try {
      const synthesis = await withDeadline(
        window.titi.voice.synthesize(
          synthesisRequestId,
          SPEECH_SAMPLE,
          settings.voice.speechRate
        ),
        SYNTHESIS_TIMEOUT_MS,
        controller.signal,
        () => void window.titi.voice.cancelSynthesis(synthesisRequestId),
        'A síntese de voz excedeu 90 segundos.'
      )
      synthesisRequestIdRef.current = null
      if (generation !== runGenerationRef.current) return
      releaseAudio()
      audioUrlRef.current = URL.createObjectURL(new Blob([synthesis.wavAudio], { type: 'audio/wav' }))
      await playCurrentAudio(controller.signal, synthesis.audioDurationMs)
      if (generation !== runGenerationRef.current) return
      setPhase('confirm-audio')
      setNotice('A reprodução terminou. Confirme abaixo se você ouviu a frase claramente.')
    } catch (error) {
      synthesisRequestIdRef.current = null
      if (!isCancelled(error, generation, runGenerationRef.current)) {
        failStep('speech', errorMessage(error, 'Não consegui reproduzir a voz local.'), generation)
      }
    }
  }

  async function replay(): Promise<void> {
    const controller = runControllerRef.current
    if (!controller || !audioUrlRef.current) return
    setNotice('Reproduzindo novamente…')
    try {
      await playCurrentAudio(controller.signal, 15_000)
      setNotice('Confirme se você ouviu a frase claramente.')
    } catch (error) {
      failStep('speech', errorMessage(error, 'Não consegui reproduzir a voz local.'), runGenerationRef.current)
    }
  }

  async function playCurrentAudio(signal: AbortSignal, durationMs: number): Promise<void> {
    const url = audioUrlRef.current
    if (!url) throw new Error('A amostra de voz não está disponível.')
    audioRef.current?.pause()
    const audio = new Audio(url)
    audioRef.current = audio
    await withDeadline(
      new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error('O Windows não conseguiu reproduzir a amostra de voz.'))
        void audio.play().catch(() => reject(new Error('O Windows bloqueou a reprodução da voz local.')))
      }),
      Math.max(15_000, Math.min(300_000, durationMs + 10_000)),
      signal,
      () => audio.pause(),
      'A reprodução da voz excedeu o tempo esperado.'
    )
    if (audioRef.current === audio) audioRef.current = null
  }

  function confirmAudio(heard: boolean): void {
    if (phase !== 'confirm-audio') return
    if (heard) {
      setSteps((current) => setStepStatus(current, 'speech', 'passed'))
      setPhase('complete')
      setNotice('Autoteste concluído: microfone, transcrição, IA, ferramenta e voz estão funcionando.')
      releaseAudio()
      runControllerRef.current = null
    } else {
      failStep('speech', 'A voz foi gerada, mas você informou que não ouviu o áudio.', runGenerationRef.current)
    }
  }

  function cancel(): void {
    runGenerationRef.current += 1
    const activeSteps = steps.map((step) => ({
      ...step,
      status: step.status === 'running' ? 'cancelled' as const : step.status
    }))
    cleanupActiveRun()
    setSteps(activeSteps)
    setPhase('cancelled')
    setNotice('Autoteste cancelado. Você pode começar novamente quando quiser.')
  }

  function failStep(step: SelfTestStepId, message: string, generation: number): void {
    if (generation !== runGenerationRef.current) return
    cleanupActiveRun()
    setSteps((current) => setStepStatus(current, step, 'failed'))
    setPhase('failed')
    setNotice(message)
  }

  function cleanupActiveRun(): void {
    recorderRef.current?.cancel()
    recorderRef.current = null
    runControllerRef.current?.abort()
    runControllerRef.current = null
    if (transcribingRef.current) void window.titi.voice.cancelTranscription().catch(() => undefined)
    transcribingRef.current = false
    const modelRequestId = modelRequestIdRef.current
    modelRequestIdRef.current = null
    if (modelRequestId) void window.titi.diagnostics.cancelSelfTest(modelRequestId).catch(() => undefined)
    const synthesisRequestId = synthesisRequestIdRef.current
    synthesisRequestIdRef.current = null
    if (synthesisRequestId) void window.titi.voice.cancelSynthesis(synthesisRequestId).catch(() => undefined)
    releaseAudio()
  }

  function releaseAudio(): void {
    audioRef.current?.pause()
    audioRef.current = null
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
  }

  const running = phase === 'recording' || phase === 'running'

  return (
    <section className="guided-self-test" aria-labelledby="guided-self-test-title">
      <header>
        <div>
          <strong id="guided-self-test-title">Autoteste guiado</strong>
          <p>Verifica a cadeia real sem abrir aplicativos nem gravar uma conversa.</p>
        </div>
        <span className={`self-test-badge is-${phase}`}>{phaseLabel(phase)}</span>
      </header>

      <ol className="self-test-steps">
        {steps.map((step) => (
          <li className={`is-${step.status}`} key={step.id}>
            <i aria-hidden="true">{statusSymbol(step.status)}</i>
            <div><strong>{step.label}</strong><span>{step.description}</span></div>
            <small>{statusLabel(step.status)}</small>
          </li>
        ))}
      </ol>

      {transcription && (
        <p className="self-test-result"><strong>Transcrição</strong><span>“{transcription}”</span></p>
      )}
      {modelResult && (
        <p className="self-test-result">
          <strong>IA e ferramenta</strong>
          <span>{modelResult.model} · {modelResult.durationMs} ms · {modelResult.tool.message}</span>
        </p>
      )}

      <p className="self-test-notice" role="status" aria-live="polite">{notice}</p>

      <div className="self-test-actions">
        {(phase === 'ready' || phase === 'complete' || phase === 'failed' || phase === 'cancelled') && (
          <button className="secondary-button" onClick={() => void start()}>
            {phase === 'ready' ? 'Iniciar autoteste' : 'Testar novamente'}
          </button>
        )}
        {phase === 'recording' && (
          <button className="primary-button" onClick={() => void finishRecording()}>Terminar gravação</button>
        )}
        {phase === 'confirm-audio' && (
          <>
            <button className="secondary-button" onClick={() => void replay()}>Ouvir novamente</button>
            <button className="secondary-button" onClick={() => confirmAudio(false)}>Não ouvi</button>
            <button className="primary-button" onClick={() => confirmAudio(true)}>Ouvi claramente</button>
          </>
        )}
        {running && <button className="secondary-button danger-button" onClick={cancel}>Cancelar teste</button>}
      </div>
    </section>
  )
}

export function createSelfTestSteps(): SelfTestStep[] {
  return [
    { id: 'microphone', label: 'Microfone', description: 'Captura uma frase curta.', status: 'pending' },
    { id: 'transcription', label: 'Transcrição', description: 'Converte sua fala localmente.', status: 'pending' },
    { id: 'model', label: 'IA local', description: 'Obtém uma resposta do modelo escolhido.', status: 'pending' },
    { id: 'tool', label: 'Ferramenta segura', description: 'Consulta apenas data e hora.', status: 'pending' },
    { id: 'speech', label: 'Voz local', description: 'Gera áudio e pede sua confirmação.', status: 'pending' }
  ]
}

function setStepStatus(
  steps: SelfTestStep[],
  id: SelfTestStepId,
  status: SelfTestStepStatus
): SelfTestStep[] {
  return steps.map((step) => step.id === id ? { ...step, status } : step)
}

function statusSymbol(status: SelfTestStepStatus): string {
  if (status === 'passed') return '✓'
  if (status === 'failed') return '!'
  if (status === 'cancelled') return '–'
  if (status === 'running') return '•'
  return ''
}

function statusLabel(status: SelfTestStepStatus): string {
  return ({
    pending: 'Aguardando',
    running: 'Testando…',
    passed: 'Funcionando',
    failed: 'Falhou',
    cancelled: 'Cancelado'
  } as const)[status]
}

function phaseLabel(phase: SelfTestPhase): string {
  return ({
    ready: 'Pronto',
    recording: 'Ouvindo',
    running: 'Testando',
    'confirm-audio': 'Confirme o áudio',
    complete: 'Tudo certo',
    failed: 'Atenção',
    cancelled: 'Cancelado'
  } as const)[phase]
}

async function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
  onTimeout: () => void,
  timeoutMessage: string
): Promise<T> {
  if (signal.aborted) throw cancellationError()
  let timeout: number | undefined
  let detachAbort: (() => void) | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    const abort = (): void => reject(cancellationError())
    signal.addEventListener('abort', abort, { once: true })
    detachAbort = () => signal.removeEventListener('abort', abort)
    timeout = window.setTimeout(() => {
      onTimeout()
      const error = new Error(timeoutMessage)
      error.name = 'TimeoutError'
      reject(error)
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout)
    detachAbort?.()
  }
}

class SelfTestStageError extends Error {
  constructor(readonly stage: SelfTestStepId, message: string) {
    super(message)
  }
}

function cancellationError(): Error {
  const error = new Error('Autoteste cancelado.')
  error.name = 'AbortError'
  return error
}

function isCancelled(error: unknown, expectedGeneration: number, currentGeneration: number): boolean {
  return expectedGeneration !== currentGeneration || (error instanceof Error && error.name === 'AbortError')
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback
}

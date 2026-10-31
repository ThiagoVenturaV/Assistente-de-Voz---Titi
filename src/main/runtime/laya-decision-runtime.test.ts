import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { OllamaProvider } from '../harness/ollama-provider'
import type { ToolExecutor } from '../tools/contracts'
import {
  LayaDecisionRuntime,
  interpretLayaIntentProbabilities,
  resolveOllayaRuntimeDir,
  shortlistControls,
  validateLayaChoiceAnswer,
  type ToolNeedDecisionRouter
} from './laya-decision-runtime'

describe('LayaDecisionRuntime (System 1 router)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('interpreta as probabilidades das 5 categorias de intenção em needs_tool vs respond', () => {
    const conversational = interpretLayaIntentProbabilities({
      open_app_or_site: 0.01,
      control_media_or_screen: 0.01,
      system_datetime: 0.01,
      explanation_or_question: 0.85,
      greeting_or_chat: 0.12
    })
    expect(conversational).toEqual({
      decision: 'respond',
      confidence: 0.97,
      category: 'explanation_or_question'
    })

    const toolAction = interpretLayaIntentProbabilities({
      open_app_or_site: 0.94,
      control_media_or_screen: 0.03,
      system_datetime: 0.01,
      explanation_or_question: 0.01,
      greeting_or_chat: 0.01
    })
    expect(toolAction).toEqual({
      decision: 'needs_tool',
      confidence: 0.98,
      category: 'open_app_or_site'
    })
  })

  it('resolve o diretório de runtime do Ollaya em LOCALAPPDATA sob demanda', () => {
    const prevLocal = process.env.LOCALAPPDATA
    const prevOverride = process.env.TITI_OLLAYA_RUNTIME_DIR
    try {
      delete process.env.TITI_OLLAYA_RUNTIME_DIR
      process.env.LOCALAPPDATA = 'C:\\Users\\qa\\AppData\\Local'
      expect(resolveOllayaRuntimeDir('C:\\Titi\\resources')).toBe(
        'C:\\Users\\qa\\AppData\\Local\\Titi\\runtime\\ollaya'
      )
      const runtime = new LayaDecisionRuntime('C:\\Titi\\resources')
      expect(runtime.executablePath).toBe(
        'C:\\Users\\qa\\AppData\\Local\\Titi\\runtime\\ollaya\\bin\\ollaya.exe'
      )
    } finally {
      if (prevLocal === undefined) delete process.env.LOCALAPPDATA
      else process.env.LOCALAPPDATA = prevLocal
      if (prevOverride === undefined) delete process.env.TITI_OLLAYA_RUNTIME_DIR
      else process.env.TITI_OLLAYA_RUNTIME_DIR = prevOverride
    }
  })

  it('roteia conversa direto para o chat limpo no System 1 sem enviar catálogo de ferramentas', async () => {
    const router: ToolNeedDecisionRouter = {
      decideToolNeed: vi.fn().mockResolvedValue({
        decision: 'respond',
        confidence: 0.93,
        category: 'explanation_or_question',
        durationMs: 45
      })
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { role: 'assistant', content: 'Rust garante segurança de memória em tempo de compilação.' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const tools: ToolExecutor = {
      definitions: [
        {
          type: 'function',
          risk: 'reversible',
          function: {
            name: 'open_application',
            description: 'Abre um aplicativo.',
            parameters: { type: 'object', properties: {} }
          }
        }
      ],
      execute: vi.fn()
    }

    const provider = new OllamaProvider(tools, router)
    const response = await provider.complete(
      [
        {
          id: 'm1',
          role: 'user',
          content: 'Quais as vantagens de compiladores modernos para sistemas embarcados?',
          createdAt: '2026-10-31T00:00:00.000Z'
        }
      ],
      DEFAULT_SETTINGS
    )

    expect(response).toBe('Rust garante segurança de memória em tempo de compilação.')
    expect(router.decideToolNeed).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.tools).toBeUndefined()
  })

  it('valida estritamente a distribuição de probabilidades do LayaDecider e rejeita escolhas inconsistentes', () => {
    const valid = validateLayaChoiceAnswer(
      {
        choice: '1',
        confidence: 0.98,
        probabilities: { '0': 0.01, '1': 0.98, '2': 0.01 }
      },
      ['0', '1', '2']
    )
    expect(valid.choice).toBe('1')

    expect(() =>
      validateLayaChoiceAnswer(
        {
          choice: '0',
          confidence: 0.98,
          probabilities: { '0': 0.1, '1': 0.9 }
        },
        ['0', '1']
      )
    ).toThrow('maior probabilidade')

    expect(() =>
      validateLayaChoiceAnswer(
        {
          choice: '99',
          confidence: 0.98,
          probabilities: { '0': 0.5, '1': 0.5 }
        },
        ['0', '1']
      )
    ).toThrow('fora do conjunto observado')
  })

  it('reduz mais de 20 candidatos mantendo a ordem original e priorizando relevância textual (shortlistControls)', () => {
    const controls = Array.from({ length: 25 }, (_, index) => ({
      name: index === 22 ? 'Bluetooth e dispositivos' : `Item genérico ${index}`,
      controlType: 'TabItem'
    }))
    const shortlisted = shortlistControls(controls, 'Abrir Bluetooth e dispositivos', 20)
    expect(shortlisted).toHaveLength(20)
    expect(shortlisted.some((item) => item.name === 'Bluetooth e dispositivos')).toBe(true)
  })
})

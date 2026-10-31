import { describe, expect, it, vi } from 'vitest'
import type {
  LayaCandidateControl,
  LayaTargetDecisionRouter
} from '../runtime/laya-decision-runtime'
import { DesktopToolkit } from './desktop-toolkit'
import {
  analyzePreflightPlan,
  LayaComputerPlanManager,
  validateLayaComputerPlan
} from './laya-computer-plan'
import type { ComputerController, ComputerObservation } from './windows-ui-automation'

function makeSnapshot(windowTitle: string, controls: ComputerObservation['controls']): ComputerObservation {
  return {
    application: 'Photos',
    processId: 5150,
    windowHandle: '998877',
    windowTitle,
    processName: 'Photos',
    controls
  }
}

function makeController(snapshots: ComputerObservation[]): ComputerController & {
  observe: ReturnType<typeof vi.fn>
  invoke: ReturnType<typeof vi.fn>
} {
  let index = 0
  return {
    observe: vi.fn(async () => snapshots[Math.min(index++, snapshots.length - 1)]),
    invoke: vi.fn(async (application: string, target: string, controlType?: string) => ({
      application,
      processId: 5150,
      windowHandle: '998877',
      windowTitle: 'Photos',
      processName: 'Photos',
      invoked: true as const,
      control: {
        name: target,
        controlType: controlType ?? 'RadioButton',
        automationId: target.toLowerCase(),
        runtimeId: '10.1',
        enabled: true
      }
    })),
    capture: vi.fn(),
    click: vi.fn(),
    focusWindow: vi.fn(async (application: string, windowTitle?: string) => ({
      application,
      processId: 5150,
      windowHandle: '998877',
      windowTitle: windowTitle ?? 'Photos',
      processName: 'Photos',
      action: 'focus' as const
    })),
    minimizeWindow: vi.fn(async (application: string, windowTitle?: string) => ({
      application,
      processId: 5150,
      windowHandle: '998877',
      windowTitle: windowTitle ?? 'Photos',
      processName: 'Photos',
      action: 'minimize' as const
    })),
    closeWindow: vi.fn()
  }
}

describe('LayaComputerPlan (arquitetura laya-computer / mcps-catalog)', () => {
  it('executa plano de múltiplas etapas localmente usando Laya para escolher entre candidatos e verificando predicados a cada etapa', async () => {
    const initialControls = [
      { name: 'Years', controlType: 'RadioButton', automationId: 'years', runtimeId: '10.1', enabled: true },
      { name: 'Months', controlType: 'RadioButton', automationId: 'months', runtimeId: '10.2', enabled: true },
      { name: 'All Photos', controlType: 'RadioButton', automationId: 'all', runtimeId: '10.3', enabled: true }
    ]

    const controller = makeController([
      makeSnapshot('Photos - All Photos', initialControls),
      makeSnapshot('Photos - Months', initialControls),
      makeSnapshot('Photos - Months', initialControls),
      makeSnapshot('Photos - Years', initialControls)
    ])

    const decider: LayaTargetDecisionRouter = {
      chooseTarget: vi.fn(async (instruction: string, candidates: LayaCandidateControl[]) => {
        const wanted = instruction.includes('Months') ? 'Months' : 'Years'
        const match = candidates.find((c: LayaCandidateControl) => c.name === wanted)!
        return {
          choice: match.id,
          confidence: 0.96,
          probabilities: Object.fromEntries(
            candidates.map((c: LayaCandidateControl) => [c.id, c.id === match.id ? 0.96 : 0.02])
          ),
          durationMs: 42
        }
      }),
      metrics: () => ({
        model: 'laya:multilingual',
        calls: 2,
        inferenceSeconds: 0.084,
        loadSeconds: 0.01,
        remoteTokens: null
      })
    }

    const manager = new LayaComputerPlanManager(controller, decider)
    const plan = {
      version: 1,
      goal: 'Verify local navigation between Months and Years in Photos.',
      application: 'Photos',
      steps: [
        {
          id: 'months',
          instruction: 'Which control selects Months?',
          action: 'click',
          target: { controlType: 'RadioButton' },
          success: [{ kind: 'window_title_contains', value: 'Months' }],
          next_step: 'years'
        },
        {
          id: 'years',
          instruction: 'Which control selects Years?',
          action: 'click',
          target: { controlType: 'RadioButton' },
          success: [{ kind: 'window_title_contains', value: 'Years' }],
          next_step: null
        }
      ]
    }

    const result = await manager.runPlan(plan)
    expect(result.status).toBe('completed')
    expect(result.verification).toBe('satisfied')
    expect(result.completed_steps).toEqual(['months', 'years'])
    expect(result.metrics.actions).toBe(2)
    expect(result.metrics.decisions).toBe(2)
    expect(decider.chooseTarget).toHaveBeenCalledTimes(2)
    expect(controller.invoke).toHaveBeenNthCalledWith(
      1,
      'Photos',
      'Months',
      'RadioButton',
      expect.objectContaining({
        control: { automationId: 'months', runtimeId: '10.2' }
      }),
      undefined
    )
    expect(controller.invoke).toHaveBeenNthCalledWith(
      2,
      'Photos',
      'Years',
      'RadioButton',
      expect.objectContaining({
        control: { automationId: 'years', runtimeId: '10.1' }
      }),
      undefined
    )
  })

  it('dispensa chamada ao Laya quando o seletor encontra exatamente um único candidato observado', async () => {
    const controls = [
      { name: 'Years', controlType: 'RadioButton', automationId: 'years', runtimeId: '10.1', enabled: true }
    ]
    const controller = makeController([
      makeSnapshot('Photos', controls),
      makeSnapshot('Photos - Years', controls)
    ])
    const decider: LayaTargetDecisionRouter = {
      chooseTarget: vi.fn(),
      metrics: () => ({ model: 'laya:multilingual', calls: 0, inferenceSeconds: 0, loadSeconds: 0, remoteTokens: null })
    }
    const manager = new LayaComputerPlanManager(controller, decider)
    const result = await manager.runPlan({
      version: 1,
      goal: 'Select Years view',
      application: 'Photos',
      steps: [
        {
          id: 'years',
          instruction: 'Choose Years',
          action: 'click',
          target: { controlType: 'RadioButton', label_contains: 'Years' },
          success: [{ kind: 'window_title_contains', value: 'Years' }],
          next_step: null
        }
      ]
    })

    expect(result.status).toBe('completed')
    expect(result.metrics.decisions).toBe(0)
    expect(decider.chooseTarget).not.toHaveBeenCalled()
  })

  it('pausa em rescue_needed quando um controle não é encontrado e permite resume preservando etapas concluídas', async () => {
    const controlsStep1 = [
      { name: 'Months', controlType: 'RadioButton', automationId: 'months', runtimeId: '10.2', enabled: true },
      { name: 'Years', controlType: 'RadioButton', automationId: 'years', runtimeId: '10.1', enabled: true }
    ]
    const controller = makeController([
      makeSnapshot('Photos', controlsStep1),
      makeSnapshot('Photos - Months', controlsStep1),
      makeSnapshot('Photos - Months', controlsStep1),
      makeSnapshot('Photos - Months', controlsStep1),
      makeSnapshot('Photos - Years', controlsStep1)
    ])
    const manager = new LayaComputerPlanManager(controller)

    const initialPlan = {
      version: 1,
      goal: 'Select Months then Years',
      application: 'Photos',
      steps: [
        {
          id: 'months',
          instruction: 'Select Months',
          action: 'click',
          target: { controlType: 'RadioButton', label_contains: 'Months' },
          success: [{ kind: 'window_title_contains', value: 'Months' }],
          next_step: 'years'
        },
        {
          id: 'years',
          instruction: 'Select Years',
          action: 'click',
          target: { controlType: 'RadioButton', label_contains: 'NonExistentLabel' },
          success: [{ kind: 'window_title_contains', value: 'Years' }],
          next_step: null
        }
      ]
    }

    const paused = await manager.runPlan(initialPlan)
    expect(paused.status).toBe('rescue_needed')
    expect(paused.reason).toBe('target_not_found')
    expect(paused.completed_steps).toEqual(['months'])
    expect(paused.rescue_context?.current_step.id).toBe('years')

    // Tentar modificar etapa já concluída deve falhar
    await expect(
      manager.resumePlan(paused.run_id!, 1, {
        ...initialPlan,
        version: 2,
        steps: [
          {
            ...initialPlan.steps[0],
            instruction: 'Modified instruction on completed step'
          },
          {
            ...initialPlan.steps[1],
            target: { controlType: 'RadioButton', label_contains: 'Years' }
          }
        ]
      })
    ).rejects.toThrow('preservar a etapa já concluída "months"')

    // Reparo mínimo válido apenas na etapa pendente 'years'
    const resumed = await manager.resumePlan(paused.run_id!, 1, {
      ...initialPlan,
      version: 2,
      steps: [
        initialPlan.steps[0],
        {
          ...initialPlan.steps[1],
          target: { controlType: 'RadioButton', label_contains: 'Years' }
        }
      ]
    })

    expect(resumed.status).toBe('completed')
    expect(resumed.verification).toBe('satisfied')
    expect(resumed.completed_steps).toEqual(['months', 'years'])
  })

  it('valida estaticamente planos com preflight detectando etapas inalcançáveis e alvos bloqueados', () => {
    const unreachable = analyzePreflightPlan({
      version: 1,
      goal: 'Test reachability',
      application: 'Spotify',
      steps: [
        {
          id: 'step-1',
          instruction: 'Click Play',
          action: 'click',
          target: { controlType: 'Button', label_contains: 'Play' },
          success: [{ kind: 'exists', controlType: 'Button', label_contains: 'Pause' }],
          next_step: null
        },
        {
          id: 'orphan-step',
          instruction: 'Never reached',
          action: 'verify',
          success: [{ kind: 'exists', controlType: 'Button', label_contains: 'Pause' }],
          next_step: null
        }
      ]
    })
    expect(unreachable.status).toBe('invalid')
    expect(unreachable.issues).toContainEqual(
      expect.objectContaining({ code: 'UNREACHABLE_STEP', step_id: 'orphan-step' })
    )

    const blockedTarget = analyzePreflightPlan({
      version: 1,
      goal: 'Blocked sensitive action',
      application: 'Spotify',
      steps: [
        {
          id: 'step-1',
          instruction: 'Click comprar',
          action: 'click',
          target: { controlType: 'Button', label_contains: 'Comprar agora' },
          success: [{ kind: 'exists', controlType: 'Button', label_contains: 'Confirmado' }],
          next_step: null
        }
      ]
    })
    expect(blockedTarget.status).toBe('invalid')
    expect(blockedTarget.issues).toContainEqual(
      expect.objectContaining({ code: 'BLOCKED_TARGET', step_id: 'step-1' })
    )
  })

  it('integra computer_plan e desambiguação Laya em computer_action no DesktopToolkit', async () => {
    const controls = [
      { name: 'Years', controlType: 'RadioButton', automationId: 'years', runtimeId: '10.1', enabled: true },
      { name: 'Months', controlType: 'RadioButton', automationId: 'months', runtimeId: '10.2', enabled: true }
    ]
    const controller = makeController([
      makeSnapshot('Photos', controls),
      makeSnapshot('Photos - Months', controls)
    ])
    const decider: LayaTargetDecisionRouter = {
      chooseTarget: vi.fn(async (_instruction: string, candidates: LayaCandidateControl[]) => ({
        choice: candidates[1].id,
        confidence: 0.95,
        probabilities: { [candidates[0].id]: 0.05, [candidates[1].id]: 0.95 },
        durationMs: 30
      })),
      metrics: () => ({ model: 'laya:multilingual', calls: 1, inferenceSeconds: 0.03, loadSeconds: 0, remoteTokens: null })
    }

    const toolkit = new DesktopToolkit(
      { open: vi.fn() },
      controller,
      async () => true,
      undefined,
      undefined,
      decider
    )

    const planResult = await toolkit.execute('computer_plan', {
      mode: 'run',
      plan: validateLayaComputerPlan({
        version: 1,
        goal: 'Select Months',
        application: 'Photos',
        steps: [
          {
            id: 'months',
            instruction: 'Which control selects Months?',
            action: 'click',
            target: { controlType: 'RadioButton' },
            success: [{ kind: 'window_title_contains', value: 'Months' }],
            next_step: null
          }
        ]
      })
    })

    expect(planResult.ok).toBe(true)
    expect(planResult.status).toBe('confirmed')
    expect(planResult.message).toContain('Plano concluído e verificado localmente')
  })
})

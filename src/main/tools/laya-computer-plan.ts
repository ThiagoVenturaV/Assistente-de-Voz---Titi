import { randomUUID } from 'node:crypto'
import {
  shortlistControls,
  type LayaCandidateControl,
  type LayaTargetDecisionRouter
} from '../runtime/laya-decision-runtime'
import { assessToolRisk } from './confirmation-tool-executor'
import type {
  ComputerController,
  ComputerObservation,
  UiControlSnapshot,
  UiInvocationIdentity
} from './windows-ui-automation'

export type LayaPlanAction = 'click' | 'verify' | 'wait' | 'focus' | 'minimize'

export type LayaPredicateKind =
  | 'exists'
  | 'not_exists'
  | 'window_title_contains'
  | 'enabled'

export type LayaAllowedControlType =
  | 'Button'
  | 'CheckBox'
  | 'Hyperlink'
  | 'ListItem'
  | 'MenuItem'
  | 'RadioButton'
  | 'TabItem'

const ALLOWED_CONTROL_TYPES = new Set<LayaAllowedControlType>([
  'Button',
  'CheckBox',
  'Hyperlink',
  'ListItem',
  'MenuItem',
  'RadioButton',
  'TabItem'
])

const ALLOWED_ACTIONS = new Set<LayaPlanAction>([
  'click',
  'verify',
  'wait',
  'focus',
  'minimize'
])

const ALLOWED_PREDICATE_KINDS = new Set<LayaPredicateKind>([
  'exists',
  'not_exists',
  'window_title_contains',
  'enabled'
])

export interface LayaControlSelector {
  controlType?: LayaAllowedControlType
  label_contains?: string
  automation_id?: string
  index?: number | 'first' | 'last'
}

export interface LayaStatePredicate {
  kind: LayaPredicateKind
  controlType?: LayaAllowedControlType
  label_contains?: string
  value?: string
}

export interface LayaComputerStep {
  id: string
  instruction: string
  action: LayaPlanAction
  target?: LayaControlSelector
  duration_seconds?: number
  preconditions: LayaStatePredicate[]
  success: LayaStatePredicate[]
  next_step: string | null
  on_failure: string | null
  window_title?: string
}

export interface LayaComputerPlan {
  version: number
  goal: string
  application: string
  steps: LayaComputerStep[]
  start_step: string | null
  max_actions: number
  max_seconds: number
  max_rescues: number
  first_step_id: string
}

export type LayaRunStatus =
  | 'running'
  | 'completed'
  | 'rescue_needed'
  | 'blocked'
  | 'stopped'

export type LayaVerificationStatus = 'satisfied' | 'not_satisfied' | 'unknown'

export interface LayaStepEvidence {
  step_id: string
  window_title: string
  predicates: LayaStatePredicate[]
  observed: Array<Record<string, unknown>>
}

export interface LayaRescueContext {
  reason: string
  plan_version: number
  goal: string
  application: string
  current_step: LayaComputerStep
  observation: Record<string, unknown> | null
  completed_steps: string[]
  recent_effects: Array<{ step_id: string; effect: string; note: string }>
  instruction: string
}

export interface LayaRunResult {
  run_id?: string
  status: LayaRunStatus
  verification: LayaVerificationStatus
  plan_version: number
  current_step: string | null
  completed_steps: string[]
  evidence: LayaStepEvidence[]
  metrics: {
    actions: number
    decisions: number
    stale_reobservations: number
    rescues: number
    effects: Record<string, number>
    elapsed_seconds: number
    remote_tokens: null
  }
  reason?: string
  rescue_context?: LayaRescueContext
}

export interface LayaPreflightIssue {
  code: string
  severity: 'error' | 'review'
  message?: string
  step_id?: string
}

export interface LayaPreflightResult {
  schema_version: 1
  status: 'valid' | 'invalid' | 'unverified'
  recommendation: 'proceed_to_inspection' | 'human_review' | 'repair'
  issues: LayaPreflightIssue[]
  risk_factors: string[]
  checks_run: string[]
  checks_not_run: string[]
}

const STEP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

export function validateLayaComputerPlan(rawPlan: unknown): LayaComputerPlan {
  if (!isRecord(rawPlan)) {
    throw new Error('O plano precisa ser um objeto JSON.')
  }

  const version = typeof rawPlan.version === 'number' && Number.isInteger(rawPlan.version) && rawPlan.version > 0
    ? rawPlan.version
    : null
  if (!version) {
    throw new Error('version precisa ser um inteiro positivo (>= 1).')
  }

  const goal = typeof rawPlan.goal === 'string' ? rawPlan.goal.trim() : ''
  if (!goal || goal.length > 2000) {
    throw new Error('goal precisa ter entre 1 e 2000 caracteres.')
  }

  const application = typeof rawPlan.application === 'string' ? rawPlan.application.trim() : ''
  if (!application || application.length > 80) {
    throw new Error('application precisa ter entre 1 e 80 caracteres.')
  }

  if (!Array.isArray(rawPlan.steps) || rawPlan.steps.length === 0 || rawPlan.steps.length > 50) {
    throw new Error('steps precisa conter entre 1 e 50 etapas.')
  }

  const steps = rawPlan.steps.map((rawStep, index) => validateStep(rawStep, index))
  const stepIds = steps.map((step) => step.id)
  const uniqueIds = new Set(stepIds)
  if (uniqueIds.size !== stepIds.length) {
    throw new Error('Os IDs das etapas (step.id) precisam ser únicos.')
  }

  const startStep = rawPlan.start_step === undefined || rawPlan.start_step === null
    ? null
    : typeof rawPlan.start_step === 'string' && rawPlan.start_step.trim()
      ? rawPlan.start_step.trim()
      : (() => { throw new Error('start_step inválido.') })()

  if (startStep !== null && !uniqueIds.has(startStep)) {
    throw new Error(`start_step referencia etapa inexistente: ${startStep}.`)
  }

  for (const step of steps) {
    for (const ref of [step.next_step, step.on_failure]) {
      if (ref !== null && !uniqueIds.has(ref)) {
        throw new Error(`Etapa "${step.id}" referencia etapa inexistente "${ref}".`)
      }
    }
  }

  const maxActions = parseBoundedInt(rawPlan.max_actions, 30, 1, 60, 'max_actions')
  const maxSeconds = parseBoundedNumber(rawPlan.max_seconds, 120, 1, 300, 'max_seconds')
  const maxRescues = parseBoundedInt(rawPlan.max_rescues, 1, 0, 1, 'max_rescues')

  return {
    version,
    goal,
    application,
    steps,
    start_step: startStep,
    max_actions: maxActions,
    max_seconds: maxSeconds,
    max_rescues: maxRescues,
    first_step_id: startStep ?? steps[0].id
  }
}

function validateStep(rawStep: unknown, index: number): LayaComputerStep {
  if (!isRecord(rawStep)) {
    throw new Error(`Etapa #${index + 1} precisa ser um objeto.`)
  }
  const id = typeof rawStep.id === 'string' ? rawStep.id.trim() : ''
  if (!id || id.length > 80 || !STEP_ID_PATTERN.test(id)) {
    throw new Error(`Etapa #${index + 1} possui id inválido.`)
  }
  const instruction = typeof rawStep.instruction === 'string' ? rawStep.instruction.trim() : ''
  if (!instruction || instruction.length > 1000) {
    throw new Error(`Etapa "${id}" precisa de instruction (1..1000 caracteres).`)
  }
  const action = rawStep.action as LayaPlanAction
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Etapa "${id}" possui action inválida (${String(rawStep.action)}).`)
  }

  const target = rawStep.target !== undefined && rawStep.target !== null
    ? validateSelector(rawStep.target, id)
    : undefined

  const durationSeconds = rawStep.duration_seconds !== undefined && rawStep.duration_seconds !== null
    ? Number(rawStep.duration_seconds)
    : undefined

  if (action === 'click' && !target) {
    throw new Error(`Etapa "${id}" (click) exige um seletor target.`)
  }
  if (action !== 'click' && target !== undefined) {
    throw new Error(`Etapa "${id}" (${action}) não utiliza target.`)
  }
  if (action === 'wait') {
    if (durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 10) {
      throw new Error(`Etapa "${id}" (wait) exige duration_seconds entre 0 e 10.`)
    }
  } else if (durationSeconds !== undefined) {
    throw new Error(`duration_seconds só é válido para action=wait (etapa "${id}").`)
  }

  if (!Array.isArray(rawStep.success) || rawStep.success.length === 0 || rawStep.success.length > 12) {
    throw new Error(`Etapa "${id}" exige de 1 a 12 predicados em success.`)
  }
  const success = rawStep.success.map((pred) => validatePredicate(pred, id))

  const preconditions = rawStep.preconditions === undefined || rawStep.preconditions === null
    ? []
    : Array.isArray(rawStep.preconditions) && rawStep.preconditions.length <= 12
      ? rawStep.preconditions.map((pred) => validatePredicate(pred, id))
      : (() => { throw new Error(`preconditions inválidas na etapa "${id}".`) })()

  const nextStep = parseStepReference(rawStep.next_step, `next_step em "${id}"`)
  const onFailure = parseStepReference(rawStep.on_failure, `on_failure em "${id}"`)
  const windowTitle = typeof rawStep.window_title === 'string' && rawStep.window_title.trim()
    ? rawStep.window_title.trim().slice(0, 200)
    : undefined

  return {
    id,
    instruction,
    action,
    ...(target ? { target } : {}),
    ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
    preconditions,
    success,
    next_step: nextStep,
    on_failure: onFailure,
    ...(windowTitle ? { window_title: windowTitle } : {})
  }
}

function validateSelector(rawSelector: unknown, stepId: string): LayaControlSelector {
  if (!isRecord(rawSelector)) {
    throw new Error(`Seletor target inválido na etapa "${stepId}".`)
  }
  const roleRaw = rawSelector.controlType ?? rawSelector.role
  let controlType: LayaAllowedControlType | undefined
  if (roleRaw !== undefined && roleRaw !== null && roleRaw !== '') {
    const normalizedRole = String(roleRaw).replace(/^AX/, '') as LayaAllowedControlType
    if (!ALLOWED_CONTROL_TYPES.has(normalizedRole)) {
      throw new Error(`controlType não permitido no seletor da etapa "${stepId}": ${String(roleRaw)}.`)
    }
    controlType = normalizedRole
  }

  const labelContains = typeof rawSelector.label_contains === 'string' && rawSelector.label_contains.trim()
    ? rawSelector.label_contains.trim().slice(0, 120)
    : undefined
  const automationId = typeof rawSelector.automation_id === 'string' && rawSelector.automation_id.trim()
    ? rawSelector.automation_id.trim().slice(0, 120)
    : undefined

  if (!controlType && !labelContains && !automationId) {
    throw new Error(`Seletor na etapa "${stepId}" precisa de controlType, label_contains ou automation_id.`)
  }

  let index: number | 'first' | 'last' | undefined
  if (rawSelector.index !== undefined && rawSelector.index !== null) {
    if (typeof rawSelector.index === 'number' && Number.isInteger(rawSelector.index) && rawSelector.index >= 0) {
      index = rawSelector.index
    } else if (rawSelector.index === 'first' || rawSelector.index === 'last') {
      index = rawSelector.index
    } else {
      throw new Error(`index do seletor na etapa "${stepId}" precisa ser inteiro não-negativo, "first" ou "last".`)
    }
  }

  return {
    ...(controlType ? { controlType } : {}),
    ...(labelContains ? { label_contains: labelContains } : {}),
    ...(automationId ? { automation_id: automationId } : {}),
    ...(index !== undefined ? { index } : {})
  }
}

function validatePredicate(rawPredicate: unknown, stepId: string): LayaStatePredicate {
  if (!isRecord(rawPredicate)) {
    throw new Error(`Predicado inválido na etapa "${stepId}".`)
  }
  const kind = rawPredicate.kind as LayaPredicateKind
  if (!ALLOWED_PREDICATE_KINDS.has(kind)) {
    throw new Error(`Tipo de predicado inválido na etapa "${stepId}": ${String(rawPredicate.kind)}.`)
  }

  const roleRaw = rawPredicate.controlType ?? rawPredicate.role
  let controlType: LayaAllowedControlType | undefined
  if (roleRaw !== undefined && roleRaw !== null && roleRaw !== '') {
    const normalizedRole = String(roleRaw).replace(/^AX/, '') as LayaAllowedControlType
    if (!ALLOWED_CONTROL_TYPES.has(normalizedRole)) {
      throw new Error(`controlType inválido em predicado da etapa "${stepId}".`)
    }
    controlType = normalizedRole
  }

  const labelContains = typeof rawPredicate.label_contains === 'string' && rawPredicate.label_contains.trim()
    ? rawPredicate.label_contains.trim().slice(0, 120)
    : undefined
  const value = typeof rawPredicate.value === 'string' && rawPredicate.value.trim()
    ? rawPredicate.value.trim().slice(0, 200)
    : undefined

  if ((kind === 'exists' || kind === 'not_exists' || kind === 'enabled') && !controlType && !labelContains) {
    throw new Error(`Predicado "${kind}" na etapa "${stepId}" exige controlType ou label_contains.`)
  }
  if (kind === 'window_title_contains' && !value && !labelContains) {
    throw new Error(`Predicado "window_title_contains" na etapa "${stepId}" exige value.`)
  }

  return {
    kind,
    ...(controlType ? { controlType } : {}),
    ...(labelContains ? { label_contains: labelContains } : {}),
    ...(value ? { value } : {})
  }
}

export function analyzePreflightPlan(planData: unknown): LayaPreflightResult {
  const result: LayaPreflightResult = {
    schema_version: 1,
    status: 'invalid',
    recommendation: 'repair',
    issues: [],
    risk_factors: [],
    checks_run: ['plan_schema', 'references', 'reachability', 'risk_rules'],
    checks_not_run: ['live_accessibility', 'runtime_effects']
  }

  try {
    let plan: LayaComputerPlan
    try {
      plan = validateLayaComputerPlan(planData)
    } catch (error) {
      result.issues.push({
        code: 'PLAN_SCHEMA_INVALID',
        severity: 'error',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Schema do plano inválido.'
      })
      return result
    }

    result.status = 'valid'
    const byId = new Map(plan.steps.map((step) => [step.id, step]))
    const reachable = new Set<string>()
    const queue: string[] = [plan.first_step_id]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      const step = byId.get(current)
      if (!step) continue
      if (step.next_step && !reachable.has(step.next_step)) queue.push(step.next_step)
      if (step.on_failure && !reachable.has(step.on_failure)) queue.push(step.on_failure)
    }

    for (const step of plan.steps) {
      if (!reachable.has(step.id)) {
        result.issues.push({
          code: 'UNREACHABLE_STEP',
          severity: 'error',
          step_id: step.id
        })
      }
    }

    if (result.issues.some((issue) => issue.code === 'UNREACHABLE_STEP')) {
      result.status = 'invalid'
      result.recommendation = 'repair'
    }

    const risks = new Set<string>()
    const observeAssessment = assessToolRisk('computer_observe', { application: plan.application })
    if (observeAssessment.kind === 'blocked') {
      risks.add('blocked_application')
      result.issues.push({
        code: 'BLOCKED_APPLICATION',
        severity: 'error',
        message: observeAssessment.message
      })
      result.status = 'invalid'
      result.recommendation = 'repair'
    }

    for (const step of plan.steps) {
      if (step.action === 'click' && step.target?.label_contains) {
        const actionRisk = assessToolRisk('computer_action', {
          action: 'click',
          application: plan.application,
          target: step.target.label_contains,
          ...(step.target.controlType ? { controlType: step.target.controlType } : {})
        })
        if (actionRisk.kind === 'blocked') {
          risks.add('sensitive_or_blocked_target')
          result.issues.push({
            code: 'BLOCKED_TARGET',
            severity: 'error',
            step_id: step.id,
            message: actionRisk.message
          })
          result.status = 'invalid'
          result.recommendation = 'repair'
        } else if (actionRisk.kind === 'sensitive') {
          risks.add('requires_confirmation')
          result.issues.push({
            code: 'SENSITIVE_TARGET',
            severity: 'review',
            step_id: step.id
          })
        }
      }
    }

    result.risk_factors = [...risks].sort()
    if (result.status === 'valid') {
      result.recommendation = risks.size > 0 ? 'human_review' : 'proceed_to_inspection'
    }
    return result
  } catch {
    return {
      schema_version: 1,
      status: 'unverified',
      recommendation: 'human_review',
      issues: [{ code: 'ANALYSIS_ERROR', severity: 'error', message: 'Falha inesperada na análise estática.' }],
      risk_factors: [],
      checks_run: ['plan_schema', 'references', 'reachability', 'risk_rules'],
      checks_not_run: ['live_accessibility', 'runtime_effects']
    }
  }
}

export class LayaComputerRun {
  static readonly NO_PROGRESS_LIMIT = 2
  static readonly STALE_REOBSERVE_LIMIT = 2

  public plan: LayaComputerPlan
  public current_step_id: string | null
  public readonly completed_steps: string[] = []
  public readonly _completed_specs = new Map<string, string>()

  private activeElapsedSeconds = 0
  private activeStartedAt: number | null = null
  private actionLimit: number
  private timeLimit: number
  private rescueLimit: number
  private actionsCount = 0
  private decisionsCount = 0
  private staleReobservations = 0
  private rescuesCount = 0
  private readonly effects: Record<string, number> = {}
  private transitions = 0
  private noProgress = 0
  private readonly history: Array<{ step_id: string; effect: string; note: string }> = []
  private readonly evidence: LayaStepEvidence[] = []
  private stopRequested = false
  private _status: LayaRunStatus = 'running'
  private _verification: LayaVerificationStatus = 'unknown'
  private lastReason?: string
  private rescueContext?: LayaRescueContext

  constructor(
    plan: LayaComputerPlan,
    private readonly controller: ComputerController,
    private readonly decider?: LayaTargetDecisionRouter
  ) {
    this.plan = plan
    this.current_step_id = plan.first_step_id
    this.actionLimit = plan.max_actions
    this.timeLimit = plan.max_seconds
    this.rescueLimit = plan.max_rescues
  }

  get status(): LayaRunStatus {
    return this._status
  }

  requestStop(): void {
    this.stopRequested = true
  }

  result(): LayaRunResult {
    const out: LayaRunResult = {
      status: this._status,
      verification: this._verification,
      plan_version: this.plan.version,
      current_step: this.current_step_id,
      completed_steps: [...this.completed_steps],
      evidence: [...this.evidence],
      metrics: {
        actions: this.actionsCount,
        decisions: this.decisionsCount,
        stale_reobservations: this.staleReobservations,
        rescues: this.rescuesCount,
        effects: { ...this.effects },
        elapsed_seconds: Number(this.elapsedActiveSeconds().toFixed(3)),
        remote_tokens: null
      }
    }
    if (this.lastReason) out.reason = this.lastReason
    if (this.rescueContext && (this._status === 'rescue_needed' || this._status === 'blocked')) {
      out.rescue_context = this.rescueContext
    }
    return out
  }

  async execute(signal?: AbortSignal): Promise<LayaRunResult> {
    if (this._status === 'completed' || this._status === 'blocked' || this._status === 'stopped') {
      return this.result()
    }
    if (this._status === 'rescue_needed' && !this.stopRequested) {
      return this.result()
    }
    this._status = 'running'
    this.beginActiveTime()
    try {
      return await this.drive(signal)
    } finally {
      this.endActiveTime()
    }
  }

  async resume(
    newPlan: LayaComputerPlan,
    expectedVersion: number,
    signal?: AbortSignal
  ): Promise<LayaRunResult> {
    if (this._status !== 'rescue_needed') {
      throw new Error('Somente execuções em rescue_needed podem ser retomadas.')
    }
    if (expectedVersion !== this.plan.version) {
      throw new Error('expected_version não corresponde à versão atual do plano.')
    }
    if (newPlan.version !== expectedVersion + 1) {
      throw new Error('A versão do plano reparado deve ser expected_version + 1.')
    }
    if (newPlan.goal !== this.plan.goal || normalizeLabel(newPlan.application) !== normalizeLabel(this.plan.application)) {
      throw new Error('O reparo deve preservar o objetivo (goal) e o aplicativo (application) originais.')
    }

    const updatedById = new Map(newPlan.steps.map((step) => [step.id, JSON.stringify(step)]))
    for (const [stepId, originalSpec] of this._completed_specs.entries()) {
      if (updatedById.get(stepId) !== originalSpec) {
        throw new Error(`O reparo deve preservar a etapa já concluída "${stepId}".`)
      }
    }
    if (this.current_step_id && !updatedById.has(this.current_step_id) && newPlan.start_step === null) {
      throw new Error('O reparo deve manter a etapa atual ou informar start_step.')
    }
    if (newPlan.start_step && this.completed_steps.includes(newPlan.start_step)) {
      throw new Error('O reparo não pode reiniciar uma etapa já concluída.')
    }

    this.actionLimit = Math.min(this.actionLimit, newPlan.max_actions)
    this.timeLimit = Math.min(this.timeLimit, newPlan.max_seconds)
    this.rescueLimit = Math.min(this.rescueLimit, newPlan.max_rescues)
    this.current_step_id = newPlan.start_step ?? this.current_step_id
    this.plan = newPlan
    this.stopRequested = false
    this._status = 'running'
    this._verification = 'unknown'
    this.beginActiveTime()
    try {
      return await this.drive(signal)
    } finally {
      this.endActiveTime()
    }
  }

  private async drive(signal?: AbortSignal): Promise<LayaRunResult> {
    while (this.current_step_id !== null) {
      if (this.stopRequested || signal?.aborted) {
        this._status = 'stopped'
        return this.result()
      }
      const limit = this.limitReason()
      if (limit) {
        this._status = 'blocked'
        this._verification = 'unknown'
        this.lastReason = limit
        return this.result()
      }

      const step = this.stepById(this.current_step_id)
      this.transitions += 1
      if (this.transitions > Math.max(20, this.actionLimit * 3)) {
        this._status = 'blocked'
        this.lastReason = 'transition_limit'
        return this.result()
      }

      const snapshot = await this.observeFresh(signal)
      if (!snapshot) {
        return this.needRescue('observation_failed', step, null)
      }
      if (this.stopRequested || signal?.aborted) {
        this._status = 'stopped'
        return this.result()
      }
      if (!snapshot.controls || snapshot.controls.length === 0) {
        return this.needRescue('empty_observation', step, snapshot)
      }

      if (step.preconditions.length > 0) {
        const prereq = evaluatePredicates(step.preconditions, snapshot)
        if (prereq !== 'satisfied') {
          return this.needRescue(`preconditions_${prereq}`, step, snapshot)
        }
      }

      let postSnapshot = snapshot
      if (step.action === 'verify') {
        // Only evaluates predicates on current snapshot
      } else if (step.action === 'wait') {
        this.actionsCount += 1
        await abortableSleep(Math.round((step.duration_seconds ?? 1) * 1000), signal)
        this.recordEffect('wait')
        this.historyAdd(step, 'action', `wait ${step.duration_seconds ?? 1}s`)
        const after = await this.observeFresh(signal)
        if (!after) return this.needRescue('post_action_observation_failed', step, snapshot)
        postSnapshot = after
      } else if (step.action === 'focus' || step.action === 'minimize') {
        this.actionsCount += 1
        try {
          if (step.action === 'focus') {
            await this.controller.focusWindow(this.plan.application, step.window_title, signal)
          } else {
            await this.controller.minimizeWindow(this.plan.application, step.window_title, signal)
          }
          this.recordEffect('confirmed')
          this.historyAdd(step, 'action', `window_${step.action}`)
        } catch (error) {
          this.historyAdd(step, 'no_effect', error instanceof Error ? error.message : 'window_action_failed')
          return this.needRescue('window_action_failed', step, snapshot)
        }
        const after = await this.observeFresh(signal)
        if (!after) return this.needRescue('post_action_observation_failed', step, snapshot)
        postSnapshot = after
      } else if (step.action === 'click') {
        const chosenResult = await this.chooseTargetControl(step, snapshot, signal)
        if (chosenResult.error || !chosenResult.control) {
          return this.needRescue(chosenResult.error ?? 'target_not_found', step, snapshot)
        }

        const safety = assessToolRisk('computer_action', {
          action: 'click',
          application: this.plan.application,
          target: chosenResult.control.name,
          controlType: chosenResult.control.controlType
        })
        if (safety.kind === 'blocked') {
          this.historyAdd(step, 'no_effect', safety.message)
          return this.needRescue('target_blocked_by_safety_policy', step, snapshot)
        }

        const actOutcome = await this.invokeFresh(step, chosenResult.control, snapshot, signal)
        if (actOutcome.error) {
          if (actOutcome.error === 'stopped') {
            this._status = 'stopped'
            return this.result()
          }
          if (actOutcome.error === 'action_limit' || actOutcome.error === 'time_limit') {
            this._status = 'blocked'
            this._verification = 'unknown'
            this.lastReason = actOutcome.error
            return this.result()
          }
          return this.needRescue(actOutcome.error, step, snapshot)
        }

        this.recordEffect('confirmed')
        this.historyAdd(step, 'action', `clicked ${chosenResult.control.controlType} "${chosenResult.control.name}"`)

        await abortableSleep(180, signal)
        const after = await this.observeFresh(signal)
        if (!after) {
          return this.needRescue('post_action_observation_failed', step, snapshot)
        }
        postSnapshot = after
      }

      if (this.elapsedActiveSeconds() >= this.timeLimit) {
        this._status = 'blocked'
        this._verification = 'unknown'
        this.lastReason = 'time_limit'
        return this.result()
      }

      const outcome = evaluatePredicates(step.success, postSnapshot)
      if (outcome === 'satisfied') {
        this.noProgress = 0
        this._verification = 'satisfied'
        if (!this.completed_steps.includes(step.id)) {
          this.completed_steps.push(step.id)
          this._completed_specs.set(step.id, JSON.stringify(step))
        }
        this.evidence.push({
          step_id: step.id,
          window_title: postSnapshot.windowTitle.slice(0, 200),
          predicates: step.success,
          observed: collectWitnesses(step.success, postSnapshot)
        })
        if (this.evidence.length > 12) this.evidence.shift()
        this.historyAdd(step, 'verified', 'success predicates satisfied')
        this.current_step_id = step.next_step
        if (this.current_step_id === null) {
          this._status = 'completed'
          return this.result()
        }
        continue
      }

      this._verification = outcome === 'not_satisfied' ? 'not_satisfied' : 'unknown'
      this.historyAdd(step, 'unverified', outcome)
      this.noProgress += 1
      if (outcome === 'not_satisfied' && step.on_failure && this.noProgress < LayaComputerRun.NO_PROGRESS_LIMIT) {
        this.current_step_id = step.on_failure
        continue
      }
      return this.needRescue('success_predicates_not_verified', step, postSnapshot)
    }

    this._status = 'completed'
    this._verification = 'satisfied'
    return this.result()
  }

  private async observeFresh(signal?: AbortSignal): Promise<ComputerObservation | null> {
    try {
      return await this.controller.observe(this.plan.application, signal)
    } catch {
      return null
    }
  }

  private async invokeFresh(
    step: LayaComputerStep,
    initialControl: UiControlSnapshot,
    initialSnapshot: ComputerObservation,
    signal?: AbortSignal
  ): Promise<{ error?: string }> {
    let currentControl = initialControl
    let currentSnapshot = initialSnapshot

    for (let attempt = 0; attempt <= LayaComputerRun.STALE_REOBSERVE_LIMIT; attempt += 1) {
      if (this.stopRequested || signal?.aborted) return { error: 'stopped' }
      const limit = this.limitReason()
      if (limit) return { error: limit }

      this.actionsCount += 1
      const expectedIdentity: UiInvocationIdentity = {
        window: {
          processId: currentSnapshot.processId,
          windowHandle: currentSnapshot.windowHandle,
          windowTitle: currentSnapshot.windowTitle,
          processName: currentSnapshot.processName
        },
        control: {
          automationId: currentControl.automationId,
          runtimeId: currentControl.runtimeId
        }
      }

      try {
        await this.controller.invoke(
          this.plan.application,
          currentControl.name,
          currentControl.controlType,
          expectedIdentity,
          signal
        )
        return {}
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isStale = /identidade da janela mudou|não está visível/i.test(message)
        if (isStale) {
          this.actionsCount -= 1
          if (attempt === LayaComputerRun.STALE_REOBSERVE_LIMIT) {
            return { error: 'stale_snapshot_limit' }
          }
          this.staleReobservations += 1
          const fresh = await this.observeFresh(signal)
          if (!fresh || fresh.controls.length === 0) {
            return { error: 'stale_snapshot_reobserve_failed' }
          }
          if (step.preconditions.length > 0 && evaluatePredicates(step.preconditions, fresh) !== 'satisfied') {
            return { error: 'preconditions_not_satisfied' }
          }
          const chosen = await this.chooseTargetControl(step, fresh, signal)
          if (chosen.error || !chosen.control) {
            return { error: chosen.error ?? 'target_not_found' }
          }
          currentSnapshot = fresh
          currentControl = chosen.control
          continue
        }
        this.historyAdd(step, 'no_effect', message.slice(0, 160))
        return { error: 'action_rejected' }
      }
    }
    return { error: 'stale_snapshot_limit' }
  }

  private async chooseTargetControl(
    step: LayaComputerStep,
    snapshot: ComputerObservation,
    signal?: AbortSignal
  ): Promise<{ control?: UiControlSnapshot; error?: string }> {
    const selector = step.target
    if (!selector) return { error: 'target_not_found' }

    let matches = snapshot.controls.filter(
      (control) => control.enabled && matchesSelector(control, selector)
    )
    if (typeof selector.index === 'number') {
      matches = matches.slice(selector.index, selector.index + 1)
    } else if (selector.index === 'first') {
      matches = matches.slice(0, 1)
    } else if (selector.index === 'last') {
      matches = matches.slice(-1)
    }

    if (matches.length === 0) {
      return { error: 'target_not_found' }
    }
    if (matches.length === 1) {
      return { control: matches[0] }
    }

    if (!this.decider) {
      return { error: 'ambiguous_target_no_decider' }
    }

    const narrowed = shortlistControls(
      matches,
      `${step.instruction} ${selector.label_contains ?? ''}`,
      20
    )
    const candidates: LayaCandidateControl[] = narrowed.map((control, idx) => ({
      id: String(idx),
      name: control.name,
      controlType: control.controlType,
      automationId: control.automationId,
      enabled: control.enabled
    }))

    this.decisionsCount += 1
    try {
      const decision = await this.decider.chooseTarget(
        step.instruction,
        candidates,
        snapshot.windowTitle,
        signal
      )
      const chosenIndex = Number(decision.choice)
      const chosen = narrowed[chosenIndex]
      if (!chosen) {
        return { error: 'decider_returned_unobserved_candidate' }
      }
      return { control: chosen }
    } catch {
      return { error: 'target_decision_failed' }
    }
  }

  private needRescue(
    reason: string,
    step: LayaComputerStep,
    snapshot: ComputerObservation | null
  ): LayaRunResult {
    this.rescuesCount += 1
    if (this.rescuesCount > this.rescueLimit) {
      this._status = 'blocked'
      this.lastReason = `rescue_limit:${reason}`
    } else {
      this._status = 'rescue_needed'
      this.lastReason = reason
    }
    if (reason.endsWith('unknown') || reason.includes('observation')) {
      this._verification = 'unknown'
    }

    let compactObservation: Record<string, unknown> | null = null
    if (snapshot) {
      const controls = [...snapshot.controls]
      if (step.target) {
        controls.sort((a, b) => Number(matchesSelector(b, step.target!)) - Number(matchesSelector(a, step.target!)))
      }
      compactObservation = {
        application: snapshot.application,
        windowTitle: snapshot.windowTitle.slice(0, 160),
        processName: snapshot.processName,
        controls: controls.slice(0, 24).map(({ name, controlType, enabled }) => ({
          name: name.slice(0, 120),
          controlType,
          enabled
        })),
        response_truncated: controls.length > 24
      }
    }

    this.rescueContext = {
      reason,
      plan_version: this.plan.version,
      goal: this.plan.goal,
      application: this.plan.application,
      current_step: step,
      observation: compactObservation,
      completed_steps: [...this.completed_steps],
      recent_effects: this.history.slice(-4),
      instruction:
        'Resolva o bloqueio com o menor reparo possível no plano. Preserve goal, application e completed_steps, e incremente version em +1.'
    }
    return this.result()
  }

  private limitReason(): string | null {
    if (this.actionsCount >= this.actionLimit) return 'action_limit'
    if (this.elapsedActiveSeconds() >= this.timeLimit) return 'time_limit'
    return null
  }

  private beginActiveTime(): void {
    if (this.activeStartedAt === null) {
      this.activeStartedAt = performance.now()
    }
  }

  private endActiveTime(): void {
    if (this.activeStartedAt !== null) {
      this.activeElapsedSeconds += (performance.now() - this.activeStartedAt) / 1000
      this.activeStartedAt = null
    }
  }

  private elapsedActiveSeconds(): number {
    const current = this.activeStartedAt !== null
      ? (performance.now() - this.activeStartedAt) / 1000
      : 0
    return this.activeElapsedSeconds + current
  }

  private recordEffect(effect: string): void {
    this.effects[effect] = (this.effects[effect] ?? 0) + 1
  }

  private historyAdd(step: LayaComputerStep, effect: string, note: string): void {
    this.history.push({ step_id: step.id, effect, note: note.slice(0, 160) })
    if (this.history.length > 12) this.history.shift()
  }

  private stepById(stepId: string): LayaComputerStep {
    const found = this.plan.steps.find((step) => step.id === stepId)
    if (!found) throw new Error(`Etapa não encontrada: ${stepId}`)
    return found
  }
}

export class LayaComputerPlanManager {
  private readonly runs = new Map<string, LayaComputerRun>()
  private readonly busyApps = new Set<string>()

  constructor(
    private readonly controller: ComputerController,
    private readonly decider?: LayaTargetDecisionRouter
  ) {}

  async runPlan(rawPlan: unknown, signal?: AbortSignal): Promise<LayaRunResult> {
    const plan = validateLayaComputerPlan(rawPlan)
    const appKey = normalizeLabel(plan.application)
    if (this.busyApps.has(appKey)) {
      throw new Error(`O aplicativo "${plan.application}" já possui uma operação de plano ativa.`)
    }
    this.makeRoom()
    const runId = randomUUID()
    const run = new LayaComputerRun(plan, this.controller, this.decider)
    this.runs.set(runId, run)
    this.busyApps.add(appKey)
    try {
      const result = await run.execute(signal)
      return { ...result, run_id: runId }
    } finally {
      this.busyApps.delete(appKey)
    }
  }

  async resumePlan(
    runId: string,
    expectedVersion: number,
    rawPlan: unknown,
    signal?: AbortSignal
  ): Promise<LayaRunResult> {
    const run = this.runs.get(runId)
    if (!run) {
      throw new Error(`Execução de plano não encontrada para run_id "${runId}".`)
    }
    const plan = validateLayaComputerPlan(rawPlan)
    const appKey = normalizeLabel(plan.application)
    if (this.busyApps.has(appKey)) {
      throw new Error(`O aplicativo "${plan.application}" já possui uma operação de plano ativa.`)
    }
    this.busyApps.add(appKey)
    try {
      const result = await run.resume(plan, expectedVersion, signal)
      return { ...result, run_id: runId }
    } finally {
      this.busyApps.delete(appKey)
    }
  }

  getRun(runId: string): LayaRunResult {
    const run = this.runs.get(runId)
    if (!run) {
      throw new Error(`Execução de plano não encontrada para run_id "${runId}".`)
    }
    return { ...run.result(), run_id: runId }
  }

  stopRun(runId: string): LayaRunResult {
    const run = this.runs.get(runId)
    if (!run) {
      throw new Error(`Execução de plano não encontrada para run_id "${runId}".`)
    }
    run.requestStop()
    return { ...run.result(), run_id: runId }
  }

  private makeRoom(): void {
    if (this.runs.size < 32) return
    for (const [id, run] of this.runs.entries()) {
      if (run.status === 'completed' || run.status === 'blocked' || run.status === 'stopped') {
        this.runs.delete(id)
        return
      }
    }
    const oldest = this.runs.keys().next().value as string | undefined
    if (oldest) this.runs.delete(oldest)
  }
}

export function matchesSelector(
  control: UiControlSnapshot,
  selector: LayaControlSelector
): boolean {
  if (selector.controlType && control.controlType !== selector.controlType) {
    return false
  }
  if (
    selector.label_contains &&
    !normalizeLabel(control.name).includes(normalizeLabel(selector.label_contains))
  ) {
    return false
  }
  if (
    selector.automation_id &&
    normalizeLabel(control.automationId) !== normalizeLabel(selector.automation_id)
  ) {
    return false
  }
  return true
}

export function evaluatePredicates(
  predicates: readonly LayaStatePredicate[],
  snapshot: ComputerObservation
): LayaVerificationStatus {
  if (!snapshot.controls || snapshot.controls.length === 0) {
    return 'unknown'
  }
  for (const predicate of predicates) {
    if (predicate.kind === 'window_title_contains') {
      const wanted = normalizeLabel(predicate.value ?? predicate.label_contains ?? '')
      if (!wanted || !normalizeLabel(snapshot.windowTitle).includes(wanted)) {
        return 'not_satisfied'
      }
      continue
    }

    const candidates = snapshot.controls.filter((control) => {
      if (predicate.controlType && control.controlType !== predicate.controlType) return false
      if (
        predicate.label_contains &&
        !normalizeLabel(control.name).includes(normalizeLabel(predicate.label_contains))
      ) {
        return false
      }
      return true
    })

    if (predicate.kind === 'exists') {
      if (candidates.length === 0) return 'not_satisfied'
    } else if (predicate.kind === 'not_exists') {
      if (candidates.length > 0) return 'not_satisfied'
    } else if (predicate.kind === 'enabled') {
      if (candidates.length === 0 || !candidates.some((c) => c.enabled)) {
        return 'not_satisfied'
      }
    }
  }
  return 'satisfied'
}

function collectWitnesses(
  predicates: readonly LayaStatePredicate[],
  snapshot: ComputerObservation
): Array<Record<string, unknown>> {
  const witnesses: Array<Record<string, unknown>> = []
  for (const predicate of predicates) {
    if (predicate.kind === 'window_title_contains') {
      witnesses.push({
        kind: predicate.kind,
        observed: snapshot.windowTitle.slice(0, 200)
      })
      continue
    }
    const matches = snapshot.controls.filter((control) => {
      if (predicate.controlType && control.controlType !== predicate.controlType) return false
      if (
        predicate.label_contains &&
        !normalizeLabel(control.name).includes(normalizeLabel(predicate.label_contains))
      ) {
        return false
      }
      return true
    })
    if (predicate.kind === 'not_exists' && matches.length === 0) {
      witnesses.push({
        kind: 'not_exists',
        ...(predicate.controlType ? { controlType: predicate.controlType } : {}),
        ...(predicate.label_contains ? { label_contains: predicate.label_contains } : {})
      })
    } else if (matches.length > 0) {
      const first = matches[0]
      witnesses.push({
        kind: predicate.kind,
        controlType: first.controlType,
        name: first.name.slice(0, 120),
        enabled: first.enabled
      })
    }
  }
  return witnesses
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseStepReference(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'string' && STEP_ID_PATTERN.test(value.trim())) {
    return value.trim()
  }
  throw new Error(`Referência inválida para ${label}.`)
}

function parseBoundedInt(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number,
  field: string
): number {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max) {
    return value
  }
  throw new Error(`${field} precisa ser um inteiro entre ${min} e ${max}.`)
}

function parseBoundedNumber(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number,
  field: string
): number {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
    return value
  }
  throw new Error(`${field} precisa ser um número entre ${min} e ${max}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function abortableSleep(durationMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    const err = new Error('Operação interrompida.')
    err.name = 'AbortError'
    throw err
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, durationMs)
    const onAbort = (): void => {
      clearTimeout(timer)
      const err = new Error('Operação interrompida.')
      err.name = 'AbortError'
      reject(err)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

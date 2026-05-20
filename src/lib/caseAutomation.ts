import type { Brief, Role } from '@/lib/types'
import { CONTRIBUTOR_META, getBriefDepartments } from '@/lib/types'

const STORAGE_KEY = 'gerai:automation-runs:v1'
const STAGE_DURATION_MS = 1600

export type AutomationRunStatus = 'running' | 'completed' | 'blocked'
export type AutomationStepStatus = 'waiting' | 'running' | 'done' | 'blocked'

export interface AutomationStep {
  id: string
  label: string
  owner: string
  status: AutomationStepStatus
}

export interface CaseAutomationRun {
  id: string
  briefId: string
  title: string
  owner: Role
  status: AutomationRunStatus
  progress: number
  currentStage: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  steps: AutomationStep[]
}

const stepTemplates = [
  { id: 'frame', label: 'Framing case', owner: 'Atmaja' },
  { id: 'delegate', label: 'Route C-level', owner: 'Atmaja' },
  { id: 'reason', label: 'Planning reasoning', owner: 'Owner lane' },
  { id: 'evidence', label: 'Evidence & risk check', owner: 'Specialist lane' },
  { id: 'synthesis', label: 'Output contract', owner: 'Atmaja' },
] as const

export function createCaseAutomationRun(brief: Brief, now = new Date()): CaseAutomationRun {
  const owner = getBriefDepartments(brief.contributors)[0] ?? 'ceo'
  return {
    id: `run-${brief.id}`,
    briefId: brief.id,
    title: brief.title,
    owner,
    status: 'running',
    progress: 8,
    currentStage: stepTemplates[0].label,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    steps: stepTemplates.map((step, index) => ({
      ...step,
      owner: step.owner === 'Owner lane' ? CONTRIBUTOR_META[owner].name : step.owner,
      status: index === 0 ? 'running' : 'waiting',
    })),
  }
}

export function loadStoredAutomationRuns(): CaseAutomationRun[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredAutomationRuns(runs: CaseAutomationRun[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, 40)))
  } catch {
    // Local storage can be unavailable in private browser contexts.
  }
}

export function reconcileCaseAutomationRuns(
  briefs: Brief[],
  runs: CaseAutomationRun[],
  now = new Date(),
): CaseAutomationRun[] {
  const runByBrief = new Map(runs.map((run) => [run.briefId, run]))
  const nextRuns = [...runs]

  for (const brief of briefs) {
    if (!runByBrief.has(brief.id)) {
      nextRuns.push(createCaseAutomationRun(brief, now))
    }
  }

  return advanceCaseAutomationRuns(nextRuns, briefs, now)
}

export function advanceCaseAutomationRuns(
  runs: CaseAutomationRun[],
  briefs: Brief[],
  now = new Date(),
): CaseAutomationRun[] {
  const briefById = new Map(briefs.map((brief) => [brief.id, brief]))
  return runs
    .filter((run) => briefById.has(run.briefId))
    .map((run) => advanceRun(run, briefById.get(run.briefId)!, now))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function getAutomationSummary(runs: CaseAutomationRun[]) {
  const running = runs.filter((run) => run.status === 'running')
  const completed = runs.filter((run) => run.status === 'completed')
  const blocked = runs.filter((run) => run.status === 'blocked')
  const latest = runs[0] ?? null

  return {
    total: runs.length,
    running: running.length,
    completed: completed.length,
    blocked: blocked.length,
    latest,
  }
}

function advanceRun(run: CaseAutomationRun, brief: Brief, now: Date): CaseAutomationRun {
  if (brief.status === 'review') {
    return completeRun(run, 'blocked', 92, 'Need Matthew revision', now)
  }

  if (brief.status === 'final' || brief.requestStatus === 'completed') {
    return completeRun(run, 'completed', 100, 'Output ready', now)
  }

  const elapsed = Math.max(0, now.getTime() - Date.parse(run.startedAt))
  const stageIndex = Math.min(stepTemplates.length - 1, Math.floor(elapsed / STAGE_DURATION_MS))
  const progress = Math.min(94, Math.max(run.progress, Math.round(((stageIndex + 1) / stepTemplates.length) * 86)))
  const currentStage = stepTemplates[stageIndex].label

  return {
    ...run,
    status: 'running',
    progress,
    currentStage,
    updatedAt: now.toISOString(),
    steps: run.steps.map((step, index) => ({
      ...step,
      status: index < stageIndex ? 'done' : index === stageIndex ? 'running' : 'waiting',
    })),
  }
}

function completeRun(
  run: CaseAutomationRun,
  status: Extract<AutomationRunStatus, 'completed' | 'blocked'>,
  progress: number,
  currentStage: string,
  now: Date,
): CaseAutomationRun {
  return {
    ...run,
    status,
    progress,
    currentStage,
    updatedAt: now.toISOString(),
    completedAt: run.completedAt ?? now.toISOString(),
    steps: run.steps.map((step) => ({
      ...step,
      status: status === 'blocked' && step.status !== 'done' ? 'blocked' : 'done',
    })),
  }
}

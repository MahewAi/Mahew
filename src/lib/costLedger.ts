import type { Brief, Role } from '@/lib/types'
import { getBriefDepartments } from '@/lib/types'

export interface CaseCostEstimate {
  briefId: string
  title: string
  owner: Role
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  status: 'estimating' | 'finalized'
}

export interface CostLedgerSummary {
  caseCount: number
  estimatedSpendUsd: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  averageCostUsd: number
  recent: CaseCostEstimate[]
}

export type ProviderCreditStatus = 'connected' | 'not_configured' | 'locked' | 'error'

export interface ProviderCreditSnapshot {
  provider: 'OpenRouter'
  status: ProviderCreditStatus
  totalCredits: number | null
  totalUsage: number | null
  remainingCredits: number | null
  updatedAt: string | null
  note: string
}

const fallbackProviderCredit: ProviderCreditSnapshot = {
  provider: 'OpenRouter',
  status: 'not_configured',
  totalCredits: null,
  totalUsage: null,
  remainingCredits: null,
  updatedAt: null,
  note: 'Server key belum dikonfigurasi. API key tidak boleh ditaruh di frontend.',
}

const roleRatesUsdPerMillion: Record<Role, { input: number; output: number }> = {
  ceo: { input: 0.7, output: 2.4 },
  coo: { input: 0.55, output: 1.9 },
  cmo: { input: 0.6, output: 2.1 },
  cfo: { input: 0.65, output: 2.2 },
  cco: { input: 0.58, output: 2 },
}

export function getFallbackProviderCredit(): ProviderCreditSnapshot {
  return fallbackProviderCredit
}

export function buildCostLedgerSummary(briefs: Brief[]): CostLedgerSummary {
  const estimates = briefs.map(estimateBriefCost)
  const estimatedSpendUsd = roundCurrency(estimates.reduce((total, item) => total + item.estimatedCostUsd, 0))
  const estimatedInputTokens = estimates.reduce((total, item) => total + item.inputTokens, 0)
  const estimatedOutputTokens = estimates.reduce((total, item) => total + item.outputTokens, 0)

  return {
    caseCount: estimates.length,
    estimatedSpendUsd,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    averageCostUsd: estimates.length > 0 ? roundCurrency(estimatedSpendUsd / estimates.length) : 0,
    recent: estimates.slice(0, 6),
  }
}

export async function fetchOpenRouterCredits(): Promise<ProviderCreditSnapshot> {
  try {
    const response = await fetch('/api/openrouter/credits', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('application/json')) return fallbackProviderCredit

    const payload = (await response.json()) as Partial<ProviderCreditSnapshot>
    return {
      provider: 'OpenRouter',
      status: payload.status ?? fallbackProviderCredit.status,
      totalCredits: typeof payload.totalCredits === 'number' ? payload.totalCredits : null,
      totalUsage: typeof payload.totalUsage === 'number' ? payload.totalUsage : null,
      remainingCredits: typeof payload.remainingCredits === 'number' ? payload.remainingCredits : null,
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
      note: typeof payload.note === 'string' ? payload.note : fallbackProviderCredit.note,
    }
  } catch {
    return {
      ...fallbackProviderCredit,
      status: 'error',
      note: 'Provider credit endpoint belum bisa dibaca dari app.',
    }
  }
}

function estimateBriefCost(brief: Brief): CaseCostEstimate {
  const owner = getBriefDepartments(brief.contributors)[0] ?? 'ceo'
  const rates = roleRatesUsdPerMillion[owner]
  const inputTokens = estimateTokens(`${brief.title}\n${brief.description}\n${brief.summary}`)
  const outputTokens = 850 + (brief.blocks?.length ?? 4) * 140 + brief.csuiteInput.length * 90
  const estimatedCostUsd = roundCurrency((inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output)

  return {
    briefId: brief.id,
    title: brief.title,
    owner,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    status: brief.requestStatus === 'pending' ? 'estimating' : 'finalized',
  }
}

function estimateTokens(text: string) {
  return Math.max(120, Math.ceil(text.length / 3.8))
}

function roundCurrency(value: number) {
  return Math.round(value * 10_000) / 10_000
}

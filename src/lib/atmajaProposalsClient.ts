// Client untuk Skill Proposals endpoint (foundation Self-Evolving Atmaja).
// Atmaja propose new capability, Matthew approve/reject via PWA.

export type ProposalType =
  | 'specialist'
  | 'workflow'
  | 'skill'
  | 'prompt-refinement'
  | 'integration'
  | 'feature'

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'implemented'

export interface AtmajaProposal {
  id: string
  type: ProposalType
  title: string
  description: string
  rationale?: string
  examples?: string[]
  estimatedEffort?: string
  estimatedCost?: string
  proposedBy?: string
  status: ProposalStatus
  createdAt: string
  approvedAt?: string | null
  rejectedReason?: string | null
  implementedAt?: string | null
  implementedCommit?: string | null
}

export interface ProposalsListResponse {
  ok: boolean
  proposals: AtmajaProposal[]
  count: number
  counts: { pending: number; approved: number; rejected: number; implemented: number }
}

async function safeFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, {
      ...init,
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', ...(init?.headers || {}) },
    })
    if (!response.ok) {
      console.error('[atmajaProposals] HTTP', response.status)
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    console.error('[atmajaProposals] fetch error:', error)
    return null
  }
}

export async function listProposals(statusFilter?: ProposalStatus): Promise<ProposalsListResponse | null> {
  const params = new URLSearchParams({ type: 'proposals' })
  if (statusFilter) params.set('status', statusFilter)
  params.set('_', String(Date.now()))
  return safeFetch<ProposalsListResponse>(`/api/atmaja/memory?${params.toString()}`)
}

export async function approveProposal(id: string): Promise<{ ok: boolean; proposal?: AtmajaProposal } | null> {
  return safeFetch(`/api/atmaja/memory?type=proposals&action=approve&id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function rejectProposal(id: string, reason?: string): Promise<{ ok: boolean; proposal?: AtmajaProposal } | null> {
  return safeFetch(`/api/atmaja/memory?type=proposals&action=reject&id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: reason || '' }),
  })
}

export function formatProposalTypeLabel(type: ProposalType): string {
  const map: Record<ProposalType, string> = {
    specialist: 'Specialist baru',
    workflow: 'Workflow otomasi',
    skill: 'Skill capability',
    'prompt-refinement': 'Prompt refinement',
    integration: 'Integrasi eksternal',
    feature: 'Fitur app',
  }
  return map[type] || type
}

export function formatProposalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

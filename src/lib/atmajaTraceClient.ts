// Client untuk Live Execution Trace (n8n-style workflow viewer).
// Backend: api/atmaja/memory.js?type=trace.
//
// Setiap chat session ke Atmaja generate trace events di KV. Frontend poll endpoint
// ini untuk visualize step-by-step apa yang sedang Atmaja kerjakan, mirip n8n
// execution view.

export type TraceStepStatus = 'pending' | 'running' | 'done' | 'skipped'
export type TraceStatus = 'running' | 'completed' | 'error'

export interface TraceStep {
  id: string
  label: string
  node: string
  status: TraceStepStatus
  at?: string
  detail?: string
}

export interface AtmajaTrace {
  sessionId: string
  requestId?: string
  startedAt: string
  completedAt: string | null
  status: TraceStatus
  userMessagePreview: string
  currentStep: string | null
  steps: TraceStep[]
  responsePreview: string | null
  totalDurationMs: number | null
  model: string | null
  error: string | null
}

export interface TraceResponse {
  ok: boolean
  current: AtmajaTrace | null
  history: AtmajaTrace[]
}

export async function fetchTrace(): Promise<TraceResponse | null> {
  try {
    const cacheBust = `&_=${Date.now()}`
    const response = await fetch(`/api/atmaja/memory?type=trace${cacheBust}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    })
    if (!response.ok) return null
    return (await response.json()) as TraceResponse
  } catch (error) {
    console.error('[atmajaTraceClient] fetch error:', error)
    return null
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${min}m ${sec}s`
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 5000) return 'baru saja'
    if (diff < 60_000) return `${Math.floor(diff / 1000)}d lalu`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m lalu`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}j lalu`
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return '-'
  }
}

export function formatAbsoluteTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '-'
  }
}

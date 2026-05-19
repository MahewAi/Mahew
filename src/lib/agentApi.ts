import type { Brief } from '@/lib/types'

export type BridgeMode = 'webhook' | 'contract' | 'offline'

export interface AgentHealth {
  ok: boolean
  checkedAt: string
  bridge: {
    mode: BridgeMode
    submitEndpoint: string
    webhookConfigured: boolean
    tokenConfigured: boolean
  }
  runtime: {
    engine: string
    status: 'external' | 'active' | 'degraded' | 'offline'
    note: string
  }
  security: {
    appFirst: boolean
    discordOptional: boolean
    requiresServerAudit: boolean
  }
}

export interface SubmitAgentBriefResult {
  mode: BridgeMode
  status: 'accepted' | 'bridge_error' | 'upstream_error'
  jobId: string
  note?: string
}

export const fallbackAgentHealth: AgentHealth = {
  ok: false,
  checkedAt: new Date(0).toISOString(),
  bridge: {
    mode: 'offline',
    submitEndpoint: '/api/agent/briefs',
    webhookConfigured: false,
    tokenConfigured: false,
  },
  runtime: {
    engine: 'OpenClaw Atmaja',
    status: 'external',
    note: 'Belum bisa membaca health endpoint.',
  },
  security: {
    appFirst: true,
    discordOptional: true,
    requiresServerAudit: true,
  },
}

export async function fetchAgentHealth(): Promise<AgentHealth> {
  try {
    const response = await fetch('/api/agent/health', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return fallbackAgentHealth
    return (await response.json()) as AgentHealth
  } catch {
    return fallbackAgentHealth
  }
}

export async function submitAgentBrief(brief: Brief): Promise<SubmitAgentBriefResult> {
  try {
    const response = await fetch('/api/agent/briefs', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        brief,
        submittedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok && response.status !== 202) {
      return {
        mode: 'offline',
        status: 'bridge_error',
        jobId: `local-${Date.now()}`,
        note: `Bridge returned ${response.status}.`,
      }
    }

    return (await response.json()) as SubmitAgentBriefResult
  } catch {
    return {
      mode: 'offline',
      status: 'bridge_error',
      jobId: `local-${Date.now()}`,
      note: 'Bridge unreachable. App memakai local contract fallback.',
    }
  }
}

import type { Brief } from '@/lib/types'
import { AGENT_BRIDGE_ALLOWED, isPrivacyLockEnabled } from '@/lib/privacyGuard'

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
    privacyLock: boolean
    requiresServerAudit: boolean
  }
}

export interface SubmitAgentBriefResult {
  mode: BridgeMode
  status: 'accepted' | 'local_only' | 'bridge_error' | 'upstream_error'
  jobId: string
  note?: string
}

export const fallbackAgentHealth: AgentHealth = {
  ok: true,
  checkedAt: new Date(0).toISOString(),
  bridge: {
    mode: 'offline',
    submitEndpoint: '/api/agent/briefs',
    webhookConfigured: false,
    tokenConfigured: false,
  },
  runtime: {
    engine: 'OpenClaw Atmaja',
    status: 'offline',
    note: 'Private mode aktif. App tidak mengirim brief ke backend sampai bridge dinyalakan.',
  },
  security: {
    appFirst: true,
    discordOptional: true,
    privacyLock: isPrivacyLockEnabled(),
    requiresServerAudit: false,
  },
}

export function isAgentBridgeEnabled() {
  return AGENT_BRIDGE_ALLOWED
}

export async function fetchAgentHealth(): Promise<AgentHealth> {
  if (!AGENT_BRIDGE_ALLOWED) return fallbackAgentHealth

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
  if (!AGENT_BRIDGE_ALLOWED) {
    return {
      mode: 'offline',
      status: 'local_only',
      jobId: `local-${Date.now()}`,
      note: 'Privacy lock aktif. Brief tidak dikirim keluar dan hanya disimpan di device.',
    }
  }

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

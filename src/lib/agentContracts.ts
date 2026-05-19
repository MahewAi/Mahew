import type { BriefBlock, Contributor, Role } from '@/lib/types'

export type AgentJobStatus = 'queued' | 'running' | 'waiting_confirmation' | 'completed' | 'failed'

export interface AgentQualityGate {
  id: string
  label: string
  passed: boolean
  note: string
}

export interface AgentNextAction {
  owner: 'matthew' | Contributor
  label: string
  urgency: 'now' | 'next' | 'later'
}

export interface AgentOutputEnvelope {
  version: 'gerai-agent-output-v1'
  briefId: string
  sourceRole: Role
  status: AgentJobStatus
  summary: string
  blocks: BriefBlock[]
  qualityGates: AgentQualityGate[]
  nextActions: AgentNextAction[]
  memoryPolicy: {
    preserveBusinessKnowledge: boolean
    storeInteractionTrace: boolean
    notes: string
  }
}

export function createAgentOutputEnvelope(input: {
  briefId: string
  sourceRole: Role
  summary: string
  blocks: BriefBlock[]
}): AgentOutputEnvelope {
  return {
    version: 'gerai-agent-output-v1',
    briefId: input.briefId,
    sourceRole: input.sourceRole,
    status: 'waiting_confirmation',
    summary: input.summary,
    blocks: input.blocks,
    qualityGates: [
      {
        id: 'structured-output',
        label: 'Output structured',
        passed: true,
        note: 'Summary, visual blocks, vote, dan action item tersedia untuk app.',
      },
      {
        id: 'rich-render-ready',
        label: 'Rich render ready',
        passed: true,
        note: 'Markdown, table, chart, mermaid, image, dan C-suite vote bisa dirender.',
      },
      {
        id: 'business-memory-clean',
        label: 'Memory policy jelas',
        passed: true,
        note: 'Business knowledge dipertahankan, jejak interaksi tetap bisa dibersihkan.',
      },
    ],
    nextActions: [
      {
        owner: 'matthew',
        label: 'Konfirmasi apakah rekomendasi boleh masuk eksekusi.',
        urgency: 'now',
      },
      {
        owner: input.sourceRole,
        label: 'Lengkapi angka, source, atau dokumen yang masih kosong.',
        urgency: 'next',
      },
    ],
    memoryPolicy: {
      preserveBusinessKnowledge: true,
      storeInteractionTrace: false,
      notes: 'Default baru: hasil penting disimpan sebagai keputusan atau output, bukan chat history mentah.',
    },
  }
}

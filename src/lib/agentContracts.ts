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

export interface AgentPlanningFrame {
  objective: string
  currentState: string
  planningHorizon: 'today' | 'week' | 'month' | 'quarter'
  options: Array<{
    label: string
    upside: string
    risk: string
  }>
  decisionNeeded: string
  plannerStandard: string
}

export type AgentWorkLaneStatus = 'proposed' | 'active' | 'blocked' | 'waiting_confirmation' | 'completed'

export interface AgentVisualWorkLane {
  zone: string
  owner: 'matthew' | Contributor
  designTask: string
  dependency: string
  outputArtifact: string
  decisionGate: string
  status: AgentWorkLaneStatus
}

export interface AgentVisualWorkMap {
  title: string
  architectureSummary: string
  preferredView: 'table' | 'flowchart' | 'grid' | 'mixed'
  lanes: AgentVisualWorkLane[]
  confirmationPoints: string[]
}

export interface AgentOutputEnvelope {
  version: 'gerai-agent-output-v1'
  briefId: string
  sourceRole: Role
  status: AgentJobStatus
  summary: string
  planningFrame: AgentPlanningFrame
  visualWorkMap: AgentVisualWorkMap
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
    planningFrame: {
      objective: 'Mengubah brief menjadi rencana yang bisa diputuskan dan dieksekusi.',
      currentState: 'Konteks awal sudah masuk, tetapi angka dan constraint final masih perlu validasi.',
      planningHorizon: 'week',
      options: [
        {
          label: 'Plan A',
          upside: 'Cepat dijalankan dengan asumsi yang tersedia.',
          risk: 'Bisa meleset kalau data baseline belum kuat.',
        },
        {
          label: 'Plan B',
          upside: 'Lebih aman karena meminta data tambahan sebelum eksekusi.',
          risk: 'Lebih lambat dan bisa menahan momentum.',
        },
      ],
      decisionNeeded: 'Matthew perlu memilih apakah brief ini masuk eksekusi, revisi data, atau ditunda.',
      plannerStandard: 'Objective, current state, options, risks, decision needed, next action.',
    },
    visualWorkMap: {
      title: 'Denah kerja keputusan',
      architectureSummary:
        'Atmaja memecah brief menjadi lane C-level, mengumpulkan specialist packet, lalu mengembalikan master plan untuk konfirmasi Matthew.',
      preferredView: 'mixed',
      lanes: [
        {
          zone: 'Leadership synthesis',
          owner: 'ceo',
          designTask: 'Menyatukan objective, trade-off, dan urutan keputusan.',
          dependency: 'Brief Matthew dan input C-level.',
          outputArtifact: 'Decision memo dan master plan.',
          decisionGate: 'Matthew approve, revisi, atau hold.',
          status: 'waiting_confirmation',
        },
        {
          zone: 'Operating lane',
          owner: 'coo',
          designTask: 'Menguji feasibility, SOP, staffing, vendor, dan fulfillment.',
          dependency: 'Budget, scope produk, dan target timeline.',
          outputArtifact: 'Ops roadmap dan risk map.',
          decisionGate: 'Feasible atau perlu redesign.',
          status: 'proposed',
        },
        {
          zone: 'Growth lane',
          owner: 'cmo',
          designTask: 'Merancang segment, positioning, channel, dan funnel.',
          dependency: 'Brand boundary dan target customer.',
          outputArtifact: 'Growth roadmap dan market signal board.',
          decisionGate: 'Market proof cukup atau butuh riset.',
          status: 'proposed',
        },
        {
          zone: 'Capital lane',
          owner: 'cfo',
          designTask: 'Mengunci ROI, margin, runway, dan scenario guardrail.',
          dependency: 'Cost baseline dan revenue assumption.',
          outputArtifact: 'Scenario table dan budget checkpoint.',
          decisionGate: 'Budget boleh dibuka atau ditahan.',
          status: 'proposed',
        },
        {
          zone: 'Narrative lane',
          owner: 'cco',
          designTask: 'Membentuk memo, source log, visual brief, dan bahasa final.',
          dependency: 'Evidence dan keputusan final.',
          outputArtifact: 'Document pack dan visual brief deck.',
          decisionGate: 'Evidence quality dan tone sudah layak.',
          status: 'proposed',
        },
      ],
      confirmationPoints: [
        'Apa keputusan yang harus dijawab sekarang?',
        'Data mana yang Matthew sudah punya dan boleh dipakai?',
        'Lane C-level mana yang harus jalan dulu?',
      ],
    },
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

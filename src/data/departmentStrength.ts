import type { Role } from '@/lib/types'

export type StrengthStatus = 'active' | 'foundation' | 'needs-build' | 'watch'

export interface DepartmentStrengthArea {
  id:
    | 'concept'
    | 'dashboard'
    | 'rich-output'
    | 'agent-runtime'
    | 'integration'
    | 'memory'
    | 'automation'
    | 'security'
  title: string
  score: number
  target: number
  northStar: number
  status: StrengthStatus
  owner: Role
  strengthenedBy: string[]
  nextMove: string
}

export interface WorkflowStage {
  id: string
  label: string
  state: 'ready' | 'partial' | 'missing'
  description: string
}

export const departmentStrengthAreas: DepartmentStrengthArea[] = [
  {
    id: 'concept',
    title: 'Konsep Department',
    score: 98,
    target: 100,
    northStar: 100,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Role map Atmaja + C-level + specialist', 'Planning OS', 'Push-back mandatory', 'Decision-first output', 'Agent registry app-side'],
    nextMove: 'Kunci authority matrix: kapan specialist final, kapan wajib naik ke Atmaja.',
  },
  {
    id: 'dashboard',
    title: 'App / Dashboard',
    score: 86,
    target: 100,
    northStar: 100,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Pending, running, confirmation, output lanes', 'Planner council surface', 'Local brief persistence', 'Integration health surface'],
    nextMove: 'Buat planning detail per C-level dengan owner, due date, dan progress server-side.',
  },
  {
    id: 'rich-output',
    title: 'Rich Visual Output',
    score: 88,
    target: 100,
    northStar: 100,
    status: 'active',
    owner: 'cco',
    strengthenedBy: ['BriefBlock contract', 'Planning-grade blocks', 'Markdown, table, chart, mermaid, image, grid, vote renderer', 'AgentOutputEnvelope v1'],
    nextMove: 'Paksa output real Atmaja mengirim plan matrix, roadmap, dan decision gate.',
  },
  {
    id: 'agent-runtime',
    title: 'Agent Runtime',
    score: 78,
    target: 100,
    northStar: 100,
    status: 'watch',
    owner: 'ceo',
    strengthenedBy: ['OpenClaw tetap dipakai sebagai engine', 'Planning OS instruction V6', 'Service status terbaca manual', '17 agent registry lengkap'],
    nextMove: 'Expose authenticated runtime health dan job execution metrics dari droplet ke app.',
  },
  {
    id: 'integration',
    title: 'Integrasi App ke Agent',
    score: 58,
    target: 100,
    northStar: 100,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['AgentOutputEnvelope v1', '/api/agent/briefs submit bridge', '/api/agent/health bridge', 'Mock fallback dipisah dari real endpoint'],
    nextMove: 'Konfigurasikan ATMAJA_BRIEF_WEBHOOK_URL lalu tambah job polling result.',
  },
  {
    id: 'memory',
    title: 'Memory Bisnis',
    score: 78,
    target: 100,
    northStar: 100,
    status: 'foundation',
    owner: 'cfo',
    strengthenedBy: ['Business knowledge dipisah dari chat trace', 'Planning memory policy', 'Reset interaction tetap aman', 'Roadmap audit memory tertulis'],
    nextMove: 'Buat halaman audit knowledge untuk keputusan, canon, preference, assumption, dan source.',
  },
  {
    id: 'automation',
    title: 'Automation Workflow',
    score: 74,
    target: 100,
    northStar: 100,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['Workflow stage map', 'Planning ritual map', 'Confirmation lane', 'Next action owner pada output agent', 'Submit bridge siap webhook'],
    nextMove: 'Tambah queue, polling result, approval routing, dan weekly planning automation.',
  },
  {
    id: 'security',
    title: 'Security & Reliability',
    score: 58,
    target: 100,
    northStar: 100,
    status: 'watch',
    owner: 'coo',
    strengthenedBy: ['App-first direction mengurangi risiko platform ban', 'Discord hanya notification optional', 'Bridge token support siap via env'],
    nextMove: 'Matikan insecure control UI, tambah runtime health auth, backup, dan log retention.',
  },
]

export const workflowStages: WorkflowStage[] = [
  {
    id: 'brief-submit',
    label: 'Submit brief',
    state: 'ready',
    description: 'Compose flow sudah submit ke /api/agent/briefs dengan fallback contract-mode.',
  },
  {
    id: 'agent-routing',
    label: 'Route ke Atmaja/C-level',
    state: 'partial',
    description: 'Bridge endpoint siap webhook; routing real menunggu URL Atmaja/n8n.',
  },
  {
    id: 'structured-result',
    label: 'Structured result',
    state: 'ready',
    description: 'Kontrak output v1 sudah disiapkan untuk summary, blocks, gates, dan action.',
  },
  {
    id: 'approval',
    label: 'Matthew approval',
    state: 'partial',
    description: 'UI approve sudah ada di detail brief; belum tersimpan ke server.',
  },
  {
    id: 'archive-memory',
    label: 'Archive & memory',
    state: 'partial',
    description: 'Memory policy sudah masuk kontrak output; backend audit page belum dibuat.',
  },
]

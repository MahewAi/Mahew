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
    score: 84,
    target: 92,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Role map Atmaja + C-level + specialist', 'Push-back sebagai prinsip kerja', 'Decision-first output', 'Agent registry app-side'],
    nextMove: 'Lengkapi authority matrix: kapan specialist boleh final, kapan wajib naik ke Atmaja.',
  },
  {
    id: 'dashboard',
    title: 'App / Dashboard',
    score: 68,
    target: 85,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Pending, running, confirmation, output lanes', 'C-level plan surface', 'Local brief persistence', 'Integration health surface'],
    nextMove: 'Ubah health dan task count agar membaca job backend live.',
  },
  {
    id: 'rich-output',
    title: 'Rich Visual Output',
    score: 66,
    target: 88,
    status: 'active',
    owner: 'cco',
    strengthenedBy: ['BriefBlock contract', 'Markdown, table, chart, mermaid, image, grid, vote renderer', 'AgentOutputEnvelope v1'],
    nextMove: 'Validasi output real Atmaja agar selalu mengirim blocks array.',
  },
  {
    id: 'agent-runtime',
    title: 'Agent Runtime',
    score: 58,
    target: 82,
    status: 'watch',
    owner: 'ceo',
    strengthenedBy: ['OpenClaw tetap dipakai sebagai engine', 'Service status terbaca manual', 'Agent registry menandai missing Web Researcher'],
    nextMove: 'Expose authenticated runtime health dari droplet ke app bridge.',
  },
  {
    id: 'integration',
    title: 'Integrasi App ke Agent',
    score: 48,
    target: 80,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['AgentOutputEnvelope v1', '/api/agent/briefs submit bridge', '/api/agent/health bridge', 'Mock fallback dipisah dari real endpoint'],
    nextMove: 'Konfigurasikan ATMAJA_BRIEF_WEBHOOK_URL agar bridge masuk ke runtime asli.',
  },
  {
    id: 'memory',
    title: 'Memory Bisnis',
    score: 66,
    target: 86,
    status: 'foundation',
    owner: 'cfo',
    strengthenedBy: ['Business knowledge dipisah dari chat trace', 'Memory policy masuk ke kontrak output', 'Reset interaction tetap aman', 'Roadmap audit memory tertulis'],
    nextMove: 'Buat halaman audit knowledge: keputusan, canon, preference, source.',
  },
  {
    id: 'automation',
    title: 'Automation Workflow',
    score: 55,
    target: 82,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['Workflow stage map', 'Confirmation lane', 'Next action owner pada output agent', 'Submit bridge siap webhook'],
    nextMove: 'Tambah queue/polling result dan route approval ke backend.',
  },
  {
    id: 'security',
    title: 'Security & Reliability',
    score: 48,
    target: 84,
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

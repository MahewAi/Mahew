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
    score: 80,
    target: 92,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Role map Atmaja + C-level + specialist', 'Push-back sebagai prinsip kerja', 'Decision-first output'],
    nextMove: 'Kunci definisi job desk dan batas wewenang tiap role.',
  },
  {
    id: 'dashboard',
    title: 'App / Dashboard',
    score: 55,
    target: 85,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Pending, running, confirmation, output lanes', 'C-level plan surface', 'Local brief persistence'],
    nextMove: 'Hubungkan semua card ke data agent asli dari backend.',
  },
  {
    id: 'rich-output',
    title: 'Rich Visual Output',
    score: 45,
    target: 88,
    status: 'active',
    owner: 'cco',
    strengthenedBy: ['BriefBlock contract', 'Markdown, table, chart, mermaid, image, grid, vote renderer', 'Visual output capability map'],
    nextMove: 'Paksa agent mengirim blocks array, bukan teks bebas.',
  },
  {
    id: 'agent-runtime',
    title: 'Agent Runtime',
    score: 50,
    target: 82,
    status: 'watch',
    owner: 'ceo',
    strengthenedBy: ['OpenClaw tetap dipakai sebagai engine', 'Service status perlu dimonitor', 'Missing specialist harus dilengkapi'],
    nextMove: 'Tambah health check dan registry agent dari server.',
  },
  {
    id: 'integration',
    title: 'Integrasi App ke Agent',
    score: 20,
    target: 80,
    status: 'needs-build',
    owner: 'coo',
    strengthenedBy: ['AgentOutputEnvelope v1', 'Backend bridge target sudah jelas', 'Mock boundary dipisah dari kontrak real output'],
    nextMove: 'Bangun endpoint submit brief dan polling job result.',
  },
  {
    id: 'memory',
    title: 'Memory Bisnis',
    score: 60,
    target: 86,
    status: 'foundation',
    owner: 'cfo',
    strengthenedBy: ['Business knowledge dipisah dari chat trace', 'Memory policy masuk ke kontrak output', 'Reset interaction tetap aman'],
    nextMove: 'Buat halaman audit knowledge: keputusan, canon, preference, source.',
  },
  {
    id: 'automation',
    title: 'Automation Workflow',
    score: 35,
    target: 82,
    status: 'needs-build',
    owner: 'coo',
    strengthenedBy: ['Workflow stage map', 'Confirmation lane', 'Next action owner pada output agent'],
    nextMove: 'Tambah n8n/API workflow untuk routing, approval, archive, dan notification.',
  },
  {
    id: 'security',
    title: 'Security & Reliability',
    score: 40,
    target: 84,
    status: 'watch',
    owner: 'coo',
    strengthenedBy: ['App-first direction mengurangi risiko platform ban', 'Discord hanya notification optional', 'Security flag perlu ditutup'],
    nextMove: 'Matikan insecure control UI, tambah auth boundary, backup, dan log retention.',
  },
]

export const workflowStages: WorkflowStage[] = [
  {
    id: 'brief-submit',
    label: 'Submit brief',
    state: 'partial',
    description: 'App sudah punya compose flow; real backend endpoint belum tersambung.',
  },
  {
    id: 'agent-routing',
    label: 'Route ke Atmaja/C-level',
    state: 'missing',
    description: 'Butuh n8n atau backend router untuk memilih role dan queue job.',
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
    state: 'missing',
    description: 'Perlu backend untuk memisahkan keputusan penting dari chat history.',
  },
]

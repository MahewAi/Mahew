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
  capabilityBreakdown: StrengthCapability[]
  maturityMeaning: string
  nextMove: string
  beyondMove: string
}

export interface StrengthCapability {
  label: string
  score: number
  evidence: string
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
    score: 104,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Role map Atmaja + C-level + specialist', 'Planning OS', 'Push-back mandatory', 'Decision-first output', 'Agent registry app-side', 'V9 Tavily research route'],
    capabilityBreakdown: [
      { label: 'Role clarity', score: 100, evidence: '17 agent registry dan struktur C-level sudah jelas.' },
      { label: 'Planning language', score: 108, evidence: 'Atmaja dan C-level diarahkan sebagai planner, bukan chatbot.' },
      { label: 'Decision gate', score: 94, evidence: 'Approval dan revision signal sudah ada di app.' },
    ],
    maturityMeaning: 'Sudah melewati baseline 100 karena struktur role, planning OS, dan push-back sudah aktif.',
    nextMove: 'Kunci authority matrix: kapan specialist final, kapan wajib naik ke Atmaja.',
    beyondMove: 'Mode 120%: Atmaja otomatis membuat council brief mingguan dan menolak brief yang datanya terlalu lemah.',
  },
  {
    id: 'dashboard',
    title: 'App / Dashboard',
    score: 94,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['Pending, running, confirmation, output lanes', 'Planner council surface', 'Local brief persistence', 'Integration health surface', 'Focused dashboard tabs'],
    capabilityBreakdown: [
      { label: 'Command center', score: 96, evidence: 'Dashboard sudah dipecah: hari ini, sektor, sistem.' },
      { label: 'C-level room', score: 90, evidence: 'Setiap role punya workspace dan planning mandate.' },
      { label: 'Breakdown visibility', score: 92, evidence: 'Scorecard maturity sekarang memperlihatkan gap dan next move.' },
    ],
    maturityMeaning: 'Sudah kuat untuk penggunaan harian, tapi belum live sepenuhnya dari runtime server.',
    nextMove: 'Buat planning detail per C-level dengan owner, due date, dan progress server-side.',
    beyondMove: 'Mode 120%: dashboard berubah jadi live cockpit dengan alerts, SLA, dan autonomous follow-up.',
  },
  {
    id: 'rich-output',
    title: 'Rich Visual Output',
    score: 104,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'cco',
    strengthenedBy: ['C-level work maps', 'Role-specific Mermaid diagrams', 'BriefBlock contract', 'Markdown, table, chart, image, grid, vote renderer', 'AgentOutputEnvelope v1'],
    capabilityBreakdown: [
      { label: 'Renderer coverage', score: 104, evidence: 'Markdown, table, chart, mermaid, callout, grid, image sudah siap.' },
      { label: 'Planning visual', score: 104, evidence: 'Setiap COO, CMO, CFO, dan CCO punya work map, dependency, output, dan decision gate.' },
      { label: 'Agent contract', score: 94, evidence: 'AgentOutputEnvelope dan mock output sudah membawa visual planning blocks.' },
    ],
    maturityMeaning: 'App bukan hanya bisa menampilkan visual; setiap C-level sudah punya rancangan kerja visual yang bisa dibuka di tab sektor.',
    nextMove: 'Paksa output real Atmaja mengirim work map C-level yang sama: lane, dependency, artifact, dan gate.',
    beyondMove: 'Mode 120%: setiap brief otomatis punya executive diagram, evidence table, dan decision simulator.',
  },
  {
    id: 'agent-runtime',
    title: 'Agent Runtime',
    score: 88,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'ceo',
    strengthenedBy: ['OpenClaw tetap dipakai sebagai engine', 'Planning OS instruction V6-V9', 'Service status aktif', '17 agent registry lengkap', 'Tavily available server-side'],
    capabilityBreakdown: [
      { label: 'Runtime active', score: 96, evidence: 'openclaw-atmaja service aktif di droplet.' },
      { label: 'Research tools', score: 92, evidence: 'Tavily primary search sudah aktif lewat web_search_pro.sh.' },
      { label: 'Observable jobs', score: 70, evidence: 'Job metrics belum ditarik otomatis ke app.' },
    ],
    maturityMeaning: 'Runtime sudah hidup dan punya research engine, tapi observability dan job history belum masuk cockpit.',
    nextMove: 'Expose authenticated runtime health dan job execution metrics dari droplet ke app.',
    beyondMove: 'Mode 120%: agent runtime punya queue, retry, job trace, cost log, dan error recovery otomatis.',
  },
  {
    id: 'integration',
    title: 'Integrasi App ke Agent',
    score: 72,
    target: 110,
    northStar: 120,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['AgentOutputEnvelope v1', 'Bridge dikunci env VITE_GERAI_AGENT_BRIDGE', 'Private local fallback', 'Mock fallback dipisah dari real endpoint'],
    capabilityBreakdown: [
      { label: 'Submit contract', score: 82, evidence: 'App punya submit bridge, tapi default off agar data tidak keluar tanpa sengaja.' },
      { label: 'Health bridge', score: 70, evidence: 'Health endpoint siap, tetapi hanya dipanggil saat bridge diaktifkan.' },
      { label: 'Result polling', score: 54, evidence: 'Belum ada job polling hasil Atmaja ke app.' },
    ],
    maturityMeaning: 'Fondasi sudah ada, tetapi belum menjadi live loop penuh dari app ke Atmaja lalu kembali ke app.',
    nextMove: 'Aktifkan bridge hanya di runtime tepercaya, lalu tambah job polling result dengan audit log.',
    beyondMove: 'Mode 120%: brief dari app masuk queue, diproses agent, hasil visual kembali otomatis, lalu minta approval.',
  },
  {
    id: 'memory',
    title: 'Memory Bisnis',
    score: 94,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'cfo',
    strengthenedBy: ['Self-learning V1 lesson store', 'Approval dan revision signals', 'Preference extraction', 'Business knowledge dipisah dari chat trace', 'Audit memory surface', 'Private Sync Vault'],
    capabilityBreakdown: [
      { label: 'Preference memory', score: 98, evidence: 'App menangkap preferensi UX, format, dan workflow Matthew.' },
      { label: 'Decision signal', score: 90, evidence: 'Approve dan revisi jadi lesson signal.' },
      { label: 'Private sync', score: 86, evidence: 'Private Sync Vault siap diekspor ke folder Syncthing.' },
    ],
    maturityMeaning: 'Memory sudah membantu gaya kerja dan sekarang punya jalur portabilitas lokal, bukan bergantung cloud.',
    nextMove: 'Uji ritme export/import vault lewat Syncthing dan tambahkan outcome review mingguan.',
    beyondMove: 'Mode 120%: sistem belajar dari hasil nyata, bukan hanya preferensi dan revisi.',
  },
  {
    id: 'automation',
    title: 'Automation Workflow',
    score: 82,
    target: 110,
    northStar: 120,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['Workflow stage map', 'Planning ritual map', 'Confirmation lane', 'Next action owner pada output agent', 'Submit bridge siap webhook', 'Autonomous engine blueprint'],
    capabilityBreakdown: [
      { label: 'Workflow map', score: 94, evidence: 'Submit, route, result, approval, archive sudah dipetakan.' },
      { label: 'Approval gate', score: 82, evidence: 'UI approval tersedia, belum server-side full audit.' },
      { label: 'Autonomous scan', score: 66, evidence: 'Tavily siap, scheduler dan recurring radar belum aktif.' },
    ],
    maturityMeaning: 'Alur sudah jelas. Agar naik ke autonomous, perlu scheduler, queue, dan recurring radar.',
    nextMove: 'Tambah queue, polling result, approval routing, dan weekly planning automation.',
    beyondMove: 'Mode 120%: AI Department jalan sendiri untuk scan, alert, draft plan, dan follow-up dengan approval gate.',
  },
  {
    id: 'security',
    title: 'Security & Reliability',
    score: 91,
    target: 110,
    northStar: 120,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['Bridge off by default', 'Telemetry off by default', 'Private Sync Vault', 'Bridge token support via env', 'allowInsecureAuth false', 'Tavily key server-side only'],
    capabilityBreakdown: [
      { label: 'Data egress', score: 94, evidence: 'Bridge dan telemetry tidak aktif kecuali env menyalakan dengan sengaja.' },
      { label: 'Secret handling', score: 88, evidence: 'Tavily tidak masuk frontend dan service memakai env file.' },
      { label: 'Local sync', score: 90, evidence: 'Private vault bisa dipindah via Syncthing antar device tepercaya.' },
    ],
    maturityMeaning: 'Naik besar setelah data egress dipagari. Sisa risk terbesar ada di runtime server, audit log, dan device key handling.',
    nextMove: 'Tambah plugin allowlist, runtime health auth, backup rotation, log retention, dan checklist Syncthing device trust.',
    beyondMove: 'Mode 120%: security posture punya allowlist, key rotation, audit trail, dan incident rollback playbook.',
  },
]

export const workflowStages: WorkflowStage[] = [
  {
    id: 'brief-submit',
    label: 'Submit brief',
    state: 'ready',
    description: 'Compose flow tersimpan lokal; /api bridge hanya aktif jika VITE_GERAI_AGENT_BRIDGE=on.',
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
    description: 'Lesson memory lokal sudah aktif; Private Sync Vault bisa dipindah lewat folder Syncthing tepercaya.',
  },
]

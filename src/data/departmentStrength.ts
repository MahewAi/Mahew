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
    score: 96,
    target: 110,
    northStar: 120,
    status: 'active',
    owner: 'cco',
    strengthenedBy: ['BriefBlock contract', 'Planning-grade blocks', 'Markdown, table, chart, mermaid, image, grid, vote renderer', 'AgentOutputEnvelope v1'],
    capabilityBreakdown: [
      { label: 'Renderer coverage', score: 100, evidence: 'Markdown, table, chart, mermaid, callout, grid, image sudah siap.' },
      { label: 'Planning visual', score: 94, evidence: 'Output diarahkan ke architecture map dan denah kerja.' },
      { label: 'Agent contract', score: 90, evidence: 'AgentOutputEnvelope sudah jadi dasar structured output.' },
    ],
    maturityMeaning: 'App sudah bisa menampilkan data kaya. Gap berikutnya adalah memaksa output real agent selalu terstruktur.',
    nextMove: 'Paksa output real Atmaja mengirim plan matrix, roadmap, dan decision gate.',
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
    strengthenedBy: ['AgentOutputEnvelope v1', '/api/agent/briefs submit bridge', '/api/agent/health bridge', 'Mock fallback dipisah dari real endpoint'],
    capabilityBreakdown: [
      { label: 'Submit contract', score: 82, evidence: 'App sudah punya submit bridge dan fallback contract mode.' },
      { label: 'Health bridge', score: 70, evidence: 'Health endpoint sudah ada, tapi belum real-time penuh.' },
      { label: 'Result polling', score: 54, evidence: 'Belum ada job polling hasil Atmaja ke app.' },
    ],
    maturityMeaning: 'Fondasi sudah ada, tetapi belum menjadi live loop penuh dari app ke Atmaja lalu kembali ke app.',
    nextMove: 'Konfigurasikan ATMAJA_BRIEF_WEBHOOK_URL lalu tambah job polling result.',
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
    strengthenedBy: ['Self-learning V1 lesson store', 'Approval dan revision signals', 'Preference extraction', 'Business knowledge dipisah dari chat trace', 'Audit memory surface', 'Memory-core plugin active server-side'],
    capabilityBreakdown: [
      { label: 'Preference memory', score: 98, evidence: 'App menangkap preferensi UX, format, dan workflow Matthew.' },
      { label: 'Decision signal', score: 90, evidence: 'Approve dan revisi jadi lesson signal.' },
      { label: 'Server sync', score: 78, evidence: 'Memory-core ada, sinkronisasi app ke server belum final.' },
    ],
    maturityMeaning: 'Memory sudah membantu gaya kerja, tapi belum sepenuhnya menjadi institutional memory lintas server dan app.',
    nextMove: 'Sinkronkan lesson memory app ke memory-core server dan tambahkan outcome review mingguan.',
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
    score: 84,
    target: 110,
    northStar: 120,
    status: 'foundation',
    owner: 'coo',
    strengthenedBy: ['App-first direction mengurangi risiko platform ban', 'Discord hanya notification optional', 'Bridge token support siap via env', 'allowInsecureAuth false', 'Tavily key server-side only', 'No risky social scraping rule'],
    capabilityBreakdown: [
      { label: 'Secret handling', score: 88, evidence: 'Tavily tidak masuk frontend dan service memakai env file.' },
      { label: 'Runtime flag', score: 92, evidence: 'allowInsecureAuth sudah dimatikan.' },
      { label: 'Policy guardrail', score: 78, evidence: 'Social scraping risk sudah dilarang di skill V9.' },
    ],
    maturityMeaning: 'Naik besar setelah security flag dibetulkan dan Tavily dipasang server-side, tetapi allowlist dan audit log masih perlu diperkuat.',
    nextMove: 'Tambah plugin allowlist, runtime health auth, backup rotation, dan log retention.',
    beyondMove: 'Mode 120%: security posture punya allowlist, key rotation, audit trail, dan incident rollback playbook.',
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
    description: 'Lesson memory lokal sudah aktif untuk approval, revisi, dan preferensi; sinkronisasi server masih berikutnya.',
  },
]

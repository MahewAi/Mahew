export type IntelligenceStatus = 'strong' | 'active' | 'developing' | 'limited'

export interface IntelligenceDimension {
  id:
    | 'business-context'
    | 'self-learning'
    | 'planning-reasoning'
    | 'research-intelligence'
    | 'visual-communication'
    | 'autonomy'
    | 'safety-judgment'
  title: string
  shortLabel: string
  score: number
  target: number
  northStar: number
  status: IntelligenceStatus
  meaning: string
  evidence: string[]
  blindSpot: string
  upgradeMove: string
}

export interface IntelligenceStage {
  label: string
  range: string
  meaning: string
}

export const intelligenceStages: IntelligenceStage[] = [
  {
    label: 'Dasar',
    range: '0-60',
    meaning: 'Bisa menjawab, tapi belum cukup stabil untuk jadi sistem kerja.',
  },
  {
    label: 'Operasional',
    range: '61-85',
    meaning: 'Sudah bisa membantu planning internal dengan validasi Matthew.',
  },
  {
    label: 'Pintar',
    range: '86-100',
    meaning: 'Mulai paham konteks, format, data, dan cara Matthew mengambil keputusan.',
  },
  {
    label: 'Advanced',
    range: '101-110',
    meaning: 'Bisa menyusun rencana lintas fungsi dan memberi push-back berbasis bukti.',
  },
  {
    label: 'Autonomous assist',
    range: '111-120',
    meaning: 'Mulai jalan sendiri untuk scan, alert, draft, follow-up, lalu minta approval.',
  },
]

export const intelligenceDimensions: IntelligenceDimension[] = [
  {
    id: 'business-context',
    title: 'Pemahaman Bisnis Gerai',
    shortLabel: 'Bisnis',
    score: 96,
    target: 110,
    northStar: 120,
    status: 'strong',
    meaning: 'AI Department sudah memegang brand canon, struktur role, dan arah Gerai 1000 Pintu.',
    evidence: ['Brand canon locked', '17 role department jelas', 'Planning OS aktif'],
    blindSpot: 'Masih perlu lebih banyak data keputusan nyata dari operasional harian.',
    upgradeMove: 'Sinkronkan business plan, decision log, dan outcome review mingguan ke memory server.',
  },
  {
    id: 'self-learning',
    title: 'Self-Learning Memory',
    shortLabel: 'Belajar',
    score: 88,
    target: 110,
    northStar: 120,
    status: 'active',
    meaning: 'App mulai belajar dari approval, revisi, dan preferensi Matthew.',
    evidence: ['Lesson store lokal', 'Approval signal', 'Revision signal', 'Preference extraction'],
    blindSpot: 'Memory app belum tersinkron penuh ke memory-core server.',
    upgradeMove: 'Buat sync app-to-server dan weekly learning review supaya lesson menjadi institutional memory.',
  },
  {
    id: 'planning-reasoning',
    title: 'Planning & Reasoning',
    shortLabel: 'Nalar',
    score: 94,
    target: 110,
    northStar: 120,
    status: 'strong',
    meaning: 'Atmaja dan C-level sudah diarahkan menjadi perencana, bukan sekadar penjawab chat.',
    evidence: ['Architecture-first output', 'Denah kerja C-level', 'Maturity impact V10', 'Push-back mandatory'],
    blindSpot: 'Belum semua hasil agent otomatis kembali sebagai structured plan di app.',
    upgradeMove: 'Paksa semua brief real memakai plan matrix, risk ledger, owner, due gate, dan maturity impact.',
  },
  {
    id: 'research-intelligence',
    title: 'Research Intelligence',
    shortLabel: 'Riset',
    score: 86,
    target: 110,
    northStar: 120,
    status: 'active',
    meaning: 'Tavily sudah menjadi search layer utama untuk market, competitor, dan evidence gathering.',
    evidence: ['Tavily server-side', 'Web Researcher V9', 'CMO market intelligence V9'],
    blindSpot: 'Competitor database dan recurring radar belum otomatis.',
    upgradeMove: 'Bangun competitor source list, recurring Tavily scan, evidence vault, dan alert pipeline.',
  },
  {
    id: 'visual-communication',
    title: 'Visual Communication',
    shortLabel: 'Visual',
    score: 96,
    target: 110,
    northStar: 120,
    status: 'strong',
    meaning: 'App sudah siap menampilkan table, chart, markdown, mermaid, callout, grid, dan visual brief.',
    evidence: ['BlockRenderer', 'Rich brief output', 'Visual-explainer skill', 'Chart and diagram support'],
    blindSpot: 'Belum semua output real agent dipaksa memakai visual format.',
    upgradeMove: 'Jadikan chart, table, dan denah kerja sebagai default untuk brief kompleks.',
  },
  {
    id: 'autonomy',
    title: 'Autonomy & Follow-Up',
    shortLabel: 'Mandiri',
    score: 78,
    target: 110,
    northStar: 120,
    status: 'developing',
    meaning: 'Case baru sekarang langsung masuk run automation lokal dengan framing, routing, reasoning, evidence check, dan output contract.',
    evidence: ['Case automation ledger', 'Workflow map', 'Confirmation lane', 'Skill automation runbook'],
    blindSpot: 'Loop app sudah live, tetapi recurring scan dan server-side job queue belum menjadi runtime penuh.',
    upgradeMove: 'Hubungkan run ledger ke job polling authenticated, daily scan, weekly council, recurring radar, dan approval gate.',
  },
  {
    id: 'safety-judgment',
    title: 'Safety & Judgment',
    shortLabel: 'Aman',
    score: 84,
    target: 110,
    northStar: 120,
    status: 'active',
    meaning: 'Security flag sudah diperbaiki dan social scraping berisiko sudah dibatasi.',
    evidence: ['allowInsecureAuth false', 'No risky social scraping rule', 'Tavily key server-side only'],
    blindSpot: 'Plugin allowlist, key rotation, dan audit trail belum lengkap.',
    upgradeMove: 'Tambah allowlist, log retention, key rotation, runtime auth, dan rollback playbook.',
  },
]

export type Role = 'ceo' | 'coo' | 'cmo' | 'cfo' | 'cco'

export type Specialist =
  | 'hr_systems'
  | 'production_manager'
  | 'curator'
  | 'brand_strategist'
  | 'market_researcher'
  | 'sales_strategist'
  | 'innovation_scout'
  | 'business_designer'
  | 'financial_analyst'
  | 'document_writer'
  | 'editorial'
  | 'web_researcher'

export type Contributor = Role | Specialist

export type Status = 'decision' | 'doing' | 'review' | 'final'
export type Verdict = { type: 'A' | 'B' | 'C'; text: string }

/**
 * Single source of truth untuk semua contributor di AI Department.
 * Avatar color = parent (C-suite warna) untuk specialist; identik untuk C-suite.
 * Initial: 1 huruf untuk C-suite, 2 huruf untuk specialist (auto-disambiguate).
 */
export const CONTRIBUTOR_META: Record<
  Contributor,
  { name: string; initials: string; parent?: Exclude<Role, 'ceo'> }
> = {
  ceo: { name: 'Atmaja', initials: 'A' },
  coo: { name: 'Operations', initials: 'O' },
  cmo: { name: 'Marketing', initials: 'M' },
  cfo: { name: 'Finance', initials: 'F' },
  cco: { name: 'Creative', initials: 'C' },

  hr_systems: { name: 'HR & Systems', initials: 'HS', parent: 'coo' },
  production_manager: { name: 'Production Manager', initials: 'PM', parent: 'coo' },
  curator: { name: 'Curator', initials: 'CU', parent: 'coo' },

  brand_strategist: { name: 'Brand Strategist', initials: 'BS', parent: 'cmo' },
  market_researcher: { name: 'Market Researcher', initials: 'MR', parent: 'cmo' },
  sales_strategist: { name: 'Sales Strategist', initials: 'SS', parent: 'cmo' },
  innovation_scout: { name: 'Innovation Scout', initials: 'IS', parent: 'cmo' },

  business_designer: { name: 'Business Designer', initials: 'BD', parent: 'cfo' },
  financial_analyst: { name: 'Financial Analyst', initials: 'FA', parent: 'cfo' },

  document_writer: { name: 'Document Writer', initials: 'DW', parent: 'cco' },
  editorial: { name: 'Editorial', initials: 'ED', parent: 'cco' },
  web_researcher: { name: 'Web Researcher', initials: 'WR', parent: 'cco' },
}

/** Returns the role color key untuk Tailwind class (mis. `bg-role-coo`). */
export function getContributorColorRole(c: Contributor): Role {
  if (c === 'ceo' || c === 'coo' || c === 'cmo' || c === 'cfo' || c === 'cco') return c
  return CONTRIBUTOR_META[c].parent ?? 'ceo'
}

/** Urutan tampilan section/tab di Inbox. */
export const DEPARTMENT_ORDER: Role[] = ['ceo', 'coo', 'cmo', 'cfo', 'cco']

/** Label panjang untuk section header / tab. */
export const DEPARTMENT_LABEL: Record<Role, string> = {
  ceo: 'Atmaja CEO',
  coo: 'Operations',
  cmo: 'Marketing',
  cfo: 'Finance',
  cco: 'Creative',
}

/** Label pendek untuk tab compact. */
export const DEPARTMENT_LABEL_SHORT: Record<Role, string> = {
  ceo: 'CEO',
  coo: 'COO',
  cmo: 'CMO',
  cfo: 'CFO',
  cco: 'CCO',
}

/**
 * Derive seluruh department yang relevan untuk brief.
 * Specialist di-rollup ke C-suite parent. Sebuah brief bisa muncul di banyak section/tab.
 */
export function getBriefDepartments(contributors: Contributor[]): Role[] {
  const set = new Set<Role>()
  for (const c of contributors) {
    set.add(getContributorColorRole(c))
  }
  return DEPARTMENT_ORDER.filter((r) => set.has(r))
}

/**
 * Pilih hero brief untuk magazine card di top Inbox.
 * Prioritas: high+decision > decision > high > none.
 * Hero tampil sebagai magazine card, sisanya sebagai standard cards.
 * Returns null kalau tidak ada brief yang layak di-hero (mis. semua final).
 */
export function pickHeroBrief(briefs: Brief[]): Brief | null {
  if (briefs.length === 0) return null
  const scored = briefs.map((b) => ({
    b,
    score:
      (b.priority === 'high' ? 100 : 0) +
      (b.status === 'decision' ? 50 : b.status === 'doing' ? 20 : b.status === 'review' ? 10 : 0) +
      b.contributors.length,
  }))
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  // Jangan hero kalau yang teratas adalah final brief (kurang menarik untuk ditampilkan besar)
  if (top.b.status === 'final' && top.score < 30) return null
  return top.b
}

export interface CSuiteInput {
  role: Contributor
  name: string
  subtitle?: string
  verdict?: Verdict
  bullets: string[]
}

export interface Brief {
  id: string
  status: Status
  priority: 'high' | 'normal'
  title: string
  description: string
  summary: string
  labels: string[]
  contributors: Contributor[]
  commentCount?: number
  timeAgo: string
  timestamp: string
  csuiteInput: CSuiteInput[]
  coverImage?: string
}

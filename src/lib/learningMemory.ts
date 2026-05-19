import type { Brief, Contributor } from '@/lib/types'

export type LearningCategory = 'format' | 'decision' | 'workflow' | 'brand' | 'ux' | 'business'
export type LearningConfidence = 'low' | 'medium' | 'high'

export interface LearningSource {
  type: 'system-seed' | 'atmaja-chat' | 'brief-comment' | 'brief-approval' | 'brief-revision'
  briefId?: string
  author?: 'matthew' | Contributor
}

export interface LearningLesson {
  id: string
  category: LearningCategory
  title: string
  lesson: string
  source: LearningSource
  confidence: LearningConfidence
  createdAt: string
  lastSeenAt: string
  uses: number
}

export interface LearningSnapshot {
  lessons: LearningLesson[]
  total: number
  highConfidence: number
  recent: LearningLesson[]
  byCategory: Record<LearningCategory, number>
}

const STORAGE_KEY = 'gerai:learning-memory:v1'
const MAX_STORED_LESSONS = 120

const EMPTY_CATEGORY_COUNT: Record<LearningCategory, number> = {
  format: 0,
  decision: 0,
  workflow: 0,
  brand: 0,
  ux: 0,
  business: 0,
}

const BUILT_IN_LESSONS: LearningLesson[] = [
  {
    id: 'seed-format-architecture',
    category: 'format',
    title: 'Preferensi output visual',
    lesson: 'Matthew lebih mudah membaca rencana sebagai architecture map, denah kerja, dependency map, dan confirmation gate.',
    source: { type: 'system-seed' },
    confidence: 'high',
    createdAt: '2026-05-19T00:00:00.000Z',
    lastSeenAt: '2026-05-19T00:00:00.000Z',
    uses: 1,
  },
  {
    id: 'seed-ux-progressive-disclosure',
    category: 'ux',
    title: 'Preferensi dashboard',
    lesson: 'Matthew tidak suka satu halaman yang terlalu banyak tombol. Pecah pekerjaan menjadi view Hari ini, Sektor, dan Sistem.',
    source: { type: 'system-seed' },
    confidence: 'high',
    createdAt: '2026-05-19T00:00:00.000Z',
    lastSeenAt: '2026-05-19T00:00:00.000Z',
    uses: 1,
  },
  {
    id: 'seed-format-direct',
    category: 'format',
    title: 'Gaya penyampaian',
    lesson: 'Jawaban harus konkret, senior internal, langsung ke keputusan, tidak terlalu klasik, dan tidak terasa seperti output AI generik.',
    source: { type: 'system-seed' },
    confidence: 'medium',
    createdAt: '2026-05-19T00:00:00.000Z',
    lastSeenAt: '2026-05-19T00:00:00.000Z',
    uses: 1,
  },
]

function safeNow() {
  return new Date().toISOString()
}

function getFingerprint(category: LearningCategory, title: string) {
  return `${category}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function readStoredLessons(): LearningLesson[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as LearningLesson[]
  } catch {
    return []
  }
}

function writeStoredLessons(lessons: LearningLesson[]) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons.slice(0, MAX_STORED_LESSONS)))
  } catch {
    // Storage unavailable or quota reached.
  }
}

function upsertLesson(input: Omit<LearningLesson, 'id' | 'createdAt' | 'lastSeenAt' | 'uses'>): LearningLesson {
  const stored = readStoredLessons()
  const id = getFingerprint(input.category, input.title)
  const now = safeNow()
  const existing = stored.find((lesson) => lesson.id === id)
  const nextLesson: LearningLesson = existing
    ? {
        ...existing,
        lesson: input.lesson,
        source: input.source,
        confidence: input.confidence,
        lastSeenAt: now,
        uses: existing.uses + 1,
      }
    : {
        ...input,
        id,
        createdAt: now,
        lastSeenAt: now,
        uses: 1,
      }

  const next = [nextLesson, ...stored.filter((lesson) => lesson.id !== id)]
  writeStoredLessons(next)
  return nextLesson
}

function inferPreferenceLessons(text: string, source: LearningSource): LearningLesson[] {
  const q = text.toLowerCase()
  const lessons: Array<Omit<LearningLesson, 'id' | 'createdAt' | 'lastSeenAt' | 'uses'>> = []

  if (/arsitektur|architecture|denah|peta kerja|work map|blueprint|dependency/.test(q)) {
    lessons.push({
      category: 'format',
      title: 'Preferensi architecture map',
      lesson: 'Saat brief kompleks, tampilkan gambaran arsitektur, denah kerja C-level, dependency, dan gate keputusan sebelum detail.',
      source,
      confidence: 'high',
    })
  }

  if (/terlalu banyak tombol|kebanyakan tombol|banyak tombol|pecah|dipecah|pisah|dipisah/.test(q)) {
    lessons.push({
      category: 'ux',
      title: 'Kurangi tombol dalam satu halaman',
      lesson: 'Kurangi tombol primer dalam satu layar. Gunakan progressive disclosure dan pecah dashboard menjadi view yang fokus.',
      source,
      confidence: 'high',
    })
  }

  if (/font.*tegas|kurang tegas|terlalu classic|terlalu klasik/.test(q)) {
    lessons.push({
      category: 'ux',
      title: 'Font lebih tegas',
      lesson: 'Gunakan typography yang lebih tegas dan modern untuk area operasional. Hindari kesan terlalu klasik pada UI kerja.',
      source,
      confidence: 'medium',
    })
  }

  if (/terlalu coklat|background.*coklat|ganggu text|mengganggu text|kurang halus/.test(q)) {
    lessons.push({
      category: 'ux',
      title: 'Background harus ringan',
      lesson: 'Background app harus ringan, putih hangat, dan tidak mengganggu text box atau readability.',
      source,
      confidence: 'medium',
    })
  }

  if (/c.?level|coo|cmo|cfo|cco|sektor|department/.test(q) && /khusus|rancang|rancangkan|kerja|planning|sektor/.test(q)) {
    lessons.push({
      category: 'workflow',
      title: 'C-level perlu workbench sendiri',
      lesson: 'Setiap C-level perlu view khusus berisi apa yang sedang mereka rancang, dependency, output, dan keputusan yang diminta.',
      source,
      confidence: 'high',
    })
  }

  return lessons.map(upsertLesson)
}

export function recordInteractionLessons(
  text: string,
  source: Omit<LearningSource, 'author'> & { author?: 'matthew' | Contributor } = { type: 'atmaja-chat' },
): LearningLesson[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (source.author && source.author !== 'matthew') return []
  return inferPreferenceLessons(trimmed, { ...source, author: source.author ?? 'matthew' })
}

export function recordBriefApprovalLesson(brief: Brief): LearningLesson {
  const lead = brief.contributors[0] ?? 'ceo'
  return upsertLesson({
    category: 'decision',
    title: `Approved brief pattern: ${brief.title}`,
    lesson: `Matthew approved "${brief.title}". Preserve the decision pattern: ${brief.labels.join(', ') || 'planning brief'} with lead ${lead}.`,
    source: { type: 'brief-approval', briefId: brief.id, author: 'matthew' },
    confidence: 'medium',
  })
}

export function recordBriefRevisionLesson(brief: Brief): LearningLesson {
  return upsertLesson({
    category: 'workflow',
    title: `Revision requested: ${brief.title}`,
    lesson: `Matthew requested revision for "${brief.title}". Future outputs should expose weak assumptions, missing data, and alternate options earlier.`,
    source: { type: 'brief-revision', briefId: brief.id, author: 'matthew' },
    confidence: 'medium',
  })
}

export function loadLearningLessons(): LearningLesson[] {
  const stored = readStoredLessons()
  const storedIds = new Set(stored.map((lesson) => lesson.id))
  return [...BUILT_IN_LESSONS.filter((lesson) => !storedIds.has(lesson.id)), ...stored]
}

export function getLearningSnapshot(): LearningSnapshot {
  const lessons = loadLearningLessons().sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  const byCategory = { ...EMPTY_CATEGORY_COUNT }

  for (const lesson of lessons) {
    byCategory[lesson.category] += 1
  }

  return {
    lessons,
    total: lessons.length,
    highConfidence: lessons.filter((lesson) => lesson.confidence === 'high').length,
    recent: lessons.slice(0, 5),
    byCategory,
  }
}

export function getLearningGuidanceLines(limit = 3): string[] {
  return loadLearningLessons()
    .filter((lesson) => lesson.confidence !== 'low')
    .sort((a, b) => b.uses - a.uses || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit)
    .map((lesson) => lesson.lesson)
}

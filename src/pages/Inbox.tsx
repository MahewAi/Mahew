import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Inbox as InboxIcon, ArrowUpRight, Plus } from 'lucide-react'
import { TopBar } from '@/components/nav/TopBar'
import { FilterChips, type FilterValue } from '@/components/nav/FilterChips'
import { BriefTile, type BriefTileSize } from '@/components/brief/BriefTile'
import { StatsTile } from '@/components/brief/StatsTile'
import { BriefDetailSheet } from '@/components/brief/BriefDetailSheet'
import { ComposeSheet, simulateAiResponse } from '@/components/brief/ComposeSheet'
import { DailyDigestCard } from '@/components/brief/DailyDigestCard'
import { mockBriefs } from '@/data/mockBriefs'
import {
  DEPARTMENT_ORDER,
  DEPARTMENT_LABEL,
  getBriefDepartments,
  pickHeroBrief,
  type Brief,
  type Comment,
  type Role,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type DeptValue = 'all' | Role

const roleDot: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

/**
 * Assign bento tile size berdasarkan priority + status.
 * Hero sudah dipilih terpisah via pickHeroBrief.
 */
function getTileSize(brief: Brief): BriefTileSize {
  if (brief.priority === 'high') return 'priority'
  if (brief.status === 'final') return 'compact'
  return 'compact'
}

export default function Inbox() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [briefs, setBriefs] = useState<Brief[]>(mockBriefs)
  const [dept, setDept] = useState<DeptValue>('all')
  const [status, setStatus] = useState<FilterValue>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)

  const visible = useMemo(() => {
    let list = briefs
    if (dept !== 'all') list = list.filter((b) => getBriefDepartments(b.contributors).includes(dept))
    if (status !== 'all') list = list.filter((b) => b.status === status)
    return list
  }, [briefs, dept, status])

  const statusCounts = useMemo<Record<FilterValue, number>>(() => {
    const base: Record<FilterValue, number> = { all: 0, decision: 0, doing: 0, review: 0, final: 0 }
    const scope = dept === 'all' ? briefs : briefs.filter((b) => getBriefDepartments(b.contributors).includes(dept))
    base.all = scope.length
    for (const b of scope) base[b.status] += 1
    return base
  }, [briefs, dept])

  const dailyDigest = useMemo(() => visible.find((b) => b.isDailyDigest) ?? null, [visible])
  const heroPool = useMemo(() => visible.filter((b) => !b.isDailyDigest), [visible])
  const hero = useMemo(() => pickHeroBrief(heroPool), [heroPool])
  const rest = useMemo(
    () => heroPool.filter((b) => !hero || b.id !== hero.id),
    [heroPool, hero],
  )

  const activeBriefs = useMemo(() => briefs.filter((b) => b.status !== 'final'), [briefs])
  const pendingCount = useMemo(() => briefs.filter((b) => b.status === 'decision').length, [briefs])

  const openBrief = params.id ? briefs.find((b) => b.id === params.id) ?? null : null
  const sheetOpen = openBrief !== null

  const handleApprove = (id: string) => {
    setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'final' } : b)))
  }

  const handleAddComment = (briefId: string, comment: Comment) => {
    setBriefs((prev) =>
      prev.map((b) =>
        b.id === briefId
          ? { ...b, comments: [...(b.comments ?? []), comment], commentCount: (b.commentCount ?? 0) + 1 }
          : b,
      ),
    )
  }

  const handleComposeSubmit = (newBrief: Brief) => {
    setBriefs((prev) => [newBrief, ...prev])
    // Simulate AI response after 2.5s
    window.setTimeout(() => {
      setBriefs((prev) => prev.map((b) => (b.id === newBrief.id ? simulateAiResponse(b) : b)))
    }, 2500)
  }

  const deptLabel = dept === 'all' ? 'Semua department' : DEPARTMENT_LABEL[dept]

  // Stats untuk tile angka huge
  const verdictsStats = useMemo(() => {
    if (!hero) return null
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 }
    for (const i of hero.csuiteInput) {
      if (i.verdict) counts[i.verdict.type] += 1
    }
    const total = counts.A + counts.B + counts.C
    if (total === 0) return null
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
    const [topType, topCount] = sorted[0]
    return { type: topType, count: topCount, total }
  }, [hero])

  return (
    <div className="min-h-screen pb-36">
      {/* Department color tint overlay — atmospheric mood shift per dept filter */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
        style={{
          opacity: dept === 'all' ? 0 : 1,
          background:
            dept !== 'all'
              ? `radial-gradient(circle at 75% 20%, hsl(var(--role-${dept}) / 0.38), transparent 50%), radial-gradient(circle at 20% 85%, hsl(var(--role-${dept}) / 0.28), transparent 55%)`
              : 'none',
        }}
      />
      <TopBar activeCount={activeBriefs.length} pendingCount={pendingCount} />

      {/* Department dropdown */}
      <div className="px-4 pt-2 pb-1 relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          className={cn(
            'inline-flex items-center gap-2 min-h-touch px-3.5 py-2 rounded-full',
            'glass-strong text-sm font-medium text-text-primary shadow-glass',
            'hover:bg-white/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
        >
          {dept !== 'all' && (
            <span aria-hidden="true" className={cn('size-2 rounded-full', roleDot[dept])} />
          )}
          {deptLabel}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 text-text-muted transition-transform', dropdownOpen && 'rotate-180')}
          />
        </button>

        {dropdownOpen && (
          <>
            <div aria-hidden="true" className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div
              role="listbox"
              className="absolute left-4 right-4 top-[calc(100%-4px)] z-40 mt-1 rounded-[14px] glass-strong shadow-glass-hero py-1"
            >
              {[
                { value: 'all' as DeptValue, label: 'Semua department' },
                ...DEPARTMENT_ORDER.map((r) => ({ value: r as DeptValue, label: DEPARTMENT_LABEL[r] })),
              ].map((opt) => {
                const isActive = opt.value === dept
                return (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setDept(opt.value)
                      setDropdownOpen(false)
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-left text-sm',
                      'hover:bg-white/40',
                      isActive ? 'text-text-primary font-medium bg-white/30' : 'text-text-secondary',
                    )}
                  >
                    {opt.value !== 'all' && (
                      <span aria-hidden="true" className={cn('size-2 rounded-full', roleDot[opt.value as Role])} />
                    )}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <FilterChips active={status} onChange={setStatus} counts={statusCounts} />

      <main className="px-3" aria-label="Daftar brief">
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Daily Digest pinned top */}
            {dailyDigest && (
              <motion.div
                key={dailyDigest.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="col-span-2"
              >
                <DailyDigestCard brief={dailyDigest} onClick={() => navigate(`/brief/${dailyDigest.id}`)} />
              </motion.div>
            )}

            {/* Hero brief */}
            {hero && (
              <motion.div
                key={hero.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="col-span-2"
              >
                <BriefTile brief={hero} size="hero" onClick={() => navigate(`/brief/${hero.id}`)} />
              </motion.div>
            )}

            {/* Stats row — 2x 1x1 tiles */}
            {hero && verdictsStats && (
              <>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
                >
                  <StatsTile
                    label="Verdict"
                    value={verdictsStats.count}
                    unit={`/ ${verdictsStats.total}`}
                    caption={`setuju ${verdictsStats.type}`}
                    tone="positive"
                  />
                </motion.div>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.12, ease: [0.32, 0.72, 0, 1] }}
                >
                  <StatsTile
                    label="Menunggu"
                    value={pendingCount}
                    unit="brief"
                    caption="keputusan Anda"
                    tone={pendingCount > 0 ? 'urgent' : 'default'}
                  />
                </motion.div>
              </>
            )}

            {/* Rest of briefs */}
            <AnimatePresence mode="popLayout" initial={true}>
              {rest.map((b, idx) => {
                const tileSize = getTileSize(b)
                return (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(idx * 0.04, 0.24),
                      ease: [0.32, 0.72, 0, 1],
                    }}
                    className={tileSize === 'priority' ? 'col-span-2' : 'col-span-1'}
                  >
                    <BriefTile brief={b} size={tileSize} onClick={() => navigate(`/brief/${b.id}`)} />
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Dark CTA tile — Approve action shortcut for top decision */}
            {hero && hero.status === 'decision' && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="col-span-2"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/brief/${hero.id}`)}
                  className={cn(
                    'group w-full rounded-[18px] bg-[#1F1A14] text-white p-4 text-left',
                    'shadow-glass-hero',
                    'flex items-center justify-between gap-3',
                    'hover:bg-text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  )}
                >
                  <div>
                    <p className="text-label-caps text-white/60">Atmaja menunggu</p>
                    <p className="mt-1 text-[15px] font-medium">Setujui rekomendasi Lokasi B</p>
                  </div>
                  <span className="inline-flex items-center justify-center size-11 rounded-full bg-accent text-white shadow-glow-accent">
                    <ArrowUpRight className="size-5" />
                  </span>
                </button>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Compose FAB — primary action */}
      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        aria-label="Brief baru"
        className={cn(
          'fixed right-4 bottom-24 z-nav mb-safe-bottom',
          'inline-flex items-center gap-2 pl-4 pr-5 h-14 rounded-full',
          'bg-accent text-white shadow-[0_12px_32px_-8px_rgba(184,149,107,0.5),0_4px_12px_-2px_rgba(184,149,107,0.4)]',
          'hover:bg-accent-dark active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'transition-all duration-fast',
        )}
      >
        <Plus className="size-5" />
        <span className="text-sm font-semibold">Brief baru</span>
      </button>

      <BriefDetailSheet
        brief={openBrief}
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o) navigate('/')
        }}
        onApprove={handleApprove}
        onAddComment={handleAddComment}
      />

      <ComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSubmit={handleComposeSubmit}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="size-14 rounded-full glass-soft flex items-center justify-center mb-4 shadow-glass">
        <InboxIcon aria-hidden="true" className="size-6 text-text-muted" />
      </div>
      <p className="text-card-title-lg text-text-primary">Tidak ada brief di sini</p>
      <p className="mt-1.5 text-sm text-text-muted max-w-[260px] leading-relaxed">
        Coba pilih department atau status lain. Brief baru akan masuk otomatis saat tim selesai
        memprosesnya.
      </p>
    </div>
  )
}

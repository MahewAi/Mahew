import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Inbox as InboxIcon } from 'lucide-react'
import { TopBar } from '@/components/nav/TopBar'
import { FilterChips, type FilterValue } from '@/components/nav/FilterChips'
import { FAB } from '@/components/nav/FAB'
import { BriefCard } from '@/components/brief/BriefCard'
import { BriefCardHero } from '@/components/brief/BriefCardHero'
import { BriefDetailSheet } from '@/components/brief/BriefDetailSheet'
import { mockBriefs } from '@/data/mockBriefs'
import {
  DEPARTMENT_ORDER,
  DEPARTMENT_LABEL,
  getBriefDepartments,
  pickHeroBrief,
  type Brief,
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

export default function Inbox() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [briefs, setBriefs] = useState<Brief[]>(mockBriefs)
  const [dept, setDept] = useState<DeptValue>('all')
  const [status, setStatus] = useState<FilterValue>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const visible = useMemo(() => {
    let list = briefs
    if (dept !== 'all') list = list.filter((b) => getBriefDepartments(b.contributors).includes(dept))
    if (status !== 'all') list = list.filter((b) => b.status === status)
    return list
  }, [briefs, dept, status])

  const hero = useMemo(() => pickHeroBrief(visible), [visible])
  const rest = useMemo(() => (hero ? visible.filter((b) => b.id !== hero.id) : visible), [visible, hero])

  const statusCounts = useMemo<Record<FilterValue, number>>(() => {
    const base: Record<FilterValue, number> = { all: 0, decision: 0, doing: 0, review: 0, final: 0 }
    const scope = dept === 'all' ? briefs : briefs.filter((b) => getBriefDepartments(b.contributors).includes(dept))
    base.all = scope.length
    for (const b of scope) base[b.status] += 1
    return base
  }, [briefs, dept])

  const activeBriefs = useMemo(() => briefs.filter((b) => b.status !== 'final'), [briefs])
  const pendingCount = useMemo(() => briefs.filter((b) => b.status === 'decision').length, [briefs])

  const openBrief = params.id ? briefs.find((b) => b.id === params.id) ?? null : null
  const sheetOpen = openBrief !== null

  const handleApprove = (id: string) => {
    setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'final' } : b)))
  }

  const deptLabel = dept === 'all' ? 'Semua department' : DEPARTMENT_LABEL[dept]

  return (
    <div className="min-h-screen bg-bg-app pb-32">
      <TopBar activeCount={activeBriefs.length} pendingCount={pendingCount} />

      <div className="px-4 pb-2 relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          className={cn(
            'inline-flex items-center gap-2 min-h-touch px-3 py-2 rounded-md',
            'border border-border-med bg-bg-elevated text-sm font-medium text-text-primary',
            'hover:bg-bg-soft',
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
            <div
              aria-hidden="true"
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
            />
            <div
              role="listbox"
              className="absolute left-4 right-4 top-[calc(100%-4px)] z-20 mt-1 rounded-md bg-bg-elevated border border-border-med shadow-pop py-1"
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
                      'hover:bg-bg-soft',
                      isActive ? 'text-text-primary font-medium bg-accent-bg/40' : 'text-text-secondary',
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

      <main className="px-4 pt-3 space-y-3" aria-label="Daftar brief">
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {hero && (
              <motion.div
                key={hero.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              >
                <BriefCardHero brief={hero} onClick={() => navigate(`/brief/${hero.id}`)} />
              </motion.div>
            )}
            {rest.length > 0 && hero && (
              <p className="text-label-caps text-text-muted pt-2 pl-1">Brief lainnya</p>
            )}
            <AnimatePresence mode="popLayout" initial={true}>
              {rest.map((b, idx) => (
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
                >
                  <BriefCard brief={b} coverImage={b.coverImage} onClick={() => navigate(`/brief/${b.id}`)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}
      </main>

      <FAB />

      <BriefDetailSheet
        brief={openBrief}
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o) navigate('/')
        }}
        onApprove={handleApprove}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="size-14 rounded-full bg-bg-soft flex items-center justify-center mb-4">
        <InboxIcon aria-hidden="true" className="size-6 text-text-muted" />
      </div>
      <p className="text-card-title-lg text-text-primary">Tidak ada brief di sini</p>
      <p className="mt-1.5 text-sm text-text-muted max-w-[260px] leading-relaxed">
        Coba pilih department atau status lain. Brief baru akan masuk otomatis saat tim AI selesai
        memprosesnya.
      </p>
    </div>
  )
}

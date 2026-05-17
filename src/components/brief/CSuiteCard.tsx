import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { CONTRIBUTOR_META, getContributorColorRole, type CSuiteInput, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CSuiteCardProps {
  input: CSuiteInput
  defaultExpanded?: boolean
}

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

const verdictStyle: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-status-doing-bg text-status-doing',
  B: 'bg-status-final-bg text-status-final',
  C: 'bg-status-review-bg text-status-review',
}

export function CSuiteCard({ input, defaultExpanded = false }: CSuiteCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()

  const colorRole = getContributorColorRole(input.role)
  const meta = CONTRIBUTOR_META[input.role]
  const isSpecialist = meta.parent !== undefined
  const isCeo = input.role === 'ceo'
  const isCfo = colorRole === 'cfo'
  const isTwo = meta.initials.length > 1
  const parentName = meta.parent ? CONTRIBUTOR_META[meta.parent].name : null

  return (
    <div
      className={cn(
        'relative rounded-[14px] shadow-glass overflow-hidden',
        isCeo
          ? 'glass-strong shadow-glass-hero ring-1 ring-accent-light/60'
          : 'glass-soft',
      )}
    >
      {/* Role color accent stripe */}
      <span
        aria-hidden="true"
        className={cn('absolute left-0 top-0 bottom-0', roleBg[colorRole], isCeo ? 'w-1.5' : 'w-1')}
      />

      {/* CEO featured: corner kicker */}
      {isCeo && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-2.5 text-[9px] font-semibold tracking-[0.22em] uppercase text-accent-dark"
        >
          Sintesis CEO
        </span>
      )}

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full pr-4 py-3.5 flex items-center gap-3',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-md',
          isCeo ? 'pl-6 pt-7' : 'pl-5',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-full font-semibold shrink-0',
            roleBg[colorRole],
            isCfo ? 'text-text-primary' : 'text-white',
            isCeo ? 'size-11 text-base ring-2 ring-white/70 shadow-glow-accent' : 'size-8',
            !isCeo && isTwo ? 'text-[11px]' : !isCeo ? 'text-sm' : '',
          )}
        >
          {meta.initials}
        </span>

        <div className="flex-1 min-w-0 text-left">
          <p
            className={cn(
              'leading-tight truncate',
              isCeo
                ? 'text-[18px] font-serif font-medium text-text-primary'
                : isSpecialist
                  ? 'text-sm font-medium text-text-secondary'
                  : 'text-base font-medium text-text-primary',
            )}
            style={isCeo ? { fontFamily: '"Cormorant Garamond", Georgia, serif' } : undefined}
          >
            {input.name}
          </p>
          {isCeo && (
            <p className="text-meta italic text-accent-dark mt-0.5">
              {input.subtitle ?? 'Sintesis kepemimpinan'}
            </p>
          )}
          {!isCeo && isSpecialist && parentName && (
            <p className="text-meta text-text-muted truncate">di bawah {parentName}</p>
          )}
          {!isCeo && !isSpecialist && input.subtitle && (
            <p className="text-meta text-text-muted truncate">{input.subtitle}</p>
          )}
        </div>

        {input.verdict && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase shrink-0',
              verdictStyle[input.verdict.type],
            )}
          >
            {input.verdict.text}
          </span>
        )}

        <motion.span
          aria-hidden="true"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 text-text-muted"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <ul
              className={cn(
                'pr-4 pb-4 space-y-2 text-sm leading-relaxed text-text-secondary',
                isCeo ? 'pl-6' : 'pl-5',
              )}
            >
              {input.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent-dark shrink-0 select-none">
                    •
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

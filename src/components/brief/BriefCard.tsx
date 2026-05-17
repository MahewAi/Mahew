import { motion } from 'framer-motion'
import { MessageCircle, Clock, Sparkles } from 'lucide-react'
import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AvatarGroup } from './AvatarGroup'
import { getStatusLabel } from './StatusPill'

interface BriefCardProps {
  brief: Brief
  onClick: () => void
  coverImage?: string
}

const statusBar: Record<Brief['status'], string> = {
  decision: 'bg-status-decision',
  doing: 'bg-status-doing',
  review: 'bg-status-review',
  final: 'bg-status-final',
}

const categoryBar: Record<string, string> = {
  Strategi: 'bg-accent',
  Pricing: 'bg-status-doing',
  Operasi: 'bg-role-coo',
  Marketing: 'bg-role-cmo',
  Branding: 'bg-role-cco',
}

function getCategoryBar(label: string): string {
  return categoryBar[label] ?? 'bg-text-muted'
}

/** Derive verdict split: "4 setuju · 1 berbeda" atau null kalau tidak ada verdict */
function getVerdictSummary(brief: Brief): string | null {
  const verdicts = brief.csuiteInput.map((i) => i.verdict?.type).filter((v): v is 'A' | 'B' | 'C' => !!v)
  if (verdicts.length < 2) return null
  const counts = verdicts.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
  const [topType, topCount] = sorted[0]
  const total = verdicts.length
  const diff = total - topCount
  if (diff === 0) return `${total} suara untuk ${topType}`
  return `${topCount} setuju ${topType} · ${diff} berbeda`
}

export function BriefCard({ brief, onClick, coverImage }: BriefCardProps) {
  const isHigh = brief.priority === 'high'
  const verdictSummary = isHigh ? getVerdictSummary(brief) : null

  const ariaLabel = [
    brief.title,
    `Status ${getStatusLabel(brief.status)}`,
    isHigh && 'Prioritas tinggi',
    `${brief.contributors.length} kontributor`,
    brief.commentCount ? `${brief.commentCount} komentar` : null,
    brief.timeAgo,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      aria-label={ariaLabel}
      className={cn(
        'group relative w-full text-left overflow-hidden',
        'rounded-lg shadow-card hover:shadow-pop',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        isHigh
          ? 'bg-gradient-to-br from-accent-bg/50 via-bg-elevated to-bg-elevated border border-accent-light'
          : 'bg-bg-elevated border border-border-soft',
      )}
    >
      {coverImage && (
        <div className="aspect-[3/1] w-full overflow-hidden bg-bg-soft">
          <img src={coverImage} alt="" className="size-full object-cover" />
        </div>
      )}

      <div className={cn(isHigh ? 'p-4' : 'p-3')}>
        <div className="flex items-center gap-1 mb-2.5" aria-hidden="true">
          <span className={cn('h-1.5 w-8 rounded-pill', statusBar[brief.status])} />
          {brief.labels.map((label) => (
            <span key={label} className={cn('h-1.5 w-8 rounded-pill', getCategoryBar(label))} />
          ))}
          {isHigh && (
            <span className="ml-auto inline-flex items-center gap-1 text-label-caps text-accent-dark">
              <Sparkles aria-hidden="true" className="size-3" />
              Prioritas
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cn(isHigh ? 'text-card-title-lg' : 'text-card-title', 'text-text-primary')}>
              {brief.title}
            </h3>
            <p
              className={cn(
                'mt-1 text-text-secondary leading-snug',
                isHigh ? 'text-sm line-clamp-3' : 'text-sm line-clamp-2',
              )}
            >
              {brief.description}
            </p>
          </div>
          <div className="shrink-0">
            <AvatarGroup contributors={brief.contributors} max={3} size={isHigh ? 'md' : 'sm'} />
          </div>
        </div>

        {verdictSummary && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-bg-elevated/70 border border-accent-light px-2.5 py-1.5">
            <span className="text-label-caps text-accent-dark">Verdict</span>
            <span className="text-meta text-text-primary">{verdictSummary}</span>
          </div>
        )}

        <div className={cn('flex items-center gap-3 text-meta text-text-muted', isHigh ? 'mt-3' : 'mt-2.5')}>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-3.5" />
            {brief.timeAgo}
          </span>
          {brief.commentCount ? (
            <span className="inline-flex items-center gap-1">
              <MessageCircle aria-hidden="true" className="size-3.5" />
              {brief.commentCount}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1.5 text-text-secondary">
            <span className={cn('size-1.5 rounded-full', statusBar[brief.status])} aria-hidden="true" />
            <span className="text-meta">{getStatusLabel(brief.status)}</span>
          </span>
        </div>
      </div>
    </motion.button>
  )
}

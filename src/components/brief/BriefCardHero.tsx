import { motion } from 'framer-motion'
import { ArrowUpRight, MessageCircle, Clock, Sparkles } from 'lucide-react'
import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AvatarGroup } from './AvatarGroup'
import { GeneratedCover } from './GeneratedCover'
import { VoteChart, hasVotes } from './VoteChart'
import { getStatusLabel } from './StatusPill'

interface BriefCardHeroProps {
  brief: Brief
  onClick: () => void
}

const statusDot: Record<Brief['status'], string> = {
  decision: 'bg-status-decision',
  doing: 'bg-status-doing',
  review: 'bg-status-review',
  final: 'bg-status-final',
}

export function BriefCardHero({ brief, onClick }: BriefCardHeroProps) {
  const ariaLabel = `${brief.title}. Status ${getStatusLabel(brief.status)}. ${
    brief.contributors.length
  } kontributor. ${brief.timeAgo}.`

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      aria-label={ariaLabel}
      className={cn(
        'group relative w-full text-left overflow-hidden',
        'rounded-xl bg-bg-elevated shadow-card hover:shadow-pop',
        'border border-border-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
    >
      <GeneratedCover brief={brief} className="aspect-[16/9]" />

      <div className="p-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          {brief.priority === 'high' && (
            <span className="inline-flex items-center gap-1 text-label-caps text-accent-dark">
              <Sparkles aria-hidden="true" className="size-3" />
              Prioritas
            </span>
          )}
          <span aria-hidden="true" className="text-text-faint">·</span>
          <span className="inline-flex items-center gap-1.5 text-label-caps text-text-muted">
            <span className={cn('size-1.5 rounded-full', statusDot[brief.status])} />
            {getStatusLabel(brief.status)}
          </span>
        </div>

        <h2 className="text-[28px] leading-[32px] font-bold tracking-[-0.024em] text-text-primary">
          {brief.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-2">
          {brief.description}
        </p>

        {hasVotes(brief) && (
          <div className="mt-4 rounded-md bg-bg-soft p-3">
            <p className="text-label-caps text-text-muted mb-2">Suara C-suite</p>
            <VoteChart brief={brief} size="md" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarGroup contributors={brief.contributors} max={4} size="md" />
            <div className="flex items-center gap-3 text-meta text-text-muted">
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
            </div>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center size-9 rounded-full bg-accent text-white shadow-soft group-hover:bg-accent-dark transition-colors duration-fast"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </motion.button>
  )
}

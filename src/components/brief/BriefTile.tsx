import { motion } from 'framer-motion'
import { ArrowUpRight, MessageCircle, Clock, Sparkles } from 'lucide-react'
import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AvatarGroup } from './AvatarGroup'
import { GeneratedCover } from './GeneratedCover'
import { VoteChart, hasVotes } from './VoteChart'
import { getStatusLabel } from './StatusPill'

export type BriefTileSize = 'hero' | 'priority' | 'compact'

interface BriefTileProps {
  brief: Brief
  onClick: () => void
  size?: BriefTileSize
}

const statusColor: Record<Brief['status'], { dot: string; text: string; glow: string }> = {
  decision: {
    dot: 'bg-status-decision',
    text: 'text-status-decision',
    glow: 'shadow-[0_0_10px_rgba(194,85,65,0.5)]',
  },
  doing: {
    dot: 'bg-status-doing',
    text: 'text-status-doing',
    glow: 'shadow-[0_0_10px_rgba(63,95,140,0.5)]',
  },
  review: {
    dot: 'bg-status-review',
    text: 'text-status-review',
    glow: 'shadow-[0_0_10px_rgba(133,84,122,0.5)]',
  },
  final: {
    dot: 'bg-status-final',
    text: 'text-status-final',
    glow: 'shadow-[0_0_10px_rgba(61,111,88,0.5)]',
  },
}

const sizeClassMap: Record<BriefTileSize, string> = {
  hero: 'col-span-2 row-span-1',
  priority: 'col-span-2 row-span-1',
  compact: 'col-span-1 row-span-1',
}

export function BriefTile({ brief, onClick, size = 'compact' }: BriefTileProps) {
  if (size === 'hero') return <HeroTile brief={brief} onClick={onClick} />
  if (size === 'priority') return <PriorityTile brief={brief} onClick={onClick} />
  return <CompactTile brief={brief} onClick={onClick} />
}

function HeroTile({ brief, onClick }: { brief: Brief; onClick: () => void }) {
  const colors = statusColor[brief.status]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`${brief.title}. ${getStatusLabel(brief.status)}.`}
      className={cn(
        sizeClassMap.hero,
        'group relative text-left overflow-hidden',
        'glass-strong rounded-[22px] shadow-glass-hero',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
    >
      <GeneratedCover brief={brief} className="aspect-[16/9]" />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2.5">
          {brief.priority === 'high' && (
            <span className="inline-flex items-center gap-1 text-label-caps text-accent-dark">
              <Sparkles aria-hidden="true" className="size-3" />
              Prioritas
            </span>
          )}
          {brief.priority === 'high' && (
            <span aria-hidden="true" className="text-text-faint">·</span>
          )}
          <span className="inline-flex items-center gap-1.5 text-label-caps">
            <span aria-hidden="true" className={cn('size-2 rounded-full', colors.dot, colors.glow)} />
            <span className={colors.text}>{getStatusLabel(brief.status)}</span>
          </span>
        </div>

        <h3 className="text-[24px] leading-[28px] font-bold tracking-[-0.022em] text-text-primary title-chroma">
          {brief.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-2">
          {brief.description}
        </p>

        {hasVotes(brief) && (
          <div className="mt-4 rounded-[14px] glass-soft p-3">
            <p className="text-label-caps text-text-muted mb-2">Suara C-suite</p>
            <VoteChart brief={brief} size="md" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarGroup contributors={brief.contributors} max={4} size="md" />
            <span className="inline-flex items-center gap-1 text-meta text-text-muted">
              <Clock aria-hidden="true" className="size-3.5" />
              {brief.timeAgo}
            </span>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center size-10 rounded-full bg-accent text-white shadow-glow-accent group-hover:bg-accent-dark transition-colors duration-fast"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </motion.button>
  )
}

function PriorityTile({ brief, onClick }: { brief: Brief; onClick: () => void }) {
  const colors = statusColor[brief.status]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`${brief.title}. ${getStatusLabel(brief.status)}.`}
      className={cn(
        sizeClassMap.priority,
        'group relative text-left overflow-hidden',
        'glass rounded-[18px] shadow-glass',
        'p-3.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {brief.priority === 'high' && (
              <>
                <Sparkles aria-hidden="true" className="size-3 text-accent-dark" />
                <span className="text-label-caps text-accent-dark">Prioritas</span>
                <span aria-hidden="true" className="text-text-faint">·</span>
              </>
            )}
            <span className={cn('text-label-caps inline-flex items-center gap-1', colors.text)}>
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', colors.dot)} />
              {getStatusLabel(brief.status)}
            </span>
          </div>
          <h3 className="text-[15px] leading-[19px] font-semibold tracking-[-0.005em] text-text-primary">
            {brief.title}
          </h3>
          <p className="mt-1 text-meta text-text-muted">
            {brief.timeAgo}
            {brief.commentCount ? ` · ${brief.commentCount} komentar` : ''}
          </p>
        </div>
        <AvatarGroup contributors={brief.contributors} max={3} size="sm" />
      </div>
    </motion.button>
  )
}

function CompactTile({ brief, onClick }: { brief: Brief; onClick: () => void }) {
  const colors = statusColor[brief.status]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`${brief.title}. ${getStatusLabel(brief.status)}.`}
      className={cn(
        sizeClassMap.compact,
        'group relative text-left overflow-hidden',
        'glass-soft rounded-[16px] shadow-glass',
        'p-3 min-h-[120px] flex flex-col',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', colors.dot)} />
        <span className={cn('text-label-caps', colors.text)}>{getStatusLabel(brief.status)}</span>
      </div>
      <h3 className="text-[13px] leading-[16px] font-semibold text-text-primary line-clamp-3">
        {brief.title}
      </h3>
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="text-[10px] text-text-muted">{brief.timeAgo}</span>
        {brief.commentCount ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
            <MessageCircle aria-hidden="true" className="size-3" />
            {brief.commentCount}
          </span>
        ) : null}
      </div>
    </motion.button>
  )
}

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Brief, Verdict } from '@/lib/types'
import { cn } from '@/lib/utils'

interface VoteChartProps {
  brief: Brief
  size?: 'sm' | 'md' | 'lg'
  className?: string
  animate?: boolean
}

interface Vote {
  type: Verdict['type']
  count: number
  label: string
}

const verdictStyle: Record<Verdict['type'], { bar: string; text: string }> = {
  A: { bar: 'bg-status-doing', text: 'text-status-doing' },
  B: { bar: 'bg-status-final', text: 'text-status-final' },
  C: { bar: 'bg-status-review', text: 'text-status-review' },
}

const sizeMap = {
  sm: { gap: 'gap-1', barH: 'h-1.5', label: 'text-[10px]', count: 'text-xs' },
  md: { gap: 'gap-1.5', barH: 'h-2', label: 'text-xs', count: 'text-sm' },
  lg: { gap: 'gap-2', barH: 'h-2.5', label: 'text-sm', count: 'text-base' },
} as const

function getVotes(brief: Brief): Vote[] {
  const counts: Record<Verdict['type'], number> = { A: 0, B: 0, C: 0 }
  for (const input of brief.csuiteInput) {
    if (input.verdict) counts[input.verdict.type] += 1
  }
  const order: Verdict['type'][] = ['B', 'A', 'C']
  return order
    .filter((t) => counts[t] > 0)
    .map((t) => ({ type: t, count: counts[t], label: getVerdictLabel(brief, t) }))
    .sort((a, b) => b.count - a.count)
}

function getVerdictLabel(brief: Brief, type: Verdict['type']): string {
  for (const input of brief.csuiteInput) {
    if (input.verdict?.type === type) return input.verdict.text
  }
  return type
}

export function VoteChart({ brief, size = 'md', className, animate = true }: VoteChartProps) {
  const votes = getVotes(brief)
  const reduceMotion = useReducedMotion()
  const cfg = sizeMap[size]
  const [mounted, setMounted] = useState(!animate || reduceMotion)

  useEffect(() => {
    if (!mounted) {
      const id = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(id)
    }
  }, [mounted])

  if (votes.length === 0) return null

  const maxCount = Math.max(...votes.map((v) => v.count))

  return (
    <div className={cn('flex flex-col', cfg.gap, className)} role="group" aria-label="Hasil suara C-suite">
      {votes.map((v) => {
        const widthPct = (v.count / maxCount) * 100
        return (
          <div key={v.type} className="flex items-center gap-2">
            <span className={cn('font-semibold tabular-nums shrink-0', cfg.label, verdictStyle[v.type].text)}>
              {v.type}
            </span>
            <div className="flex-1 h-full relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: mounted ? `${widthPct}%` : 0 }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className={cn('rounded-pill', cfg.barH, verdictStyle[v.type].bar)}
              />
            </div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: mounted ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className={cn('font-semibold tabular-nums shrink-0 text-text-primary', cfg.count)}
            >
              {v.count}
            </motion.span>
          </div>
        )
      })}
    </div>
  )
}

export function hasVotes(brief: Brief): boolean {
  return brief.csuiteInput.some((i) => i.verdict)
}

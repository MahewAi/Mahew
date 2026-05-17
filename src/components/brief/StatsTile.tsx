import { cn } from '@/lib/utils'

interface StatsTileProps {
  label: string
  value: string | number
  unit?: string
  caption?: string
  tone?: 'default' | 'urgent' | 'positive'
  className?: string
}

const toneStyle = {
  default: 'text-text-primary',
  urgent: 'text-status-decision',
  positive: 'text-status-final',
} as const

export function StatsTile({ label, value, unit, caption, tone = 'default', className }: StatsTileProps) {
  return (
    <div
      className={cn(
        'col-span-1 row-span-1 glass-soft rounded-[16px] shadow-glass p-3.5 flex flex-col min-h-[120px]',
        className,
      )}
    >
      <p className="text-label-caps text-text-muted mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-[32px] leading-[32px] font-bold tabular-nums tracking-tight', toneStyle[tone])}>
          {value}
        </span>
        {unit && <span className="text-[13px] font-medium text-text-muted">{unit}</span>}
      </div>
      {caption && <p className="mt-auto pt-1 text-[11px] text-text-secondary font-medium">{caption}</p>}
    </div>
  )
}

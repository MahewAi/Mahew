import type { Status } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FilterValue = 'all' | Status

interface TopTabsProps {
  active: FilterValue
  onChange: (value: FilterValue) => void
  counts: Record<FilterValue, number>
}

const tabs: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'decision', label: 'Keputusan' },
  { value: 'doing', label: 'Berjalan' },
  { value: 'review', label: 'Tinjau' },
  { value: 'final', label: 'Final' },
]

export function FilterChips({ active, onChange, counts }: TopTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter status brief"
      className="flex gap-1.5 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {tabs.map((t) => {
        const isActive = t.value === active
        const count = counts[t.value]
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(t.value)}
            style={{ scrollSnapAlign: 'start' }}
            className={cn(
              'min-h-touch px-3.5 py-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0',
              'text-sm font-medium rounded-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              'transition-all duration-fast',
              isActive
                ? 'glass-strong text-text-primary shadow-glass'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/30',
            )}
          >
            {t.label}
            {count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                  isActive ? 'bg-accent text-white' : 'bg-white/40 text-text-muted',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

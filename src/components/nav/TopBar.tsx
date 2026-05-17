import { Bell } from 'lucide-react'
import { Monogram } from '@/components/shared/Monogram'
import { cn } from '@/lib/utils'

interface TopBarProps {
  activeCount: number
  pendingCount: number
  onNotifClick?: () => void
}

export function TopBar({ activeCount, pendingCount, onNotifClick }: TopBarProps) {
  return (
    <header className="px-4 pt-safe-top pt-5 pb-3 bg-bg-app">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Monogram size="sm" ariaLabel="Gerai 1000 Pintu" />
          <p className="text-label-caps text-text-muted">Gerai 1000 Pintu</p>
        </div>

        <button
          type="button"
          onClick={onNotifClick}
          aria-label={`Notifikasi${pendingCount > 0 ? `, ${pendingCount} brief menunggu` : ''}`}
          className={cn(
            'relative inline-flex items-center justify-center min-h-touch min-w-touch rounded-pill',
            'text-text-secondary hover:text-text-primary hover:bg-bg-soft',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
        >
          <Bell aria-hidden="true" className="size-5" />
          {pendingCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-2 rounded-full bg-status-decision ring-2 ring-bg-app"
            />
          )}
        </button>
      </div>

      <h1 className="mt-5 text-display text-text-primary">AI Department</h1>

      <div className="mt-3 flex items-center gap-3 text-meta text-text-muted">
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-status-decision animate-pulse" />
            {activeCount} brief aktif
          </span>
        )}
        <span aria-hidden="true" className="text-text-faint">·</span>
        <span>{pendingCount} menunggu keputusan</span>
      </div>
    </header>
  )
}

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  activeCount: number
  pendingCount: number
  onNotifClick?: () => void
}

export function TopBar({ activeCount, pendingCount, onNotifClick }: TopBarProps) {
  const hasUrgent = pendingCount > 0

  return (
    <header className="glass-soft sticky top-0 z-20 px-4 pt-safe-top pt-6 pb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center size-8 rounded-[10px] bg-gradient-to-br from-accent to-accent-dark text-white font-serif font-semibold text-base shadow-glow-accent">
            G
          </span>
          <p className="text-label-caps text-text-primary">Gerai 1000 Pintu</p>
        </div>

        <button
          type="button"
          onClick={onNotifClick}
          aria-label={`Notifikasi${pendingCount > 0 ? `, ${pendingCount} brief menunggu` : ''}`}
          className={cn(
            'relative inline-flex items-center justify-center min-h-touch min-w-touch rounded-full',
            'glass-soft text-text-primary hover:bg-white/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            'transition-colors duration-fast',
          )}
          style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }}
        >
          <Bell aria-hidden="true" className="size-5" />
          {pendingCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 size-2 rounded-full bg-status-decision shadow-[0_0_8px_rgba(194,85,65,0.6)]"
            />
          )}
        </button>
      </div>

      <h1 className="text-display text-text-primary title-chroma">AI Department</h1>

      <div className="mt-2 flex items-center gap-3 text-meta text-text-secondary">
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                hasUrgent
                  ? 'bg-status-decision animate-pulse shadow-[0_0_8px_rgba(194,85,65,0.5)]'
                  : 'bg-text-muted',
              )}
            />
            {activeCount} brief aktif
          </span>
        )}
        <span aria-hidden="true" className="text-text-faint">·</span>
        <span>{pendingCount} menunggu keputusan</span>
      </div>
    </header>
  )
}

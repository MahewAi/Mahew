import { Bell } from 'lucide-react'
import { Monogram } from '@/components/shared/Monogram'
import { cn } from '@/lib/utils'

interface TopBarProps {
  activeCount: number
  pendingCount: number
  onNotifClick?: () => void
}

export function TopBar({ activeCount, pendingCount, onNotifClick }: TopBarProps) {
  const hasUrgent = pendingCount > 0

  return (
    <header className="relative overflow-hidden bg-bg-app">
      {/* Atmospheric gradient mesh — soft brass radial in top-right */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 size-80 rounded-full opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, hsl(var(--accent) / 0.22), hsl(var(--accent) / 0.06) 45%, transparent 70%)',
        }}
      />

      {/* Soft warm sunken wash at bottom edge */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, transparent, hsl(var(--accent-bg) / 0.5))',
        }}
      />

      {/* Paper grain texture — extremely subtle (SVG fractal noise) */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-[0.04] mix-blend-multiply pointer-events-none"
      >
        <filter id="topbar-grain">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#topbar-grain)" />
      </svg>

      <div className="relative px-4 pt-safe-top pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Monogram size="sm" ariaLabel="Gerai 1000 Pintu" />
              {/* Subtle halo around monogram */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-md pointer-events-none"
                style={{
                  boxShadow: '0 0 24px 4px hsl(var(--accent) / 0.25)',
                }}
              />
            </div>
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
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 rounded-full',
                  hasUrgent ? 'bg-status-decision animate-pulse' : 'bg-text-muted',
                )}
              />
              {activeCount} brief aktif
            </span>
          )}
          <span aria-hidden="true" className="text-text-faint">·</span>
          <span>{pendingCount} menunggu keputusan</span>
        </div>
      </div>

      {/* Dynamic accent strip below TopBar — shifts color if urgent decisions */}
      <div
        aria-hidden="true"
        className={cn(
          'relative h-px transition-colors duration-base',
          hasUrgent ? 'bg-status-decision/40' : 'bg-border-soft',
        )}
      />
    </header>
  )
}

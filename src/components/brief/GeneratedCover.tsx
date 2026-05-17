import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GeneratedCoverProps {
  brief: Brief
  className?: string
}

/**
 * Atmospheric brass cover untuk brief tanpa coverImage explicit.
 * Variasi gradient + grid orientasi berdasarkan brief.id hash supaya
 * tiap brief terasa berbeda tanpa random per-render.
 */
export function GeneratedCover({ brief, className }: GeneratedCoverProps) {
  if (brief.coverImage) {
    return (
      <div className={cn('relative w-full overflow-hidden bg-bg-soft', className)}>
        <img src={brief.coverImage} alt="" className="size-full object-cover" />
      </div>
    )
  }

  const seed = hashId(brief.id)
  const variant = seed % 3
  const monogramOpacity = 0.08 + (seed % 5) * 0.01

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        variant === 0 && 'bg-gradient-to-br from-accent-light via-accent to-accent-dark',
        variant === 1 && 'bg-gradient-to-tr from-accent-dark via-accent to-accent-light',
        variant === 2 && 'bg-gradient-to-b from-accent to-accent-dark',
        className,
      )}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 size-full mix-blend-overlay"
        viewBox="0 0 600 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id={`noise-${brief.id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#noise-${brief.id})`} opacity="0.6" />
      </svg>

      <svg
        className="absolute right-[-10%] bottom-[-20%]"
        width="60%"
        viewBox="0 0 200 200"
        style={{ opacity: monogramOpacity }}
        aria-hidden="true"
      >
        <text
          x="100"
          y="155"
          textAnchor="middle"
          fontFamily="Georgia, 'Cormorant Garamond', serif"
          fontSize="220"
          fontWeight="600"
          fill="white"
        >
          G
        </text>
      </svg>

      <div className="absolute inset-x-4 top-3 flex items-center justify-between text-white">
        <span className="text-label-caps drop-shadow-sm">{brief.labels[0] ?? 'Brief'}</span>
        <span className="text-label-caps drop-shadow-sm">{brief.id.slice(-8).toUpperCase()}</span>
      </div>
    </div>
  )
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

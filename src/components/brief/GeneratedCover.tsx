import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GeneratedCoverProps {
  brief: Brief
  className?: string
}

type Pattern = 'mesh' | 'horizon' | 'beam' | 'dots' | 'spiral'

/**
 * Atmospheric brass cover untuk brief tanpa coverImage explicit.
 * 5 pattern distinct (mesh/horizon/beam/dots/spiral) berdasarkan brief.id hash
 * supaya tiap brief punya tampilan berbeda tanpa random per-render.
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
  const patterns: Pattern[] = ['mesh', 'horizon', 'beam', 'dots', 'spiral']
  const pattern: Pattern = patterns[seed % patterns.length]

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-gradient-to-br from-accent-light via-accent to-accent-dark',
        className,
      )}
      aria-hidden="true"
    >
      <PatternLayer pattern={pattern} seed={seed} />
      <NoiseLayer seed={seed} />
      <WatermarkLayer seed={seed} />

      <div className="absolute inset-x-4 top-3 flex items-center justify-between text-white drop-shadow-sm">
        <span className="text-label-caps">{brief.labels[0] ?? 'Brief'}</span>
        <span className="text-label-caps">{brief.id.slice(-8).toUpperCase()}</span>
      </div>
    </div>
  )
}

function PatternLayer({ pattern, seed }: { pattern: Pattern; seed: number }) {
  switch (pattern) {
    case 'mesh':
      return (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35), transparent 50%), radial-gradient(circle at 80% 70%, rgba(31,26,20,0.25), transparent 50%)',
          }}
        />
      )
    case 'horizon':
      return (
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-[60%] left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-[68%] left-0 right-0 h-px bg-white/15" />
          <div className="absolute top-[74%] left-0 right-0 h-px bg-white/10" />
        </div>
      )
    case 'beam':
      return (
        <svg className="absolute inset-0 size-full" viewBox="0 0 600 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`beam-${seed}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <path d="M0,200 L300,0 L600,200 Z" fill={`url(#beam-${seed})`} />
        </svg>
      )
    case 'dots':
      return (
        <svg className="absolute inset-0 size-full" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id={`dots-${seed}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.25)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dots-${seed})`} />
        </svg>
      )
    case 'spiral':
      return (
        <svg className="absolute inset-0 size-full" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id={`spiral-${seed}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <ellipse cx="300" cy="100" rx="280" ry="80" fill={`url(#spiral-${seed})`} />
          <ellipse cx="300" cy="100" rx="200" ry="50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <ellipse cx="300" cy="100" rx="120" ry="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </svg>
      )
  }
}

function NoiseLayer({ seed }: { seed: number }) {
  return (
    <svg className="absolute inset-0 size-full mix-blend-overlay opacity-50">
      <filter id={`noise-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#noise-${seed})`} />
    </svg>
  )
}

function WatermarkLayer({ seed }: { seed: number }) {
  const opacity = 0.08 + (seed % 5) * 0.012
  const position = seed % 3
  const positionClass = position === 0 ? 'right-[-10%] bottom-[-20%]' : position === 1 ? 'left-[-5%] bottom-[-25%]' : 'right-[5%] top-[-30%]'

  return (
    <svg
      className={cn('absolute', positionClass)}
      width="60%"
      viewBox="0 0 200 200"
      style={{ opacity }}
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
  )
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

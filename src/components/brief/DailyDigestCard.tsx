import { motion } from 'framer-motion'
import { Sunrise, ArrowUpRight } from 'lucide-react'
import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DailyDigestCardProps {
  brief: Brief
  onClick: () => void
}

/** Daily Digest dari Atmaja — pinned at top of Inbox, distinct treatment. */
export function DailyDigestCard({ brief, onClick }: DailyDigestCardProps) {
  const ceoInput = brief.csuiteInput.find((i) => i.role === 'ceo')

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`${brief.title}. ${brief.description}`}
      className={cn(
        'group relative w-full text-left overflow-hidden col-span-2',
        'rounded-[22px] shadow-glass-hero',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
    >
      {/* Morning gradient — peach/dawn instead of brass */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, hsl(35 60% 90%) 0%, hsl(25 55% 82%) 35%, hsl(15 50% 75%) 70%, hsl(5 45% 68%) 100%)',
        }}
      />
      {/* Sun bloom */}
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-16 size-64 rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle at center, hsl(45 90% 75% / 0.55), transparent 65%)',
        }}
      />
      {/* Soft grain */}
      <svg aria-hidden="true" className="absolute inset-0 size-full opacity-[0.08] mix-blend-multiply">
        <filter id="digest-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#digest-grain)" />
      </svg>

      <div className="relative p-5">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-text-primary/85">
            <Sunrise aria-hidden="true" className="size-4" />
            <span className="text-label-caps">Laporan harian · Atmaja</span>
          </div>
          <span className="text-label-caps text-text-primary/60">{brief.timeAgo}</span>
        </div>

        {/* Title */}
        <h3 className="text-[26px] leading-[30px] font-bold tracking-[-0.022em] text-text-primary title-chroma">
          {brief.title.split('·')[0].trim()}
        </h3>
        <p className="mt-1 text-meta text-text-primary/70">
          {brief.title.split('·')[1]?.trim() ?? brief.timestamp}
        </p>

        {/* Description */}
        <p className="mt-3 text-sm leading-relaxed text-text-primary/85">
          {brief.description}
        </p>

        {/* CEO bullets preview */}
        {ceoInput && (
          <ul className="mt-4 space-y-1.5">
            {ceoInput.bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-[19px] text-text-primary/85">
                <span aria-hidden="true" className="text-accent-dark shrink-0 select-none mt-0.5">
                  •
                </span>
                <span className="line-clamp-1">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-label-caps text-text-primary/70">Buka laporan penuh</span>
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center size-10 rounded-full bg-text-primary text-white shadow-glass group-hover:bg-accent-dark transition-colors duration-fast"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </motion.button>
  )
}

/**
 * OpsFlow — Kerangka halaman.
 *
 * Header menempel di atas dan memadat saat digulir: judul mengecil, materialnya
 * jadi glass, dan garis bawahnya muncul. Gunanya bukan hiasan — di halaman yang
 * panjang, konteks "saya sedang di stage mana" harus tetap terbaca tanpa
 * menggulir kembali ke atas.
 *
 * Lencana sumber data juga dibawa sampai ke layar. Selama datanya masih
 * simulasi, itu harus terbaca jelas — dashboard yang tidak menyatakannya adalah
 * cara tercepat membuat orang mengambil keputusan atas angka karangan.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, FlaskConical, Radio } from 'lucide-react'
import type { SnapshotSource } from '@/opsflow/useOpsflowSnapshot'
import { DURATION, EASE, SPRING } from '@/components/opsflow/motion'
import { cn } from '@/lib/utils'

interface OpsflowShellProps {
  title: string
  subtitle?: string
  source?: SnapshotSource
  /** Baris filter — ikut menempel bersama header. */
  toolbar?: ReactNode
  /** Tautan kembali. Default ke ikhtisar OpsFlow. */
  backTo?: string
  backLabel?: string
  /** Titik warna sektor di sebelah judul. */
  accentColor?: string
  children: ReactNode
}

export function OpsflowShell({
  title,
  subtitle,
  source,
  toolbar,
  backTo = '/opsflow',
  backLabel = 'Ikhtisar',
  accentColor,
  children,
}: OpsflowShellProps) {
  const reduced = useReducedMotion()
  const [condensed, setCondensed] = useState(false)
  const isRoot = backTo === '/opsflow' && title === 'Alur Kerja Ekosistem'

  useEffect(() => {
    // Ambang 40px, bukan 0 — supaya header tidak berkedip saat guliran kecil.
    const onScroll = () => setCondensed(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="min-h-screen px-3 pb-32 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div
          className={cn(
            'sticky top-0 z-nav -mx-3 px-3 pt-safe-top transition-[background-color,box-shadow] duration-base md:-mx-6 md:px-6',
            condensed && 'glass-strong shadow-glass',
          )}
        >
          <header className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to={isRoot ? '/' : backTo}
                className={cn(
                  'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-bg-elevated px-3',
                  'text-[11px] font-bold text-text-secondary shadow-soft ring-1 ring-inset ring-border-med',
                  'transition-colors duration-fast hover:bg-bg-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                )}
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                {isRoot ? 'Dashboard' : backLabel}
              </Link>

              {source && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]',
                    'ring-1 ring-inset',
                    source === 'simulasi'
                      ? 'bg-status-decision-bg text-status-decision ring-status-decision/25'
                      : 'bg-status-final-bg text-status-final ring-status-final/25',
                  )}
                >
                  {source === 'simulasi' ? (
                    <FlaskConical aria-hidden="true" className="size-3" />
                  ) : (
                    <motion.span
                      aria-hidden="true"
                      className="inline-flex"
                      animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Radio className="size-3" />
                    </motion.span>
                  )}
                  {source === 'simulasi' ? 'Data simulasi' : 'Data live'}
                </span>
              )}
            </div>

            <motion.div
              // Judul memadat saat digulir. Yang dianimasikan hanya skala &
              // opasitas subjudul, jadi tidak memicu perhitungan ulang layout.
              animate={reduced ? undefined : { scale: condensed ? 0.86 : 1 }}
              transition={SPRING}
              className="origin-left"
            >
              <h1 className="mt-3 flex items-center gap-2.5 text-[26px] font-extrabold leading-[30px] tracking-[-0.02em] text-text-primary md:text-[34px] md:leading-[38px]">
                {accentColor && (
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
                {title}
              </h1>
            </motion.div>

            {subtitle && (
              <motion.p
                animate={reduced ? undefined : { opacity: condensed ? 0 : 1, height: condensed ? 0 : 'auto' }}
                transition={{ duration: DURATION.micro, ease: EASE.inOut }}
                className="mt-1.5 overflow-hidden text-[12px] leading-[17px] text-text-muted"
              >
                {subtitle}
              </motion.p>
            )}

            {toolbar && <div className="mt-3 pb-1">{toolbar}</div>}
          </header>
        </div>

        {/* Induk stagger ada di pembungkus konten tiap halaman (`pageContent`),
            bukan di sini — supaya crossfade saat ganti filter dan stagger kartu
            berada di satu komponen dan rantai varian tidak terputus. */}
        <div className="pt-1">{children}</div>
      </div>
    </main>
  )
}

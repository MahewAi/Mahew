/**
 * OpsFlow — Primitif UI dashboard.
 *
 * Semua warna data diambil dari `@/opsflow/viz` yang sudah tervalidasi. Aturan
 * yang dipegang di seluruh file ini:
 *  - Teks tidak pernah memakai warna data. Identitas dibawa oleh mark berwarna
 *    di SEBELAH teks (titik, swatch), bukan oleh teks yang diwarnai.
 *  - Warna status selalu berpasangan dengan ikon + label, tidak pernah sendiri.
 *  - Setiap nilai bisa dibaca tanpa tooltip — tooltip menambah, bukan menggantikan.
 */

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert, Table2, X } from 'lucide-react'
import { SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_WASH, type SeverityLevel } from '@/opsflow/viz'
import { AnimatedNumber } from './AnimatedNumber'
import { DURATION, EASE, SPRING, pressable } from './motion'
import { cn } from '@/lib/utils'

// ============================================================
// Lencana status — warna + ikon + teks, ketiganya sekaligus
// ============================================================

const SEVERITY_ICON: Record<SeverityLevel, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: CircleAlert,
  serious: AlertTriangle,
  critical: OctagonAlert,
}

interface SeverityBadgeProps {
  level: SeverityLevel
  /** Teks pengganti label bawaan. Tetap wajib ada teks — tidak boleh warna saja. */
  children?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function SeverityBadge({ level, children, size = 'sm', className }: SeverityBadgeProps) {
  const Icon = SEVERITY_ICON[level]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-bold whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
        className,
      )}
      style={{ backgroundColor: SEVERITY_WASH[level], color: SEVERITY_COLOR[level] }}
    >
      <Icon aria-hidden="true" className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {children ?? SEVERITY_LABEL[level]}
    </span>
  )
}

// ============================================================
// Kartu bagian
// ============================================================

interface SectionCardProps {
  title: string
  /** Satu baris yang menjelaskan cara membaca isinya. */
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Urutan kemunculan. Tidak memengaruhi tata letak, hanya jeda animasinya. */
  index?: number
}

export function SectionCard({ title, hint, action, children, className, index = 0 }: SectionCardProps) {
  return (
    <section
      // Kemunculan lewat CSS: keadaan statisnya terlihat, jadi kalau animasinya
      // tidak jalan kartunya tetap tampil. Lihat `.opsflow-enter` di globals.css.
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'opsflow-enter',
        // Material: permukaan putih di atas kanvas brass, dengan cincin hairline
        // dalam yang memberi tepi tanpa menambah berat garis.
        'relative overflow-hidden rounded-lg bg-bg-elevated px-4 py-4 md:px-5 md:py-5',
        'shadow-soft ring-1 ring-inset ring-border-soft',
        className,
      )}
    >
      {/* Sorotan sangat halus di tepi atas — memberi kesan permukaan terangkat. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
      />
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-text-secondary">{title}</h2>
          {hint && <p className="mt-1.5 max-w-prose text-[12px] leading-[17px] text-text-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  )
}

// ============================================================
// Kartu metrik (stat tile)
// ============================================================

interface MetricTileProps {
  label: string
  /** Nilai sudah diformat. Dipakai kalau angkanya tidak perlu berjalan naik. */
  value?: string
  /** Nilai mentah + formatter — dipakai supaya angkanya bisa berjalan naik. */
  animate?: { value: number; format: (v: number) => string }
  unit?: string
  caption?: string
  level?: SeverityLevel
  /** Sparkline. Warna netral — bukan warna data kategorikal. */
  spark?: number[]
  className?: string
  /** Urutan kemunculan. */
  index?: number
}

export function MetricTile({
  label,
  value,
  animate,
  unit,
  caption,
  level,
  spark,
  className,
  index = 0,
}: MetricTileProps) {
  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'opsflow-enter',
        'flex min-h-[112px] flex-col rounded-md bg-bg-elevated px-3.5 py-3',
        'shadow-soft ring-1 ring-inset ring-border-soft',
        className,
      )}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        {/* Angka besar pakai figur proporsional — tabular-nums hanya untuk kolom tabel. */}
        <span className="text-[30px] font-bold leading-[32px] tracking-[-0.02em] text-text-primary">
          {animate ? <AnimatedNumber value={animate.value} format={animate.format} /> : value}
        </span>
        {unit && <span className="text-[12px] font-semibold text-text-muted">{unit}</span>}
      </div>
      {spark && spark.length > 1 && <Sparkline points={spark} className="mt-2" />}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5">
        {level && <SeverityBadge level={level} />}
        {caption && <p className="text-[11px] leading-[15px] text-text-secondary">{caption}</p>}
      </div>
    </div>
  )
}

/** Sparkline 2px, hue de-emphasis. Tidak ada label per titik. */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const width = 96
  const height = 22
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = max - min || 1
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - ((p - min) / span) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-[22px] w-full', className)}
      role="img"
      aria-label={`Tren ${points.length} periode terakhir`}
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="#b6aa9a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ============================================================
// Angka utama (hero figure) — tepat satu per halaman
// ============================================================

interface HeroFigureProps {
  /** Nilai sudah diformat. */
  value?: string
  /** Nilai mentah + formatter, supaya angkanya berjalan naik saat halaman muncul. */
  animate?: { value: number; format: (v: number) => string }
  unit?: string
  label: string
  /** Satu paragraf yang menjelaskan kenapa angka ini yang dipilih jadi angka utama. */
  meaning?: string
  /** Ukuran angka. 'inline' untuk di dalam meter cincin. */
  size?: 'display' | 'inline'
}

export function HeroFigure({ value, animate, unit, label, meaning, size = 'display' }: HeroFigureProps) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <div className={cn('flex items-baseline gap-1.5', size === 'display' ? 'mt-1.5' : 'mt-0.5 justify-center')}>
        {/* >=48px, sans yang sama dengan seluruh app, figur proporsional. */}
        <span
          className={cn(
            'font-bold tracking-[-0.03em] text-text-primary',
            size === 'display' ? 'text-[56px] leading-[58px]' : 'text-[48px] leading-[50px]',
          )}
        >
          {animate ? <AnimatedNumber value={animate.value} format={animate.format} /> : value}
        </span>
        {unit && <span className="text-[18px] font-semibold text-text-secondary">{unit}</span>}
      </div>
      {meaning && <p className="mt-2.5 max-w-prose text-[13px] leading-[20px] text-text-secondary">{meaning}</p>}
    </div>
  )
}

// ============================================================
// Baris filter — satu baris di atas semua yang dicakupnya
// ============================================================

interface FilterRowProps {
  children: ReactNode
  className?: string
}

export function FilterRow({ children, className }: FilterRowProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

interface FilterChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** Titik warna di sebelah teks — identitas dibawa mark, bukan teks berwarna. */
  dotColor?: string
  /** Pengelompokan penanda aktif yang berpindah. Satu grup per baris filter. */
  groupId?: string
}

/**
 * Chip filter. Penanda aktifnya adalah satu elemen yang BERPINDAH antar chip
 * (`layoutId`), bukan warna yang menyala-mati di masing-masing chip — jadi
 * pilihannya terlihat bergerak dari yang lama ke yang baru, dan mata pengguna
 * ikut terbawa ke pilihan barunya.
 */
export function FilterChip({ active, onClick, children, dotColor, groupId = 'filter' }: FilterChipProps) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={reduced ? undefined : pressable.whileTap}
      transition={SPRING}
      className={cn(
        'relative inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-[12px] font-bold',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        active ? 'text-white' : 'text-text-secondary ring-1 ring-inset ring-border-med hover:bg-bg-surface',
      )}
    >
      {active && (
        <motion.span
          aria-hidden="true"
          layoutId={reduced ? undefined : `${groupId}-active`}
          className="absolute inset-0 rounded-pill bg-text-primary"
          transition={SPRING}
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">
        {dotColor && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />}
        {children}
      </span>
    </motion.button>
  )
}

// ============================================================
// Skeleton — bentuknya mengikuti tata letak akhir
// ============================================================

/**
 * Kerangka pemuatan yang ukurannya sama dengan konten akhirnya, sehingga tidak
 * ada lompatan tata letak saat data datang. Skeleton yang bentuknya berbeda dari
 * hasil akhirnya justru menambah kesan lambat.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="rounded-lg bg-bg-elevated px-4 py-5 shadow-soft ring-1 ring-inset ring-border-soft md:px-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="skeleton-line size-[200px] shrink-0 rounded-full" />
          <div className="w-full space-y-2">
            <div className="skeleton-line h-3 w-32 rounded" />
            <div className="skeleton-line h-5 w-full rounded" />
            <div className="skeleton-line h-5 w-4/5 rounded" />
            <div className="skeleton-line h-9 w-48 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-h-[112px] rounded-md bg-bg-elevated px-3.5 py-3 shadow-soft ring-1 ring-inset ring-border-soft"
          >
            <div className="skeleton-line h-2.5 w-20 rounded" />
            <div className="skeleton-line mt-3 h-7 w-16 rounded" />
            <div className="skeleton-line mt-4 h-2.5 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-bg-elevated px-4 py-5 shadow-soft ring-1 ring-inset ring-border-soft md:px-5">
        <div className="skeleton-line h-3 w-40 rounded" />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-line h-[132px] rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Legenda — selalu ada untuk 2 seri atau lebih
// ============================================================

export interface LegendItem {
  color: string
  label: string
  /** Nilai opsional yang ikut ditampilkan, supaya legenda juga membawa angka. */
  value?: string
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] font-semibold text-text-secondary">{item.label}</span>
          {item.value && <span className="text-[11px] tabular-nums text-text-muted">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}

// ============================================================
// Tooltip hover/fokus — menambah, tidak menggantikan
// ============================================================

interface HoverTipProps {
  /** Isi tooltip. */
  tip: ReactNode
  children: ReactNode
  className?: string
  /**
   * Gaya inline untuk pembungkusnya sendiri. Dibutuhkan saat pembungkus ini
   * menjadi anak flex langsung yang lebarnya persentase — kalau lebarnya ditaruh
   * di dalam pembungkus, persentasenya dihitung terhadap pembungkus yang
   * menyusut sendiri, dan seluruh batang menumpuk di satu sisi.
   */
  style?: CSSProperties
}

/**
 * Area singgungnya adalah seluruh elemen anak, jadi tidak ada target sekecil
 * titik. Fokus keyboard menampilkan hal yang sama dengan hover.
 */
export function HoverTip({ tip, children, className, style }: HoverTipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div
      className={cn('relative min-w-0', className)}
      style={style}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      role="group"
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.99, transition: { duration: DURATION.exit } }}
            transition={{ duration: DURATION.micro, ease: EASE.out }}
            className={cn(
              'pointer-events-none absolute bottom-full left-0 z-sheet mb-2 w-max max-w-[280px]',
              'rounded-md border border-border-med bg-bg-elevated px-2.5 py-2 shadow-pop',
            )}
          >
            {tip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// Table-view twin — setiap grafik punya padanan tabel
// ============================================================

interface TableViewProps {
  /** Judul tabel untuk pembaca layar. */
  caption: string
  headers: string[]
  rows: Array<Array<string | number>>
  /** Kolom yang isinya angka — dapat tabular-nums & rata kanan. */
  numericColumns?: number[]
}

/**
 * Tombol yang membuka padanan tabel dari sebuah grafik.
 *
 * Ini bukan pelengkap opsional: tiga warna sektor duduk di bawah 3:1 pada
 * sebagian permukaan, dan aturan keringanan kontras mewajibkan salah satu dari
 * label langsung atau tampilan tabel. Di sini keduanya ada.
 */
export function TableViewToggle({ caption, headers, rows, numericColumns = [] }: TableViewProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-med bg-bg-elevated px-2.5',
          'text-[11px] font-bold text-text-secondary transition-colors duration-fast hover:bg-bg-surface',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        )}
      >
        <Table2 aria-hidden="true" className="size-3.5" />
        Tabel
      </button>

      {open && (
        <div
          className="fixed inset-0 z-sheet flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={caption}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-t-lg bg-bg-elevated shadow-pop sm:rounded-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
              <h3 className="text-[13px] font-extrabold text-text-primary">{caption}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup tabel"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-text-muted hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>
            <div className="max-h-[calc(80vh-52px)] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-bg-surface">
                  <tr>
                    {headers.map((header, index) => (
                      <th
                        key={header}
                        scope="col"
                        className={cn(
                          'border-b border-border-med px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted',
                          numericColumns.includes(index) && 'text-right',
                        )}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="even:bg-bg-surface/60">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={cn(
                            'border-b border-border-soft px-3 py-2 text-[12px] text-text-secondary',
                            numericColumns.includes(cellIndex) && 'text-right tabular-nums',
                          )}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// Catatan kehati-hatian
// ============================================================

/** Peringatan pembacaan yang wajib tampil bersama angka individu. */
export function Caveats({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-1.5 text-[11px] leading-[15px] text-text-muted">
          <CircleAlert aria-hidden="true" className="mt-px size-3 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  )
}

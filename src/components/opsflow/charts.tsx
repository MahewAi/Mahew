/**
 * OpsFlow — Grafik.
 *
 * Ditulis dengan HTML/SVG biasa, bukan pustaka grafik, karena spesifikasi mark
 * yang dipakai di sini butuh kendali persis: batang maksimum 24px, ujung data
 * membulat 4px sementara sisi garis dasar tetap kotak, dan celah 2px berwarna
 * permukaan sebagai pemisah antar segmen — bukan garis tepi yang digambar di
 * sekeliling mark.
 *
 * Grid dan sumbu selalu hairline 1px solid, satu langkah dari permukaan, dan
 * tidak pernah putus-putus.
 *
 * Soal animasi: batang tumbuh dengan `scaleX`, bukan `width`. Menganimasikan
 * lebar memaksa browser menghitung ulang layout tiap frame — pada daftar 30-an
 * batang, itu terasa tersendat. Semua gerakan dimatikan kalau pengguna memasang
 * `prefers-reduced-motion`.
 */

import { useState, type CSSProperties, type ReactNode } from 'react'
import { CHART_CHROME, SEVERITY_COLOR, TIME_COLOR, type SeverityLevel } from '@/opsflow/viz'
import { HoverTip, Legend, type LegendItem } from './primitives'
import { cn } from '@/lib/utils'

// ============================================================
// Daftar batang horizontal
// ============================================================

export interface BarRow {
  key: string
  label: string
  sublabel?: string
  /** Nilai mentah untuk panjang batang. */
  value: number
  /** Label yang ditempel di ujung batang. */
  valueLabel: string
  color: string
  /** Lencana di sebelah label — untuk pemicu, status, dsb. */
  badge?: ReactNode
  tip?: ReactNode
  onClick?: () => void
}

interface BarListProps {
  rows: BarRow[]
  /** Nilai maksimum sebagai acuan skala. Default: nilai terbesar di rows. */
  max?: number
  /** Tampilkan nomor peringkat di kiri. */
  ranked?: boolean
  className?: string
}

/**
 * Kategori nominal (nama stage, nama sub-tim) — panjang batang yang membawa
 * besaran. Warna dipakai untuk keparahan, bukan untuk mengulang panjang batang.
 */
export function BarList({ rows, max, ranked = false, className }: BarListProps) {
  const scale = max ?? Math.max(...rows.map((r) => r.value), 1)

  return (
    <ul className={cn('-mx-1.5', className)}>
      {rows.map((row, index) => {
        const widthPct = Math.max(1.5, (row.value / scale) * 100)
        const content = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                {ranked && (
                  <span className="w-4 shrink-0 text-[11px] font-extrabold tabular-nums text-text-faint">
                    {index + 1}
                  </span>
                )}
                <div className="min-w-0">
                  <span className="text-[13px] font-bold leading-[18px] text-text-primary">{row.label}</span>
                  {row.sublabel && (
                    <span className="ml-1.5 text-[11px] leading-[18px] text-text-muted">{row.sublabel}</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-text-primary">
                {row.valueLabel}
              </span>
            </div>
            <div className={cn('flex items-center gap-2', ranked && 'pl-6')}>
              {/* Garis dasar tunggal di kiri; ujung data membulat 4px, sisi dasar kotak. */}
              <div
                className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[1px]"
                style={{ backgroundColor: CHART_CHROME.grid }}
              >
                <div
                  className="opsflow-bar h-2.5"
                  style={
                    {
                      width: `${widthPct}%`,
                      backgroundColor: row.color,
                      borderRadius: '0 4px 4px 0',
                      '--i': index,
                    } as CSSProperties
                  }
                />
              </div>
              {row.badge}
            </div>
          </>
        )

        const body = row.tip ? <HoverTip tip={row.tip}>{content}</HoverTip> : content

        return (
          <li key={row.key} className="opsflow-enter list-none" style={{ '--i': index } as CSSProperties}>
            {row.onClick ? (
              <button
                type="button"
                onClick={row.onClick}
                className={cn(
                  'group block w-full cursor-pointer rounded-md px-1.5 py-2 text-left',
                  'transition-colors duration-fast hover:bg-bg-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                )}
              >
                {body}
              </button>
            ) : (
              <div className="px-1.5 py-2">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ============================================================
// Batang bertumpuk
// ============================================================

export interface StackSegment {
  key: string
  label: string
  value: number
  color: string
}

interface StackedBarProps {
  segments: StackSegment[]
  /** Format nilai untuk tooltip & legenda. */
  format: (value: number) => string
  /** Tinggi batang. Maksimum 24px sesuai spesifikasi mark. */
  height?: number
  showLegend?: boolean
  className?: string
}

/**
 * Bagian-dari-total. Pemisah antar segmen adalah celah 2px berwarna permukaan
 * (lewat `gap`), bukan garis tepi. Label di dalam segmen hanya dirender kalau
 * segmennya benar-benar cukup lebar — kalau tidak, nilainya dibawa legenda dan
 * tooltip, bukan dipotong.
 *
 * Catatan implementasi: lebar persentase harus melekat pada elemen flex
 * langsung. Versi pertama memasang lebar pada anak di dalam pembungkus tooltip,
 * sehingga persentasenya dihitung terhadap pembungkus yang menyusut sendiri —
 * seluruh batang jadi menumpuk di kiri. Bug yang hanya kelihatan setelah
 * halamannya benar-benar dirender dan dilihat.
 */
export function StackedBar({ segments, format, height = 14, showLegend = true, className }: StackedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const visible = segments.filter((s) => s.value > 0)

  const legendItems: LegendItem[] = segments.map((s) => ({
    color: s.color,
    label: s.label,
    value: format(s.value),
  }))

  return (
    <div className={className}>
      <div
        className="flex w-full overflow-hidden rounded-[1px]"
        style={{ height, gap: '2px', backgroundColor: CHART_CHROME.grid }}
        role="img"
        aria-label={visible.map((s) => `${s.label} ${format(s.value)}`).join(', ')}
      >
        {visible.map((segment, index) => {
          const pct = total > 0 ? (segment.value / total) * 100 : 0
          const isLast = index === visible.length - 1
          // Cukup lebar untuk memuat label di dalam segmen dengan padding nyaman?
          const fitsLabel = pct > 16 && height >= 20
          return (
            <HoverTip
              key={segment.key}
              // Lebar ada di sini, pada anak flex langsung — bukan di dalamnya.
              style={{ width: `${pct}%`, minWidth: 3 }}
              tip={
                <div>
                  <p className="text-[11px] font-bold text-text-primary">{segment.label}</p>
                  <p className="text-[11px] tabular-nums text-text-secondary">
                    {format(segment.value)} · {total > 0 ? `${Math.round(pct)}%` : '0%'}
                  </p>
                </div>
              }
            >
              <div
                style={
                  {
                    height,
                    backgroundColor: segment.color,
                    borderRadius: isLast ? '0 4px 4px 0' : 0,
                    '--i': index,
                  } as CSSProperties
                }
                className="opsflow-segment flex w-full items-center justify-center"
              >
                {fitsLabel && <span className="px-1 text-[10px] font-bold text-white">{Math.round(pct)}%</span>}
              </div>
            </HoverTip>
          )
        })}
      </div>
      {showLegend && segments.length >= 2 && <Legend items={legendItems} className="mt-2.5" />}
    </div>
  )
}

// ============================================================
// Tunggu vs kerja
// ============================================================

interface WaitTouchBarProps {
  waitHours: number
  touchHours: number
  blockedHours?: number
  format: (hours: number) => string
  showLegend?: boolean
  height?: number
}

/**
 * Pemisahan paling penting di seluruh dashboard: berapa lama menganggur di
 * antrean, berapa lama benar-benar dikerjakan. Memakai satu hue netral dua
 * langkah, bukan warna kategorikal — supaya tidak pernah tertukar dengan
 * identitas sektor, dan supaya "menunggu" tampil dominan karena itu pokok
 * masalahnya.
 */
export function WaitTouchBar({
  waitHours,
  touchHours,
  blockedHours = 0,
  format,
  showLegend = true,
  height = 14,
}: WaitTouchBarProps) {
  const segments: StackSegment[] = [
    { key: 'wait', label: 'Menunggu', value: waitHours, color: TIME_COLOR.wait },
    { key: 'touch', label: 'Dikerjakan', value: touchHours, color: TIME_COLOR.touch },
  ]
  if (blockedHours > 0) {
    segments.push({ key: 'blocked', label: 'Tertahan pihak luar', value: blockedHours, color: TIME_COLOR.blocked })
  }
  return <StackedBar segments={segments} format={format} height={height} showLegend={showLegend} />
}

// ============================================================
// Umur WIP
// ============================================================

interface AgingBarProps {
  aging: { under8h: number; h8to24: number; h24to72: number; over72h: number }
  showLegend?: boolean
  height?: number
}

const AGING_ORDER: Array<{ key: keyof AgingBarProps['aging']; label: string; level: SeverityLevel }> = [
  { key: 'under8h', label: 'di bawah 8 j', level: 'good' },
  { key: 'h8to24', label: '8–24 j', level: 'warning' },
  { key: 'h24to72', label: '24–72 j', level: 'serious' },
  { key: 'over72h', label: 'di atas 72 j', level: 'critical' },
]

/**
 * Umur pekerjaan yang masih tertahan. Skala keparahan dipakai di sini karena
 * makin lama memang makin buruk — dan setiap tingkat selalu punya label teks di
 * legenda, jadi maknanya tidak pernah dibawa warna saja.
 */
export function AgingBar({ aging, showLegend = true, height = 14 }: AgingBarProps) {
  const segments: StackSegment[] = AGING_ORDER.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: aging[bucket.key],
    color: SEVERITY_COLOR[bucket.level],
  }))
  return <StackedBar segments={segments} format={(v) => `${v} item`} height={height} showLegend={showLegend} />
}

// ============================================================
// Grafik tren
// ============================================================

export interface TrendSeries {
  key: string
  label: string
  color: string
  points: number[]
  /** Isi area 10% di bawah garis. Hanya untuk satu seri. */
  fill?: boolean
}

interface TrendChartProps {
  labels: string[]
  series: TrendSeries[]
  format: (value: number) => string
  height?: number
  className?: string
}

const PLOT_PADDING = { top: 12, right: 10, bottom: 26, left: 34 }

/**
 * Garis 2px, marker ujung >=8px dengan ring permukaan 2px, grid hairline solid.
 * Lapisan hover memakai crosshair + tooltip karena ini bentuk garis: pembaca
 * perlu membandingkan seluruh seri pada satu titik waktu, bukan satu mark saja.
 */
export function TrendChart({ labels, series, format, height = 150, className }: TrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = 340
  const plotW = width - PLOT_PADDING.left - PLOT_PADDING.right
  const plotH = height - PLOT_PADDING.top - PLOT_PADDING.bottom

  const allValues = series.flatMap((s) => s.points)
  const rawMax = Math.max(...allValues, 1)
  // Bulatkan sumbu ke angka bersih.
  const step = rawMax <= 5 ? 1 : rawMax <= 20 ? 5 : rawMax <= 60 ? 10 : rawMax <= 150 ? 25 : 50
  const axisMax = Math.ceil(rawMax / step) * step
  const ticks = [0, axisMax / 2, axisMax]

  const x = (i: number) => PLOT_PADDING.left + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * plotW)
  const y = (v: number) => PLOT_PADDING.top + plotH - (v / axisMax) * plotH

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const relX = ((event.clientX - rect.left) / rect.width) * width - PLOT_PADDING.left
    const index = Math.round((relX / plotW) * (labels.length - 1))
    setHoverIndex(Math.min(labels.length - 1, Math.max(0, index)))
  }

  // Label sumbu x dijarangkan supaya tidak bertumpuk.
  const xLabelEvery = Math.max(1, Math.ceil(labels.length / 5))

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="opsflow-fade h-auto w-full touch-none"
        role="img"
        aria-label={`Tren ${series.map((s) => s.label).join(' dan ')} selama ${labels.length} hari`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Grid hairline solid + label sumbu y bulat */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PLOT_PADDING.left}
              x2={width - PLOT_PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? CHART_CHROME.axis : CHART_CHROME.grid}
              strokeWidth={1}
            />
            <text
              x={PLOT_PADDING.left - 6}
              y={y(tick) + 3}
              textAnchor="end"
              className="tabular-nums"
              style={{ fontSize: 10, fill: CHART_CHROME.muted }}
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {/* Crosshair */}
        {hoverIndex !== null && (
          <line
            x1={x(hoverIndex)}
            x2={x(hoverIndex)}
            y1={PLOT_PADDING.top}
            y2={PLOT_PADDING.top + plotH}
            stroke={CHART_CHROME.axis}
            strokeWidth={1}
          />
        )}

        {series.map((s) => {
          const path = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
          const areaPath = `${path} L${x(s.points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
          const lastIndex = s.points.length - 1
          return (
            <g key={s.key}>
              {s.fill && <path d={areaPath} fill={s.color} fillOpacity={0.1} />}
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Marker ujung: r>=4 dengan ring 2px berwarna permukaan */}
              <circle
                cx={x(lastIndex)}
                cy={y(s.points[lastIndex])}
                r={4}
                fill={s.color}
                stroke={CHART_CHROME.surface}
                strokeWidth={2}
              />
              {hoverIndex !== null && hoverIndex !== lastIndex && (
                <circle
                  cx={x(hoverIndex)}
                  cy={y(s.points[hoverIndex])}
                  r={4}
                  fill={s.color}
                  stroke={CHART_CHROME.surface}
                  strokeWidth={2}
                />
              )}
            </g>
          )
        })}

        {labels.map((label, index) =>
          index % xLabelEvery === 0 || index === labels.length - 1 ? (
            <text
              key={label}
              x={x(index)}
              y={height - 7}
              textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}
              style={{ fontSize: 10, fill: CHART_CHROME.muted }}
            >
              {label.slice(5).replace('-', '/')}
            </text>
          ) : null,
        )}
      </svg>

      {hoverIndex !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute right-0 top-0 rounded-md border border-border-med bg-bg-elevated px-2.5 py-1.5 shadow-pop"
        >
          <p className="text-[10px] font-bold text-text-primary">{labels[hoverIndex]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="tabular-nums">{format(s.points[hoverIndex])}</span>
            </p>
          ))}
        </div>
      )}

      {series.length >= 2 && (
        <Legend items={series.map((s) => ({ color: s.color, label: s.label }))} className="mt-1.5" />
      )}
    </div>
  )
}

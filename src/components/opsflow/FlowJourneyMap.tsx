/**
 * OpsFlow — Peta perjalanan.
 *
 * 32 stage jalur utama digambar sebagai satu rute berkelok: empat baris, satu
 * baris per sektor, arahnya berbalik di tiap ujung seperti papan permainan.
 * Setiap stage jadi stasiun ber-ikon; paket bergerak di sepanjang jalur; stasiun
 * yang macet berdenyut.
 *
 * Kenapa bentuk peta, bukan tabel: pertanyaan "di mana macetnya" adalah
 * pertanyaan tentang TEMPAT. Peta menjawabnya dalam sekali pandang — mata
 * langsung tertuju ke stasiun yang berdenyut dan menumpuk — sedangkan tabel
 * menuntut pembacanya membandingkan angka baris per baris lebih dulu.
 *
 * Catatan teknis penting:
 *
 * 1. Posisi stasiun dihitung dengan rumus, bukan diukur dari DOM. Jalur SVG dan
 *    stasiun HTML memakai sistem koordinat yang sama (viewBox 1000×640) dengan
 *    rasio aspek yang dikunci di pembungkusnya, jadi keduanya selalu sejajar
 *    tanpa perlu observer atau perhitungan ulang saat ukuran berubah.
 * 2. Ikon dirender sebagai HTML di atas SVG, bukan di dalamnya. `foreignObject`
 *    bermasalah di beberapa mesin render dan menyulitkan penataan teks.
 * 3. Animasi paket memakai SMIL (`animateMotion`) yang mengikuti jalur yang sama
 *    persis. Tidak ada JavaScript per frame — jadi tidak ada yang bisa membeku,
 *    dan kalau animasinya tidak jalan, tidak ada konten yang tersembunyi.
 * 4. Di layar sempit peta digulir mendatar di dalam wadahnya sendiri. Memaksa 32
 *    stasiun masuk ke lebar 375px akan membuat semuanya terlalu kecil untuk
 *    diketuk maupun dibaca.
 */

import { useMemo, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { SECTORS, SECTOR_ORDER, stagesOfSector, type SectorId, type StageDef } from '@/opsflow/taxonomy'
import { iconForStage } from '@/opsflow/stageIcons'
import type { BottleneckFinding, StageMetrics } from '@/opsflow/metrics'
import {
  DRIVER_LABEL,
  SECTOR_COLOR,
  SEVERITY_COLOR,
  formatDays,
  formatIdr,
  formatWorkHours,
  severityOfScore,
} from '@/opsflow/viz'
import { HoverTip, SeverityBadge } from './primitives'
import { cn } from '@/lib/utils'

// ============================================================
// Geometri
// ============================================================

const VB = { w: 1000, h: 640 }
/** Baris per sektor. */
const ROW_Y = [104, 250, 396, 542]
/**
 * Rute dimulai jauh dari tepi kiri karena 0–150 disisakan sebagai gutter label
 * sektor. Versi pertama menaruh label di titik awal tiap baris; karena barisnya
 * berkelok, titik awal baris genap berimpit dengan titik akhir baris sebelumnya
 * dan labelnya menimpa stasiun di sana.
 */
const GUTTER = 172
const X_START = GUTTER + 34
const X_END = 946
/** Radius lengkung U-turn di ujung baris. */
const TURN = 46

interface Station {
  stage: StageDef
  sector: SectorId
  x: number
  y: number
  /** Urutan di sepanjang rute, dipakai untuk jeda kemunculan. */
  order: number
}

/**
 * Susun stasiun secara berkelok (boustrophedon): baris ganjil dibalik arahnya,
 * sehingga rutenya menyambung tanpa garis panjang yang melompat kembali ke kiri.
 */
function buildStations(): Station[] {
  const stations: Station[] = []
  let order = 0

  SECTOR_ORDER.forEach((sectorId, rowIndex) => {
    const stages = stagesOfSector(sectorId, false)
    const y = ROW_Y[rowIndex]
    const span = X_END - X_START
    const step = stages.length > 1 ? span / (stages.length - 1) : 0
    const reversed = rowIndex % 2 === 1

    stages.forEach((stage, i) => {
      const t = reversed ? stages.length - 1 - i : i
      stations.push({ stage, sector: sectorId, x: X_START + t * step, y, order: order++ })
    })
  })

  return stations
}

/** Jalur tunggal yang melewati semua stasiun, dengan U-turn di setiap ujung baris. */
function buildRoutePath(): string {
  const segments: string[] = []

  ROW_Y.forEach((y, rowIndex) => {
    const leftToRight = rowIndex % 2 === 0
    const from = leftToRight ? X_START : X_END
    const to = leftToRight ? X_END : X_START

    if (rowIndex === 0) segments.push(`M ${from} ${y}`)
    else segments.push(`L ${from} ${y}`)

    segments.push(`L ${to} ${y}`)

    // U-turn ke baris berikutnya.
    if (rowIndex < ROW_Y.length - 1) {
      const nextY = ROW_Y[rowIndex + 1]
      const bulge = leftToRight ? to + TURN : to - TURN
      segments.push(`C ${bulge} ${y}, ${bulge} ${nextY}, ${to} ${nextY}`)
    }
  })

  return segments.join(' ')
}

// ============================================================
// Komponen
// ============================================================

interface FlowJourneyMapProps {
  stages: StageMetrics[]
  bottlenecks: BottleneckFinding[]
  onSelectStage: (stageCode: string) => void
  onSelectSector: (sector: SectorId) => void
}

export function FlowJourneyMap({ stages, bottlenecks, onSelectStage, onSelectSector }: FlowJourneyMapProps) {
  const reduced = useReducedMotion()
  const stations = useMemo(buildStations, [])
  const routePath = useMemo(buildRoutePath, [])

  const metricByStage = new Map(stages.map((s) => [s.stageCode, s]))
  const findingByStage = new Map(bottlenecks.map((b) => [b.stageCode, b]))

  // Ukuran stasiun mengikuti jumlah pekerjaan yang tertahan di sana, jadi
  // penumpukan terlihat sebagai penumpukan — bukan hanya sebagai angka.
  const maxWip = Math.max(...stages.map((s) => s.wip), 1)
  const nodeSize = (wip: number) => 34 + Math.round((Math.min(wip, maxWip) / maxWip) * 16)

  const pct = (value: number, total: number) => `${(value / total) * 100}%`

  return (
    <div>
      {/* Kunci rasio aspek supaya jalur SVG dan stasiun HTML memakai sistem
          koordinat yang sama tanpa perlu pengukuran DOM. */}
      <div className="-mx-1 overflow-x-auto pb-2">
        {/* Lebar minimum dihitung, bukan ditebak: label stasiun lebarnya tetap
            92px, sementara jarak antar stasiun menyusut ikut lebar peta. Di bawah
            ~1000px, jarak antar stasiun jadi lebih kecil dari lebar labelnya dan
            label mulai bertabrakan. Ini ketemu dari pemeriksaan visual otomatis
            (`npm run opsflow:visual`), bukan dari melihat sekilas. */}
        <div className="relative mx-1 min-w-[1000px]">
          <div className="relative aspect-[1000/640] w-full">
            <svg
              viewBox={`0 0 ${VB.w} ${VB.h}`}
              className="absolute inset-0 size-full"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <path id="opsflow-route" d={routePath} fill="none" />
                {/* Gradien jalur berpindah warna mengikuti sektor yang dilewatinya. */}
                <linearGradient id="opsflow-route-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SECTOR_COLOR.PROC} />
                  <stop offset="33%" stopColor={SECTOR_COLOR.FIN} />
                  <stop offset="66%" stopColor={SECTOR_COLOR.PRD} />
                  <stop offset="100%" stopColor={SECTOR_COLOR.DEL} />
                </linearGradient>
              </defs>

              {/* Badan jalan */}
              <use href="#opsflow-route" stroke="#efeae1" strokeWidth={22} strokeLinecap="round" />
              <use href="#opsflow-route" stroke="#ffffff" strokeWidth={16} strokeLinecap="round" />
              {/* Marka tengah yang bergerak — menyatakan arah aliran */}
              <use
                href="#opsflow-route"
                stroke="url(#opsflow-route-grad)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="10 18"
                className={reduced ? undefined : 'opsflow-conveyor'}
                opacity={0.55}
              />

              {/* Paket yang berjalan di sepanjang rute. Tiga saja — lebih dari itu
                  jadi ramai dan menarik perhatian dari stasiun yang bermasalah. */}
              {!reduced &&
                [0, 1, 2].map((i) => (
                  <circle key={i} r={5} fill={SEVERITY_COLOR.good} opacity={0.85}>
                    <animateMotion
                      dur="14s"
                      begin={`${i * 4.6}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath href="#opsflow-route" />
                    </animateMotion>
                  </circle>
                ))}
            </svg>

            {/* Label sektor di titik awal tiap baris */}
            {SECTOR_ORDER.map((sectorId, rowIndex) => {
              const sector = SECTORS[sectorId]
              const sectorStages = stages.filter((s) => s.sector === sectorId)
              const wip = sectorStages.reduce((sum, s) => sum + s.wip, 0)
              const stuck = bottlenecks
                .filter((b) => b.sector === sectorId)
                .reduce((sum, b) => sum + b.valueStuckIdr, 0)
              const worst = bottlenecks.find((b) => b.sector === sectorId)

              return (
                <button
                  key={sectorId}
                  type="button"
                  onClick={() => onSelectSector(sectorId)}
                  className={cn(
                    'absolute left-0 z-10 flex w-[156px] -translate-y-1/2 cursor-pointer flex-col justify-center rounded-md bg-bg-elevated px-2.5 py-2 text-left',
                    'shadow-soft ring-1 ring-inset ring-border-soft',
                    'transition-shadow duration-base hover:shadow-glass',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  )}
                  style={{ top: pct(ROW_Y[rowIndex], VB.h) }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: SECTOR_COLOR[sectorId] }}
                    />
                    <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-primary">
                      {rowIndex + 1}. {sector.name}
                    </span>
                  </span>
                  <span className="mt-1 block text-[16px] font-bold leading-[18px] tabular-nums text-text-primary">
                    {wip}
                    <span className="ml-1 text-[10px] font-semibold text-text-muted">tertahan</span>
                  </span>
                  {stuck > 0 && (
                    <span className="text-[10px] tabular-nums text-text-secondary">{formatIdr(stuck)}</span>
                  )}
                  {worst && (
                    <span className="mt-1">
                      <SeverityBadge level={severityOfScore(worst.score)} />
                    </span>
                  )}
                </button>
              )
            })}

            {/* Penanda arah di tengah tiap baris. Tata letak berkelok hemat
                ruang, tapi baris yang mengalir ke kiri bisa terbaca mundur kalau
                arahnya tidak dinyatakan. */}
            {ROW_Y.map((y, rowIndex) => {
              const leftToRight = rowIndex % 2 === 0
              const midX = (X_START + X_END) / 2
              return (
                <span
                  key={`dir-${rowIndex}`}
                  aria-hidden="true"
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-bg-elevated px-1.5 py-0.5 shadow-soft ring-1 ring-inset ring-border-soft"
                  style={{ left: pct(midX, VB.w), top: pct(y - 34, VB.h) }}
                >
                  <ChevronRight
                    className={cn('size-3 text-text-faint', !leftToRight && 'rotate-180')}
                    strokeWidth={3}
                  />
                </span>
              )
            })}

            {/* Stasiun */}
            {stations.map((station) => {
              const metrics = metricByStage.get(station.stage.code)
              const finding = findingByStage.get(station.stage.code)
              const level = finding ? severityOfScore(finding.score) : 'good'
              const wip = metrics?.wip ?? 0
              const size = nodeSize(wip)
              const Icon = iconForStage(station.stage.code)
              const jammed = level === 'critical' || level === 'serious'
              const color = SECTOR_COLOR[station.sector]

              return (
                <div
                  key={station.stage.code}
                  className="opsflow-node absolute z-20"
                  style={
                    {
                      left: pct(station.x, VB.w),
                      top: pct(station.y, VB.h),
                      '--i': station.order,
                    } as CSSProperties
                  }
                >
                  <HoverTip
                    tip={
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-text-primary">
                          {station.stage.code} · {station.stage.name}
                        </p>
                        <p className="text-[11px] text-text-muted">{station.stage.team}</p>
                        {metrics && (
                          <>
                            <p className="text-[11px] tabular-nums text-text-secondary">
                              {metrics.wip} tertahan · {metrics.untouchedWip} belum dipegang
                            </p>
                            <p className="text-[11px] tabular-nums text-text-secondary">
                              Antrean {formatDays(metrics.queueDays === 999 ? 0 : metrics.queueDays)} hari · tunggu p90{' '}
                              {formatWorkHours(metrics.waitHoursP90)}
                            </p>
                          </>
                        )}
                        {finding && (
                          <p className="text-[11px] font-semibold text-text-primary">
                            {DRIVER_LABEL[finding.primaryDriver] ?? finding.primaryDriver}
                          </p>
                        )}
                      </div>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectStage(station.stage.code)}
                      aria-label={`${station.stage.code} ${station.stage.name}, ${wip} item tertahan`}
                      className="group relative block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                      style={{ width: size, height: size }}
                    >
                      {/* Denyut untuk stasiun yang macet. Cincin terpisah, jadi
                          ukuran stasiunnya sendiri tetap dan tata letak tidak bergeser. */}
                      {jammed && !reduced && (
                        <span
                          aria-hidden="true"
                          className="opsflow-node-pulse absolute inset-0 rounded-full"
                          style={{ backgroundColor: SEVERITY_COLOR[level] }}
                        />
                      )}

                      <span
                        className={cn(
                          'relative flex size-full items-center justify-center rounded-full bg-bg-elevated shadow-soft',
                          'transition-transform duration-fast group-hover:scale-110',
                        )}
                        style={{ boxShadow: `0 0 0 2.5px ${color}, 0 2px 6px rgba(31,26,20,0.14)` }}
                      >
                        <Icon aria-hidden="true" className="size-[45%]" style={{ color }} strokeWidth={2} />
                      </span>

                      {/* Jumlah pekerjaan tertahan. Selalu angka, bukan hanya ukuran —
                          ukuran menyampaikan kesan, angka menyampaikan fakta. */}
                      {wip > 0 && (
                        <span
                          className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-px text-[10px] font-extrabold tabular-nums text-white shadow-soft"
                          style={{ backgroundColor: jammed ? SEVERITY_COLOR[level] : '#6b6253' }}
                        >
                          {wip}
                        </span>
                      )}
                    </button>
                  </HoverTip>

                  {/* Label stasiun di bawah ikon */}
                  <span
                    className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-[92px] -translate-x-1/2 text-center"
                    aria-hidden="true"
                  >
                    <span className="block text-[9px] font-extrabold tabular-nums text-text-faint">
                      {station.stage.code}
                    </span>
                    <span className="block text-[10px] font-bold leading-[13px] text-text-secondary">
                      {station.stage.name}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Keterangan cara membaca peta. Ukuran dan denyut adalah pengkodean baru,
          jadi harus dijelaskan — pengkodean yang tidak dijelaskan akan ditebak. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-soft pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <span aria-hidden="true" className="size-2.5 rounded-full ring-2 ring-inset ring-text-faint" />
          Ukuran stasiun = jumlah pekerjaan tertahan
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: SEVERITY_COLOR.critical }}
          />
          Berdenyut = macet, ketuk untuk melihat sebabnya
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-text-faint" />
          Marka jalan bergerak = arah aliran pekerjaan
        </span>
      </div>

      {/* Ringkasan teks: peta menyampaikan tempat, kalimat ini menyampaikan
          kesimpulannya — dan pembaca layar hanya mendapat yang ini. */}
      <ul className="mt-3 space-y-1.5">
        {bottlenecks.slice(0, 3).map((finding, index) => (
          <li key={finding.stageCode} className="flex items-start gap-2 text-[12px] leading-[17px]">
            <span className="mt-px w-3 shrink-0 text-[11px] font-extrabold tabular-nums text-text-faint">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="font-bold text-text-primary">{finding.stageName}</span>
              <span className="text-text-muted"> · {finding.team} · </span>
              <SeverityBadge level={severityOfScore(finding.score)}>
                {DRIVER_LABEL[finding.primaryDriver]}
              </SeverityBadge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

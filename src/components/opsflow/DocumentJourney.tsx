/**
 * OpsFlow — Perjalanan satu dokumen.
 *
 * Menjawab pertanyaan yang paling sering ditanyakan orang tentang sebuah
 * dokumen, dan yang paling sering dijawab lewat WhatsApp: "ini sudah sampai
 * mana, dan sekarang di tangan siapa?"
 *
 * Bacanya dari bentuk dulu, bukan dari teks: stage yang sudah lewat memakai ikon
 * centang, stage sekarang memakai ikon stage-nya dengan cincin tebal, stage
 * berikutnya abu-abu. Warna hanya memperkuat — statusnya tetap terbaca kalau
 * warnanya hilang, karena bentuk dan labelnya sudah membedakan.
 */

import { Fragment } from 'react'
import { Check, Clock3 } from 'lucide-react'
import { getStage, stagesOfSector, type SectorId } from '@/opsflow/taxonomy'
import { iconForStage } from '@/opsflow/stageIcons'
import { SECTOR_COLOR, formatWorkHours } from '@/opsflow/viz'
import { cn } from '@/lib/utils'

export interface JourneyStop {
  code: string
  name: string
  team: string
  sector: SectorId
  state: 'lewat' | 'sekarang' | 'nanti'
  /** Berapa lama dokumen ini berada di stage tersebut, kalau sudah tercatat. */
  hours?: number | null
}

/**
 * Susun perhentian dari stage yang benar-benar pernah disinggahi dokumen ini,
 * digabung dengan stage tersisa di sektornya yang sekarang.
 *
 * Sengaja tidak menampilkan seluruh 35 stage: dokumen tidak melewati semuanya,
 * dan daftar panjang berisi stage yang tidak relevan justru menyembunyikan yang
 * penting.
 */
export function buildJourney(
  visitedCodes: string[],
  currentCode: string,
  hoursByCode: Record<string, number | null>,
): JourneyStop[] {
  const current = getStage(currentCode)
  const seen = new Set<string>()
  const stops: JourneyStop[] = []

  for (const code of visitedCodes) {
    const stage = getStage(code)
    if (!stage || seen.has(code)) continue
    seen.add(code)
    stops.push({
      code: stage.code,
      name: stage.name,
      team: stage.team,
      sector: stage.sector,
      state: code === currentCode ? 'sekarang' : 'lewat',
      hours: hoursByCode[code] ?? null,
    })
  }

  if (current && !seen.has(current.code)) {
    seen.add(current.code)
    stops.push({
      code: current.code,
      name: current.name,
      team: current.team,
      sector: current.sector,
      state: 'sekarang',
      hours: hoursByCode[current.code] ?? null,
    })
  }

  // Beberapa stage berikutnya di sektor yang sama, supaya orang tahu pekerjaan
  // ini akan mendarat di meja siapa setelah dia selesai.
  if (current) {
    const ahead = stagesOfSector(current.sector)
      .filter((stage) => stage.order > current.order && !seen.has(stage.code))
      .slice(0, 3)
    for (const stage of ahead) {
      stops.push({
        code: stage.code,
        name: stage.name,
        team: stage.team,
        sector: stage.sector,
        state: 'nanti',
      })
    }
  }

  return stops
}

export function DocumentJourney({ stops, closed }: { stops: JourneyStop[]; closed?: boolean }) {
  if (stops.length === 0) return null

  return (
    <ol
      className="flex snap-x gap-0 overflow-x-auto pb-1"
      aria-label="Perjalanan dokumen antar stage"
    >
      {stops.map((stop, index) => {
        const Icon = stop.state === 'lewat' ? Check : iconForStage(stop.code)
        const color = SECTOR_COLOR[stop.sector]
        const isCurrent = stop.state === 'sekarang'
        const isFuture = stop.state === 'nanti'

        return (
          <Fragment key={stop.code}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mt-[19px] h-0.5 w-5 shrink-0 rounded-full sm:w-8"
                style={{ backgroundColor: isFuture ? 'rgb(0 0 0 / 0.10)' : `${color}55` }}
              />
            )}
            <li className="flex w-[92px] shrink-0 snap-start flex-col items-center text-center sm:w-[104px]">
              <span
                aria-hidden="true"
                className={cn(
                  'flex items-center justify-center rounded-full transition-transform',
                  isCurrent ? 'size-10' : 'size-8',
                )}
                style={{
                  backgroundColor: isFuture ? 'transparent' : isCurrent ? `${color}1f` : `${color}14`,
                  boxShadow: isFuture
                    ? 'inset 0 0 0 1.5px rgb(0 0 0 / 0.12)'
                    : `inset 0 0 0 ${isCurrent ? 2.5 : 1.5}px ${color}`,
                }}
              >
                <Icon
                  className={isCurrent ? 'size-[18px]' : 'size-4'}
                  style={{ color: isFuture ? 'rgb(0 0 0 / 0.28)' : color }}
                />
              </span>

              <span
                className={cn(
                  'mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em]',
                  isFuture ? 'text-text-faint' : 'text-text-muted',
                )}
              >
                {stop.code}
              </span>
              <span
                className={cn(
                  'text-[11px] leading-[14px]',
                  isCurrent ? 'font-bold text-text-primary' : isFuture ? 'text-text-faint' : 'text-text-secondary',
                )}
              >
                {stop.name}
              </span>

              {/* Status ditulis, bukan hanya diwarnai. */}
              {isCurrent && (
                <span
                  className="mt-1 inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: `${color}1f`, color }}
                >
                  <Clock3 aria-hidden="true" className="size-2.5" />
                  {closed ? 'selesai' : 'di sini'}
                </span>
              )}
              {stop.state === 'lewat' && stop.hours != null && (
                <span className="mt-1 text-[10px] tabular-nums text-text-faint">
                  {formatWorkHours(stop.hours)}
                </span>
              )}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

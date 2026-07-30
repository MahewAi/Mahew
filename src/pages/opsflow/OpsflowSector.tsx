/**
 * OpsFlow — Layar kepala sektor.
 *
 * Bedanya dengan layar pimpinan: di sini yang dibutuhkan adalah daftar tindakan,
 * bukan kesimpulan. Antrean sub-tim sendiri, diurutkan dari yang paling tua,
 * plus kartu skor sub-tim — masih tingkat tim, bukan individu.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Users } from 'lucide-react'
import { SECTORS, stagesOfSector, type SectorId } from '@/opsflow/taxonomy'
import { WINDOW_OPTIONS, useOpsflowSnapshot, type WindowDays } from '@/opsflow/useOpsflowSnapshot'
import { computeDailySeries } from '@/opsflow/metrics'
import {
  DRIVER_LABEL,
  SECTOR_COLOR,
  SEVERITY_COLOR,
  TIME_COLOR,
  formatCount,
  formatDays,
  formatIdr,
  formatPct,
  formatWorkHours,
  severityOfOnTime,
  severityOfScore,
} from '@/opsflow/viz'
import { AgingBar, BarList, TrendChart, WaitTouchBar, type BarRow } from '@/components/opsflow/charts'
import {
  DashboardSkeleton,
  FilterChip,
  FilterRow,
  MetricTile,
  SectionCard,
  SeverityBadge,
  TableViewToggle,
} from '@/components/opsflow/primitives'
import { DURATION, EASE, SPRING } from '@/components/opsflow/motion'
import { OpsflowShell } from './OpsflowShell'

const VALID_SECTORS: SectorId[] = ['PROC', 'FIN', 'PRD', 'DEL']

export default function OpsflowSector() {
  const params = useParams<{ sector?: string }>()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const data = useOpsflowSnapshot(windowDays)

  const sectorId = VALID_SECTORS.find((s) => s === params.sector?.toUpperCase())

  const daily = useMemo(() => {
    if (!data || !sectorId) return []
    return computeDailySeries(data.dataset, data.visits, { windowDays, sector: sectorId })
  }, [data, sectorId, windowDays])

  if (!sectorId) {
    return (
      <OpsflowShell title="Sektor tidak ditemukan">
        <p className="text-[13px] text-text-secondary">
          Kode sektor harus salah satu dari PROC, FIN, PRD, atau DEL.
        </p>
      </OpsflowShell>
    )
  }

  const sector = SECTORS[sectorId]

  if (!data) {
    return (
      <OpsflowShell title={sector.name} subtitle="Menghitung snapshot…" accentColor={SECTOR_COLOR[sectorId]}>
        <DashboardSkeleton />
      </OpsflowShell>
    )
  }

  const { snapshot, source } = data
  const sectorStages = snapshot.stages.filter((s) => s.sector === sectorId)
  const sectorBottlenecks = snapshot.bottlenecks.filter((b) => b.sector === sectorId)
  const sectorTeams = snapshot.teams.filter((t) => t.sector === sectorId)
  const stageDefs = stagesOfSector(sectorId, true)

  const totalWip = sectorStages.reduce((sum, s) => sum + s.wip, 0)
  const untouchedWip = sectorStages.reduce((sum, s) => sum + s.untouchedWip, 0)
  const overdueValue = sectorBottlenecks.reduce((sum, b) => sum + b.valueStuckIdr, 0)
  const waitHours = snapshot.flow.waitHoursBySector[sectorId] ?? 0
  const onTimeAvg =
    sectorTeams.length > 0
      ? sectorTeams.reduce((sum, t) => sum + t.onTimeHandoffPct, 0) / sectorTeams.length
      : 100

  const queueRows: BarRow[] = [...sectorStages]
    .sort((a, b) => (b.queueDays === 999 ? 0 : b.queueDays) - (a.queueDays === 999 ? 0 : a.queueDays))
    .map((stage) => {
      const finding = sectorBottlenecks.find((b) => b.stageCode === stage.stageCode)
      const level = finding ? severityOfScore(finding.score) : 'good'
      return {
        key: stage.stageCode,
        label: stage.stageName,
        sublabel: stage.team,
        value: stage.queueDays === 999 ? 30 : stage.queueDays,
        valueLabel: stage.queueDays === 999 ? 'tak bergerak' : `${formatDays(stage.queueDays)} hari`,
        color: SEVERITY_COLOR[level],
        badge: (
          <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
            {stage.wip} item
          </span>
        ),
        tip: (
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-text-primary">
              {stage.stageCode} · {stage.stageName}
            </p>
            <p className="text-[11px] tabular-nums text-text-secondary">
              Tunggu p90 {formatWorkHours(stage.waitHoursP90)} vs target {formatWorkHours(stage.slaWaitTarget)}
            </p>
            <p className="text-[11px] tabular-nums text-text-secondary">
              {stage.untouchedWip} dari {stage.wip} item belum ada yang mulai kerjakan
            </p>
            {finding && <p className="text-[11px] leading-[15px] text-text-secondary">{finding.explanation}</p>}
          </div>
        ),
        onClick: () => navigate(`/opsflow/stage/${stage.stageCode}`),
      }
    })

  const totalAging = sectorStages.reduce(
    (acc, s) => ({
      under8h: acc.under8h + s.aging.under8h,
      h8to24: acc.h8to24 + s.aging.h8to24,
      h24to72: acc.h24to72 + s.aging.h24to72,
      over72h: acc.over72h + s.aging.over72h,
    }),
    { under8h: 0, h8to24: 0, h24to72: 0, over72h: 0 },
  )

  const totalTouch = sectorStages.reduce((sum, s) => sum + s.touchHoursP50 * s.completedInWindow, 0)

  return (
    <OpsflowShell
      title={sector.name}
      subtitle={sector.mandate}
      source={source}
      backTo="/opsflow"
      backLabel="Ikhtisar"
      accentColor={SECTOR_COLOR[sectorId]}
      toolbar={
        <FilterRow>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-muted">Jendela</span>
          {WINDOW_OPTIONS.map((option) => (
            <FilterChip
              key={option.days}
              groupId="window"
              active={windowDays === option.days}
              onClick={() => setWindowDays(option.days)}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>
      }
    >
      <motion.div
        key={windowDays}
        initial={reduced ? false : { opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.enter, ease: EASE.out }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricTile
          index={1}
            label="Item tertahan"
            animate={{ value: totalWip, format: (v) => formatCount(Math.round(v)) }}
            caption={`${untouchedWip} belum ada yang pegang`}
            level={untouchedWip > totalWip * 0.5 ? 'serious' : 'warning'}
          />
          <MetricTile
          index={2} label="Jam tunggu" value={formatWorkHours(waitHours)} caption="hilang di antrean" />
          <MetricTile
          index={3}
            label="Serah terima tepat waktu"
            animate={{ value: onTimeAvg / 100, format: (v) => formatPct(v) }}
            level={severityOfOnTime(onTimeAvg)}
            caption={`rata-rata ${sectorTeams.length} sub-tim`}
          />
          <MetricTile
          index={4} label="Nilai tertahan" value={formatIdr(overdueValue)} caption="di seluruh stage sektor ini" />
        </div>

        <SectionCard
          index={5}
          title="Antrean per stage"
          hint="Panjang batang = berapa hari untuk menghabiskan antrean dengan kecepatan penyelesaian sekarang (WIP ÷ throughput). Ini indikator macet paling jujur karena tidak bisa dikaburkan rata-rata."
          action={
            <TableViewToggle
              caption={`Antrean stage — ${sector.name}`}
              headers={['Kode', 'Stage', 'Sub-tim', 'WIP', 'Belum dipegang', 'Hari antrean', 'Tunggu p90 (j)', 'Target (j)']}
              numericColumns={[3, 4, 5, 6, 7]}
              rows={sectorStages.map((s) => [
                s.stageCode,
                s.stageName,
                s.team,
                s.wip,
                s.untouchedWip,
                s.queueDays === 999 ? '—' : s.queueDays,
                s.waitHoursP90,
                s.slaWaitTarget,
              ])}
            />
          }
        >
          <BarList rows={queueRows} />
        </SectionCard>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SectionCard
          index={6}
            title="Umur pekerjaan tertahan"
            hint="Kelompok di atas 72 jam adalah daftar tindakan harian. Setiap satu berarti ada pekerjaan yang sudah lebih dari 9 hari kerja tidak bergerak."
          >
            <AgingBar aging={totalAging} height={20} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Menunggu</p>
                <p className="mt-0.5 text-[18px] font-bold tabular-nums text-text-primary">
                  {formatWorkHours(waitHours)}
                </p>
              </div>
              <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Dikerjakan</p>
                <p className="mt-0.5 text-[18px] font-bold tabular-nums text-text-primary">
                  {formatWorkHours(totalTouch)}
                </p>
              </div>
            </div>
            <WaitTouchBar waitHours={waitHours} touchHours={totalTouch} format={formatWorkHours} height={14} />
          </SectionCard>

          <SectionCard
          index={7}
            title="Tren harian sektor"
            hint="Penyelesaian dibanding pelanggaran SLA di sektor ini saja."
          >
            <TrendChart
              labels={daily.map((d) => d.date)}
              series={[
                {
                  key: 'completed',
                  label: 'Selesai',
                  color: TIME_COLOR.touch,
                  points: daily.map((d) => d.completed),
                  fill: true,
                },
                {
                  key: 'breached',
                  label: 'Lewat SLA',
                  color: SEVERITY_COLOR.critical,
                  points: daily.map((d) => d.breached),
                },
              ]}
              format={(v) => `${v}`}
            />
          </SectionCard>
        </div>

        <SectionCard
          index={8}
          title="Kartu skor sub-tim"
          hint="Beban per orang ditampilkan berdampingan dengan kecepatan — sub-tim dengan waktu kerja 2× lebih lama tapi beban 3× lebih banyak bukan sub-tim yang lambat."
          action={
            <TableViewToggle
              caption={`Kartu skor sub-tim — ${sector.name}`}
              headers={[
                'Sub-tim',
                'Item',
                'Per orang',
                'Respons (j)',
                'Kerja (j)',
                'Tepat waktu',
                'Kesalahan',
                'Lolos',
                'Jeda catat (j)',
                'Kelengkapan',
              ]}
              numericColumns={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
              rows={sectorTeams.map((t) => [
                t.teamName,
                t.itemsHandled,
                t.itemsPerPerson,
                t.medianResponseHours,
                t.medianTouchHours,
                `${t.onTimeHandoffPct}%`,
                t.incidentsSourced,
                t.incidentsEscaped,
                t.medianRecordingLagHours,
                `${t.timestampCompletenessPct}%`,
              ])}
            />
          }
        >
          {sectorTeams.length === 0 ? (
            <p className="text-[12px] text-text-muted">
              Belum ada kunjungan stage yang selesai di jendela ini, jadi kartu skor belum bisa dihitung.
            </p>
          ) : (
            <ul className="space-y-2">
              {sectorTeams.map((team) => (
                <motion.li
                  key={team.teamId}
                  whileHover={reduced ? undefined : { y: -2 }}
                  transition={SPRING}
                  className="rounded-md bg-bg-surface px-3.5 py-3 ring-1 ring-inset ring-border-soft"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-text-primary">
                      <Users aria-hidden="true" className="size-3.5 text-text-muted" />
                      {team.teamName}
                    </span>
                    <SeverityBadge level={severityOfOnTime(team.onTimeHandoffPct)}>
                      {team.onTimeHandoffPct}% tepat waktu
                    </SeverityBadge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                    <ScoreCell label="Item" value={`${team.itemsHandled}`} />
                    <ScoreCell label="Per orang" value={`${team.itemsPerPerson}`} />
                    <ScoreCell label="Respons" value={formatWorkHours(team.medianResponseHours)} />
                    <ScoreCell label="Kerja" value={formatWorkHours(team.medianTouchHours)} />
                  </dl>
                  {team.timestampCompletenessPct < 85 && (
                    <p className="mt-2 text-[11px] leading-[15px] text-text-muted">
                      Kelengkapan timestamp {team.timestampCompletenessPct}% — angka waktu sub-tim ini belum bisa
                      dipakai untuk menilai apa pun. Yang perlu dibenahi lebih dulu pencatatannya.
                    </p>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          index={9} title="Stage di sektor ini" hint="Urutan, sub-tim pemilik, dan gerbang yang harus dilewati.">
          <ol className="space-y-1.5">
            {stageDefs.map((stage) => (
              <li key={stage.code}>
                <button
                  type="button"
                  onClick={() => navigate(`/opsflow/stage/${stage.code}`)}
                  className="group flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                >
                  <span className="mt-px shrink-0 text-[10px] font-extrabold tabular-nums text-text-faint">
                    {stage.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-text-primary">{stage.name}</span>
                    <span className="block text-[11px] text-text-muted">
                      {stage.team}
                      {stage.gate && <> · gerbang: {stage.gate}</>}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-text-faint opacity-0 transition-all duration-fast group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </button>
              </li>
            ))}
          </ol>
        </SectionCard>

        {sectorBottlenecks[0] && (
          <SectionCard
          index={10} title="Pemicu utama di sektor ini" hint="Diagnosis menentukan tindakan yang tepat.">
            <p className="text-[13px] font-bold text-text-primary">
              {sectorBottlenecks[0].stageName} — {DRIVER_LABEL[sectorBottlenecks[0].primaryDriver]}
            </p>
            <p className="mt-1.5 text-[12px] leading-[17px] text-text-secondary">
              {sectorBottlenecks[0].explanation}
            </p>
          </SectionCard>
        )}
      </motion.div>
    </OpsflowShell>
  )
}

function ScoreCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="text-[13px] font-bold tabular-nums text-text-primary">{value}</dd>
    </div>
  )
}

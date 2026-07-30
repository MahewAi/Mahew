/**
 * OpsFlow — Layar detail stage.
 *
 * Di sini pemisahan tunggu vs kerja jadi pusat perhatian, karena di tingkat ini
 * pertanyaannya bukan lagi "di mana macetnya" tapi "apa yang harus diubah":
 * kalau waktunya habis di antrean, yang perlu dibenahi kepemilikan pekerjaan;
 * kalau habis di pengerjaan, yang perlu dilihat alat kerja dan kerumitan kasus.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { SECTORS, getStage } from '@/opsflow/taxonomy'
import { WINDOW_OPTIONS, useOpsflowSnapshot, type WindowDays } from '@/opsflow/useOpsflowSnapshot'
import {
  DRIVER_LABEL,
  INCIDENT_LABEL,
  SECTOR_COLOR,
  SEVERITY_COLOR,
  formatCount,
  formatDays,
  formatIdr,
  formatPct,
  formatWorkHours,
  severityOfConfidence,
  severityOfScore,
} from '@/opsflow/viz'
import { AgingBar, BarList, WaitTouchBar, type BarRow } from '@/components/opsflow/charts'
import {
  DashboardSkeleton,
  FilterChip,
  FilterRow,
  HeroFigure,
  MetricTile,
  SectionCard,
  SeverityBadge,
  TableViewToggle,
} from '@/components/opsflow/primitives'
import { Meter } from '@/components/opsflow/Meter'
import { DURATION, EASE, SPRING } from '@/components/opsflow/motion'
import { OpsflowShell } from './OpsflowShell'

export default function OpsflowStage() {
  const params = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const data = useOpsflowSnapshot(windowDays)

  const stageCode = params.code?.toUpperCase() ?? ''
  const stageDef = getStage(stageCode)

  const openItems = useMemo(() => {
    if (!data) return []
    return data.visits
      .filter((v) => v.stageCode === stageCode && v.isOpen)
      .sort((a, b) => (b.ageHours ?? 0) - (a.ageHours ?? 0))
      .slice(0, 12)
  }, [data, stageCode])

  if (!stageDef) {
    return (
      <OpsflowShell title="Stage tidak ditemukan">
        <p className="text-[13px] text-text-secondary">
          Kode <span className="font-bold">{stageCode}</span> tidak ada dalam taksonomi. Daftar lengkapnya ada di
          dokumen peta alur.
        </p>
      </OpsflowShell>
    )
  }

  const sector = SECTORS[stageDef.sector]

  if (!data) {
    return (
      <OpsflowShell
        title={stageDef.name}
        subtitle="Menghitung snapshot…"
        backTo={`/opsflow/sektor/${stageDef.sector}`}
        accentColor={SECTOR_COLOR[stageDef.sector]}
      >
        <DashboardSkeleton />
      </OpsflowShell>
    )
  }

  const { snapshot, dataset, source } = data
  const metrics = snapshot.stages.find((s) => s.stageCode === stageCode)
  const finding = snapshot.bottlenecks.find((b) => b.stageCode === stageCode)
  const quality = snapshot.dataQuality.find((q) => q.stageCode === stageCode)
  const personById = new Map(dataset.people.map((p) => [p.id, p]))
  const itemById = new Map(dataset.workItems.map((i) => [i.id, i]))

  const stageIncidents = dataset.incidents.filter((i) => i.occurredAtStage === stageCode)
  const incidentByType = new Map<string, number>()
  for (const incident of stageIncidents) {
    incidentByType.set(incident.type, (incidentByType.get(incident.type) ?? 0) + 1)
  }
  const incidentRows: BarRow[] = [...incidentByType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      key: type,
      label: INCIDENT_LABEL[type] ?? type,
      value: count,
      valueLabel: `${count}×`,
      color: SEVERITY_COLOR.serious,
    }))

  const waitShare = metrics ? 1 - metrics.touchShare : 0

  return (
    <OpsflowShell
      title={stageDef.name}
      subtitle={`${stageDef.code} · ${stageDef.team} · sektor ${sector.name}`}
      source={source}
      backTo={`/opsflow/sektor/${stageDef.sector}`}
      backLabel={sector.name}
      accentColor={SECTOR_COLOR[stageDef.sector]}
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
        {/* Angka utama halaman ini: porsi waktu yang habis menunggu */}
        <section className="relative overflow-hidden rounded-lg bg-bg-elevated px-4 py-6 shadow-glass ring-1 ring-inset ring-border-soft md:px-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          />
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-9">
            <Meter
              fraction={waitShare}
              level={waitShare > 0.75 ? 'critical' : waitShare > 0.55 ? 'serious' : waitShare > 0.35 ? 'warning' : 'good'}
              size={188}
              thickness={13}
              ariaLabel={`Waktu yang habis menunggu ${formatPct(waitShare)}`}
            >
              <HeroFigure
                label="Habis menunggu"
                animate={{ value: waitShare, format: (v) => formatPct(v) }}
                size="inline"
              />
            </Meter>
            <div className="min-w-0 flex-1">
              <p className="max-w-prose text-[13px] leading-[20px] text-text-secondary">
                {waitShare > 0.6
                  ? 'Sebagian besar waktu di stage ini bukan waktu kerja, tapi waktu menganggur di antrean. Menambah orang tidak akan memperbaikinya — yang perlu dibenahi kejelasan siapa yang mengambil pekerjaan dan kapan.'
                  : 'Waktu di stage ini didominasi pengerjaan, bukan antrean. Kalau masih terasa lambat, yang perlu dilihat alat kerja, kejelasan instruksi, dan kerumitan kasusnya.'}
              </p>
              {finding && (
                <div className="mt-4 rounded-md bg-bg-surface px-3.5 py-3 ring-1 ring-inset ring-border-soft">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-muted">Diagnosis</p>
                  <div className="mt-1.5">
                    <SeverityBadge level={severityOfScore(finding.score)} size="md">
                      {DRIVER_LABEL[finding.primaryDriver]}
                    </SeverityBadge>
                  </div>
                  <p className="mt-2 text-[13px] leading-[19px] text-text-secondary">{finding.explanation}</p>
                  <p className="mt-2 text-[12px] tabular-nums text-text-muted">
                    Skor bottleneck {finding.score.toFixed(0)} dari 100 · peringkat{' '}
                    {snapshot.bottlenecks.findIndex((b) => b.stageCode === stageCode) + 1} dari{' '}
                    {snapshot.bottlenecks.length} stage
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {metrics && (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MetricTile
          index={1}
                label="Tertahan sekarang"
                animate={{ value: metrics.wip, format: (v) => formatCount(Math.round(v)) }}
                unit="item"
                caption={`${metrics.untouchedWip} belum ada yang pegang`}
              />
              <MetricTile
          index={2}
                label="Tunggu p90"
                value={formatWorkHours(metrics.waitHoursP90)}
                caption={`target ${formatWorkHours(metrics.slaWaitTarget)} · p50 ${formatWorkHours(metrics.waitHoursP50)}`}
                level={metrics.waitHoursP90 > metrics.slaWaitTarget ? 'critical' : 'good'}
              />
              <MetricTile
          index={3}
                label="Kerja p90"
                value={formatWorkHours(metrics.touchHoursP90)}
                caption={`target ${formatWorkHours(metrics.slaTouchTarget)}`}
                level={metrics.touchHoursP90 > metrics.slaTouchTarget ? 'serious' : 'good'}
              />
              <MetricTile
          index={4}
                label="Hari antrean"
                value={metrics.queueDays === 999 ? '∞' : formatDays(metrics.queueDays)}
                unit="hari"
                caption={`${metrics.throughputPerDay}/hari selesai`}
                level={metrics.queueDays > 5 ? 'critical' : metrics.queueDays > 2 ? 'warning' : 'good'}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <SectionCard
          index={5}
                title="Menunggu vs dikerjakan"
                hint="Rata-rata satu item yang lewat stage ini, dalam jam kerja. Pemisahan ini yang menentukan tindakan."
              >
                <WaitTouchBar
                  waitHours={metrics.waitHoursP50}
                  touchHours={metrics.touchHoursP50}
                  format={formatWorkHours}
                  height={22}
                />
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
                      Pelanggaran tunggu
                    </dt>
                    <dd className="mt-0.5 text-[18px] font-bold tabular-nums text-text-primary">
                      {formatPct(metrics.waitBreachRate)}
                    </dd>
                  </div>
                  <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
                      Diulang (rework)
                    </dt>
                    <dd className="mt-0.5 text-[18px] font-bold tabular-nums text-text-primary">
                      {formatPct(metrics.reworkRate)}
                    </dd>
                  </div>
                </dl>
                {metrics.reworkRate > 0.15 && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-[15px] text-text-muted">
                    <AlertTriangle aria-hidden="true" className="mt-px size-3 shrink-0" />
                    Rework di sini berarti masalahnya ada di stage sebelumnya. Kapasitas stage ini terbuang untuk
                    mengulang pekerjaan yang seharusnya benar dari awal.
                  </p>
                )}
              </SectionCard>

              <SectionCard
          index={6} title="Umur pekerjaan tertahan" hint="Kelompok di atas 72 jam butuh tindakan hari ini.">
                <AgingBar aging={metrics.aging} height={22} />
                {quality && (
                  <div className="mt-4 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
                        Kualitas data stage ini
                      </p>
                      <SeverityBadge level={severityOfConfidence(quality.confidence)}>
                        {quality.confidence}
                      </SeverityBadge>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-[15px] text-text-secondary">
                      Cakupan timestamp masuk antrean {quality.arrivedCoveragePct}%, mulai kerja{' '}
                      {quality.startedCoveragePct}%. Jeda pencatatan{' '}
                      {formatWorkHours(quality.medianRecordingLagHours)}.
                    </p>
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
          index={7}
              title="Item paling tua yang masih tertahan"
              hint="Daftar tindakan langsung. Ketuk untuk menelusuri riwayat item itu lintas sektor."
              action={
                <TableViewToggle
                  caption={`Item tertahan — ${stageDef.name}`}
                  headers={['Dokumen', 'Umur (j kerja)', 'PIC', 'Nilai (Rp)', 'Sudah dimulai']}
                  numericColumns={[1, 3]}
                  rows={openItems.map((visit) => {
                    const item = itemById.get(visit.workItemId)
                    return [
                      item?.documentNumber ?? visit.workItemId,
                      Math.round(visit.ageHours ?? 0),
                      visit.actorPersonId ? (personById.get(visit.actorPersonId)?.name ?? '—') : 'belum ada',
                      (item?.amount ?? 0).toLocaleString('id-ID'),
                      visit.startedAt ? 'ya' : 'belum',
                    ]
                  })}
                />
              }
            >
              {openItems.length === 0 ? (
                <p className="text-[12px] text-text-muted">Tidak ada item yang tertahan di stage ini sekarang.</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {openItems.map((visit) => {
                    const item = itemById.get(visit.workItemId)
                    const person = visit.actorPersonId ? personById.get(visit.actorPersonId) : null
                    const age = visit.ageHours ?? 0
                    const level = age > 72 ? 'critical' : age > 24 ? 'serious' : age > 8 ? 'warning' : 'good'
                    return (
                      <li key={visit.workItemId}>
                        <motion.button
                          type="button"
                          onClick={() => navigate(`/opsflow/telusur/${visit.workItemId}`)}
                          whileTap={reduced ? undefined : { scale: 0.995 }}
                          transition={SPRING}
                          className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-2.5 text-left transition-colors duration-fast hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold text-text-primary">
                              {item?.documentNumber ?? visit.workItemId}
                            </span>
                            <span className="block text-[11px] text-text-muted">
                              {person ? `dipegang ${person.name}` : 'belum ada yang mengambil'}
                              {item?.amount ? ` · ${formatIdr(item.amount)}` : ''}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <SeverityBadge level={level}>{formatWorkHours(age)}</SeverityBadge>
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-3.5 text-text-faint transition-transform duration-fast group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            />
                          </span>
                        </motion.button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>
          </>
        )}

        {incidentRows.length > 0 && (
          <SectionCard
          index={8}
            title="Kesalahan yang bersumber di stage ini"
            hint="Dihitung ke stage tempat kesalahan TERJADI, bukan tempat ia ketahuan — kalau dibalik, QC akan terlihat sebagai bagian paling bermasalah padahal justru satu-satunya yang bekerja."
          >
            {/* Satu batang saja bukan grafik — bentuk yang benar untuk satu angka
                adalah angkanya sendiri. */}
            {incidentRows.length >= 2 ? (
              <BarList rows={incidentRows} />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[36px] font-bold leading-[38px] tracking-[-0.02em] text-text-primary">
                  {incidentRows[0]?.value ?? 0}×
                </span>
                <span className="text-[13px] font-semibold text-text-secondary">
                  seluruhnya berjenis{' '}
                  <span className="font-extrabold text-text-primary">
                    {(incidentRows[0]?.label ?? '—').toLowerCase()}
                  </span>
                </span>
              </div>
            )}
          </SectionCard>
        )}

        {/* Definisi stage dari taksonomi — supaya layar dan dokumen tidak pernah berbeda */}
        <SectionCard
          index={9} title="Definisi stage" hint="Diambil langsung dari taksonomi, sumber yang sama dengan dokumennya.">
          <dl className="space-y-2.5">
            <DefRow label="Masuk" value={stageDef.input} />
            <DefRow label="Keluar" value={stageDef.output} />
            {stageDef.gate && <DefRow label="Gerbang" value={stageDef.gate} />}
            <DefRow
              label="Target"
              value={`maksimum ${formatWorkHours(stageDef.slaWaitHours)} mengantre + ${formatWorkHours(stageDef.slaTouchHours)} dikerjakan; eskalasi setelah ${formatWorkHours(stageDef.escalateAfterHours)}`}
            />
          </dl>

          <div className="mt-4 border-t border-border-soft pt-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
              Kesalahan yang paling sering terjadi di sini
            </p>
            <ul className="mt-2 space-y-1.5">
              {stageDef.commonFailures.map((failure) => (
                <li key={failure} className="flex items-start gap-1.5 text-[12px] leading-[17px] text-text-secondary">
                  <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-text-faint" />
                  {failure}
                </li>
              ))}
            </ul>
          </div>

          {stageDef.typicallyEscapesTo && stageDef.typicallyEscapesTo.length > 0 && (
            <div className="mt-4 border-t border-border-soft pt-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
                Kesalahan di sini biasanya baru ketahuan di
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stageDef.typicallyEscapesTo.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => navigate(`/opsflow/stage/${code}`)}
                    className="inline-flex min-h-8 items-center rounded-md border border-border-med bg-bg-surface px-2 text-[11px] font-bold tabular-nums text-text-secondary transition-colors hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </motion.div>
    </OpsflowShell>
  )
}

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="text-[12px] leading-[17px] text-text-secondary">{value}</dd>
    </div>
  )
}

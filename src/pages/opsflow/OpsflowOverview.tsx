/**
 * OpsFlow — Layar pimpinan.
 *
 * Satu pertanyaan yang dijawab halaman ini: di mana macetnya, kenapa, dan
 * berapa nilai yang tertahan di sana.
 *
 * Angka utama halaman ini adalah efisiensi alur, bukan jumlah item atau nilai
 * rupiah. Alasannya: angka itu yang mengubah arah pembenahan. Kalau hanya 36%
 * waktu proses dipakai bekerja, menuntut orang bekerja dua kali lebih cepat
 * hampir tidak mengubah lead time — yang perlu dibenahi antreannya.
 */

import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Clock, TrendingDown } from 'lucide-react'
import { SECTORS, SECTOR_ORDER, type SectorId } from '@/opsflow/taxonomy'
import { WINDOW_OPTIONS, useOpsflowSnapshot, type WindowDays } from '@/opsflow/useOpsflowSnapshot'
import {
  ATTRIBUTION_LABEL,
  DRIVER_LABEL,
  INCIDENT_LABEL,
  SECTOR_COLOR,
  SEVERITY_COLOR,
  TIME_COLOR,
  formatCount,
  formatDays,
  formatIdr,
  formatPct,
  formatWorkHours,
  severityOfConfidence,
  severityOfOnTime,
  severityOfScore,
} from '@/opsflow/viz'
import { BarList, StackedBar, TrendChart, type BarRow, type StackSegment } from '@/components/opsflow/charts'
import {
  Caveats,
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
import { FlowJourneyMap } from '@/components/opsflow/FlowJourneyMap'
import { DURATION, EASE, SPRING, pressable } from '@/components/opsflow/motion'
import { OpsflowShell } from './OpsflowShell'

export default function OpsflowOverview() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const data = useOpsflowSnapshot(windowDays)

  const toolbar = (
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
  )

  if (!data) {
    return (
      <OpsflowShell title="Alur Kerja Ekosistem" subtitle="Menghitung snapshot…" toolbar={toolbar}>
        <DashboardSkeleton />
      </OpsflowShell>
    )
  }

  const { snapshot, source } = data
  const { flow, bottlenecks, incidents, stages, dataQuality, daily } = snapshot

  const top = bottlenecks.slice(0, 8)
  const bottleneckRows: BarRow[] = top.map((finding) => ({
    key: finding.stageCode,
    label: finding.stageName,
    sublabel: finding.team,
    value: finding.score,
    valueLabel: finding.score.toFixed(0),
    color: SEVERITY_COLOR[severityOfScore(finding.score)],
    badge: <SeverityBadge level={severityOfScore(finding.score)}>{DRIVER_LABEL[finding.primaryDriver]}</SeverityBadge>,
    tip: (
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-text-primary">
          {finding.stageCode} · {finding.stageName}
        </p>
        <p className="text-[11px] leading-[15px] text-text-secondary">{finding.explanation}</p>
        {finding.valueStuckIdr > 0 && (
          <p className="text-[11px] tabular-nums text-text-secondary">
            Nilai tertahan {formatIdr(finding.valueStuckIdr)}
          </p>
        )}
      </div>
    ),
    onClick: () => navigate(`/opsflow/stage/${finding.stageCode}`),
  }))

  const waitBySector: StackSegment[] = SECTOR_ORDER.map((sectorId) => ({
    key: sectorId,
    label: SECTORS[sectorId].name,
    value: Math.round(flow.waitHoursBySector[sectorId] ?? 0),
    color: SECTOR_COLOR[sectorId],
  }))

  const paretoRows: BarRow[] = incidents.paretoTop.slice(0, 6).map((pattern, index) => ({
    key: `${pattern.stageCode}-${pattern.type}-${index}`,
    label: INCIDENT_LABEL[pattern.type] ?? pattern.type,
    sublabel: pattern.stageCode,
    value: pattern.count,
    valueLabel: `${pattern.count}×`,
    color: TIME_COLOR.wait,
    badge: (
      <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
        kumulatif {formatPct(pattern.cumulativeShare)}
      </span>
    ),
    onClick: () => navigate(`/opsflow/stage/${pattern.stageCode}`),
  }))

  const attributionSegments: StackSegment[] = Object.entries(incidents.byAttribution).map(([key, count]) => ({
    key,
    label: ATTRIBUTION_LABEL[key] ?? key,
    value: count,
    color:
      key === 'person'
        ? SEVERITY_COLOR.critical
        : key === 'process'
          ? SEVERITY_COLOR.serious
          : key === 'system'
            ? SEVERITY_COLOR.warning
            : SEVERITY_COLOR.good,
  }))

  const lowConfidence = dataQuality.filter((q) => q.confidence === 'low' || q.confidence === 'insufficient')
  const systemicPatterns = incidents.recurringPatterns.filter((p) => p.systemic)

  // Efisiensi alur: makin rendah makin buruk, jadi ambangnya dibalik.
  // Di perusahaan besar yang belum membenahi alur, 5–15% adalah hal biasa —
  // ambang di bawah ini disetel terhadap kenyataan itu, bukan terhadap angka ideal.
  const flowEfficiencyLevel =
    flow.flowEfficiency >= 0.4
      ? 'good'
      : flow.flowEfficiency >= 0.25
        ? 'warning'
        : flow.flowEfficiency >= 0.12
          ? 'serious'
          : 'critical'

  return (
    <OpsflowShell
      title="Alur Kerja Ekosistem"
      subtitle={`Pembelian → Finance → Produksi → Pengiriman · snapshot ${new Date(snapshot.snapshotAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB`}
      source={source}
      toolbar={toolbar}
    >
      {/* Konten di-crossfade saat jendela filter berubah — bukan diganti skeleton.
          Skeleton yang berkedip di setiap penggantian filter terasa lebih lambat
          daripada konten lama yang diredupkan sebentar. */}
      <motion.div
        key={windowDays}
        initial={reduced ? false : { opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.enter, ease: EASE.out }}
        className="space-y-3"
      >
        {/* Angka utama — tepat satu per halaman, di dalam meter cincin */}
        <section className="opsflow-enter relative overflow-hidden rounded-lg bg-bg-elevated px-4 py-6 shadow-glass ring-1 ring-inset ring-border-soft md:px-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          />
          {/* Sorotan sangat lembut di belakang meter — memberi kedalaman tanpa
              menambah warna yang bisa tertukar dengan warna data. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-accent-light/25 blur-3xl"
          />
          <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-9">
            <Meter
              fraction={flow.flowEfficiency}
              level={flowEfficiencyLevel}
              size={196}
              thickness={13}
              ariaLabel={`Efisiensi alur ${formatPct(flow.flowEfficiency)}`}
            >
              <HeroFigure
                label="Efisiensi alur"
                animate={{ value: flow.flowEfficiency, format: (v) => formatPct(v) }}
                size="inline"
              />
            </Meter>

            <div className="min-w-0 flex-1">
              <p className="max-w-prose text-[13px] leading-[20px] text-text-secondary">
                Dari seluruh waktu proses, hanya sebesar itu yang dipakai untuk benar-benar bekerja. Sisanya menunggu
                di antrean. Artinya memotong waktu tunggu jauh lebih berpengaruh pada lead time daripada menuntut
                orang bekerja lebih cepat.
              </p>

              <div className="mt-4 rounded-md bg-bg-surface px-3.5 py-3 ring-1 ring-inset ring-border-soft">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-muted">
                  Kesimpulan sistem
                </p>
                <p className="mt-1.5 text-[13px] font-semibold leading-[19px] text-text-primary">
                  {snapshot.headline}
                </p>
              </div>

              {bottlenecks[0] && (
                <motion.button
                  type="button"
                  onClick={() => navigate(`/opsflow/stage/${bottlenecks[0].stageCode}`)}
                  whileHover={reduced ? undefined : { y: -2 }}
                  whileTap={reduced ? undefined : pressable.whileTap}
                  transition={SPRING}
                  className="group mt-3 inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill bg-text-primary px-4 text-[12px] font-bold text-white shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Buka {bottlenecks[0].stageName}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
                  />
                </motion.button>
              )}
            </div>
          </div>
        </section>

        {/* Kartu metrik */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricTile
          index={1}
            label="Lead time p90"
            animate={{ value: flow.leadTimeDaysP90, format: formatDays }}
            unit="hari"
            caption={`p50 ${formatDays(flow.leadTimeDaysP50)} hari`}
            spark={daily.map((d) => d.wip)}
          />
          <MetricTile
          index={2}
            label="Ketepatan janji"
            animate={{ value: flow.onTimePct / 100, format: (v) => formatPct(v) }}
            level={severityOfOnTime(flow.onTimePct)}
            caption={`${flow.completed} selesai`}
          />
          <MetricTile
          index={3}
            label="Lewat tanggal janji"
            animate={{ value: flow.overdueOpen, format: (v) => formatCount(Math.round(v)) }}
            unit="item"
            caption="masih berjalan"
            level={flow.overdueOpen > 0 ? 'serious' : 'good'}
          />
          <MetricTile
          index={4}
            label="Kesalahan lolos"
            animate={{ value: incidents.escapeRate, format: (v) => formatPct(v) }}
            caption={`rata-rata ${formatDays(incidents.avgEscapeDistance)} stage setelah terjadi`}
            level={incidents.escapeRate > 0.5 ? 'critical' : incidents.escapeRate > 0.25 ? 'serious' : 'warning'}
          />
        </div>

        {/* Peta alur */}
        <SectionCard
          index={5}
          title="Peta perjalanan pekerjaan"
          hint="Satu rute dari permintaan barang sampai penagihan, melewati 32 stage di empat sektor. Ketuk stasiun untuk melihat sebab macetnya, ketuk nama sektor untuk melihat sub-timnya."
        >
          <FlowJourneyMap
            stages={stages}
            bottlenecks={bottlenecks}
            onSelectStage={(code: string) => navigate(`/opsflow/stage/${code}`)}
            onSelectSector={(sector: SectorId) => navigate(`/opsflow/sektor/${sector}`)}
          />
        </SectionCard>

        {/* Peringkat bottleneck */}
        <SectionCard
          index={6}
          title="Titik macet, diurutkan"
          hint="Panjang batang = skor bottleneck 0–100 (antrean, waktu tunggu vs target, pelanggaran SLA, pengulangan, kesalahan). Lencana menyebut pemicu utamanya."
          action={
            <TableViewToggle
              caption="Titik macet — semua stage"
              headers={['Kode', 'Stage', 'Sub-tim', 'Skor', 'Pemicu', 'Tertahan', 'Nilai (Rp)']}
              numericColumns={[3, 5, 6]}
              rows={bottlenecks.map((b) => [
                b.stageCode,
                b.stageName,
                b.team,
                b.score.toFixed(1),
                DRIVER_LABEL[b.primaryDriver] ?? b.primaryDriver,
                b.itemsStuck,
                b.valueStuckIdr.toLocaleString('id-ID'),
              ])}
            />
          }
        >
          <BarList rows={bottleneckRows} max={100} ranked />
        </SectionCard>

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {/* Tren */}
          <SectionCard
          index={7}
            title="Tren harian"
            hint="Penyelesaian per hari dibanding yang melewati SLA. Kalau garis pelanggaran naik seiring penyelesaian, kapasitasnya yang kurang."
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

          {/* Waktu tunggu per sektor */}
          <SectionCard
          index={8}
            title="Waktu tunggu per sektor"
            hint="Total jam kerja yang hilang di antrean, dipecah per sektor. Ini penyumbang lead time terbesar, bukan waktu pengerjaan."
            action={
              <TableViewToggle
                caption="Waktu tunggu per sektor"
                headers={['Sektor', 'Jam tunggu']}
                numericColumns={[1]}
                rows={waitBySector.map((s) => [s.label, s.value.toLocaleString('id-ID')])}
              />
            }
          >
            <StackedBar segments={waitBySector} format={(v) => formatWorkHours(v)} height={20} />

            {/* Angka per sektor ditulis eksplisit. Tiga dari empat warna sektor
                duduk di bawah 3:1 pada sebagian permukaan, dan aturan keringanan
                kontras mewajibkan label terbaca atau tampilan tabel — di sini
                keduanya ada. */}
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {waitBySector.map((segment) => (
                <div
                  key={segment.key}
                  className="flex items-baseline justify-between gap-2 rounded-md bg-bg-surface px-2.5 py-2 ring-1 ring-inset ring-border-soft"
                >
                  <dt className="inline-flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="truncate text-[11px] font-semibold text-text-secondary">{segment.label}</span>
                  </dt>
                  <dd className="shrink-0 text-[12px] font-bold tabular-nums text-text-primary">
                    {formatWorkHours(segment.value)}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-[15px] text-text-muted">
              <Clock aria-hidden="true" className="mt-px size-3 shrink-0" />
              Angka ini jam kerja, sudah memperhitungkan akhir pekan dan hari libur.
            </p>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {/* Pareto kesalahan */}
          <SectionCard
          index={9}
            title="Kesalahan paling sering"
            hint="Biasanya 3–4 pola menyumbang lebih dari separuh seluruh kesalahan. Ini daftar pekerjaan perbaikan, sudah dalam urutan yang benar."
            action={
              <TableViewToggle
                caption="Pola kesalahan berulang"
                headers={['Stage', 'Jenis', 'Jumlah', 'Orang berbeda', 'Sistemik']}
                numericColumns={[2, 3]}
                rows={incidents.recurringPatterns.map((p) => [
                  p.stageCode,
                  INCIDENT_LABEL[p.type] ?? p.type,
                  p.count,
                  p.distinctPeople,
                  p.systemic ? 'ya' : 'tidak',
                ])}
              />
            }
          >
            <BarList rows={paretoRows} />
          </SectionCard>

          {/* Atribusi */}
          <SectionCard
          index={10}
            title="Kesalahan itu soal orang atau soal proses?"
            hint="Jenis kesalahan yang sama, di stage yang sama, oleh 3 orang berbeda dalam 30 hari otomatis dipindah dari 'individu' ke 'proses' dan namanya dihapus."
          >
            {/* Batang bertumpuk berisi satu kategori adalah grafik yang tidak
                mengatakan apa pun — bentuk yang benar untuk satu angka adalah
                angkanya sendiri. Ini bukan kasus teoretis: setelah reklasifikasi
                otomatis, seluruh insiden bisa jatuh ke satu atribusi. */}
            {attributionSegments.length >= 2 ? (
              <StackedBar segments={attributionSegments} format={(v) => `${v} kesalahan`} height={20} showLegend />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[36px] font-bold leading-[38px] tracking-[-0.02em] text-text-primary">
                  {attributionSegments[0]?.value ?? 0}
                </span>
                <span className="text-[13px] font-semibold text-text-secondary">
                  kesalahan, seluruhnya beratribusi{' '}
                  <span className="font-extrabold text-text-primary">
                    {(attributionSegments[0]?.label ?? '—').toLowerCase()}
                  </span>
                </span>
              </div>
            )}
            <div className="mt-4 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-text-primary">
                <TrendingDown aria-hidden="true" className="size-3.5" />
                {systemicPatterns.length} pola dinyatakan sistemik
              </p>
              <p className="mt-1 text-[11px] leading-[15px] text-text-secondary">
                Pola sistemik tidak berhenti dengan mengganti orang — yang perlu diubah prosedur, validasi sistem,
                atau beban kerjanya.
              </p>
              {incidents.customerDetectedCount > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-[15px] text-text-secondary">
                  <AlertTriangle aria-hidden="true" className="mt-px size-3 shrink-0" />
                  {incidents.customerDetectedCount} kesalahan baru ketahuan dari komplain pelanggan. Angka ini
                  idealnya nol — setiap satu berarti seluruh rantai kontrol internal gagal untuk kasus itu.
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Kualitas data — ditampilkan, bukan disembunyikan */}
        <SectionCard
          index={11}
          title="Kualitas data"
          hint="Stage yang datanya belum cukup ditandai apa adanya. Dashboard yang menampilkan angka meyakinkan dari data setengah kosong lebih berbahaya daripada tidak ada dashboard."
          action={
            <TableViewToggle
              caption="Kualitas data per stage"
              headers={['Stage', 'Cakupan masuk antrean', 'Cakupan mulai kerja', 'Jeda catat (j)', 'Kepercayaan']}
              numericColumns={[1, 2, 3]}
              rows={dataQuality.map((q) => [
                q.stageCode,
                `${q.arrivedCoveragePct}%`,
                `${q.startedCoveragePct}%`,
                q.medianRecordingLagHours,
                q.confidence,
              ])}
            />
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {dataQuality.map((q) => (
              <span
                key={q.stageCode}
                className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-bg-surface px-1.5 py-0.5"
              >
                <span className="text-[10px] font-bold tabular-nums text-text-secondary">{q.stageCode}</span>
                <SeverityBadge level={severityOfConfidence(q.confidence)}>{q.confidence}</SeverityBadge>
              </span>
            ))}
          </div>
          {lowConfidence.length > 0 && (
            <Caveats
              items={[
                `${lowConfidence.length} stage belum bisa dipercaya angkanya: ${lowConfidence.map((q) => q.stageCode).join(', ')}. Perbaiki pencatatannya sebelum menarik kesimpulan dari stage itu.`,
              ]}
            />
          )}
        </SectionCard>
      </motion.div>
    </OpsflowShell>
  )
}

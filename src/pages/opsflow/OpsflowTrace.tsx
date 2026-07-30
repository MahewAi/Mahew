/**
 * OpsFlow — Penelusuran satu objek kerja lintas sektor.
 *
 * Ini jawaban untuk pertanyaan yang paling sering ditanyakan manajemen:
 * "kenapa order ini telat?" — dan jawabannya sering ada di sektor lain.
 *
 * Garis waktunya menyatukan beberapa objek kerja yang saling terkait (permintaan
 * barang → PO → penerimaan → tagihan → pembayaran, dan order produksi → surat
 * jalan), karena tidak ada satu "order" tunggal yang mengalir dari pembelian
 * sampai pengiriman. Yang menghubungkannya adalah tautan antar objek kerja.
 */

import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { SECTORS } from '@/opsflow/taxonomy'
import { WINDOW_OPTIONS, useOpsflowSnapshot, type WindowDays } from '@/opsflow/useOpsflowSnapshot'
import { traceWorkItem } from '@/opsflow/metrics'
import {
  SECTOR_COLOR,
  TIME_COLOR,
  WORK_ITEM_LABEL,
  formatDateTime,
  formatIdr,
  formatPct,
  formatWorkHours,
} from '@/opsflow/viz'
import { WaitTouchBar } from '@/components/opsflow/charts'
import {
  DashboardSkeleton,
  FilterChip,
  FilterRow,
  Legend,
  MetricTile,
  SectionCard,
  SeverityBadge,
  TableViewToggle,
} from '@/components/opsflow/primitives'
import { DURATION, EASE, SPRING } from '@/components/opsflow/motion'
import { OpsflowShell } from './OpsflowShell'
import { cn } from '@/lib/utils'

export default function OpsflowTrace() {
  const params = useParams<{ workItemId?: string }>()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const data = useOpsflowSnapshot(windowDays)
  const workItemId = params.workItemId ?? ''

  const steps = useMemo(() => {
    if (!data) return []
    return traceWorkItem(data.dataset, data.visits, workItemId)
  }, [data, workItemId])

  if (!data) {
    return (
      <OpsflowShell title="Penelusuran" subtitle="Menghitung snapshot…">
        <DashboardSkeleton />
      </OpsflowShell>
    )
  }

  const { dataset, source } = data
  const rootItem = dataset.workItems.find((i) => i.id === workItemId)

  if (!rootItem || steps.length === 0) {
    return (
      <OpsflowShell title="Objek kerja tidak ditemukan" source={source}>
        <p className="text-[13px] text-text-secondary">
          Tidak ada riwayat untuk <span className="font-bold">{workItemId}</span>.
        </p>
      </OpsflowShell>
    )
  }

  const totalWait = steps.reduce((sum, s) => sum + (s.waitHours ?? 0), 0)
  const totalTouch = steps.reduce((sum, s) => sum + (s.touchHours ?? 0), 0)
  const efficiency = totalWait + totalTouch > 0 ? totalTouch / (totalWait + totalTouch) : 0
  const worst = steps.find((s) => s.isWorstDelay)
  const sectorsTouched = [...new Set(steps.map((s) => s.sector))]
  const breached = steps.filter((s) => s.breached).length
  const documents = [...new Set(steps.map((s) => s.documentNumber))]

  return (
    <OpsflowShell
      title={rootItem.documentNumber}
      subtitle={`${WORK_ITEM_LABEL[rootItem.type] ?? rootItem.type} · menyentuh ${sectorsTouched.length} sektor · ${documents.length} dokumen terkait`}
      source={source}
      backTo="/opsflow"
      backLabel="Ikhtisar"
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
          index={1} label="Total menunggu" value={formatWorkHours(totalWait)} caption="di seluruh rantai" />
          <MetricTile
          index={2} label="Total dikerjakan" value={formatWorkHours(totalTouch)} caption="di seluruh rantai" />
          <MetricTile
          index={3}
            label="Efisiensi rantai"
            animate={{ value: efficiency, format: (v) => formatPct(v) }}
            caption="waktu kerja ÷ total waktu"
            level={efficiency < 0.2 ? 'critical' : efficiency < 0.4 ? 'serious' : 'warning'}
          />
          <MetricTile
          index={4}
            label="Lewat SLA"
            value={`${breached}`}
            unit={`/ ${steps.length}`}
            caption="langkah"
            level={breached > steps.length / 3 ? 'critical' : breached > 0 ? 'warning' : 'good'}
          />
        </div>

        {worst && (
          <SectionCard
          index={5}
            title="Penyumbang keterlambatan terbesar"
            hint="Satu langkah yang paling banyak menahan rantai ini. Sering kali bukan di sektor yang dikeluhkan."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: SECTOR_COLOR[worst.sector] }}
              />
              <span className="text-[14px] font-extrabold text-text-primary">{worst.stageName}</span>
              <span className="text-[11px] text-text-muted">
                {SECTORS[worst.sector].name} · {worst.documentNumber}
              </span>
              <SeverityBadge level="critical">
                <Flame aria-hidden="true" className="size-3" />
                {formatWorkHours((worst.waitHours ?? 0) + (worst.touchHours ?? 0))}
              </SeverityBadge>
            </div>
            <p className="mt-2 text-[12px] leading-[17px] text-text-secondary">
              Menunggu {formatWorkHours(worst.waitHours)} · dikerjakan {formatWorkHours(worst.touchHours)}
              {worst.actorPersonName ? ` · ditangani ${worst.actorPersonName}` : ' · belum ada yang mengambil'}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/opsflow/stage/${worst.stageCode}`)}
              className="mt-3 inline-flex min-h-9 items-center rounded-md border border-border-med bg-bg-surface px-3 text-[12px] font-bold text-text-secondary transition-colors hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Buka stage {worst.stageCode}
            </button>
          </SectionCard>
        )}

        <SectionCard
          index={6}
          title="Garis waktu"
          hint="Panjang batang tiap langkah menunjukkan pembagian antara menunggu dan dikerjakan. Warna titik di kiri menandai sektornya."
          action={
            <TableViewToggle
              caption={`Garis waktu — ${rootItem.documentNumber}`}
              headers={['Stage', 'Dokumen', 'Sektor', 'Masuk antrean', 'Selesai', 'Tunggu (j)', 'Kerja (j)', 'PIC']}
              numericColumns={[5, 6]}
              rows={steps.map((step) => [
                `${step.stageCode} ${step.stageName}`,
                step.documentNumber,
                SECTORS[step.sector].name,
                formatDateTime(step.arrivedAt),
                formatDateTime(step.completedAt),
                step.waitHours ?? '—',
                step.touchHours ?? '—',
                step.actorPersonName ?? 'belum ada',
              ])}
            />
          }
        >
          <Legend
            items={[
              { color: TIME_COLOR.wait, label: 'Menunggu' },
              { color: TIME_COLOR.touch, label: 'Dikerjakan' },
            ]}
            className="mb-3"
          />
          <ol className="relative space-y-0">
            {steps.map((step, index) => {
              const total = (step.waitHours ?? 0) + (step.touchHours ?? 0)
              return (
                <li
                  key={`${step.workItemId}-${step.stageCode}-${index}`}
                  style={{ '--i': index } as CSSProperties}
                  className="opsflow-enter relative flex gap-3 pb-4"
                >
                  {/* Rel vertikal hairline */}
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[5px] top-4 h-full w-px bg-border-med"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-bg-app',
                    )}
                    style={{ backgroundColor: SECTOR_COLOR[step.sector] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/opsflow/stage/${step.stageCode}`)}
                        className="text-left text-[13px] font-bold text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      >
                        {step.stageName}
                      </button>
                      <span className="text-[10px] tabular-nums text-text-muted">
                        {formatDateTime(step.arrivedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {step.stageCode} · {step.documentNumber} · {WORK_ITEM_LABEL[step.type] ?? step.type}
                      {step.actorPersonName ? ` · ${step.actorPersonName}` : ''}
                    </p>
                    {total > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <WaitTouchBar
                            waitHours={step.waitHours ?? 0}
                            touchHours={step.touchHours ?? 0}
                            format={formatWorkHours}
                            showLegend={false}
                            height={10}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-text-secondary">
                          {formatWorkHours(total)}
                        </span>
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {step.isWorstDelay && (
                        <SeverityBadge level="critical">Penahan terbesar</SeverityBadge>
                      )}
                      {step.breached && !step.isWorstDelay && <SeverityBadge level="serious">Lewat SLA</SeverityBadge>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </SectionCard>

        <SectionCard
          index={7}
          title="Dokumen yang terhubung"
          hint="Rantai pengadaan dan rantai pemenuhan bertemu di sini — inilah yang membuat sebabnya bisa ditelusuri ke sektor lain."
        >
          <ul className="flex flex-wrap gap-1.5">
            {steps
              .filter((step, index, all) => all.findIndex((s) => s.workItemId === step.workItemId) === index)
              .map((step) => {
                const item = dataset.workItems.find((i) => i.id === step.workItemId)
                return (
                  <li key={step.workItemId}>
                    <motion.button
                      type="button"
                      onClick={() => navigate(`/opsflow/telusur/${step.workItemId}`)}
                      whileTap={reduced ? undefined : { scale: 0.97 }}
                      transition={SPRING}
                      className={cn(
                        'inline-flex min-h-touch cursor-pointer flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                        step.workItemId === workItemId
                          ? 'border-text-primary bg-text-primary'
                          : 'border-border-med bg-bg-surface hover:bg-bg-soft',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[11px] font-bold tabular-nums',
                          step.workItemId === workItemId ? 'text-white' : 'text-text-primary',
                        )}
                      >
                        {step.documentNumber}
                      </span>
                      <span
                        className={cn(
                          'text-[10px]',
                          step.workItemId === workItemId ? 'text-white/75' : 'text-text-muted',
                        )}
                      >
                        {WORK_ITEM_LABEL[step.type] ?? step.type}
                        {item?.amount ? ` · ${formatIdr(item.amount)}` : ''}
                      </span>
                    </motion.button>
                  </li>
                )
              })}
          </ul>
        </SectionCard>
      </motion.div>
    </OpsflowShell>
  )
}

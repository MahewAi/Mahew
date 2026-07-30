/**
 * OpsFlow — Kotak Kerja.
 *
 * Halaman tempat pekerjaan benar-benar dikerjakan: apa yang menunggu saya, apa
 * yang harus saya lakukan, dan tombol untuk melakukannya. Inilah pengganti
 * WhatsApp — bukan dashboard-nya.
 *
 * Ada pemilih peran di atas. Di sistem sungguhan peran datang dari login; di
 * tahap ini pemilih itu justru berguna, karena satu orang bisa menelusuri
 * seluruh alur dari ujung ke ujung dan melihat sendiri bagaimana pekerjaan
 * berpindah tangan — hal yang paling sulit dijelaskan lewat dokumen.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Inbox, Plus, RotateCcw } from 'lucide-react'
import { SECTORS, allTeams, getStage } from '@/opsflow/taxonomy'
import { useWorkStore, inboxForTeam } from '@/opsflow/useWorkStore'
import { ACTIONS, actionsForItem } from '@/opsflow/workflow'
import { resetStore } from '@/opsflow/store'
import { commit, nextDocumentNumber, nextEventId } from '@/opsflow/store'
import { SECTOR_COLOR, WORK_ITEM_LABEL, formatIdr, formatWorkHours } from '@/opsflow/viz'
import { iconForStage } from '@/opsflow/stageIcons'
import { MetricTile, SectionCard, SeverityBadge } from '@/components/opsflow/primitives'
import { OpsflowShell } from './OpsflowShell'
import { cn } from '@/lib/utils'

/** Sub-tim yang punya aksi di katalog — hanya ini yang berguna dipilih sekarang. */
const TEAMS_WITH_ACTIONS = [...new Set(ACTIONS.map((a) => a.team))]

export default function OpsflowWork() {
  const navigate = useNavigate()
  const { dataset, visits } = useWorkStore()
  // Peran awal dipilih dari yang benar-benar punya pekerjaan menunggu. Membuka
  // sistem baru lalu melihat kotak kosong memberi kesan salah — bukan "sedang
  // lancar", tapi "tidak ada apa-apa di sini". Yang harus terlihat pertama adalah
  // pekerjaan yang nyata.
  const [teamName, setTeamName] = useState(() => {
    const busiest = TEAMS_WITH_ACTIONS.map((name) => ({
      name,
      count: inboxForTeam(dataset, visits, name, actionsForItem).length,
    })).sort((a, b) => b.count - a.count)[0]
    return busiest && busiest.count > 0 ? busiest.name : TEAMS_WITH_ACTIONS[0]
  })
  const [creating, setCreating] = useState<null | 'purchase_request' | 'sales_order'>(null)

  const teamMeta = allTeams().find((t) => t.team === teamName)

  const inbox = useMemo(
    () => inboxForTeam(dataset, visits, teamName, actionsForItem),
    [dataset, visits, teamName],
  )

  const overdue = inbox.filter((row) => {
    const stage = getStage(row.item.currentStageCode)
    return stage ? row.ageHours > stage.escalateAfterHours : false
  })

  const totalValue = inbox.reduce((sum, row) => sum + (row.item.amount ?? 0), 0)

  /**
   * Buat dokumen awal. Hanya dua jenis yang lahir tanpa induk: permintaan barang
   * dan pesanan pelanggan. Sisanya selalu lahir dari aksi pada dokumen lain —
   * itu yang mencegah PO muncul tanpa permintaan, atau surat jalan tanpa produksi.
   */
  const createRoot = (type: 'purchase_request' | 'sales_order', values: Record<string, string>) => {
    const now = new Date().toISOString()
    const prefix = type === 'purchase_request' ? 'PR' : 'SO'
    const documentNumber = nextDocumentNumber(prefix, now)
    const stageCode = type === 'purchase_request' ? 'PROC-10' : 'DEL-10'
    const id = `WI-${documentNumber}`

    commit({
      at: now,
      newItems: [
        {
          id,
          type,
          documentNumber,
          externalId: documentNumber,
          sourceSystem: 'opsflow',
          currentStageCode: stageCode,
          status: 'open',
          createdAt: now,
          closedAt: null,
          amount: values.nilai ? Number(values.nilai) : undefined,
          priority: (values.prioritas as 'normal' | 'urgent' | 'critical') ?? 'normal',
          links: [],
          refs: {
            itemIds: values.kode_item ? [values.kode_item] : undefined,
            supplierId: type === 'purchase_request' ? values.mitra || undefined : undefined,
            customerId: type === 'sales_order' ? values.mitra || undefined : undefined,
          },
          extra: { keterangan: values.keterangan ?? '' },
        },
      ],
      events: [
        {
          id: nextEventId(),
          workItemId: id,
          stageCode,
          type: 'arrived',
          occurredAt: now,
          recordedAt: now,
          actorPersonId: null,
          recordedBy: 'opsflow-ui',
          recordingLagHours: 0,
        },
      ],
    })

    setCreating(null)
    navigate(`/kerja/dokumen/${id}`)
  }

  return (
    <OpsflowShell
      title="Kotak Kerja"
      subtitle="Pekerjaan yang menunggu tindakan Anda. Setiap tindakan tercatat siapa dan kapan — dan langsung terbaca di dashboard."
      backTo="/opsflow"
      backLabel="Dashboard"
      accentColor={teamMeta ? SECTOR_COLOR[teamMeta.sector] : undefined}
      toolbar={
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {/*
            Lebar <select> ditentukan oleh pilihan terpanjang — di sini nama
            sub-tim plus nama sektor, yang meluber di layar ponsel. Jadi lebarnya
            dibatasi eksplisit dan dibiarkan turun baris, bukan dibiarkan
            mendorong seluruh halaman ke samping.
          */}
          <label className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:w-auto">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-muted">
              Saya bekerja sebagai
            </span>
            <select
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className={cn(
                'min-h-touch w-full min-w-0 max-w-full cursor-pointer truncate rounded-pill bg-bg-elevated px-3 text-[12px] font-bold text-text-primary',
                'shadow-soft ring-1 ring-inset ring-border-med',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'sm:w-auto sm:max-w-[300px]',
              )}
            >
              {TEAMS_WITH_ACTIONS.map((name) => {
                const meta = allTeams().find((t) => t.team === name)
                return (
                  <option key={name} value={name}>
                    {name}
                    {meta ? ` — ${SECTORS[meta.sector].name}` : ''}
                  </option>
                )
              })}
            </select>
          </label>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricTile
            index={1}
            label="Menunggu saya"
            value={String(inbox.length)}
            unit="dokumen"
            caption={teamName}
          />
          <MetricTile
            index={2}
            label="Lewat batas eskalasi"
            value={String(overdue.length)}
            unit="dokumen"
            level={overdue.length > 0 ? 'critical' : 'good'}
            caption="perlu ditangani hari ini"
          />
          <MetricTile
            index={3}
            label="Nilai tertahan di tangan saya"
            value={formatIdr(totalValue)}
            caption="total dokumen di kotak ini"
          />
          <MetricTile
            index={4}
            label="Paling lama menunggu"
            value={inbox.length > 0 ? formatWorkHours(inbox[0].ageHours) : '—'}
            caption={inbox.length > 0 ? inbox[0].item.documentNumber : 'kotak kerja kosong'}
            level={inbox.length > 0 && inbox[0].ageHours > 24 ? 'serious' : 'good'}
          />
        </div>

        {/* Membuat dokumen awal */}
        <SectionCard
          index={5}
          title="Mulai pekerjaan baru"
          hint="Hanya dua dokumen yang bisa lahir tanpa induk. Sisanya selalu lahir dari tindakan pada dokumen lain — itu yang mencegah PO muncul tanpa permintaan, atau surat jalan tanpa produksi."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreating('purchase_request')}
              className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill bg-text-primary px-4 text-[12px] font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Permintaan barang (PR)
            </button>
            <button
              type="button"
              onClick={() => setCreating('sales_order')}
              className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill bg-bg-surface px-4 text-[12px] font-bold text-text-primary shadow-soft ring-1 ring-inset ring-border-med transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Pesanan pelanggan (SO)
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Kembalikan ke riwayat simulasi awal? Dokumen yang Anda buat sendiri akan hilang.')) {
                  resetStore()
                }
              }}
              className="ml-auto inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill px-3 text-[11px] font-bold text-text-muted ring-1 ring-inset ring-border-soft transition-colors hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Mulai ulang demo
            </button>
          </div>

          {creating && <CreateForm type={creating} onCancel={() => setCreating(null)} onSubmit={createRoot} />}
        </SectionCard>

        {/* Kotak masuk */}
        <SectionCard
          index={6}
          title={`Menunggu tindakan ${teamName}`}
          hint="Diurutkan dari yang paling lama menunggu — itu urutan yang benar untuk dikerjakan, dan yang paling mungkin sudah jadi masalah di tempat lain."
        >
          {inbox.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Inbox aria-hidden="true" className="size-8 text-text-faint" />
              <p className="text-[13px] font-bold text-text-primary">Tidak ada yang menunggu tindakan Anda</p>
              <p className="max-w-sm text-[12px] leading-[17px] text-text-muted">
                Ganti peran di atas untuk melihat kotak kerja sub-tim lain, atau mulai permintaan barang baru untuk
                menjalankan alurnya dari awal.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border-soft">
              {inbox.map((row) => {
                const stage = getStage(row.item.currentStageCode)
                const Icon = iconForStage(row.item.currentStageCode)
                const late = stage ? row.ageHours > stage.escalateAfterHours : false
                const mine = row.actions.filter((a) => a.team === teamName)

                return (
                  <li key={row.item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/kerja/dokumen/${row.item.id}`)}
                      className="group flex w-full items-center gap-3 rounded-md px-1.5 py-3 text-left transition-colors duration-fast hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated"
                        style={{
                          boxShadow: `0 0 0 2px ${stage ? SECTOR_COLOR[stage.sector] : '#ccc'}`,
                        }}
                      >
                        <Icon className="size-4" style={{ color: stage ? SECTOR_COLOR[stage.sector] : undefined }} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[13px] font-bold text-text-primary">{row.item.documentNumber}</span>
                          <span className="text-[11px] text-text-muted">
                            {WORK_ITEM_LABEL[row.item.type] ?? row.item.type}
                          </span>
                          {row.item.amount ? (
                            <span className="text-[11px] font-bold tabular-nums text-text-secondary">
                              {formatIdr(row.item.amount)}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-text-secondary">
                          {stage ? `${stage.code} ${stage.name}` : row.item.currentStageCode} ·{' '}
                          <span className="font-semibold text-text-primary">{mine[0]?.label ?? 'menunggu'}</span>
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        <SeverityBadge level={late ? 'critical' : row.ageHours > 8 ? 'warning' : 'good'}>
                          {formatWorkHours(row.ageHours)}
                        </SeverityBadge>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5"
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          index={7}
          title="Kenapa lewat sistem, bukan WhatsApp"
          hint="Tiga hal yang tidak bisa dilakukan pesan chat, dan semuanya berjalan otomatis di sini."
        >
          <ul className="space-y-3">
            {[
              {
                title: 'Gerbang yang menolak, bukan mengingatkan',
                body: 'Surat jalan tidak bisa terbit sebelum QC akhir lolos. Produksi tidak bisa jalan sebelum material lolos QC masuk. Sistem menolak dan menyebutkan alasannya — di chat, semua itu bergantung pada seseorang ingat memeriksa.',
              },
              {
                title: 'Nomor dokumen dan tautan terbentuk sendiri',
                body: 'PO lahir dari PR yang disetujui, surat jalan lahir dari produksi yang lolos QC. Tautannya otomatis, jadi pertanyaan "PO ini dari permintaan mana" selalu punya jawaban.',
              },
              {
                title: 'Jejak yang tidak bisa dibantah',
                body: 'Setiap tindakan tercatat siapa dan kapan, dan catatan itu langsung menjadi angka di dashboard. Tidak ada pencatatan kedua, jadi tidak ada celah antara yang dikerjakan dan yang dilaporkan.',
              },
            ].map((point) => (
              <li key={point.title} className="rounded-md bg-bg-surface px-3.5 py-3 ring-1 ring-inset ring-border-soft">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-text-primary">
                  <Building2 aria-hidden="true" className="size-3.5 text-text-muted" />
                  {point.title}
                </p>
                <p className="mt-1 text-[11px] leading-[16px] text-text-secondary">{point.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </OpsflowShell>
  )
}

// ============================================================
// Form dokumen awal
// ============================================================

function CreateForm({
  type,
  onCancel,
  onSubmit,
}: {
  type: 'purchase_request' | 'sales_order'
  onCancel: () => void
  onSubmit: (type: 'purchase_request' | 'sales_order', values: Record<string, string>) => void
}) {
  const { dataset } = useWorkStore()
  const [values, setValues] = useState<Record<string, string>>({ prioritas: 'normal' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isPr = type === 'purchase_request'
  const partners = isPr ? dataset.suppliers : dataset.customers
  const items = isPr ? dataset.items.filter((i) => i.kind === 'raw') : dataset.items.filter((i) => i.kind === 'fg')

  const set = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }))

  const submit = () => {
    const next: Record<string, string> = {}
    if (!values.kode_item) next.kode_item = 'Wajib dipilih'
    if (!values.keterangan?.trim()) next.keterangan = 'Wajib diisi'
    if (isPr && !values.nilai) next.nilai = 'Perkiraan nilai wajib diisi'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit(type, values)
  }

  return (
    <div className="mt-4 rounded-md bg-bg-surface px-3.5 py-3.5 ring-1 ring-inset ring-border-med">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-text-secondary">
        {isPr ? 'Permintaan barang baru' : 'Pesanan pelanggan baru'}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={isPr ? 'Material yang diminta' : 'Produk yang dipesan'} error={errors.kode_item}>
          <select
            value={values.kode_item ?? ''}
            onChange={(e) => set('kode_item', e.target.value)}
            className={inputClass}
          >
            <option value="">— pilih —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.name} ({item.uom})
              </option>
            ))}
          </select>
        </Field>

        <Field label={isPr ? 'Supplier yang diusulkan' : 'Pelanggan'}>
          <select value={values.mitra ?? ''} onChange={(e) => set('mitra', e.target.value)} className={inputClass}>
            <option value="">— belum ditentukan —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={isPr ? 'Perkiraan nilai' : 'Nilai pesanan'} error={errors.nilai} hint="Nilai ini menentukan siapa yang berwenang menyetujuinya nanti.">
          <input
            type="number"
            inputMode="numeric"
            value={values.nilai ?? ''}
            onChange={(e) => set('nilai', e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <Field label="Prioritas">
          <select value={values.prioritas ?? 'normal'} onChange={(e) => set('prioritas', e.target.value)} className={inputClass}>
            <option value="normal">Normal</option>
            <option value="urgent">Mendesak</option>
            <option value="critical">Kritis</option>
          </select>
        </Field>

        <Field
          label={isPr ? 'Untuk apa & kapan dibutuhkan' : 'Keterangan pesanan'}
          error={errors.keterangan}
          className="sm:col-span-2"
          hint={isPr ? 'Spesifikasi yang tidak lengkap adalah kesalahan paling sering di stage ini — barang yang datang jadi beda varian.' : undefined}
        >
          <textarea
            rows={3}
            value={values.keterangan ?? ''}
            onChange={(e) => set('keterangan', e.target.value)}
            className={cn(inputClass, 'resize-y')}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          className="inline-flex min-h-touch cursor-pointer items-center rounded-pill bg-text-primary px-4 text-[12px] font-bold text-white shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Buat dokumen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-touch cursor-pointer items-center rounded-pill px-4 text-[12px] font-bold text-text-secondary ring-1 ring-inset ring-border-med focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Batal
        </button>
      </div>
    </div>
  )
}

const inputClass =
  'w-full min-h-touch rounded-md bg-bg-elevated px-3 text-[13px] text-text-primary ring-1 ring-inset ring-border-med focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-[11px] font-extrabold uppercase tracking-[0.06em] text-text-secondary">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {/* Error di bawah field-nya sendiri, bukan dikumpulkan di atas — supaya
          jelas field mana yang harus diperbaiki. */}
      {error && <span className="mt-1 block text-[11px] font-bold text-status-decision">{error}</span>}
      {!error && hint && <span className="mt-1 block text-[11px] leading-[15px] text-text-muted">{hint}</span>}
    </label>
  )
}

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
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleCheck,
  Clock3,
  Inbox,
  Play,
  Plus,
  RotateCcw,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { SECTORS, allTeams, getStage, type SectorId } from '@/opsflow/taxonomy'
import { useWorkStore, inboxForTeam } from '@/opsflow/useWorkStore'
import { ACTIONS, actionsForItem } from '@/opsflow/workflow'
import { resetStore } from '@/opsflow/store'
import { commit, nextDocumentNumber, nextEventId } from '@/opsflow/store'
import { SECTOR_COLOR, SEVERITY_COLOR, WORK_ITEM_LABEL, formatIdr, formatWorkHours } from '@/opsflow/viz'
import { iconForStage, iconForWorkItem } from '@/opsflow/stageIcons'
import { MetricTile, SectionCard, SeverityBadge } from '@/components/opsflow/primitives'
import { OpsflowShell } from './OpsflowShell'
import { cn } from '@/lib/utils'

/** Sub-tim yang punya aksi di katalog — hanya ini yang berguna dipilih sekarang. */
const TEAMS_WITH_ACTIONS = [...new Set(ACTIONS.map((a) => a.team))]

type InboxRow = ReturnType<typeof inboxForTeam>[number]

interface InboxGroup {
  id: string
  label: string
  icon: LucideIcon
  color: string
  rows: InboxRow[]
}

/**
 * Kelompokkan kotak masuk menurut mendesaknya, bukan hanya diurutkan.
 *
 * Daftar panjang yang terurut tetap menuntut pembacanya membandingkan badge
 * baris per baris untuk tahu mana yang genting. Dengan kepala kelompok, jawaban
 * "mana yang harus saya kerjakan sekarang" ada sebelum baris pertama dibaca.
 * Kelompok yang kosong tidak ditampilkan — kepala kelompok tanpa isi hanya
 * menambah yang harus dilewati mata.
 */
function groupInbox(rows: InboxRow[]): InboxGroup[] {
  const late: InboxRow[] = []
  const soon: InboxRow[] = []
  const calm: InboxRow[] = []

  for (const row of rows) {
    const stage = getStage(row.item.currentStageCode)
    if (stage && row.ageHours > stage.escalateAfterHours) late.push(row)
    else if (row.ageHours > 8) soon.push(row)
    else calm.push(row)
  }

  return [
    { id: 'telat', label: 'Lewat batas eskalasi', icon: AlertTriangle, color: SEVERITY_COLOR.critical, rows: late },
    { id: 'segera', label: 'Perlu perhatian hari ini', icon: Clock3, color: SEVERITY_COLOR.warning, rows: soon },
    { id: 'aman', label: 'Masih dalam batas', icon: CircleCheck, color: SEVERITY_COLOR.good, rows: calm },
  ].filter((group) => group.rows.length > 0)
}

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
  const [sector, setSector] = useState<SectorId>(teamMeta?.sector ?? 'PROC')

  const inbox = useMemo(
    () => inboxForTeam(dataset, visits, teamName, actionsForItem),
    [dataset, visits, teamName],
  )

  /**
   * Jumlah antrean tiap sub-tim, dihitung sekali untuk semua.
   *
   * Angkanya ditampilkan di pemilih peran, bukan disembunyikan sampai perannya
   * dipilih. Tanpa itu orang harus mencoba satu per satu untuk menemukan
   * pekerjaan yang menumpuk — dan tumpukan yang harus dicari dulu adalah
   * tumpukan yang tidak akan ditemukan.
   */
  const countByTeam = useMemo(() => {
    const counts: Record<string, { total: number; telat: number }> = {}
    for (const name of TEAMS_WITH_ACTIONS) {
      const rows = inboxForTeam(dataset, visits, name, actionsForItem)
      counts[name] = {
        total: rows.length,
        telat: rows.filter((row) => {
          const stage = getStage(row.item.currentStageCode)
          return stage ? row.ageHours > stage.escalateAfterHours : false
        }).length,
      }
    }
    return counts
  }, [dataset, visits])

  const teamsBySector = useMemo(() => {
    const map = new Map<SectorId, string[]>()
    for (const name of TEAMS_WITH_ACTIONS) {
      const meta = allTeams().find((t) => t.team === name)
      if (!meta) continue
      map.set(meta.sector, [...(map.get(meta.sector) ?? []), name])
    }
    return map
  }, [])

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
          {/* Peran yang sedang dipakai, sebagai penanda konteks — pemilihnya ada di kartu pertama. */}
          <span
            className="inline-flex min-h-touch items-center gap-2 rounded-pill px-3 text-[12px] font-bold text-text-primary shadow-soft ring-1 ring-inset ring-border-med"
            style={{ backgroundColor: teamMeta ? `${SECTOR_COLOR[teamMeta.sector]}14` : undefined }}
          >
            <UserRound
              aria-hidden="true"
              className="size-3.5"
              style={{ color: teamMeta ? SECTOR_COLOR[teamMeta.sector] : undefined }}
            />
            {teamName}
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        {/*
          Pemilih peran. Dulu ini satu <select> berisi 32 nama — untuk tahu di
          mana pekerjaan menumpuk, orang harus membuka satu per satu. Sekarang
          jumlah antreannya terlihat di mukanya, dikelompokkan per sektor, jadi
          tumpukan menemukan orangnya, bukan sebaliknya.
        */}
        <SectionCard
          index={0}
          title="Saya bekerja sebagai"
          hint="Di sistem sungguhan peran datang dari login. Di sini bisa diganti-ganti supaya satu orang bisa menelusuri alurnya dari ujung ke ujung."
        >
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SECTORS) as SectorId[]).map((id) => {
              const teams = teamsBySector.get(id) ?? []
              const total = teams.reduce((sum, name) => sum + (countByTeam[name]?.total ?? 0), 0)
              const active = sector === id
              const SectorIcon = iconForStage(`${id}-10`)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSector(id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill px-3 text-[12px] font-bold',
                    'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    active ? 'text-white shadow-soft' : 'text-text-secondary ring-1 ring-inset ring-border-med hover:bg-bg-surface',
                  )}
                  style={active ? { backgroundColor: SECTOR_COLOR[id] } : undefined}
                >
                  <SectorIcon aria-hidden="true" className="size-3.5" />
                  {SECTORS[id].name}
                  <span
                    className={cn(
                      'rounded-pill px-1.5 py-0.5 text-[10px] tabular-nums',
                      active ? 'bg-white/20 text-white' : 'bg-bg-soft text-text-muted',
                    )}
                  >
                    {total}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-soft pt-3">
            {(teamsBySector.get(sector) ?? []).map((name) => {
              const count = countByTeam[name] ?? { total: 0, telat: 0 }
              const active = teamName === name
              const empty = count.total === 0
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTeamName(name)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-md px-3 text-[12px]',
                    'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    active
                      ? 'bg-text-primary font-bold text-white shadow-soft'
                      : empty
                        ? 'text-text-faint ring-1 ring-inset ring-border-soft hover:bg-bg-surface'
                        : 'font-semibold text-text-primary ring-1 ring-inset ring-border-med hover:bg-bg-surface',
                  )}
                >
                  {name}
                  {count.total > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        active ? 'bg-white/20 text-white' : 'bg-bg-soft text-text-secondary',
                      )}
                    >
                      {/* Telat ditandai ikon + angka, bukan sekadar diwarnai merah. */}
                      {count.telat > 0 && (
                        <AlertTriangle
                          aria-hidden="true"
                          className="size-2.5"
                          style={{ color: active ? undefined : SEVERITY_COLOR.critical }}
                        />
                      )}
                      {count.total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </SectionCard>

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
            groupInbox(inbox).map((group) => (
              <section key={group.id} className="mb-1 last:mb-0">
                {/*
                  Kepala kelompok: ikon + kata + jumlah. Tiga penanda yang saling
                  menguatkan, jadi urutan prioritasnya terbaca dalam sekali lihat
                  tanpa harus membandingkan warna badge baris per baris.
                */}
                <p className="flex items-center gap-1.5 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[0.08em] first:pt-0">
                  <group.icon aria-hidden="true" className="size-3" style={{ color: group.color }} />
                  <span style={{ color: group.color }}>{group.label}</span>
                  <span className="tabular-nums text-text-faint">· {group.rows.length}</span>
                </p>
                <ul className="divide-y divide-border-soft">
                  {group.rows.map((row) => {
                    const stage = getStage(row.item.currentStageCode)
                    const Icon = iconForStage(row.item.currentStageCode)
                    const TypeIcon = iconForWorkItem(row.item.type)
                    const late = stage ? row.ageHours > stage.escalateAfterHours : false
                    const mine = row.actions.filter((a) => a.team === teamName)

                    return (
                      <li key={row.item.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/kerja/dokumen/${row.item.id}`)}
                          className="group flex w-full items-center gap-3 rounded-md px-1.5 py-3 text-left transition-colors duration-fast hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                        >
                          {/*
                            Dua ikon dengan tugas berbeda: cincin besar = stage
                            tempat dokumen berdiri sekarang, lencana kecil = jenis
                            dokumennya. Keduanya terbaca sebelum nomornya dieja.
                          */}
                          <span aria-hidden="true" className="relative shrink-0">
                            <span
                              className="flex size-10 items-center justify-center rounded-full bg-bg-elevated"
                              style={{ boxShadow: `0 0 0 2px ${stage ? SECTOR_COLOR[stage.sector] : '#ccc'}` }}
                            >
                              <Icon
                                className="size-[18px]"
                                style={{ color: stage ? SECTOR_COLOR[stage.sector] : undefined }}
                              />
                            </span>
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-[17px] items-center justify-center rounded-full bg-bg-elevated ring-1 ring-border-med">
                              <TypeIcon className="size-2.5 text-text-muted" />
                            </span>
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="text-[13px] font-bold text-text-primary">
                                {row.item.documentNumber}
                              </span>
                              <span className="text-[11px] text-text-muted">
                                {WORK_ITEM_LABEL[row.item.type] ?? row.item.type}
                              </span>
                              {row.item.amount ? (
                                <span className="text-[11px] font-bold tabular-nums text-text-secondary">
                                  {formatIdr(row.item.amount)}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-[16px] text-text-secondary">
                              {stage ? `${stage.code} ${stage.name}` : row.item.currentStageCode}
                            </span>
                            {/* Aksi yang menanti ditulis sebagai ajakan, bukan sebagai status. */}
                            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-bg-soft px-2 py-0.5 text-[10px] font-bold text-text-primary">
                              <Play aria-hidden="true" className="size-2.5 text-text-muted" />
                              {mine[0]?.label ?? 'menunggu tindakan'}
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
              </section>
            ))
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

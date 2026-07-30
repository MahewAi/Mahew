/**
 * OpsFlow — Halaman dokumen.
 *
 * Satu dokumen: isinya, tindakan yang tersedia, dan jejak lengkap siapa
 * mengerjakan apa dan kapan.
 *
 * Bagian terpenting halaman ini bukan tombolnya, tapi apa yang terjadi ketika
 * tombol itu TIDAK BOLEH ditekan. Gerbang yang tidak lolos ditampilkan sebagai
 * penjelasan: apa yang kurang, kenapa itu penting, dan apa yang harus dilakukan.
 * Penolakan yang hanya berbunyi "tidak diizinkan" akan membuat orang mencari
 * jalan lain — biasanya kembali ke WhatsApp.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Lock, ShieldAlert } from 'lucide-react'
import { getStage } from '@/opsflow/taxonomy'
import { useWorkStore } from '@/opsflow/useWorkStore'
import { actionsForItem, type ActionDef } from '@/opsflow/workflow'
import {
  SECTOR_COLOR,
  SEVERITY_COLOR,
  WORK_ITEM_LABEL,
  formatDateTime,
  formatWorkHours,
} from '@/opsflow/viz'
import { iconForEvent, iconForStage, iconForWorkItem } from '@/opsflow/stageIcons'
import { SectionCard, SeverityBadge } from '@/components/opsflow/primitives'
import { DocumentJourney, buildJourney } from '@/components/opsflow/DocumentJourney'
import { OpsflowShell } from './OpsflowShell'
import { Field } from './OpsflowWork'
import { cn } from '@/lib/utils'

const EVENT_LABEL: Record<string, string> = {
  arrived: 'Masuk antrean',
  started: 'Mulai dikerjakan',
  completed: 'Diselesaikan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  returned: 'Dikembalikan',
  blocked: 'Tertahan pihak luar',
  unblocked: 'Pihak luar merespons',
  reassigned: 'Ganti penanggung jawab',
  field_changed: 'Data diubah',
  cancelled: 'Dibatalkan',
  incident_logged: 'Kesalahan dicatat',
  note: 'Catatan',
}

export default function OpsflowDocument() {
  const params = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { dataset, visits, run, check } = useWorkStore()
  const [values, setValues] = useState<Record<string, string>>({})
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [justDone, setJustDone] = useState<string | null>(null)

  const item = dataset.workItems.find((i) => i.id === params.id)

  const personByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const team of dataset.teams) {
      const person = dataset.people.find((p) => p.teamId === team.id)
      if (person) map.set(team.name, { id: person.id, name: person.name })
    }
    return map
  }, [dataset])

  if (!item) {
    return (
      <OpsflowShell title="Dokumen tidak ditemukan" backTo="/kerja" backLabel="Kotak Kerja">
        <p className="text-[13px] text-text-secondary">
          Dokumen <span className="font-bold">{params.id}</span> tidak ada di penyimpanan.
        </p>
      </OpsflowShell>
    )
  }

  const stage = getStage(item.currentStageCode)
  const actions = actionsForItem(item)
  const timeline = dataset.events
    .filter((e) => e.workItemId === item.id)
    .slice()
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  const currentVisit = visits.find((v) => v.workItemId === item.id && v.isOpen)

  // Perjalanan dokumen disusun dari kunjungan stage yang benar-benar terjadi,
  // bukan dari jalur teoretis di taksonomi — dokumen yang pernah dikembalikan
  // atau di-rework harus terlihat apa adanya.
  const myVisits = visits
    .filter((v) => v.workItemId === item.id)
    .slice()
    .sort((a, b) => Date.parse(a.arrivedAt ?? a.completedAt ?? '') - Date.parse(b.arrivedAt ?? b.completedAt ?? ''))
  const hoursByStage: Record<string, number | null> = {}
  for (const visit of myVisits) {
    hoursByStage[visit.stageCode] = (visit.waitHours ?? 0) + (visit.touchHours ?? 0)
  }
  const journey = buildJourney(
    myVisits.map((v) => v.stageCode),
    item.currentStageCode,
    hoursByStage,
  )
  const linked = item.links
    .map((l) => dataset.workItems.find((i) => i.id === l.targetWorkItemId))
    .filter((i): i is NonNullable<typeof i> => i !== undefined)
  const children = dataset.workItems.filter((other) => other.links.some((l) => l.targetWorkItemId === item.id))

  const submit = (action: ActionDef) => {
    const actor = personByTeam.get(action.team)
    if (!actor) return
    const result = run(action, { item, actorPersonId: actor.id, values })
    if (result.ok) {
      setValues({})
      setFieldErrors({})
      setOpenAction(null)
      setJustDone(action.label)
      if (result.createdId) navigate(`/kerja/dokumen/${result.createdId}`)
    } else {
      setFieldErrors(result.validation.fieldErrors)
    }
  }

  return (
    <OpsflowShell
      title={item.documentNumber}
      subtitle={`${WORK_ITEM_LABEL[item.type] ?? item.type} · ${stage ? `${stage.code} ${stage.name} · ${stage.team}` : item.currentStageCode}`}
      backTo="/kerja"
      backLabel="Kotak Kerja"
      accentColor={stage ? SECTOR_COLOR[stage.sector] : undefined}
    >
      <div className="space-y-3">
        {justDone && (
          <div
            role="status"
            className="opsflow-enter flex items-center gap-2 rounded-md bg-status-final-bg px-3.5 py-3 ring-1 ring-inset ring-status-final/25"
          >
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-status-final" />
            <p className="text-[12px] font-bold text-status-final">
              {justDone} — tercatat dengan waktu dan pelakunya. Angka di dashboard sudah ikut berubah.
            </p>
          </div>
        )}

        {/* Keadaan dokumen */}
        <SectionCard index={1} title="Keadaan sekarang">
          <div className="flex flex-wrap items-start gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-elevated"
              style={{ boxShadow: `0 0 0 2.5px ${stage ? SECTOR_COLOR[stage.sector] : '#ccc'}` }}
            >
              {(() => {
                const Icon = iconForStage(item.currentStageCode)
                return <Icon className="size-5" style={{ color: stage ? SECTOR_COLOR[stage.sector] : undefined }} />
              })()}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-text-primary">
                {stage ? stage.name : item.currentStageCode}
              </p>
              {/*
                Dokumen yang sudah ditutup tidak menunggu siapa-siapa. Kalimat
                "menunggu tindakan X" pada dokumen selesai membuat orang mengejar
                pekerjaan yang tidak ada — dan itu persis jenis salah paham yang
                sistem ini dibuat untuk menghilangkan.
              */}
              <p className="mt-0.5 text-[12px] text-text-secondary">
                {item.closedAt ? (
                  <>
                    Selesai di <span className="font-bold text-text-primary">{stage?.team ?? '—'}</span> — tidak ada
                    yang perlu menindaklanjuti
                  </>
                ) : (
                  <>
                    Menunggu tindakan <span className="font-bold text-text-primary">{stage?.team ?? '—'}</span>
                  </>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.closedAt ? (
                  <SeverityBadge level="good">Selesai</SeverityBadge>
                ) : currentVisit ? (
                  <SeverityBadge
                    level={
                      stage && (currentVisit.ageHours ?? 0) > stage.escalateAfterHours
                        ? 'critical'
                        : (currentVisit.ageHours ?? 0) > 8
                          ? 'warning'
                          : 'good'
                    }
                  >
                    Menunggu {formatWorkHours(currentVisit.ageHours ?? 0)}
                  </SeverityBadge>
                ) : null}
                {item.amount ? (
                  // Nilai penuh, bukan ringkas: ini nilai dokumennya sendiri.
                  <span className="inline-flex items-center rounded-md bg-bg-surface px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-primary ring-1 ring-inset ring-border-soft">
                    Rp {item.amount.toLocaleString('id-ID')}
                  </span>
                ) : null}
                {item.priority !== 'normal' && (
                  <SeverityBadge level={item.priority === 'critical' ? 'critical' : 'warning'}>
                    {item.priority === 'critical' ? 'Kritis' : 'Mendesak'}
                  </SeverityBadge>
                )}
              </div>
            </div>
          </div>

          {/* Perjalanan dokumen: sudah lewat mana, sekarang di mana, berikutnya siapa. */}
          <div className="mt-4 border-t border-border-soft pt-3">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-text-muted">
              Perjalanan dokumen ini
            </p>
            <DocumentJourney stops={journey} closed={item.closedAt !== null} />
          </div>

          {/* Isi dokumen yang sudah diisi di sepanjang alur */}
          {item.extra && Object.keys(item.extra).length > 0 && (
            <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-2.5 border-t border-border-soft pt-3 sm:grid-cols-2">
              {Object.entries(item.extra)
                .filter(([, value]) => value !== '' && value !== null)
                .map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[132px_1fr] items-baseline gap-2">
                    <dt className="text-[10px] font-extrabold uppercase leading-[15px] tracking-[0.06em] text-text-muted">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd
                      className={cn(
                        'text-[12px] leading-[17px] text-text-secondary',
                        typeof value === 'number' && 'font-bold tabular-nums text-text-primary',
                      )}
                    >
                      {formatFieldValue(key, value)}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </SectionCard>

        {/* Tindakan */}
        <SectionCard
          index={2}
          title="Tindakan yang tersedia"
          hint="Hanya sub-tim pemilik stage ini yang bisa menjalankannya. Kalau ada syarat yang belum terpenuhi, syaratnya disebutkan — bukan sekadar ditolak."
        >
          {actions.length === 0 ? (
            <p className="text-[12px] text-text-muted">
              {item.closedAt
                ? 'Dokumen ini sudah selesai. Tidak ada tindakan lanjutan.'
                : `Stage ${item.currentStageCode} belum punya tindakan di katalog. Stage ini akan menyusul dengan pola yang sama — aksinya dideklarasikan sebagai data, bukan kode per stage.`}
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => {
                const actor = personByTeam.get(action.team)
                const validation = actor
                  ? check(action, { item, actorPersonId: actor.id, values })
                  : { ok: false, fieldErrors: {}, blockers: [], warnings: [] }
                const isOpen = openAction === action.id
                const blocked = validation.blockers.length > 0
                const warned = !blocked && validation.warnings.length > 0

                return (
                  <div
                    key={action.id}
                    className={cn(
                      'rounded-md px-3.5 py-3 ring-1 ring-inset',
                      blocked ? 'bg-status-decision-bg/40 ring-status-decision/25' : 'bg-bg-surface ring-border-soft',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-text-primary">{action.label}</p>
                        <p className="mt-0.5 text-[11px] leading-[16px] text-text-secondary">{action.outcome}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">
                          oleh {action.team}
                          {actor ? ` · ${actor.name}` : ''}
                        </p>
                      </div>

                      {/*
                        Tombol ini tetap ada walau gerbangnya menahan. Sebagian
                        gerbang menilai isian formnya sendiri — mis. nilai
                        tagihan yang tidak cocok dengan PO. Kalau formnya
                        disembunyikan begitu gerbangnya menyala, nilai yang
                        menyebabkan penolakan justru tidak bisa dibetulkan lagi:
                        jalan buntu, dan jalan buntu adalah alasan orang kembali
                        ke WhatsApp. Yang dinonaktifkan hanya tombol kirimnya.
                      */}
                      <button
                        type="button"
                        onClick={() => setOpenAction(isOpen ? null : action.id)}
                        className={cn(
                          'inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-pill px-4 text-[12px] font-bold shadow-soft',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                          blocked
                            ? 'bg-bg-elevated text-status-decision ring-1 ring-inset ring-status-decision/30'
                            : action.tone === 'reject'
                              ? 'bg-bg-elevated text-status-decision ring-1 ring-inset ring-status-decision/30'
                              : 'bg-text-primary text-white',
                        )}
                      >
                        {isOpen ? 'Tutup' : blocked ? 'Lihat & perbaiki' : action.label}
                      </button>
                    </div>

                    {/* Gerbang yang belum lolos. Ini bagian terpenting halaman ini. */}
                    {blocked && (
                      <div className="mt-3 space-y-2">
                        {validation.blockers.map((blocker) => (
                          <div key={blocker.guard} className="flex items-start gap-2">
                            <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-status-decision" />
                            <div>
                              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-status-decision">
                                Belum bisa dijalankan
                              </p>
                              <p className="mt-0.5 text-[12px] leading-[17px] text-text-secondary">
                                {blocker.message}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/*
                      Gerbang yang memperingatkan tapi tidak menahan. Bedanya
                      dengan blok di atas disengaja: yang bisa dibuktikan
                      datanya menahan tombol, yang belum bisa dibuktikan hanya
                      memperingatkan. Menahan pekerjaan sah dengan aturan yang
                      datanya belum ada adalah cara tercepat mengembalikan orang
                      ke WhatsApp.
                    */}
                    {warned && (
                      <div className="mt-3 space-y-2">
                        {validation.warnings.map((warning) => (
                          <div
                            key={warning.guard}
                            className="flex items-start gap-2 rounded-md px-2.5 py-2"
                            style={{ backgroundColor: `${SEVERITY_COLOR.warning}14` }}
                          >
                            <AlertTriangle
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0"
                              style={{ color: SEVERITY_COLOR.warning }}
                            />
                            <div>
                              <p
                                className="text-[11px] font-extrabold uppercase tracking-[0.06em]"
                                style={{ color: SEVERITY_COLOR.warning }}
                              >
                                Boleh diteruskan, tapi tercatat
                              </p>
                              <p className="mt-0.5 text-[12px] leading-[17px] text-text-secondary">
                                {warning.message}
                              </p>
                            </div>
                          </div>
                        ))}
                        <p className="text-[11px] leading-[16px] text-text-muted">
                          Sistem tidak menahan tindakan ini karena datanya belum cukup untuk memastikan. Kalau tetap
                          diteruskan, peringatannya masuk ke jejak audit dokumen ini dan ikut terhitung di dashboard.
                        </p>
                      </div>
                    )}

                    {/* Form aksi — tetap bisa diedit meski gerbangnya menahan. */}
                    {isOpen && (
                      <div className="mt-4 border-t border-border-soft pt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {action.fields.map((field) => (
                            <Field
                              key={field.name}
                              label={field.label}
                              hint={field.hint}
                              error={fieldErrors[field.name]}
                              className={field.type === 'textarea' ? 'sm:col-span-2' : undefined}
                            >
                              {field.type === 'select' ? (
                                <select
                                  value={values[field.name] ?? ''}
                                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                  className={inputClass}
                                >
                                  <option value="">— pilih —</option>
                                  {(field.options ?? []).map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === 'textarea' ? (
                                <textarea
                                  rows={3}
                                  value={values[field.name] ?? ''}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                  className={cn(inputClass, 'resize-y')}
                                />
                              ) : (
                                <span className="flex items-center gap-2">
                                  <input
                                    type={field.type === 'date' ? 'date' : field.type === 'text' ? 'text' : 'number'}
                                    inputMode={field.type === 'text' ? undefined : 'numeric'}
                                    value={values[field.name] ?? ''}
                                    placeholder={field.placeholder}
                                    onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                    className={inputClass}
                                  />
                                  {field.suffix && (
                                    <span className="shrink-0 text-[11px] font-bold text-text-muted">
                                      {field.suffix}
                                    </span>
                                  )}
                                </span>
                              )}
                            </Field>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => submit(action)}
                          className={cn(
                            'mt-4 inline-flex min-h-touch items-center gap-2 rounded-pill px-4 text-[12px] font-bold shadow-soft',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                            blocked
                              ? 'cursor-not-allowed bg-bg-soft text-text-faint'
                              : 'cursor-pointer bg-text-primary text-white',
                          )}
                        >
                          {blocked ? (
                            <Lock aria-hidden="true" className="size-3.5" />
                          ) : (
                            <CheckCircle2 aria-hidden="true" className="size-3.5" />
                          )}
                          {blocked
                            ? 'Tertahan gerbang di atas'
                            : warned
                              ? 'Teruskan meski ada peringatan'
                              : action.label}
                        </button>
                        <p className="mt-2 text-[11px] leading-[15px] text-text-muted">
                          {blocked
                            ? 'Perbaiki isian di atas atau selesaikan syaratnya; tombol ini akan aktif sendiri begitu syaratnya terpenuhi.'
                            : `Tindakan ini akan tercatat atas nama ${actor?.name ?? '—'} pada waktu sekarang, dan tidak bisa dihapus. Koreksi dilakukan dengan tindakan baru, bukan dengan mengubah catatan lama.`}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Dokumen terkait */}
        {(linked.length > 0 || children.length > 0) && (
          <SectionCard
            index={3}
            title="Dokumen terkait"
            hint="Tautan terbentuk otomatis saat dokumen lahir dari tindakan pada dokumen lain — bukan diisi manual."
          >
            <ul className="flex flex-wrap gap-2">
              {[...linked, ...children].map((related) => {
                const RelatedIcon = iconForWorkItem(related.type)
                const relatedStage = getStage(related.currentStageCode)
                const relatedColor = relatedStage ? SECTOR_COLOR[relatedStage.sector] : '#999'
                return (
                  <li key={related.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/kerja/dokumen/${related.id}`)}
                      className="inline-flex min-h-touch cursor-pointer items-center gap-2.5 rounded-md bg-bg-surface py-1.5 pl-2.5 pr-3 text-left ring-1 ring-inset ring-border-med transition-colors hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${relatedColor}18` }}
                      >
                        <RelatedIcon className="size-3.5" style={{ color: relatedColor }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold text-text-primary">
                          {related.documentNumber}
                        </span>
                        <span className="block text-[10px] text-text-muted">
                          {WORK_ITEM_LABEL[related.type] ?? related.type}
                          {related.closedAt ? ' · selesai' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        )}

        {/* Jejak audit */}
        <SectionCard
          index={4}
          title="Jejak lengkap"
          hint="Catatan tidak pernah diubah atau dihapus — koreksi dilakukan dengan menambah catatan baru. Ini yang membuat 'saya sudah kirim kok' tidak lagi jadi perdebatan."
        >
          <ol className="relative space-y-0">
            {timeline.map((event, index) => {
              const person = event.actorPersonId
                ? dataset.people.find((p) => p.id === event.actorPersonId)
                : null
              const eventStage = getStage(event.stageCode)
              return (
                // Id + posisi, bukan id saja. Id event yang kembar — entah dari
                // bug penomoran atau dari ekspor sistem lama saat ingestion —
                // membuat React memakai ulang baris milik dokumen lain, dan
                // jejak audit yang salah lebih buruk daripada tidak ada jejak.
                <li key={`${event.id}-${index}`} className="relative flex gap-3 pb-3.5">
                  {index < timeline.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[13px] top-7 h-full w-px bg-border-med" />
                  )}
                  {/*
                    Ikon per jenis event, bukan titik berwarna. Dengan titik,
                    "Disetujui" dan "Ditolak" hanya berbeda warnanya — dan warna
                    sendirian gugur di mata yang lelah, layar redup, atau
                    penglihatan warna yang berbeda. Bentuk tidak punya syarat itu.
                  */}
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full bg-bg-elevated"
                    style={{
                      boxShadow: `inset 0 0 0 1.5px ${eventStage ? SECTOR_COLOR[eventStage.sector] : '#ccc'}40`,
                    }}
                  >
                    {(() => {
                      const EventIcon = iconForEvent(event.type)
                      return (
                        <EventIcon
                          className="size-3.5"
                          style={{ color: eventStage ? SECTOR_COLOR[eventStage.sector] : undefined }}
                        />
                      )
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-[12px] font-bold text-text-primary">
                        {EVENT_LABEL[event.type] ?? event.type}
                      </span>
                      <span className="text-[10px] tabular-nums text-text-muted">
                        {formatDateTime(event.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {eventStage ? `${eventStage.code} ${eventStage.name}` : event.stageCode}
                      {person ? ` · ${person.name}` : ' · sistem'}
                      {event.recordedBy === 'opsflow-ui' ? ' · lewat sistem' : ''}
                    </p>
                    {event.change && (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-status-decision-bg px-2 py-0.5 text-[11px] font-semibold text-status-decision">
                        <ShieldAlert aria-hidden="true" className="size-3" />
                        {event.change.field}: {String(event.change.from)} → {String(event.change.to)}
                      </p>
                    )}
                    {event.reason && (
                      <p className="mt-1 text-[11px] leading-[16px] text-text-secondary">“{event.reason}”</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </SectionCard>
      </div>
    </OpsflowShell>
  )
}

const inputClass =
  'w-full min-h-touch rounded-md bg-bg-elevated px-3 text-[13px] text-text-primary ring-1 ring-inset ring-border-med focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * Nilai isian ditampilkan sesuai artinya, bukan seadanya.
 *
 * Angka rupiah dengan pemisah ribuan, tanggal dalam bentuk yang dibaca orang,
 * dan pilihan berkode (`lolos-catatan`) dikembalikan jadi kalimat. Kolom yang
 * isinya "2026-08-20" atau "sebagian-rusak" memaksa pembacanya menerjemahkan
 * sendiri — dan itu pekerjaan yang seharusnya dikerjakan sistem.
 */
function formatFieldValue(key: string, value: string | number | boolean | null): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'number') {
    // Nilai di badan dokumen ditulis penuh, bukan diringkas jadi "Rp 80,0 jt".
    // Ringkasan itu tepat untuk dashboard, tapi di dokumen yang jadi dasar
    // pembayaran, angka yang dibulatkan adalah angka yang salah.
    const isMoney = /nilai|harga|anggaran|tagihan|sisa/.test(key)
    return isMoney ? `Rp ${value.toLocaleString('id-ID')}` : value.toLocaleString('id-ID')
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  // Nilai pilihan disimpan berkode supaya stabil di data; yang dibaca orang
  // tetap harus berupa kata. Berlaku juga untuk kode satu kata seperti "baik"
  // atau "ya" — kalimat bebas tidak ikut tersentuh karena selalu punya spasi.
  // Harus diawali huruf: "2026-07" (masa pajak) dan kode berangka lain bukan
  // pilihan berkode, dan mengubahnya jadi "2026 07" merusak artinya.
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value)) {
    const words = value.replace(/-/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
  }
  return value
}

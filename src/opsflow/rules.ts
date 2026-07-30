/**
 * OpsFlow — Deteksi kesalahan otomatis.
 *
 * Ini bagian yang menjawab keberatan paling serius terhadap seluruh sistem:
 * kalau pencatatan kesalahan bergantung pada laporan sendiri, orang tidak akan
 * melaporkan kesalahannya — apalagi kalau tahu datanya dipakai menilai kinerja.
 * Maka data kesalahannya mati, dan dashboard-nya jadi hiasan.
 *
 * Aturan di file ini menemukan kesalahan dari **jejak yang sudah ada**, tanpa
 * seorang pun perlu melapor. Persetujuan di luas wewenang, invoice dobel,
 * gerbang QC yang dilewati, data yang diubah setelah disetujui — semuanya
 * terbaca dari event log dan master data.
 *
 * SATU KEPUTUSAN YANG PERLU DIPEGANG: aturan otomatis TIDAK menetapkan siapa
 * yang salah. Semua temuan keluar dengan `attribution: 'unknown'` dan
 * `status: 'open'`. Mesin bisa memastikan bahwa sesuatu terjadi; ia tidak bisa
 * memastikan mengapa. Membiarkan mesin menuduh individu adalah cara tercepat
 * membuat seluruh sistem ditolak — dan sering kali salah, karena penyebabnya
 * ternyata prosedur atau beban kerja.
 *
 * Setiap temuan membawa `ruleId` dan `evidence` supaya bisa dibantah. Temuan yang
 * tidak bisa diperiksa ulang tidak akan dipercaya.
 */

import { calendarHoursBetween, resolveCalendar, workingHoursBetween } from './calendar.ts'
import type { Incident, IncidentSeverity, OpsDataset, WorkEvent, WorkItem } from './schema.ts'
import type { StageVisit } from './metrics.ts'
import { getStage, mainPath } from './taxonomy.ts'

// ============================================================
// Bentuk hasil
// ============================================================

export interface DetectedIncident extends Incident {
  /** Aturan yang memicunya — supaya temuan bisa ditelusuri dan dibantah. */
  ruleId: RuleId
  /** Bukti yang bisa diperiksa manusia. Tanpa ini, temuan tidak akan dipercaya. */
  evidence: string
  /**
   * `confirmed` = pasti terjadi menurut data (mis. penyetuju levelnya memang di
   * bawah batas). `suspected` = pola yang perlu diperiksa, bisa jadi wajar
   * (mis. dua invoice bernilai sama dari vendor yang sama).
   */
  certainty: 'confirmed' | 'suspected'
}

export type RuleId =
  | 'R1-wewenang'
  | 'R2-invoice-dobel'
  | 'R3-gerbang-dilewati'
  | 'R4-catat-terlambat'
  | 'R5-approval-menggantung'
  | 'R6-ubah-setelah-disetujui'
  | 'R7-kerja-tanpa-serah-terima'

export interface RuleDefinition {
  id: RuleId
  name: string
  /** Apa yang dicari, dalam bahasa yang bisa dibaca kepala sektor. */
  what: string
  /** Kenapa ini penting. */
  why: string
  certainty: DetectedIncident['certainty']
}

export const RULES: RuleDefinition[] = [
  {
    id: 'R1-wewenang',
    name: 'Persetujuan di luar batas wewenang',
    what: 'Dokumen disetujui oleh orang yang level wewenangnya di bawah batas nilai transaksi, atau butuh dua penyetuju tapi hanya satu yang menyetujui.',
    why: 'Celah kontrol paling mahal. Tidak perlu dilaporkan siapa pun — matriks wewenang dan event persetujuan sudah cukup untuk memastikannya.',
    certainty: 'confirmed',
  },
  {
    id: 'R2-invoice-dobel',
    name: 'Dugaan tagihan dobel',
    what: 'Dua atau lebih tagihan dari vendor yang sama, dengan nilai sama, dalam 14 hari.',
    why: 'Pembayaran dobel jarang ketahuan sampai rekonsiliasi akhir periode — dan pada saat itu uangnya sudah keluar.',
    certainty: 'suspected',
  },
  {
    id: 'R3-gerbang-dilewati',
    name: 'Gerbang pemeriksaan dilewati',
    what: 'Pekerjaan lanjut ke stage berikutnya padahal stage pemeriksaan sebelum itu tidak pernah dilalui.',
    why: 'Inilah bentuk konkret dari "SOP dilewati": barang dipakai sebelum QC keluar, tagihan dibayar sebelum diverifikasi.',
    certainty: 'confirmed',
  },
  {
    id: 'R4-catat-terlambat',
    name: 'Pencatatan jauh setelah kejadian',
    what: 'Selisih antara waktu kejadian dan waktu pencatatan melebihi 24 jam.',
    why: 'Selama belum tercatat, stage berikutnya tidak tahu ada pekerjaan menunggu. Ini juga membuat seluruh angka waktu tidak bisa dipercaya.',
    certainty: 'confirmed',
  },
  {
    id: 'R5-approval-menggantung',
    name: 'Persetujuan menggantung',
    what: 'Dokumen mengantre di stage persetujuan melewati batas eskalasi, tanpa alasan tertahan pihak luar.',
    why: 'Penyebab macet nomor satu di perusahaan besar, dan hampir selalu karena tidak ada delegasi saat penyetuju tidak di tempat.',
    certainty: 'confirmed',
  },
  {
    id: 'R6-ubah-setelah-disetujui',
    name: 'Data diubah setelah disetujui',
    what: 'Nilai, jumlah, atau tanggal diubah setelah dokumen mendapat persetujuan.',
    why: 'Persetujuan jadi tidak bermakna kalau isinya masih bisa berubah sesudahnya. Ini celah yang sering tidak terlihat sama sekali.',
    certainty: 'confirmed',
  },
  {
    id: 'R7-kerja-tanpa-serah-terima',
    name: 'Pekerjaan selesai tanpa tercatat diambil',
    what: 'Ada catatan selesai, tapi tidak pernah ada catatan siapa yang mulai mengerjakan.',
    why: 'Bukan sekadar kelalaian administrasi: tanpa catatan mulai, waktu tunggu tidak bisa dipisahkan dari waktu kerja, dan diagnosis macetnya jadi tidak mungkin.',
    certainty: 'confirmed',
  },
]

export const RULE_BY_ID: Record<RuleId, RuleDefinition> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule]),
) as Record<RuleId, RuleDefinition>

// ============================================================
// Opsi
// ============================================================

export interface DetectOptions {
  /** Ambang jeda pencatatan (jam kalender) untuk R4. */
  recordingLagHours?: number
  /** Jendela hari untuk mencari tagihan dobel (R2). */
  duplicateWindowDays?: number
  /**
   * Batas jumlah temuan per aturan. Aturan yang bersifat kebersihan data bisa
   * memicu ratusan temuan pada bulan-bulan awal; membanjiri daftar akan membuat
   * temuan yang benar-benar mahal ikut tenggelam.
   *
   * Pemotongan TIDAK disembunyikan — jumlah yang dipotong dilaporkan di
   * `DetectionSummary.truncated`, karena daftar yang dipotong tanpa keterangan
   * akan terbaca sebagai "hanya sebanyak ini yang terjadi".
   */
  maxPerRule?: number
}

export interface DetectionSummary {
  incidents: DetectedIncident[]
  /** Jumlah temuan per aturan, sebelum dipotong. */
  countByRule: Record<string, number>
  /** Berapa temuan yang tidak ditampilkan karena batas per aturan. */
  truncated: Record<string, number>
  totalFound: number
  totalReturned: number
}

const DEFAULTS = {
  recordingLagHours: 24,
  duplicateWindowDays: 14,
  maxPerRule: 150,
}

// ============================================================
// Mesin
// ============================================================

/**
 * Jalankan seluruh aturan terhadap satu dataset.
 *
 * Murni: tidak ada `Date.now()`, waktu acuan selalu `dataset.snapshotAt`, jadi
 * hasilnya bisa dihitung ulang untuk periode masa lalu dan tidak berubah kalau
 * dijalankan dua kali.
 */
export function detectIncidents(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: DetectOptions = {},
): DetectionSummary {
  const opts = { ...DEFAULTS, ...options }
  const found: DetectedIncident[] = []

  const itemById = new Map(dataset.workItems.map((i) => [i.id, i]))
  const personById = new Map(dataset.people.map((p) => [p.id, p]))
  const teamByName = new Map(dataset.teams.map((t) => [t.name, t]))

  const teamIdForStage = (stageCode: string): string => {
    const teamName = getStage(stageCode)?.team
    return (teamName ? teamByName.get(teamName)?.id : undefined) ?? 'unknown'
  }

  let seq = 0
  const make = (
    ruleId: RuleId,
    partial: {
      workItemId: string | null
      stageCode: string
      detectedAtStage?: string
      type: Incident['type']
      severity: IncidentSeverity
      occurredAt: string
      description: string
      evidence: string
      personId?: string | null
      delayImpactHours?: number
      costImpactIdr?: number
    },
  ): DetectedIncident => {
    seq += 1
    return {
      id: `AUTO-${ruleId}-${String(seq).padStart(5, '0')}`,
      workItemId: partial.workItemId,
      occurredAtStage: partial.stageCode,
      detectedAtStage: partial.detectedAtStage ?? partial.stageCode,
      type: partial.type,
      severity: partial.severity,
      // Mesin memastikan kejadiannya, bukan sebabnya. Atribusi menunggu penelusuran.
      attribution: 'unknown',
      personId: partial.personId ?? null,
      teamId: teamIdForStage(partial.stageCode),
      occurredAt: partial.occurredAt,
      detectedAt: dataset.snapshotAt,
      description: partial.description,
      status: 'open',
      delayImpactHours: partial.delayImpactHours,
      costImpactIdr: partial.costImpactIdr,
      detectionMethod: 'automatic_rule',
      ruleId,
      evidence: partial.evidence,
      certainty: RULE_BY_ID[ruleId].certainty,
    }
  }

  // ---------- R1: persetujuan di luar batas wewenang ----------
  const approvalsByItemStage = new Map<string, WorkEvent[]>()
  for (const event of dataset.events) {
    if (event.type !== 'approved') continue
    const key = `${event.workItemId}::${event.stageCode}`
    const list = approvalsByItemStage.get(key)
    if (list) list.push(event)
    else approvalsByItemStage.set(key, [event])
  }

  for (const [key, approvals] of approvalsByItemStage) {
    const [workItemId, stageCode] = key.split('::')
    const item = itemById.get(workItemId)
    const amount = item?.amount ?? 0
    const rule = dataset.approvalRules.find(
      (r) => r.stageCode === stageCode && amount >= r.minAmount && (r.maxAmount === null || amount < r.maxAmount),
    )
    if (!rule) continue

    const approvers = approvals
      .map((a) => (a.actorPersonId ? personById.get(a.actorPersonId) : undefined))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)

    const underAuthorised = approvers.filter((p) => p.authorityLevel < rule.requiredAuthorityLevel)
    if (underAuthorised.length > 0) {
      const worst = underAuthorised[0]
      found.push(
        make('R1-wewenang', {
          workItemId,
          stageCode,
          type: 'authority_violation',
          severity: 'critical',
          occurredAt: approvals[0].occurredAt,
          personId: worst.id,
          costImpactIdr: amount,
          description: `Nilai transaksi butuh level wewenang ${rule.requiredAuthorityLevel}, disetujui oleh level ${worst.authorityLevel}.`,
          evidence: `${item?.documentNumber ?? workItemId} · nilai Rp ${amount.toLocaleString('id-ID')} · aturan ${rule.id} · penyetuju ${worst.name} (level ${worst.authorityLevel})`,
        }),
      )
    }

    if (rule.requiresDualApproval) {
      const distinct = new Set(approvers.map((p) => p.id))
      if (distinct.size < 2) {
        found.push(
          make('R1-wewenang', {
            workItemId,
            stageCode,
            type: 'authority_violation',
            severity: 'high',
            occurredAt: approvals[0].occurredAt,
            costImpactIdr: amount,
            description: 'Aturan mewajibkan dua penyetuju berbeda, hanya satu yang menyetujui.',
            evidence: `${item?.documentNumber ?? workItemId} · nilai Rp ${amount.toLocaleString('id-ID')} · aturan ${rule.id} · jumlah penyetuju berbeda ${distinct.size}`,
          }),
        )
      }
    }
  }

  // ---------- R2: dugaan tagihan dobel ----------
  const invoices = dataset.workItems.filter((i) => i.type === 'payable_invoice')
  const invoiceGroups = new Map<string, WorkItem[]>()
  for (const invoice of invoices) {
    if (!invoice.refs.supplierId || !invoice.amount) continue
    const key = `${invoice.refs.supplierId}::${invoice.amount}`
    const list = invoiceGroups.get(key)
    if (list) list.push(invoice)
    else invoiceGroups.set(key, [invoice])
  }
  const windowMs = opts.duplicateWindowDays * 86_400_000
  for (const group of invoiceGroups.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = Date.parse(sorted[i].createdAt) - Date.parse(sorted[i - 1].createdAt)
      if (gap > windowMs) continue
      found.push(
        make('R2-invoice-dobel', {
          workItemId: sorted[i].id,
          stageCode: 'FIN-20',
          detectedAtStage: 'FIN-20',
          type: 'duplicate_entry',
          severity: 'high',
          occurredAt: sorted[i].createdAt,
          costImpactIdr: sorted[i].amount ?? 0,
          description: 'Dua tagihan dari vendor yang sama dengan nilai sama, berdekatan waktunya.',
          evidence: `${sorted[i - 1].documentNumber} dan ${sorted[i].documentNumber} · vendor ${sorted[i].refs.supplierId} · nilai Rp ${(sorted[i].amount ?? 0).toLocaleString('id-ID')} · selisih ${Math.round(gap / 86_400_000)} hari`,
        }),
      )
    }
  }

  // ---------- R3: gerbang pemeriksaan dilewati ----------
  const path = mainPath()
  const pathIndex = new Map(path.map((s, i) => [s.code, i]))
  const inspectionStages = path.filter((s) => s.kind === 'inspection')

  const visitsByItem = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    const list = visitsByItem.get(visit.workItemId)
    if (list) list.push(visit)
    else visitsByItem.set(visit.workItemId, [visit])
  }

  for (const [workItemId, itemVisits] of visitsByItem) {
    const visitedCodes = new Set(itemVisits.map((v) => v.stageCode))
    const completed = itemVisits.filter((v) => v.completedAt !== null)
    if (completed.length === 0) continue

    // Stage terjauh yang sudah diselesaikan objek ini di jalur utama.
    const furthest = completed.reduce((best, v) => {
      const idx = pathIndex.get(v.stageCode)
      return idx !== undefined && idx > best ? idx : best
    }, -1)
    if (furthest < 0) continue

    // Gerbang pemeriksaan sebelum titik itu yang tidak pernah dilalui.
    const firstIndex = itemVisits.reduce((min, v) => {
      const idx = pathIndex.get(v.stageCode)
      return idx !== undefined && idx < min ? idx : min
    }, Number.MAX_SAFE_INTEGER)

    for (const gate of inspectionStages) {
      const gateIndex = pathIndex.get(gate.code)
      if (gateIndex === undefined) continue
      if (gateIndex <= firstIndex || gateIndex >= furthest) continue
      if (visitedCodes.has(gate.code)) continue

      const nextStage = path[furthest]
      const item = itemById.get(workItemId)
      found.push(
        make('R3-gerbang-dilewati', {
          workItemId,
          stageCode: gate.code,
          detectedAtStage: nextStage.code,
          type: 'procedure_skipped',
          severity: 'high',
          occurredAt: completed[0].completedAt ?? dataset.snapshotAt,
          description: `Pekerjaan sudah sampai ${nextStage.code} padahal gerbang ${gate.code} (${gate.name}) tidak pernah dilalui.`,
          evidence: `${item?.documentNumber ?? workItemId} · stage terlewat ${gate.code} · sudah sampai ${nextStage.code}`,
        }),
      )
    }
  }

  // ---------- R4: pencatatan jauh setelah kejadian ----------
  for (const event of dataset.events) {
    const lag = event.recordingLagHours ?? calendarHoursBetween(event.occurredAt, event.recordedAt)
    if (lag <= opts.recordingLagHours) continue
    const item = itemById.get(event.workItemId)
    found.push(
      make('R4-catat-terlambat', {
        workItemId: event.workItemId,
        stageCode: event.stageCode,
        type: 'document_late',
        severity: lag > 72 ? 'high' : 'medium',
        occurredAt: event.occurredAt,
        personId: event.actorPersonId,
        delayImpactHours: Math.round(lag),
        description: `Kejadian dicatat ${Math.round(lag)} jam setelah benar-benar terjadi.`,
        evidence: `${item?.documentNumber ?? event.workItemId} · event ${event.type} di ${event.stageCode} · terjadi ${event.occurredAt} · dicatat ${event.recordedAt}`,
      }),
    )
  }

  // ---------- R5: persetujuan menggantung ----------
  for (const visit of visits) {
    const stage = getStage(visit.stageCode)
    if (!stage || stage.kind !== 'approval') continue
    if (visit.waitHours === null) continue
    if (visit.blockedHours > 0) continue
    if (visit.waitHours <= stage.escalateAfterHours) continue

    const item = itemById.get(visit.workItemId)
    found.push(
      make('R5-approval-menggantung', {
        workItemId: visit.workItemId,
        stageCode: visit.stageCode,
        type: 'approval_delay',
        severity: visit.waitHours > stage.escalateAfterHours * 3 ? 'critical' : 'high',
        occurredAt: visit.arrivedAt ?? dataset.snapshotAt,
        personId: visit.actorPersonId,
        delayImpactHours: Math.round(visit.waitHours - stage.escalateAfterHours),
        costImpactIdr: item?.amount ?? 0,
        description: `Mengantre ${Math.round(visit.waitHours)} jam kerja di stage persetujuan, batas eskalasinya ${stage.escalateAfterHours} jam.`,
        evidence: `${item?.documentNumber ?? visit.workItemId} · masuk antrean ${visit.arrivedAt ?? '—'} · mulai dikerjakan ${visit.startedAt ?? 'belum'} · tidak ada catatan tertahan pihak luar`,
      }),
    )
  }

  // ---------- R6: data diubah setelah disetujui ----------
  const eventsByItem = new Map<string, WorkEvent[]>()
  for (const event of dataset.events) {
    const list = eventsByItem.get(event.workItemId)
    if (list) list.push(event)
    else eventsByItem.set(event.workItemId, [event])
  }
  for (const [workItemId, events] of eventsByItem) {
    const approvedAt = events
      .filter((e) => e.type === 'approved')
      .map((e) => Date.parse(e.occurredAt))
      .sort((a, b) => a - b)[0]
    if (approvedAt === undefined) continue

    for (const event of events) {
      if (event.type !== 'field_changed') continue
      if (Date.parse(event.occurredAt) <= approvedAt) continue
      const item = itemById.get(workItemId)
      found.push(
        make('R6-ubah-setelah-disetujui', {
          workItemId,
          stageCode: event.stageCode,
          type: 'data_error',
          severity: 'critical',
          occurredAt: event.occurredAt,
          personId: event.actorPersonId,
          costImpactIdr: item?.amount ?? 0,
          description: `Kolom ${event.change?.field ?? 'tidak diketahui'} diubah setelah dokumen disetujui.`,
          evidence: `${item?.documentNumber ?? workItemId} · ${event.change?.field ?? '?'}: ${String(event.change?.from ?? '?')} → ${String(event.change?.to ?? '?')} · diubah ${event.occurredAt}, disetujui ${new Date(approvedAt).toISOString()}`,
        }),
      )
    }
  }

  // ---------- R7: selesai tanpa catatan mulai ----------
  for (const visit of visits) {
    if (visit.completedAt === null) continue
    if (visit.startedAt !== null) continue
    const item = itemById.get(visit.workItemId)
    const cal = resolveCalendar(
      dataset.calendars,
      dataset.slaTargets.find((t) => t.stageCode === visit.stageCode)?.calendarId,
    )
    const span = visit.arrivedAt ? workingHoursBetween(visit.arrivedAt, visit.completedAt, cal) : 0
    found.push(
      make('R7-kerja-tanpa-serah-terima', {
        workItemId: visit.workItemId,
        stageCode: visit.stageCode,
        type: 'unrecorded_work',
        severity: 'low',
        occurredAt: visit.completedAt,
        description: 'Ada catatan selesai tapi tidak ada catatan siapa yang mulai mengerjakan.',
        evidence: `${item?.documentNumber ?? visit.workItemId} · ${visit.stageCode} · selesai ${visit.completedAt}${span > 0 ? ` · rentang ${Math.round(span)} jam kerja` : ''}`,
      }),
    )
  }

  // ---------- Pemotongan per aturan, dilaporkan apa adanya ----------
  const countByRule: Record<string, number> = {}
  for (const incident of found) {
    countByRule[incident.ruleId] = (countByRule[incident.ruleId] ?? 0) + 1
  }

  const kept: DetectedIncident[] = []
  const perRuleKept: Record<string, number> = {}
  const truncated: Record<string, number> = {}

  // Yang paling berat didahulukan, supaya kalau terpotong yang tersisa yang penting.
  const severityRank: Record<IncidentSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const ordered = [...found].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  for (const incident of ordered) {
    const keptSoFar = perRuleKept[incident.ruleId] ?? 0
    if (keptSoFar >= opts.maxPerRule) {
      truncated[incident.ruleId] = (truncated[incident.ruleId] ?? 0) + 1
      continue
    }
    perRuleKept[incident.ruleId] = keptSoFar + 1
    kept.push(incident)
  }

  return {
    incidents: kept,
    countByRule,
    truncated,
    totalFound: found.length,
    totalReturned: kept.length,
  }
}

/**
 * Dataset dengan temuan otomatis ikut dihitung sebagai insiden.
 *
 * Dipakai supaya metrik kesalahan (Pareto, escape rate, kesalahan per 100 item)
 * mencerminkan kesalahan yang ditemukan sistem, bukan hanya yang dilaporkan
 * orang. Di bulan-bulan awal, yang ditemukan sistem biasanya jauh lebih banyak —
 * dan itu justru gambaran yang lebih jujur.
 */
export function withDetectedIncidents(
  dataset: OpsDataset,
  visits: StageVisit[],
  options?: DetectOptions,
): { dataset: OpsDataset; detection: DetectionSummary } {
  const detection = detectIncidents(dataset, visits, options)
  return {
    dataset: { ...dataset, incidents: [...dataset.incidents, ...detection.incidents] },
    detection,
  }
}

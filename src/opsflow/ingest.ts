/**
 * OpsFlow — Adapter ingestion.
 *
 * Mengubah ekspor riwayat status dari sistem existing (bentuk CSV di
 * `docs/opsflow/templates/B-transaksi-historis.csv`) menjadi `OpsDataset` yang
 * bisa langsung dipakai mesin metrik.
 *
 * Tiga hal yang wajib ada di lapisan ini, dan ketiganya sering dilupakan:
 *
 * 1. **Idempotensi.** Kunci unik = `sourceSystem` + `externalId` untuk objek
 *    kerja, dan sidik jari deterministik untuk event. Sinkronisasi yang
 *    dijalankan dua kali tidak boleh menghasilkan data dobel — kalau tidak,
 *    angka throughput naik palsu setiap kali sinkronisasi diulang setelah
 *    gangguan jaringan, dan tidak ada yang menyadarinya.
 *
 * 2. **Penolakan yang tercatat, bukan yang dibuang diam-diam.** Setiap baris
 *    yang tidak bisa diproses masuk daftar penolakan beserta alasannya. Tanpa
 *    daftar itu, dashboard akan menampilkan "stage ini aman" padahal artinya
 *    "data stage ini tidak masuk" — kebohongan yang meyakinkan, dan jenis
 *    kegagalan paling berbahaya di sistem seperti ini.
 *
 * 3. **Pemetaan status yang bisa dikonfigurasi.** Nama status di tiap perusahaan
 *    berbeda ("Approved", "Disetujui", "APPROVE_2"). Pemetaan dari
 *    (jenis dokumen, status) ke (stage, jenis event) adalah data konfigurasi,
 *    bukan kode. `DEFAULT_STATUS_MAP` di bawah hanya titik awal untuk diedit.
 */

import { CONTINUOUS_CALENDAR, DEFAULT_CALENDAR } from './calendar.ts'
import type {
  EventType,
  IngestionRun,
  OpsDataset,
  Person,
  SlaTarget,
  Team,
  WorkEvent,
  WorkItem,
  WorkItemStatus,
} from './schema.ts'
import { STAGES, allTeams, getStage, type SectorId, type WorkItemType } from './taxonomy.ts'

// ============================================================
// Pembacaan CSV
// ============================================================

/**
 * Pembaca CSV kecil yang menangani tanda kutip, koma di dalam kutip, kutip ganda
 * yang di-escape, dan baris baru CRLF. Sengaja tanpa dependensi: satu pustaka
 * tambahan untuk pekerjaan sebesar ini tidak sebanding, dan bentuk masukannya
 * sudah ditentukan oleh template sendiri.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    // Lewati baris yang benar-benar kosong.
    if (row.length > 1 || row[0]?.trim() !== '') rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      pushField()
    } else if (char === '\n') {
      pushField()
      pushRow()
    } else if (char === '\r') {
      // Diabaikan; '\n' berikutnya yang menutup baris.
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    pushField()
    pushRow()
  }

  return rows
}

/** Ubah CSV berjudul kolom jadi daftar objek. Nama kolom dinormalkan ke huruf kecil. */
export function csvToRecords(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim()
    })
    return record
  })
}

// ============================================================
// Pemetaan status → stage
// ============================================================

export interface StatusMapping {
  /** Nilai kolom `jenis_dokumen` di ekspor. */
  docType: string
  /** Nilai kolom `status_ke` di ekspor. Dicocokkan tanpa peduli huruf besar/kecil. */
  statusTo: string
  stageCode: string
  eventType: EventType
  /** Jenis objek kerja yang dibentuk baris ini. */
  workItemType: WorkItemType
}

/**
 * Titik awal pemetaan, memakai nama status yang lazim di sistem pengadaan.
 * **Ini yang harus diedit bersama tim IT**, karena nama statusnya pasti berbeda.
 * Baris yang statusnya tidak dikenali TIDAK dibuang diam-diam — ia masuk daftar
 * penolakan dengan alasan "status tidak dikenali", sehingga pemetaan bisa
 * dilengkapi berdasarkan kenyataan, bukan dugaan.
 */
export const DEFAULT_STATUS_MAP: StatusMapping[] = [
  // Permintaan barang
  { docType: 'PR', statusTo: 'Diajukan', stageCode: 'PROC-10', eventType: 'completed', workItemType: 'purchase_request' },
  { docType: 'PR', statusTo: 'Divalidasi', stageCode: 'PROC-20', eventType: 'completed', workItemType: 'purchase_request' },
  { docType: 'PR', statusTo: 'Dicek anggaran', stageCode: 'FIN-10', eventType: 'completed', workItemType: 'purchase_request' },
  { docType: 'PR', statusTo: 'Disetujui', stageCode: 'PROC-40', eventType: 'approved', workItemType: 'purchase_request' },

  // Purchase order
  { docType: 'PO', statusTo: 'Diajukan', stageCode: 'PROC-40', eventType: 'arrived', workItemType: 'purchase_order' },
  { docType: 'PO', statusTo: 'Disetujui', stageCode: 'PROC-40', eventType: 'approved', workItemType: 'purchase_order' },
  { docType: 'PO', statusTo: 'Terkirim ke vendor', stageCode: 'PROC-50', eventType: 'completed', workItemType: 'purchase_order' },
  { docType: 'PO', statusTo: 'Dikonfirmasi vendor', stageCode: 'PROC-60', eventType: 'completed', workItemType: 'purchase_order' },

  // Penerimaan barang
  { docType: 'GRN', statusTo: 'Diterima', stageCode: 'PROC-70', eventType: 'completed', workItemType: 'goods_receipt' },
  { docType: 'GRN', statusTo: 'Lolos QC', stageCode: 'PROC-80', eventType: 'completed', workItemType: 'goods_receipt' },
  { docType: 'GRN', statusTo: 'Ditolak QC', stageCode: 'PROC-80', eventType: 'rejected', workItemType: 'goods_receipt' },

  // Tagihan vendor
  { docType: 'INV', statusTo: 'Diterima', stageCode: 'FIN-20', eventType: 'arrived', workItemType: 'payable_invoice' },
  { docType: 'INV', statusTo: 'Diverifikasi', stageCode: 'FIN-20', eventType: 'completed', workItemType: 'payable_invoice' },
  { docType: 'INV', statusTo: 'Pajak diverifikasi', stageCode: 'FIN-30', eventType: 'completed', workItemType: 'payable_invoice' },
  { docType: 'INV', statusTo: 'Disetujui', stageCode: 'FIN-40', eventType: 'approved', workItemType: 'payable_invoice' },
  { docType: 'INV', statusTo: 'Dijadwalkan bayar', stageCode: 'FIN-50', eventType: 'completed', workItemType: 'payable_invoice' },
  { docType: 'INV', statusTo: 'Dibayar', stageCode: 'FIN-60', eventType: 'completed', workItemType: 'payment' },

  // Sales order & pengiriman
  { docType: 'SO', statusTo: 'Dikonfirmasi', stageCode: 'DEL-10', eventType: 'completed', workItemType: 'sales_order' },
  { docType: 'WO', statusTo: 'Dijadwalkan', stageCode: 'PRD-10', eventType: 'completed', workItemType: 'production_order' },
  { docType: 'WO', statusTo: 'Material keluar', stageCode: 'PRD-30', eventType: 'completed', workItemType: 'production_order' },
  { docType: 'WO', statusTo: 'Selesai produksi', stageCode: 'PRD-50', eventType: 'completed', workItemType: 'production_order' },
  { docType: 'WO', statusTo: 'Lolos QC akhir', stageCode: 'PRD-80', eventType: 'completed', workItemType: 'production_order' },
  { docType: 'SJ', statusTo: 'Diterbitkan', stageCode: 'DEL-20', eventType: 'completed', workItemType: 'delivery_order' },
  { docType: 'SJ', statusTo: 'Dimuat', stageCode: 'DEL-50', eventType: 'completed', workItemType: 'delivery_order' },
  { docType: 'SJ', statusTo: 'Diterima pelanggan', stageCode: 'DEL-70', eventType: 'completed', workItemType: 'delivery_order' },
]

// ============================================================
// Ingestion
// ============================================================

export interface IngestOptions {
  sourceSystem: string
  statusMap?: StatusMapping[]
  /**
   * Zona waktu ekspor kalau kolom waktunya tidak menyertakan offset.
   * Wajib eksplisit: menebak zona waktu adalah cara paling halus untuk
   * menghasilkan angka yang salah secara konsisten.
   */
  timezoneOffset?: string
  /** Waktu acuan snapshot. Default: waktu event terakhir yang berhasil dibaca. */
  snapshotAt?: string
  /** Master data yang sudah ada. Yang tidak diberikan akan dibentuk minimal dari ekspor. */
  base?: Partial<OpsDataset>
}

export interface IngestResult {
  dataset: OpsDataset
  run: IngestionRun
  /** Status yang muncul di ekspor tapi belum ada di pemetaan — daftar kerja berikutnya. */
  unmappedStatuses: Array<{ docType: string; statusTo: string; count: number }>
}

const REQUIRED_COLUMNS = ['jenis_dokumen', 'nomor_dokumen', 'status_ke', 'waktu_perubahan']

/** Ubah 'YYYY-MM-DD HH:MM' jadi ISO dengan offset eksplisit. */
function toIso(raw: string, offset: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  // Sudah ISO lengkap dengan offset atau Z.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  }
  const normalised = value.replace(' ', 'T')
  const withSeconds = /T\d{2}:\d{2}$/.test(normalised) ? `${normalised}:00` : normalised
  const parsed = Date.parse(`${withSeconds}${offset}`)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (cleaned === '') return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

/**
 * Bentuk master data minimal dari taksonomi kalau belum disediakan, supaya mesin
 * metrik bisa jalan sejak ekspor pertama — SLA-nya masih hipotesis, dan itu
 * ditandai di `basis` sehingga tidak tertukar dengan angka yang sudah dikalibrasi.
 */
function scaffoldMasterData(): { teams: Team[]; slaTargets: SlaTarget[] } {
  const continuous = new Set([
    'Gudang Inbound',
    'Gudang Produksi',
    'Gudang Finished Goods',
    'Produksi (per line & shift)',
    'QC In-Process',
    'Gudang + Driver',
    'Ekspedisi',
  ])

  const teams: Team[] = allTeams().map((def, index) => ({
    id: `T${String(index + 1).padStart(2, '0')}`,
    name: def.team,
    sector: def.sector as SectorId,
    leadPersonId: '',
    headcount: 1,
  }))

  const slaTargets: SlaTarget[] = STAGES.map((stage) => ({
    stageCode: stage.code,
    maxWaitHours: stage.slaWaitHours,
    maxTouchHours: stage.slaTouchHours,
    calendarId: continuous.has(stage.team) ? CONTINUOUS_CALENDAR.id : DEFAULT_CALENDAR.id,
    basis: 'hypothesis',
    effectiveFrom: '1970-01-01T00:00:00+07:00',
  }))

  return { teams, slaTargets }
}

/**
 * Baca ekspor riwayat status jadi OpsDataset.
 *
 * Satu baris ekspor = satu perpindahan status = satu event. Objek kerja dibentuk
 * dari kumpulan baris dengan nomor dokumen yang sama, dan tautan antar objek
 * dibentuk dari kolom `nomor_dokumen_sebelumnya` — tautan itulah yang membuat
 * pertanyaan "kenapa order ini telat" bisa ditelusuri sampai ke sektor lain.
 */
export function ingestStatusHistoryCsv(csvText: string, options: IngestOptions): IngestResult {
  const statusMap = options.statusMap ?? DEFAULT_STATUS_MAP
  const offset = options.timezoneOffset ?? '+07:00'
  const records = csvToRecords(csvText)

  const rejections: IngestionRun['rejections'] = []
  const unmapped = new Map<string, { docType: string; statusTo: string; count: number }>()

  const mapKey = (docType: string, statusTo: string) => `${docType.trim().toLowerCase()}::${statusTo.trim().toLowerCase()}`
  const mapping = new Map(statusMap.map((m) => [mapKey(m.docType, m.statusTo), m]))

  const itemsByExternalId = new Map<string, WorkItem>()
  /** Sidik jari event untuk idempotensi: dokumen + stage + jenis + waktu. */
  const eventFingerprints = new Set<string>()
  const events: WorkEvent[] = []
  const pendingLinks: Array<{ from: string; to: string }> = []

  let read = 0
  let latestEventMs = 0

  // Validasi judul kolom sekali, di depan. Ekspor yang kolomnya salah akan
  // menghasilkan ribuan penolakan identik kalau dibiarkan lewat.
  if (records.length > 0) {
    const present = Object.keys(records[0])
    const missing = REQUIRED_COLUMNS.filter((c) => !present.includes(c))
    if (missing.length > 0) {
      return {
        dataset: emptyDataset(options, offset),
        run: {
          id: `ingest-${options.sourceSystem}`,
          sourceSystem: options.sourceSystem,
          startedAt: new Date(0).toISOString(),
          finishedAt: new Date(0).toISOString(),
          status: 'failed',
          coveredStageCodes: [],
          recordsRead: records.length,
          recordsWritten: 0,
          recordsRejected: records.length,
          rejections: [
            {
              externalId: '(header)',
              reason: `Kolom wajib tidak ada: ${missing.join(', ')}. Bandingkan dengan docs/opsflow/templates/B-transaksi-historis.csv`,
            },
          ],
        },
        unmappedStatuses: [],
      }
    }
  }

  for (const record of records) {
    read += 1
    const docType = record.jenis_dokumen
    const docNumber = record.nomor_dokumen
    const statusTo = record.status_ke
    const externalId = docNumber

    if (!docNumber) {
      rejections.push({ externalId: '(kosong)', reason: 'nomor_dokumen kosong' })
      continue
    }

    const occurredAt = toIso(record.waktu_perubahan, offset)
    if (!occurredAt) {
      rejections.push({ externalId, reason: `waktu_perubahan tidak bisa dibaca: "${record.waktu_perubahan}"` })
      continue
    }

    const map = mapping.get(mapKey(docType, statusTo))
    if (!map) {
      const key = mapKey(docType, statusTo)
      const existing = unmapped.get(key)
      if (existing) existing.count += 1
      else unmapped.set(key, { docType, statusTo, count: 1 })
      rejections.push({
        externalId,
        reason: `Status tidak dikenali: jenis "${docType}" status "${statusTo}". Tambahkan ke pemetaan status.`,
      })
      continue
    }

    if (!getStage(map.stageCode)) {
      rejections.push({ externalId, reason: `Pemetaan menunjuk stage yang tidak ada: ${map.stageCode}` })
      continue
    }

    // ---- Objek kerja (idempoten per sourceSystem + externalId) ----
    const itemKey = `${options.sourceSystem}::${externalId}`
    let item = itemsByExternalId.get(itemKey)
    if (!item) {
      item = {
        id: `WI-${externalId}`,
        type: map.workItemType,
        documentNumber: docNumber,
        externalId,
        sourceSystem: options.sourceSystem,
        currentStageCode: map.stageCode,
        status: 'open',
        createdAt: occurredAt,
        closedAt: null,
        priority: 'normal',
        links: [],
        refs: {},
      }
      itemsByExternalId.set(itemKey, item)
    }

    // Tanggal lahir = event paling awal; stage sekarang = event paling akhir.
    if (Date.parse(occurredAt) < Date.parse(item.createdAt)) item.createdAt = occurredAt
    item.currentStageCode = map.stageCode

    const amount = parseAmount(record.nilai_rp ?? '')
    if (amount !== undefined) item.amount = amount

    const itemCode = record.kode_item
    if (itemCode) item.refs.itemIds = [...new Set([...(item.refs.itemIds ?? []), itemCode])]

    const partner = record.kode_supplier_atau_pelanggan
    if (partner) {
      // Rantai pengadaan merujuk supplier; rantai pemenuhan merujuk pelanggan.
      const procurement: WorkItemType[] = ['purchase_request', 'purchase_order', 'goods_receipt', 'payable_invoice', 'payment']
      if (procurement.includes(item.type)) item.refs.supplierId = partner
      else item.refs.customerId = partner
    }

    const promised = toIso(record.tanggal_dibutuhkan_atau_dijanjikan ?? '', offset)
    if (promised) item.promisedAt = promised

    const finalStatus = (record.status_akhir ?? '').toLowerCase()
    if (finalStatus.startsWith('selesai')) item.status = 'completed'
    else if (finalStatus.startsWith('batal')) item.status = 'cancelled'
    else if (finalStatus.startsWith('tolak') || finalStatus.startsWith('ditolak')) item.status = 'rejected'

    const previous = record.nomor_dokumen_sebelumnya
    if (previous) pendingLinks.push({ from: item.id, to: `WI-${previous}` })

    // ---- Event (idempoten lewat sidik jari) ----
    const fingerprint = `${options.sourceSystem}|${externalId}|${map.stageCode}|${map.eventType}|${occurredAt}`
    if (eventFingerprints.has(fingerprint)) {
      // Bukan penolakan: baris dobel adalah keadaan normal saat sinkronisasi
      // diulang. Yang penting ia tidak menambah data.
      continue
    }
    eventFingerprints.add(fingerprint)

    events.push({
      id: `E-${fingerprint.length}-${events.length + 1}`,
      workItemId: item.id,
      stageCode: map.stageCode,
      type: map.eventType,
      occurredAt,
      // Ekspor historis tidak menyimpan kapan barisnya dicatat; anggap sama
      // dengan waktu kejadian. Metrik disiplin pencatatan baru bisa dihitung
      // setelah data mengalir dari sistem yang mencatat keduanya.
      recordedAt: occurredAt,
      actorPersonId: record.id_pegawai_pelaku || null,
      recordedBy: `${options.sourceSystem}-csv-import`,
      recordingLagHours: 0,
    })

    latestEventMs = Math.max(latestEventMs, Date.parse(occurredAt))
  }

  // ---- Tautan antar objek, hanya ke objek yang benar-benar ada ----
  const itemsById = new Map([...itemsByExternalId.values()].map((i) => [i.id, i]))
  for (const link of pendingLinks) {
    const source = itemsById.get(link.from)
    if (!source) continue
    if (!itemsById.has(link.to)) {
      rejections.push({
        externalId: source.externalId,
        reason: `nomor_dokumen_sebelumnya menunjuk dokumen yang tidak ada di ekspor ini: ${link.to.replace('WI-', '')}`,
      })
      continue
    }
    if (source.links.some((l) => l.targetWorkItemId === link.to)) continue
    source.links.push({ targetWorkItemId: link.to, relation: 'derived_from' })
  }

  // ---- Tanggal selesai dari event terakhir objek yang statusnya selesai ----
  const lastEventByItem = new Map<string, string>()
  for (const event of events) {
    const current = lastEventByItem.get(event.workItemId)
    if (!current || Date.parse(event.occurredAt) > Date.parse(current)) {
      lastEventByItem.set(event.workItemId, event.occurredAt)
    }
  }
  for (const item of itemsById.values()) {
    if (item.status === 'completed') item.closedAt = lastEventByItem.get(item.id) ?? null
  }

  const scaffold = scaffoldMasterData()
  const workItems = [...itemsById.values()]
  const snapshotAt =
    options.snapshotAt ?? (latestEventMs > 0 ? new Date(latestEventMs).toISOString() : new Date(0).toISOString())

  const dataset: OpsDataset = {
    people: (options.base?.people as Person[]) ?? [],
    teams: options.base?.teams ?? scaffold.teams,
    approvalRules: options.base?.approvalRules ?? [],
    delegations: options.base?.delegations ?? [],
    calendars: options.base?.calendars ?? [DEFAULT_CALENDAR, CONTINUOUS_CALENDAR],
    slaTargets: options.base?.slaTargets ?? scaffold.slaTargets,
    suppliers: options.base?.suppliers ?? [],
    customers: options.base?.customers ?? [],
    items: options.base?.items ?? [],
    bom: options.base?.bom ?? [],
    productionLines: options.base?.productionLines ?? [],
    carriers: options.base?.carriers ?? [],
    workItems,
    events,
    incidents: options.base?.incidents ?? [],
    snapshotAt,
  }

  const coveredStageCodes = [...new Set(events.map((e) => e.stageCode))].sort()

  const run: IngestionRun = {
    id: `ingest-${options.sourceSystem}-${coveredStageCodes.length}`,
    sourceSystem: options.sourceSystem,
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(0).toISOString(),
    status: rejections.length === 0 ? 'success' : events.length > 0 ? 'partial' : 'failed',
    coveredStageCodes,
    recordsRead: read,
    recordsWritten: events.length,
    recordsRejected: rejections.length,
    // Batasi daftar penolakan yang dibawa, tapi jumlah totalnya tetap utuh di
    // `recordsRejected` supaya tidak ada yang terlihat lebih bersih dari kenyataan.
    rejections: rejections.slice(0, 200),
  }

  return {
    dataset,
    run,
    unmappedStatuses: [...unmapped.values()].sort((a, b) => b.count - a.count),
  }
}

function emptyDataset(options: IngestOptions, _offset: string): OpsDataset {
  const scaffold = scaffoldMasterData()
  return {
    people: [],
    teams: scaffold.teams,
    approvalRules: [],
    delegations: [],
    calendars: [DEFAULT_CALENDAR, CONTINUOUS_CALENDAR],
    slaTargets: scaffold.slaTargets,
    suppliers: [],
    customers: [],
    items: [],
    bom: [],
    productionLines: [],
    carriers: [],
    workItems: [],
    events: [],
    incidents: [],
    snapshotAt: options.snapshotAt ?? new Date(0).toISOString(),
  }
}

/** Status yang dipakai mesin metrik, diekspos agar adapter lain konsisten. */
export const WORK_ITEM_STATUSES: WorkItemStatus[] = [
  'open',
  'blocked',
  'on_hold',
  'completed',
  'cancelled',
  'rejected',
]

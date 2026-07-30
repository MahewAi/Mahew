/**
 * OpsFlow — Dataset contoh.
 *
 * Fungsinya dua:
 *  1. Spesifikasi hidup. Bentuk data di sini adalah bentuk yang harus
 *     dihasilkan adapter ingestion nanti. Kalau ragu "kolom ini isinya apa",
 *     lihat contoh di file ini.
 *  2. Bahan uji mesin metrik tanpa perlu data perusahaan sungguhan.
 *
 * Angka dibangkitkan dengan generator acak berbibit tetap (seeded), jadi
 * hasilnya selalu sama setiap dijalankan. Tidak memakai `Math.random()` maupun
 * `Date.now()` supaya pengujian bisa diandalkan.
 *
 * Bottleneck sengaja ditanam di FIN-40 (Persetujuan Berjenjang) dan PROC-30
 * (Sourcing) supaya bisa dipastikan mesin deteksinya benar-benar menemukannya.
 */

import { CONTINUOUS_CALENDAR, DEFAULT_CALENDAR } from './calendar.ts'
import type {
  ApprovalRule,
  Customer,
  Incident,
  IncidentType,
  Item,
  OpsDataset,
  Person,
  SlaTarget,
  Supplier,
  Team,
  WorkEvent,
  WorkItem,
} from './schema.ts'
import { STAGES, allTeams, getStage, type WorkItemType } from './taxonomy.ts'

/** Generator kongruen linier — acak tapi dapat diulang. */
function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

const HOUR_MS = 3_600_000

/** Sub-tim yang bekerja terus-menerus (shift/gudang) — kalendernya beda. */
const CONTINUOUS_TEAMS = new Set([
  'Gudang Inbound',
  'Gudang Produksi',
  'Gudang Finished Goods',
  'Produksi (per line & shift)',
  'QC In-Process',
  'Gudang + Driver',
  'Ekspedisi',
])

/** Stage yang sengaja dibuat lambat, beserta pengali keterlambatannya. */
const INJECTED_DELAY: Record<string, number> = {
  'FIN-40': 9, // persetujuan menggantung berhari-hari
  'PROC-30': 4, // sourcing lambat menunggu penawaran vendor
  'FIN-20': 2.5, // 3-way match tertahan karena GRN belum dibuat
  'DEL-70': 3, // bukti terima lama kembali ke kantor
}

const PROCUREMENT_PATH = ['PROC-10', 'PROC-20', 'FIN-10', 'PROC-30', 'PROC-40', 'PROC-50', 'PROC-60', 'PROC-70', 'PROC-80']
const PAYABLE_PATH = ['FIN-20', 'FIN-30', 'FIN-40', 'FIN-50', 'FIN-60', 'FIN-70']
const PRODUCTION_PATH = ['PRD-10', 'PRD-20', 'PRD-30', 'PRD-40', 'PRD-50', 'PRD-60', 'PRD-80', 'PRD-90']
const DELIVERY_PATH = ['DEL-10', 'DEL-20', 'DEL-30', 'DEL-40', 'DEL-50', 'DEL-60', 'DEL-70', 'DEL-90']

const INCIDENT_POOL: Array<{ stage: string; type: IncidentType; detectedAt: string; description: string }> = [
  {
    stage: 'PROC-10',
    type: 'data_error',
    detectedAt: 'PROC-70',
    description: 'Kode item pada PR memakai nama pasaran, barang yang datang beda varian',
  },
  {
    stage: 'PROC-50',
    type: 'data_error',
    detectedAt: 'FIN-20',
    description: 'Satuan pada PO tertulis pcs, seharusnya box',
  },
  {
    stage: 'PROC-70',
    type: 'unrecorded_work',
    detectedAt: 'FIN-20',
    description: 'Barang diterima fisik tapi GRN baru dibuat 4 hari kemudian',
  },
  {
    stage: 'FIN-40',
    type: 'approval_delay',
    detectedAt: 'FIN-40',
    description: 'Persetujuan menggantung karena penyetuju dinas luar tanpa delegasi',
  },
  {
    stage: 'FIN-20',
    type: 'duplicate_entry',
    detectedAt: 'FIN-80',
    description: 'Invoice vendor tercatat dua kali dengan nomor sedikit berbeda',
  },
  {
    stage: 'PRD-30',
    type: 'quantity_variance',
    detectedAt: 'FIN-80',
    description: 'Material keluar gudang tanpa dokumen, selisih ketahuan saat stock opname',
  },
  {
    stage: 'PRD-50',
    type: 'procedure_skipped',
    detectedAt: 'PRD-80',
    description: 'Produksi berjalan sebelum QC barang masuk mengeluarkan hasil',
  },
  {
    stage: 'DEL-30',
    type: 'spec_mismatch',
    detectedAt: 'DEL-70',
    description: 'Salah ambil varian ukuran yang mirip, ditolak pelanggan di lokasi',
  },
  {
    stage: 'DEL-20',
    type: 'document_missing',
    detectedAt: 'DEL-90',
    description: 'Surat jalan tidak terhubung ke sales order, penagihan tertahan',
  },
  {
    stage: 'DEL-70',
    type: 'document_late',
    detectedAt: 'DEL-90',
    description: 'Bukti terima kembali ke kantor 9 hari setelah barang diterima',
  },
]

export interface ExampleOptions {
  seed?: number
  procurementChains?: number
  fulfillmentChains?: number
  /** Awal periode data. Default: 90 hari sebelum snapshot. */
  startAt?: string
  /** Waktu acuan snapshot. */
  snapshotAt?: string
  /**
   * Rentang hari untuk menyebar tanggal lahir objek kerja.
   * Harus lebih pendek dari jarak startAt→snapshotAt supaya sebagian rantai
   * punya waktu untuk selesai, sementara sebagian masih berjalan (WIP).
   */
  spreadDays?: number
}

export function buildExampleDataset(options: ExampleOptions = {}): OpsDataset {
  const rng = createRng(options.seed ?? 20260729)
  const procurementChains = options.procurementChains ?? 60
  const fulfillmentChains = options.fulfillmentChains ?? 45
  const snapshotAt = options.snapshotAt ?? '2026-07-29T17:00:00+07:00'
  const snapshotMs = Date.parse(snapshotAt)
  const startMs = Date.parse(options.startAt ?? new Date(snapshotMs - 90 * 24 * HOUR_MS).toISOString())
  const spreadDays = options.spreadDays ?? 62
  const spreadMs = spreadDays * 24 * HOUR_MS
  const procurementSpacingMs = spreadMs / Math.max(1, procurementChains)
  const fulfillmentSpacingMs = spreadMs / Math.max(1, fulfillmentChains)

  // ---------- Master data ----------
  const teamDefs = allTeams()
  const teams: Team[] = []
  const people: Person[] = []

  teamDefs.forEach((def, teamIndex) => {
    const teamId = `T${String(teamIndex + 1).padStart(2, '0')}`
    const headcount = 2 + Math.floor(rng() * 4)
    const memberCount = Math.min(headcount, 3)
    for (let m = 0; m < memberCount; m += 1) {
      people.push({
        id: `${teamId}-P${m + 1}`,
        name: `${def.team} ${m + 1}`,
        teamId,
        position: m === 0 ? 'Lead' : 'Staff',
        authorityLevel: m === 0 ? 3 : 1,
        joinedAt: '2023-01-09T08:00:00+07:00',
        shift: CONTINUOUS_TEAMS.has(def.team) ? `shift-${(m % 3) + 1}` : 'non-shift',
        active: true,
      })
    }
    teams.push({
      id: teamId,
      name: def.team,
      sector: def.sector,
      leadPersonId: `${teamId}-P1`,
      headcount,
    })
  })

  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]))
  const peopleByTeamId = new Map<string, Person[]>()
  for (const person of people) {
    const list = peopleByTeamId.get(person.teamId)
    if (list) list.push(person)
    else peopleByTeamId.set(person.teamId, [person])
  }

  const pickActor = (stageCode: string, salt: number): string | null => {
    const teamName = getStage(stageCode)?.team
    if (!teamName) return null
    const teamId = teamIdByName.get(teamName)
    if (!teamId) return null
    const members = peopleByTeamId.get(teamId) ?? []
    if (members.length === 0) return null
    return members[salt % members.length].id
  }

  const approvalRules: ApprovalRule[] = [
    {
      id: 'AR-1',
      stageCode: 'FIN-40',
      minAmount: 0,
      maxAmount: 50_000_000,
      requiredAuthorityLevel: 3,
      requiresDualApproval: false,
    },
    {
      id: 'AR-2',
      stageCode: 'FIN-40',
      minAmount: 50_000_000,
      maxAmount: null,
      requiredAuthorityLevel: 5,
      requiresDualApproval: true,
    },
    {
      id: 'AR-3',
      stageCode: 'PROC-40',
      minAmount: 0,
      maxAmount: 100_000_000,
      requiredAuthorityLevel: 3,
      requiresDualApproval: false,
    },
    // Band teratas harus terbuka (maxAmount null). Kalau band tertinggi punya
    // batas atas, nilai di atasnya tidak cocok dengan aturan mana pun dan
    // gerbang wewenang lolos begitu saja — makin besar pembeliannya, makin
    // sedikit kontrolnya. Persis kebalikan dari yang seharusnya.
    {
      id: 'AR-4',
      stageCode: 'PROC-40',
      minAmount: 100_000_000,
      maxAmount: null,
      requiredAuthorityLevel: 5,
      requiresDualApproval: true,
    },
  ]

  const slaTargets: SlaTarget[] = STAGES.map((stage) => ({
    stageCode: stage.code,
    maxWaitHours: stage.slaWaitHours,
    maxTouchHours: stage.slaTouchHours,
    calendarId: CONTINUOUS_TEAMS.has(stage.team) ? CONTINUOUS_CALENDAR.id : DEFAULT_CALENDAR.id,
    basis: 'hypothesis',
    effectiveFrom: '2026-05-01T00:00:00+07:00',
  }))

  const suppliers: Supplier[] = Array.from({ length: 8 }, (_, i) => ({
    id: `SUP-${i + 1}`,
    name: `Supplier ${i + 1}`,
    category: i % 2 === 0 ? 'material-utama' : 'material-pendukung',
    promisedLeadTimeDays: 7 + (i % 3) * 7,
    paymentTermDays: [14, 30, 45][i % 3],
    active: true,
  }))

  const customers: Customer[] = Array.from({ length: 10 }, (_, i) => ({
    id: `CUS-${i + 1}`,
    name: `Pelanggan ${i + 1}`,
    region: ['Jakarta', 'Surabaya', 'Medan', 'Makassar'][i % 4],
    paymentTermDays: 30,
    creditLimit: 500_000_000,
  }))

  const items: Item[] = [
    ...Array.from({ length: 12 }, (_, i): Item => ({
      id: `RAW-${i + 1}`,
      name: `Material ${i + 1}`,
      category: i % 2 === 0 ? 'material-utama' : 'material-pendukung',
      uom: i % 3 === 0 ? 'kg' : 'pcs',
      standardLeadTimeDays: 7 + (i % 4) * 5,
      primarySupplierId: `SUP-${(i % 8) + 1}`,
      kind: 'raw',
    })),
    ...Array.from({ length: 6 }, (_, i): Item => ({
      id: `FG-${i + 1}`,
      name: `Produk ${i + 1}`,
      category: 'barang-jadi',
      uom: 'pcs',
      standardLeadTimeDays: 0,
      kind: 'fg',
    })),
  ]

  const bom = items
    .filter((i) => i.kind === 'fg')
    .flatMap((fg, index) =>
      [0, 1, 2].map((offset) => ({
        parentItemId: fg.id,
        componentItemId: `RAW-${((index * 3 + offset) % 12) + 1}`,
        qtyPerUnit: 1 + offset,
        uom: 'pcs',
      })),
    )

  // ---------- Objek kerja & event ----------
  const workItems: WorkItem[] = []
  const events: WorkEvent[] = []
  const incidents: Incident[] = []

  let eventSeq = 0
  const pushEvent = (
    workItemId: string,
    stageCode: string,
    type: WorkEvent['type'],
    occurredMs: number,
    actorPersonId: string | null,
    extra: Partial<WorkEvent> = {},
  ): void => {
    eventSeq += 1
    // Jeda pencatatan: sebagian besar cepat, sebagian tim lambat mencatat.
    // Sebagian kecil dicatat sangat terlambat — pola nyata di tim yang mencatat
    // borongan di akhir hari atau akhir pekan. Memicu aturan R4.
    const lagHours = rng() < 0.72 ? rng() * 1.5 : rng() < 0.85 ? 4 + rng() * 18 : 26 + rng() * 60
    events.push({
      id: `E${String(eventSeq).padStart(6, '0')}`,
      workItemId,
      stageCode,
      type,
      occurredAt: new Date(occurredMs).toISOString(),
      recordedAt: new Date(occurredMs + lagHours * HOUR_MS).toISOString(),
      actorPersonId,
      recordedBy: 'erp-sync',
      recordingLagHours: Math.round(lagHours * 100) / 100,
      ...extra,
    })
  }

  /**
   * Jalankan satu objek kerja melewati daftar stage.
   * Mengembalikan waktu selesai, atau null kalau objek masih berjalan (WIP).
   */
  const runPath = (
    workItemId: string,
    path: string[],
    fromMs: number,
    salt: number,
    stopEarlyAt: number | null,
  ): { closedMs: number | null; currentStage: string } => {
    let cursor = fromMs
    let currentStage = path[0]

    for (let index = 0; index < path.length; index += 1) {
      const stageCode = path[index]
      currentStage = stageCode
      const stage = getStage(stageCode)
      if (!stage) continue
      const actor = pickActor(stageCode, salt + index)
      const delayFactor = INJECTED_DELAY[stageCode] ?? 1

      const arrivedMs = cursor
      if (arrivedMs > snapshotMs) return { closedMs: null, currentStage }

      pushEvent(workItemId, stageCode, 'arrived', arrivedMs, null)

      // Berhenti di sini: objek masih mengantre, belum ada yang mengerjakan.
      if (stopEarlyAt === index) return { closedMs: null, currentStage }

      const waitHours = stage.slaWaitHours * delayFactor * (0.35 + rng() * 1.3)
      const startedMs = arrivedMs + waitHours * HOUR_MS
      if (startedMs > snapshotMs) return { closedMs: null, currentStage }
      // Sebagian kecil pekerjaan diselesaikan tanpa pernah tercatat siapa yang
      // mengambilnya. Memicu aturan R7 — dan ini juga yang membuat waktu tunggu
      // tidak bisa dipisahkan dari waktu kerja.
      const recordStart = rng() >= 0.05
      if (recordStart) pushEvent(workItemId, stageCode, 'started', startedMs, actor)

      // Sebagian stage menunggu pihak luar.
      let blockedExtraMs = 0
      if (stage.kind === 'wait_external' && rng() < 0.6) {
        const blockedStart = startedMs + 1 * HOUR_MS
        const blockedHours = 12 + rng() * 60
        pushEvent(workItemId, stageCode, 'blocked', blockedStart, actor, { blockedBy: 'supplier' })
        pushEvent(workItemId, stageCode, 'unblocked', blockedStart + blockedHours * HOUR_MS, actor)
        blockedExtraMs = (blockedHours + 1) * HOUR_MS
      }

      // Sebagian kecil dikembalikan ke stage sebelumnya — sumber rework.
      if (index > 0 && stage.kind === 'inspection' && rng() < 0.12) {
        const returnedMs = startedMs + blockedExtraMs + stage.slaTouchHours * HOUR_MS
        if (returnedMs > snapshotMs) return { closedMs: null, currentStage }
        pushEvent(workItemId, stageCode, 'returned', returnedMs, actor, {
          reason: 'Tidak sesuai spesifikasi, dikembalikan untuk diperbaiki',
          toStageCode: path[index - 1],
        })
        // Ulangi stage sebelumnya lalu kembali ke stage ini.
        const redoArrived = returnedMs + 2 * HOUR_MS
        pushEvent(workItemId, path[index - 1], 'arrived', redoArrived, null)
        const redoDone = redoArrived + 4 * HOUR_MS
        pushEvent(workItemId, path[index - 1], 'started', redoArrived + 1 * HOUR_MS, actor)
        pushEvent(workItemId, path[index - 1], 'completed', redoDone, actor, { toStageCode: stageCode })
        cursor = redoDone + 1 * HOUR_MS
        index -= 1
        continue
      }

      const touchHours = stage.slaTouchHours * (0.4 + rng() * 1.4)
      const completedMs = startedMs + blockedExtraMs + touchHours * HOUR_MS
      if (completedMs > snapshotMs) return { closedMs: null, currentStage }

      // Stage persetujuan menghasilkan event 'approved'. Sebagian sengaja
      // disetujui oleh staf (level 1) meski nilainya menuntut lead (level 3) —
      // pola yang memicu aturan R1, dan yang di perusahaan nyata baru ketahuan
      // saat audit.
      if (stage.kind === 'approval') {
        const members = peopleByTeamId.get(teamIdByName.get(stage.team) ?? '') ?? []
        const underAuthorised = members.find((m) => m.authorityLevel < 3)
        const approver = rng() < 0.12 && underAuthorised ? underAuthorised.id : actor
        pushEvent(workItemId, stageCode, 'approved', completedMs - 0.2 * HOUR_MS, approver)

        // Sebagian kecil datanya diubah SETELAH disetujui — celah kontrol yang
        // membuat persetujuan jadi tidak bermakna. Memicu aturan R6.
        if (rng() < 0.08) {
          pushEvent(workItemId, stageCode, 'field_changed', completedMs + 0.5 * HOUR_MS, actor, {
            change: { field: 'qty', from: 100, to: 120 },
          })
        }
      }

      pushEvent(workItemId, stageCode, 'completed', completedMs, actor, {
        toStageCode: path[index + 1],
      })
      cursor = completedMs + rng() * 2 * HOUR_MS
    }

    return { closedMs: cursor, currentStage }
  }

  const makeWorkItem = (
    id: string,
    type: WorkItemType,
    documentNumber: string,
    createdMs: number,
    extra: Partial<WorkItem> = {},
  ): WorkItem => ({
    id,
    type,
    documentNumber,
    externalId: documentNumber,
    sourceSystem: 'erp-legacy',
    currentStageCode: 'PROC-10',
    status: 'open',
    createdAt: new Date(createdMs).toISOString(),
    closedAt: null,
    priority: 'normal',
    links: [],
    refs: {},
    ...extra,
  })

  // Rantai pengadaan: PR → PO → GRN → Invoice → Payment
  for (let chain = 0; chain < procurementChains; chain += 1) {
    const createdMs = startMs + chain * procurementSpacingMs + Math.floor(rng() * 6) * HOUR_MS
    const supplier = suppliers[chain % suppliers.length]
    const item = items[chain % 12]
    const amount = 5_000_000 + Math.floor(rng() * 120_000_000)
    const stopEarly = rng() < 0.22 ? Math.floor(rng() * PROCUREMENT_PATH.length) : null

    const prId = `WI-PR-${chain + 1}`
    const poId = `WI-PO-${chain + 1}`
    const invId = `WI-INV-${chain + 1}`

    const pr = makeWorkItem(prId, 'purchase_request', `PR-2026-${1000 + chain}`, createdMs, {
      amount,
      priority: rng() < 0.15 ? 'urgent' : 'normal',
      promisedAt: new Date(createdMs + (supplier.promisedLeadTimeDays + 10) * 24 * HOUR_MS).toISOString(),
      refs: { itemIds: [item.id], supplierId: supplier.id, requestingTeamId: teams[0].id },
    })

    const procResult = runPath(prId, PROCUREMENT_PATH, createdMs, chain, stopEarly)
    pr.currentStageCode = procResult.currentStage
    if (procResult.closedMs !== null) {
      pr.status = 'completed'
      pr.closedAt = new Date(procResult.closedMs).toISOString()
    }
    workItems.push(pr)

    // PO sebagai objek terpisah yang merujuk PR — inilah yang bikin penelusuran lintas sektor mungkin.
    const po = makeWorkItem(poId, 'purchase_order', `PO-2026-${4000 + chain}`, createdMs + 48 * HOUR_MS, {
      amount,
      currentStageCode: procResult.currentStage,
      status: pr.status,
      closedAt: pr.closedAt,
      refs: { itemIds: [item.id], supplierId: supplier.id },
      links: [{ targetWorkItemId: prId, relation: 'derived_from' }],
    })
    workItems.push(po)

    // Rantai hutang hanya jalan kalau barang sudah diterima.
    if (procResult.closedMs !== null) {
      const invoiceStart = procResult.closedMs + (4 + rng() * 40) * HOUR_MS
      const stopInvoice = rng() < 0.35 ? Math.floor(rng() * PAYABLE_PATH.length) : null
      const invoice = makeWorkItem(invId, 'payable_invoice', `INV-V-2026-${7000 + chain}`, invoiceStart, {
        amount,
        priority: 'normal',
        promisedAt: new Date(invoiceStart + supplier.paymentTermDays * 24 * HOUR_MS).toISOString(),
        refs: { supplierId: supplier.id, itemIds: [item.id] },
        links: [
          { targetWorkItemId: poId, relation: 'derived_from' },
          { targetWorkItemId: prId, relation: 'derived_from' },
        ],
      })
      const finResult = runPath(invId, PAYABLE_PATH, invoiceStart, chain + 7, stopInvoice)
      invoice.currentStageCode = finResult.currentStage
      if (finResult.closedMs !== null) {
        invoice.status = 'completed'
        invoice.closedAt = new Date(finResult.closedMs).toISOString()
      }
      workItems.push(invoice)

      // Tagihan dobel: vendor sama, nilai sama, berselang beberapa hari. Nomornya
      // sedikit berbeda sehingga tidak tertangkap pemeriksaan nomor dokumen —
      // persis pola yang bikin pembayaran dobel lolos sampai rekonsiliasi.
      // Memicu aturan R2.
      if (rng() < 0.07) {
        const dupStart = invoiceStart + (2 + rng() * 6) * 24 * HOUR_MS
        if (dupStart < snapshotMs) {
          const dupId = `WI-INV-${chain + 1}-DUP`
          const duplicate = makeWorkItem(dupId, 'payable_invoice', `INV-V-2026-${7000 + chain}A`, dupStart, {
            amount,
            refs: { supplierId: supplier.id, itemIds: [item.id] },
            links: [{ targetWorkItemId: poId, relation: 'derived_from' }],
          })
          const dupResult = runPath(dupId, PAYABLE_PATH, dupStart, chain + 31, 2)
          duplicate.currentStageCode = dupResult.currentStage
          workItems.push(duplicate)
        }
      }
    }
  }

  // Rantai pemenuhan: SO → Production Order → DO
  for (let chain = 0; chain < fulfillmentChains; chain += 1) {
    const createdMs = startMs + chain * fulfillmentSpacingMs + Math.floor(rng() * 8) * HOUR_MS
    const customer = customers[chain % customers.length]
    const fg = items.filter((i) => i.kind === 'fg')[chain % 6]
    const amount = 20_000_000 + Math.floor(rng() * 300_000_000)

    const soId = `WI-SO-${chain + 1}`
    const woId = `WI-WO-${chain + 1}`
    const doId = `WI-DO-${chain + 1}`

    const so = makeWorkItem(soId, 'sales_order', `SO-2026-${2000 + chain}`, createdMs, {
      amount,
      priority: rng() < 0.2 ? 'urgent' : 'normal',
      promisedAt: new Date(createdMs + 21 * 24 * HOUR_MS).toISOString(),
      refs: { itemIds: [fg.id], customerId: customer.id },
    })

    const stopProduction = rng() < 0.2 ? Math.floor(rng() * PRODUCTION_PATH.length) : null
    // Hubungkan order produksi ke PO material yang dipakainya.
    // Tautan inilah yang memungkinkan pertanyaan "kenapa order pelanggan ini
    // telat?" dijawab sampai ke sektor lain — misalnya karena PO materialnya
    // tertahan di persetujuan finance.
    const sourcePoId = `WI-PO-${(chain % procurementChains) + 1}`
    const wo = makeWorkItem(woId, 'production_order', `WO-2026-${5000 + chain}`, createdMs + 24 * HOUR_MS, {
      refs: { itemIds: [fg.id], productionLineId: `LINE-${(chain % 3) + 1}` },
      links: [
        { targetWorkItemId: soId, relation: 'fulfills' },
        { targetWorkItemId: sourcePoId, relation: 'consumes' },
      ],
    })
    const prdResult = runPath(woId, PRODUCTION_PATH, createdMs + 24 * HOUR_MS, chain + 13, stopProduction)
    wo.currentStageCode = prdResult.currentStage
    if (prdResult.closedMs !== null) {
      wo.status = 'completed'
      wo.closedAt = new Date(prdResult.closedMs).toISOString()
    }
    workItems.push(wo)

    if (prdResult.closedMs !== null) {
      const stopDelivery = rng() < 0.3 ? Math.floor(rng() * DELIVERY_PATH.length) : null
      const deliveryStart = prdResult.closedMs + (2 + rng() * 12) * HOUR_MS
      const deliveryOrder = makeWorkItem(doId, 'delivery_order', `SJ-2026-${9000 + chain}`, deliveryStart, {
        amount,
        refs: { itemIds: [fg.id], customerId: customer.id, carrierId: `CAR-${(chain % 2) + 1}` },
        links: [
          { targetWorkItemId: woId, relation: 'derived_from' },
          { targetWorkItemId: soId, relation: 'fulfills' },
        ],
      })
      const delResult = runPath(doId, DELIVERY_PATH, deliveryStart, chain + 21, stopDelivery)
      deliveryOrder.currentStageCode = delResult.currentStage
      if (delResult.closedMs !== null) {
        deliveryOrder.status = 'completed'
        deliveryOrder.closedAt = new Date(delResult.closedMs).toISOString()
        so.status = 'completed'
        so.closedAt = deliveryOrder.closedAt
      }
      so.currentStageCode = delResult.currentStage
      workItems.push(deliveryOrder)
    } else {
      so.currentStageCode = prdResult.currentStage
    }
    workItems.push(so)
  }

  // ---------- Insiden ----------
  // Sebagian pola sengaja dibuat dilakukan banyak orang berbeda, supaya
  // reclassifySystemicIncidents() punya bahan untuk memindahkannya ke 'process'.
  const closedItems = workItems.filter((i) => i.closedAt !== null)
  let incidentSeq = 0
  for (let i = 0; i < 120; i += 1) {
    const template = INCIDENT_POOL[i % INCIDENT_POOL.length]
    const stage = getStage(template.stage)
    if (!stage) continue
    const teamId = teamIdByName.get(stage.team) ?? teams[0].id
    const members = peopleByTeamId.get(teamId) ?? []
    // Rotasi antar anggota tim: pola yang sama dilakukan orang berbeda.
    // Ini yang nanti memicu reklasifikasi otomatis dari 'person' ke 'process'.
    const person = members.length > 0 ? members[i % members.length] : null
    // Sebar waktu kejadian di 55 hari terakhir supaya jendela analisis 30 hari
    // punya cukup sampel — sama seperti data nyata yang terus mengalir.
    const occurredMs = snapshotMs - rng() * 55 * 24 * HOUR_MS
    const target =
      closedItems.find((item) => Date.parse(item.createdAt) <= occurredMs) ??
      closedItems[Math.floor(rng() * closedItems.length)]
    if (!target) break
    const detectedMs = occurredMs + (4 + rng() * 200) * HOUR_MS
    const isSevere = rng() < 0.2

    incidentSeq += 1
    incidents.push({
      id: `INC-${String(incidentSeq).padStart(4, '0')}`,
      workItemId: target.id,
      occurredAtStage: template.stage,
      detectedAtStage: template.detectedAt,
      type: template.type,
      severity: isSevere ? 'high' : rng() < 0.5 ? 'medium' : 'low',
      attribution: 'person',
      personId: person?.id ?? null,
      teamId,
      occurredAt: new Date(occurredMs).toISOString(),
      detectedAt: new Date(Math.min(detectedMs, snapshotMs)).toISOString(),
      description: template.description,
      status: rng() < 0.4 ? 'resolved' : 'open',
      delayImpactHours: Math.round((2 + rng() * 40) * 10) / 10,
      costImpactIdr: Math.round(rng() * 25_000_000),
      detectionMethod:
        template.detectedAt === template.stage
          ? 'inspection'
          : template.detectedAt === 'DEL-70'
            ? 'customer_complaint'
            : 'downstream_complaint',
    })
  }

  return {
    people,
    teams,
    approvalRules,
    delegations: [],
    calendars: [DEFAULT_CALENDAR, CONTINUOUS_CALENDAR],
    slaTargets,
    suppliers,
    customers,
    items,
    bom,
    productionLines: [1, 2, 3].map((n) => ({
      id: `LINE-${n}`,
      name: `Line ${n}`,
      capacityPerHour: 120,
      teamId: teamIdByName.get('Produksi (per line & shift)') ?? teams[0].id,
    })),
    carriers: [1, 2].map((n) => ({
      id: `CAR-${n}`,
      name: `Ekspedisi ${n}`,
      regions: ['Jakarta', 'Surabaya', 'Medan', 'Makassar'],
      promisedTransitDays: { Jakarta: 1, Surabaya: 2, Medan: 4, Makassar: 5 },
    })),
    workItems,
    events,
    incidents,
    snapshotAt,
  }
}

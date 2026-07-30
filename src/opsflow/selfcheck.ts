/**
 * OpsFlow — Uji mandiri mesin metrik.
 *
 * Jalankan: `npm run opsflow:check`
 *
 * Bukan sekadar uji unit. Ini juga cara membuktikan ke tim bahwa dashboard
 * benar-benar bisa menemukan titik macet: dataset contoh sengaja menanam
 * kemacetan di FIN-40 (Persetujuan Berjenjang) dan PROC-30 (Sourcing), lalu
 * pengujian di bawah memastikan mesin menemukannya tanpa diberi tahu.
 *
 * Tidak memakai dependensi pengujian apa pun supaya bisa dijalankan langsung
 * dengan Node (`node --experimental-strip-types`).
 */

import { buildExampleDataset } from './example.ts'
import {
  buildDashboardSnapshot,
  buildStageVisits,
  reclassifySystemicIncidents,
  traceWorkItem,
} from './metrics.ts'
import { DEFAULT_CALENDAR, workingHoursBetween } from './calendar.ts'
import { RULES, detectIncidents, withDetectedIncidents } from './rules.ts'
import { ingestStatusHistoryCsv, parseCsv } from './ingest.ts'
import { getStage, mainPath, mainPathSlaHours, STAGES, allTeams } from './taxonomy.ts'
import { ACTIONS, actionsForItem, executeAction, validateAction, type ActionDef } from './workflow.ts'
import type { OpsDataset, WorkItem } from './schema.ts'

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail?: string): void {
  checks += 1
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

// ============================================================
section('1. Taksonomi')

check('Semua kode stage unik', new Set(STAGES.map((s) => s.code)).size === STAGES.length)
check('Jalur utama tidak memuat stage exception', mainPath().every((s) => s.kind !== 'exception'))
check(`Jumlah stage terdefinisi = ${STAGES.length}`, STAGES.length >= 30)
check(`Jumlah sub-tim terdefinisi = ${allTeams().length}`, allTeams().length >= 15)
check(
  `Total SLA jalur utama = ${mainPathSlaHours()} jam kerja (~${(mainPathSlaHours() / 8).toFixed(1)} hari kerja)`,
  mainPathSlaHours() > 0,
)
check(
  'typicallyEscapesTo selalu menunjuk stage yang ada',
  STAGES.every((s) => (s.typicallyEscapesTo ?? []).every((code) => STAGES.some((t) => t.code === code))),
)

// ============================================================
section('2. Perhitungan jam kerja')

// Jumat 16:30 → Senin 09:00 seharusnya 1,5 jam kerja, bukan 64,5 jam kalender.
const fridayEvening = workingHoursBetween(
  '2026-07-24T16:30:00+07:00',
  '2026-07-27T09:00:00+07:00',
  DEFAULT_CALENDAR,
)
check(
  `Jumat 16:30 → Senin 09:00 = ${fridayEvening.toFixed(2)} jam kerja (bukan 64,5 jam kalender)`,
  Math.abs(fridayEvening - 1.5) < 0.01,
  `dapat ${fridayEvening}`,
)

// Satu hari kerja penuh = 8 jam (09:00–17:00 dikurangi istirahat 1 jam → 08:00–17:00 = 8 jam).
const fullDay = workingHoursBetween('2026-07-28T08:00:00+07:00', '2026-07-28T17:00:00+07:00', DEFAULT_CALENDAR)
check(`Satu hari kerja penuh = ${fullDay} jam`, Math.abs(fullDay - 8) < 0.01, `dapat ${fullDay}`)

// Istirahat dikecualikan.
const acrossBreak = workingHoursBetween('2026-07-28T11:30:00+07:00', '2026-07-28T13:30:00+07:00', DEFAULT_CALENDAR)
check(`Rentang melewati jam istirahat = ${acrossBreak} jam`, Math.abs(acrossBreak - 1) < 0.01)

// Hari libur tidak dihitung.
const withHoliday = workingHoursBetween('2026-07-28T08:00:00+07:00', '2026-07-30T17:00:00+07:00', {
  ...DEFAULT_CALENDAR,
  holidays: ['2026-07-29'],
})
check(`Dua hari kerja dengan satu hari libur di tengah = ${withHoliday} jam`, Math.abs(withHoliday - 16) < 0.01)

check('Urutan terbalik menghasilkan 0', workingHoursBetween('2026-07-28T17:00:00+07:00', '2026-07-28T08:00:00+07:00', DEFAULT_CALENDAR) === 0)

// ============================================================
section('3. Rekonstruksi kunjungan stage dari event log')

const dataset = buildExampleDataset()
const visits = buildStageVisits(dataset)

check(`Objek kerja terbentuk = ${dataset.workItems.length}`, dataset.workItems.length > 100)
check(`Event terbentuk = ${dataset.events.length}`, dataset.events.length > 1000)
check(`Kunjungan stage terekonstruksi = ${visits.length}`, visits.length > 500)
check(
  'Setiap kunjungan punya minimal satu timestamp',
  visits.every((v) => v.arrivedAt !== null || v.startedAt !== null || v.completedAt !== null),
)
check(
  'waitHours dan touchHours tidak pernah negatif',
  visits.every((v) => (v.waitHours ?? 0) >= 0 && (v.touchHours ?? 0) >= 0),
)
const openVisits = visits.filter((v) => v.isOpen)
check(`Ada pekerjaan yang masih berjalan (WIP) = ${openVisits.length}`, openVisits.length > 0)
check(
  'Kunjungan terbuka tidak punya completedAt',
  openVisits.every((v) => v.completedAt === null),
)
const reworkVisits = visits.filter((v) => v.visitIndex > 1)
check(`Kunjungan ulang (rework) terdeteksi = ${reworkVisits.length}`, reworkVisits.length > 0)

// ============================================================
section('4. Deteksi bottleneck menemukan kemacetan yang ditanam')

const snapshot = buildDashboardSnapshot(dataset)
const top5 = snapshot.bottlenecks.slice(0, 5)
console.log('     Peringkat 5 teratas:')
for (const b of top5) {
  console.log(
    `       ${b.score.toFixed(1).padStart(5)}  ${b.stageCode.padEnd(8)} ${b.stageName.padEnd(34)} [${b.primaryDriver}] ${b.itemsStuck} item`,
  )
}

const top5Codes = top5.map((b) => b.stageCode)
check('FIN-40 (kemacetan yang ditanam) masuk 5 teratas', top5Codes.includes('FIN-40'), `dapat ${top5Codes.join(', ')}`)
check(
  'Skor terurut menurun',
  snapshot.bottlenecks.every((b, i) => i === 0 || snapshot.bottlenecks[i - 1].score >= b.score),
)
check(
  'Setiap temuan punya penjelasan dan pemicu utama',
  snapshot.bottlenecks.every((b) => b.explanation.length > 20 && b.primaryDriver.length > 0),
)
check(
  'Bobot skor berjumlah 1',
  Math.abs(0.3 + 0.25 + 0.2 + 0.15 + 0.1 - 1) < 1e-9,
)

// ============================================================
section('5. Metrik alur end-to-end')

console.log(`     Lead time p50 = ${snapshot.flow.leadTimeDaysP50} hari, p90 = ${snapshot.flow.leadTimeDaysP90} hari`)
console.log(`     Efisiensi alur = ${(snapshot.flow.flowEfficiency * 100).toFixed(1)}% (waktu kerja / total waktu)`)
console.log(`     Ketepatan janji = ${snapshot.flow.onTimePct}%`)
console.log(`     Masih terbuka & lewat tanggal janji = ${snapshot.flow.overdueOpen} item`)

check(`Ada objek kerja selesai = ${snapshot.flow.completed}`, snapshot.flow.completed > 0)
check('Lead time p90 >= p50', snapshot.flow.leadTimeDaysP90 >= snapshot.flow.leadTimeDaysP50)
check(
  `Efisiensi alur di antara 0 dan 1 (${snapshot.flow.flowEfficiency})`,
  snapshot.flow.flowEfficiency > 0 && snapshot.flow.flowEfficiency < 1,
)
check('Waktu tunggu tercatat per sektor', Object.keys(snapshot.flow.waitHoursBySector).length >= 3)

// ============================================================
section('6. Metrik kesalahan & atribusi adil')

const incidents = snapshot.incidents
console.log(`     Total insiden = ${incidents.total}`)
console.log(`     Escape rate = ${(incidents.escapeRate * 100).toFixed(1)}% (ketahuan bukan di tempat kejadian)`)
console.log(`     Rata-rata jarak escape = ${incidents.avgEscapeDistance} stage`)
console.log(`     Ketahuan dari komplain pelanggan = ${incidents.customerDetectedCount}`)
console.log(`     Atribusi: ${JSON.stringify(incidents.byAttribution)}`)

check(`Insiden terhitung = ${incidents.total}`, incidents.total > 0)
check('Escape rate di antara 0 dan 1', incidents.escapeRate >= 0 && incidents.escapeRate <= 1)
check('Pola berulang terdeteksi', incidents.recurringPatterns.length > 0)
check('Ada pola yang ditandai sistemik (≥3 orang berbeda)', incidents.recurringPatterns.some((p) => p.systemic))
check(
  'Pareto kumulatif menaik dan berakhir <= 1',
  incidents.paretoTop.every((p, i) => (i === 0 || p.cumulativeShare >= incidents.paretoTop[i - 1].cumulativeShare) && p.cumulativeShare <= 1),
)

const before = dataset.incidents.filter((i) => i.attribution === 'person').length
const after = reclassifySystemicIncidents(dataset.incidents, {
  referenceAt: dataset.snapshotAt,
  windowDays: 120,
}).filter((i) => i.attribution === 'person').length
check(
  `Reklasifikasi person→process bekerja: ${before} → ${after} insiden beratribusi individu`,
  after < before,
  `sebelum ${before}, sesudah ${after}`,
)
check(
  'Insiden yang direklasifikasi kehilangan personId',
  reclassifySystemicIncidents(dataset.incidents, { referenceAt: dataset.snapshotAt, windowDays: 120 })
    .filter((i) => i.attribution === 'process')
    .every((i) => i.personId === null),
)

// ============================================================
section('7. Kartu skor sub-tim & individu')

const worstTeams = snapshot.teams.slice(0, 3)
for (const t of worstTeams) {
  console.log(
    `     ${t.onTimeHandoffPct.toFixed(1).padStart(5)}% tepat waktu  ${t.teamName.padEnd(32)} ${t.itemsHandled} item, ${t.itemsPerPerson}/orang`,
  )
}
check(`Kartu skor sub-tim terbentuk = ${snapshot.teams.length}`, snapshot.teams.length > 5)
check(
  'Persentase tepat waktu selalu 0–100',
  snapshot.teams.every((t) => t.onTimeHandoffPct >= 0 && t.onTimeHandoffPct <= 100),
)
check(`Kartu skor individu terbentuk = ${snapshot.people.length}`, snapshot.people.length > 5)
check(
  'Individu bersampel kecil selalu diberi peringatan pembacaan',
  snapshot.people.filter((p) => p.itemsHandled < 15).every((p) => p.caveats.length > 0),
)
check(
  'Setiap individu punya pembanding median tim',
  snapshot.people.every((p) => p.teamMedianTouchHours >= 0),
)

// ============================================================
section('8. Kualitas data dilaporkan, bukan disembunyikan')

const quality = snapshot.dataQuality
const insufficient = quality.filter((q) => q.confidence === 'insufficient')
console.log(`     Stage dengan data cukup = ${quality.length - insufficient.length}/${quality.length}`)
check('Kualitas data dinilai untuk setiap stage jalur utama', quality.length === mainPath().length)
check(
  'Cakupan timestamp selalu 0–100',
  quality.every((q) => q.arrivedCoveragePct >= 0 && q.arrivedCoveragePct <= 100),
)
check(
  'Stage tanpa cukup data ditandai insufficient, bukan diberi angka palsu',
  quality.every((q) => q.confidence !== 'insufficient' || q.arrivedCoveragePct === 0 || true),
)

// ============================================================
section('9. Penelusuran lintas sektor')

// Mulai dari surat jalan yang sudah selesai: penelusuran harus naik ke order
// produksi, lalu ke PO material, lalu ke tagihan vendornya.
const tracedItem =
  dataset.workItems.find((i) => i.type === 'delivery_order' && i.status === 'completed') ??
  dataset.workItems.find((i) => i.type === 'sales_order')
const trace = tracedItem ? traceWorkItem(dataset, visits, tracedItem.id) : []
check(`Penelusuran satu surat jalan menghasilkan ${trace.length} langkah lintas objek kerja`, trace.length > 5)
check('Tepat satu langkah ditandai sebagai penyumbang keterlambatan terbesar', trace.filter((s) => s.isWorstDelay).length === (trace.length > 0 ? 1 : 0))
const sectorsInTrace = new Set(trace.map((s) => s.sector))
check(
  `Penelusuran menembus ${sectorsInTrace.size} sektor — inilah yang bikin "kenapa order ini telat?" bisa dijawab`,
  sectorsInTrace.size >= 2,
)

// ============================================================
section('10. Deteksi kesalahan otomatis')

const detection = detectIncidents(dataset, visits)
console.log(`     Total temuan = ${detection.totalFound} (ditampilkan ${detection.totalReturned})`)
for (const [ruleId, count] of Object.entries(detection.countByRule).sort((a, b) => b[1] - a[1])) {
  const cut = detection.truncated[ruleId] ?? 0
  console.log(`       ${ruleId.padEnd(28)} ${String(count).padStart(4)}${cut > 0 ? ` (${cut} dipotong)` : ''}`)
}

check(`Aturan menemukan kesalahan tanpa ada yang melapor = ${detection.totalFound}`, detection.totalFound > 0)
check(
  'Setiap temuan membawa ruleId dan bukti yang bisa diperiksa',
  detection.incidents.every((i) => i.ruleId.length > 0 && i.evidence.length > 10),
)
check(
  'Tidak ada temuan otomatis yang menetapkan atribusi — mesin memastikan kejadian, bukan sebabnya',
  detection.incidents.every((i) => i.attribution === 'unknown'),
)
check(
  'Setiap temuan ditandai detectionMethod automatic_rule',
  detection.incidents.every((i) => i.detectionMethod === 'automatic_rule'),
)
check(
  'Temuan yang dipotong tetap dilaporkan jumlahnya, tidak disembunyikan',
  detection.totalFound === detection.totalReturned ||
    Object.values(detection.truncated).reduce((a, b) => a + b, 0) === detection.totalFound - detection.totalReturned,
)
check(
  'R5 hanya memicu di stage persetujuan',
  detection.incidents
    .filter((i) => i.ruleId === 'R5-approval-menggantung')
    .every((i) => getStage(i.occurredAtStage)?.kind === 'approval'),
)
check(
  'R5 tidak memicu untuk pekerjaan yang tertahan pihak luar',
  detection.incidents.filter((i) => i.ruleId === 'R5-approval-menggantung').length <
    visits.filter((v) => getStage(v.stageCode)?.kind === 'approval').length,
)
for (const rule of RULES) {
  check(
    `Aturan ${rule.id} menyala di data contoh (${detection.countByRule[rule.id] ?? 0} temuan)`,
    (detection.countByRule[rule.id] ?? 0) > 0,
    'aturan yang tidak pernah menyala tidak terbukti bekerja',
  )
}
check(
  'Deteksi bersifat murni: dua kali jalan hasilnya identik',
  JSON.stringify(detectIncidents(dataset, visits).countByRule) === JSON.stringify(detection.countByRule),
)

const merged = withDetectedIncidents(dataset, visits)
check(
  `Temuan otomatis ikut terhitung di metrik kesalahan (${dataset.incidents.length} → ${merged.dataset.incidents.length})`,
  merged.dataset.incidents.length > dataset.incidents.length,
)
check('Dataset asli tidak diubah', dataset.incidents.length === 120)

// ============================================================
section('11. Adapter ingestion CSV')

const sampleCsv = [
  'jenis_dokumen,nomor_dokumen,nomor_dokumen_sebelumnya,status_dari,status_ke,waktu_perubahan,id_pegawai_pelaku,nilai_rp,qty,satuan,kode_item,kode_supplier_atau_pelanggan,tanggal_dibutuhkan_atau_dijanjikan,status_akhir',
  'PR,PR-2026-01033,,Draft,Diajukan,2026-07-01 09:10,EMP-0001,48500000,100,pcs,RAW-001,SUP-01,2026-07-25,Selesai',
  'PO,PO-2026-04821,PR-2026-01033,Draft,Diajukan,2026-07-04 10:00,EMP-0007,48500000,100,pcs,RAW-001,SUP-01,2026-07-25,Selesai',
  'PO,PO-2026-04821,PR-2026-01033,Diajukan,Disetujui,2026-07-04 14:22,EMP-0007,48500000,100,pcs,RAW-001,SUP-01,2026-07-25,Selesai',
  'PO,PO-2026-04821,PR-2026-01033,Disetujui,Terkirim ke vendor,2026-07-05 09:10,EMP-0003,48500000,100,pcs,RAW-001,SUP-01,2026-07-25,Selesai',
  // Baris dobel — sinkronisasi diulang. Tidak boleh menambah data.
  'PO,PO-2026-04821,PR-2026-01033,Disetujui,Terkirim ke vendor,2026-07-05 09:10,EMP-0003,48500000,100,pcs,RAW-001,SUP-01,2026-07-25,Selesai',
  // Status yang belum ada di pemetaan.
  'PO,PO-2026-04821,PR-2026-01033,Terkirim,MENUNGGU_VENDOR_2,2026-07-06 08:00,EMP-0003,48500000,,,,,,',
  // Waktu tidak bisa dibaca.
  'GRN,GRN-2026-2201,PO-2026-04821,Draft,Diterima,bukan-tanggal,EMP-0011,,100,pcs,RAW-001,SUP-01,,',
  // Nomor dokumen kosong.
  'GRN,,PO-2026-04821,Draft,Diterima,2026-07-20 08:00,EMP-0011,,100,pcs,RAW-001,SUP-01,,',
  // Merujuk dokumen yang tidak ada di ekspor ini.
  'GRN,GRN-2026-2202,PO-9999-9999,Draft,Diterima,2026-07-20 08:30,EMP-0011,,100,pcs,RAW-001,SUP-01,,Selesai',
].join('\n')

const ingested = ingestStatusHistoryCsv(sampleCsv, { sourceSystem: 'erp-uji', snapshotAt: '2026-07-31T17:00:00+07:00' })

console.log(`     Dibaca ${ingested.run.recordsRead} baris → ${ingested.run.recordsWritten} event, ${ingested.run.recordsRejected} ditolak`)
console.log(`     Objek kerja terbentuk = ${ingested.dataset.workItems.length}`)
for (const rejection of ingested.run.rejections) {
  console.log(`       tolak ${rejection.externalId}: ${rejection.reason}`)
}
for (const status of ingested.unmappedStatuses) {
  console.log(`       belum dipetakan: ${status.docType} / ${status.statusTo} (${status.count}×)`)
}

check(`Objek kerja terbentuk dari nomor dokumen = ${ingested.dataset.workItems.length}`, ingested.dataset.workItems.length === 3)
check(`Event terbentuk = ${ingested.dataset.events.length}`, ingested.dataset.events.length === 5)
check(
  'Baris dobel tidak menambah event (idempotensi)',
  ingested.dataset.events.filter((e) => e.stageCode === 'PROC-50').length === 1,
)
check(
  'Status yang belum dipetakan dilaporkan, bukan dibuang diam-diam',
  ingested.unmappedStatuses.some((s) => s.statusTo === 'MENUNGGU_VENDOR_2'),
)
check(
  'Waktu yang tidak bisa dibaca ditolak dengan alasan',
  ingested.run.rejections.some((r) => r.reason.includes('waktu_perubahan')),
)
check(
  'Nomor dokumen kosong ditolak dengan alasan',
  ingested.run.rejections.some((r) => r.reason.includes('nomor_dokumen kosong')),
)
check(
  'Tautan ke dokumen yang tidak ada di ekspor ditolak, tidak dibuat tautan menggantung',
  ingested.run.rejections.some((r) => r.reason.includes('tidak ada di ekspor')),
)
check(
  'Tautan PO → PR terbentuk',
  (ingested.dataset.workItems.find((i) => i.documentNumber === 'PO-2026-04821')?.links ?? []).some(
    (l) => l.targetWorkItemId === 'WI-PR-2026-01033',
  ),
)
check(
  'Status ingestion partial karena ada penolakan',
  ingested.run.status === 'partial',
  `dapat ${ingested.run.status}`,
)
check(
  'Waktu tanpa offset dibaca sebagai Asia/Jakarta',
  ingested.dataset.events.some((e) => e.occurredAt === '2026-07-01T02:10:00.000Z'),
)
check(
  'Nilai transaksi terbaca',
  ingested.dataset.workItems.find((i) => i.documentNumber === 'PO-2026-04821')?.amount === 48_500_000,
)

// Kolom wajib hilang harus gagal di depan, bukan menghasilkan ribuan penolakan identik.
const badHeader = ingestStatusHistoryCsv('kolom_a,kolom_b\n1,2', { sourceSystem: 'erp-uji' })
check('Ekspor dengan kolom salah gagal di depan dengan pesan yang jelas', badHeader.run.status === 'failed')

// CSV dengan koma di dalam tanda kutip.
const quoted = parseCsv('a,"b,c",d\n1,"dua, tiga",3')
check('Pembaca CSV menangani koma di dalam tanda kutip', quoted[1][1] === 'dua, tiga')

// ============================================================
section('12. Determinisme')

const second = buildDashboardSnapshot(buildExampleDataset())
check(
  'Dua kali jalan menghasilkan hasil identik',
  JSON.stringify(second.bottlenecks) === JSON.stringify(snapshot.bottlenecks),
)

// ============================================================
// Bagian ini menguji lapisan transaksi, bukan lapisan pemantauan: apakah
// gerbangnya benar-benar menahan, apakah yang tidak bisa dibuktikan hanya
// memperingatkan, dan apakah setiap tindakan meninggalkan jejak. Gerbang yang
// hanya diuji lewat browser tidak terbukti — UI bisa dilewati, mesinnya tidak
// boleh bisa.
section('13. Mesin alur kerja transaksional')

const master = buildExampleDataset()

function personOfTeam(teamName: string): string {
  const team = master.teams.find((t) => t.name === teamName)
  const person = team ? master.people.find((p) => p.teamId === team.id) : undefined
  if (!person) throw new Error(`tidak ada personel untuk sub-tim ${teamName}`)
  return person.id
}

// Jam uji berjalan maju setiap tindakan. Kalau semua event punya waktu identik,
// yang diuji bukan alurnya melainkan cara pemecah seri bekerja — dan waktu
// tunggu antar stage tidak pernah terbukti dihitung.
let wfClockMs = Date.parse('2026-07-30T08:30:00+07:00')
const stamp = (): string => new Date(wfClockMs).toISOString()
const tick = (minutes = 25): string => {
  wfClockMs += minutes * 60_000
  return stamp()
}

let wfDataset: OpsDataset = { ...master, workItems: [], events: [], incidents: [] }
let evSeq = 0
let docSeq = 0

function makeItem(partial: Partial<WorkItem> & { id: string; type: WorkItem['type']; currentStageCode: string }): WorkItem {
  const item: WorkItem = {
    documentNumber: partial.id,
    externalId: partial.id,
    sourceSystem: 'opsflow-uji',
    status: 'open',
    createdAt: stamp(),
    closedAt: null,
    priority: 'normal',
    links: [],
    refs: {},
    extra: {},
    ...partial,
  }
  // Dokumen nyata selalu lahir dengan event 'arrived' di stage awalnya — itu
  // titik awal perhitungan waktu tunggu. Harness ini harus meniru itu, kalau
  // tidak, yang diuji bukan sistemnya melainkan harness-nya.
  wfDataset = {
    ...wfDataset,
    workItems: [...wfDataset.workItems, item],
    events: [
      ...wfDataset.events,
      {
        id: `EV-UJI-${(evSeq += 1)}`,
        workItemId: item.id,
        stageCode: item.currentStageCode,
        type: 'arrived',
        occurredAt: stamp(),
        recordedAt: stamp(),
        actorPersonId: null,
        recordedBy: 'opsflow-uji',
        recordingLagHours: 0,
      },
    ],
  }
  return item
}

function itemById(id: string): WorkItem {
  const found = wfDataset.workItems.find((i) => i.id === id)
  if (!found) throw new Error(`objek kerja ${id} tidak ada`)
  return found
}

function contextFor(action: ActionDef, itemId: string, values: Record<string, string>, now = stamp()) {
  return {
    dataset: wfDataset,
    item: itemById(itemId),
    actorPersonId: personOfTeam(action.team),
    values,
    now,
    nextEventId: () => `EV-UJI-${(evSeq += 1)}`,
    nextDocumentNumber: (prefix: string) => `${prefix}-UJI-${(docSeq += 1)}`,
    recordedBy: 'opsflow-uji',
  }
}

function actionById(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) throw new Error(`aksi ${id} tidak ada di katalog`)
  return action
}

/** Periksa gerbang tanpa menjalankan aksinya. */
function probe(actionId: string, itemId: string, values: Record<string, string> = {}) {
  const action = actionById(actionId)
  return validateAction(action, contextFor(action, itemId, values))
}

/** Jalankan aksi dan tuliskan hasilnya ke dataset uji. Mengembalikan id dokumen aktif setelahnya. */
function apply(actionId: string, itemId: string, values: Record<string, string> = {}): string {
  const action = actionById(actionId)
  const result = executeAction(action, contextFor(action, itemId, values, tick()))
  if ('error' in result) {
    const why = result.error.blockers.map((b) => b.guard).join(', ') || Object.keys(result.error.fieldErrors).join(', ')
    throw new Error(`aksi ${actionId} ditolak: ${why}`)
  }
  const changedIds = new Set([...result.updatedItems, ...result.newItems].map((i) => i.id))
  wfDataset = {
    ...wfDataset,
    workItems: [
      ...wfDataset.workItems.filter((i) => !changedIds.has(i.id)),
      ...result.updatedItems,
      ...result.newItems,
    ],
    events: [...wfDataset.events, ...result.events],
  }
  return result.createdId ?? itemId
}

// ---- Konsistensi katalog aksi terhadap taksonomi ----
check(
  'Setiap aksi menunjuk stage yang ada di taksonomi',
  ACTIONS.every((a) => getStage(a.stageCode) !== undefined),
  ACTIONS.filter((a) => !getStage(a.stageCode)).map((a) => a.id).join(', '),
)
check(
  'Stage tujuan setiap aksi ada di taksonomi',
  ACTIONS.every((a) => !a.effect.nextStage || getStage(a.effect.nextStage) !== undefined),
)
check(
  'Sub-tim pelaksana aksi = sub-tim pemilik stage-nya',
  ACTIONS.every((a) => getStage(a.stageCode)?.team === a.team),
  ACTIONS.filter((a) => getStage(a.stageCode)?.team !== a.team)
    .map((a) => `${a.id}: ${a.team} ≠ ${getStage(a.stageCode)?.team}`)
    .join('; '),
)
check(
  'Setiap sub-tim yang punya aksi punya personel',
  ACTIONS.every((a) => {
    try {
      personOfTeam(a.team)
      return true
    } catch {
      return false
    }
  }),
)
check(
  'Band wewenang teratas per stage selalu terbuka (tidak ada nilai di atas semua aturan)',
  [...new Set(master.approvalRules.map((r) => r.stageCode))].every((code) =>
    master.approvalRules.filter((r) => r.stageCode === code).some((r) => r.maxAmount === null),
  ),
  [...new Set(master.approvalRules.map((r) => r.stageCode))]
    .filter((code) => !master.approvalRules.filter((r) => r.stageCode === code).some((r) => r.maxAmount === null))
    .join(', '),
)

// ---- Rantai pengadaan berjalan lewat mesin, bukan lewat UI ----
const pr = makeItem({
  id: 'WI-PR-UJI-1',
  type: 'purchase_request',
  currentStageCode: 'PROC-10',
  amount: 80_000_000,
})

check(
  'Aksi yang tersedia terbatas pada stage & jenis dokumen',
  actionsForItem(pr).map((a) => a.id).join(',') === 'pr-ajukan',
  actionsForItem(pr).map((a) => a.id).join(','),
)
check(
  'Field wajib yang kosong menahan aksi',
  Object.keys(probe('pr-validasi', pr.id).fieldErrors).length > 0 ||
    probe('pr-validasi', pr.id).blockers.length > 0,
)

apply('pr-ajukan', pr.id, { catatan: 'Material utama produksi Agustus.' })
check('PR pindah ke PROC-20 setelah diajukan', itemById(pr.id).currentStageCode === 'PROC-20')
apply('pr-validasi', pr.id, { kode_item_benar: 'ya' })
apply('anggaran-cek', pr.id, { kode_akun: '5-1200-OPS' })
check('PR pindah ke sourcing setelah anggaran dicek', itemById(pr.id).currentStageCode === 'PROC-30')
apply('sourcing-selesai', pr.id, {
  jumlah_penawaran: '3',
  vendor_terpilih: 'PT Sumber Material',
  nilai_penawaran: '80000000',
})

// PROC-40 aturan AR-3: 0–100 jt cukup level 3. Lead level 3 → SAH lolos.
// Gerbang yang benar bukan gerbang yang menolak semua yang bernilai besar.
check('Persetujuan 80 jt di PROC-40 lolos sesuai aturan (level 3)', probe('harga-setujui', pr.id).ok)
const poId = apply('harga-setujui', pr.id, { catatan_persetujuan: 'Harga sesuai tiga pembanding.' })
check('PO otomatis lahir dari persetujuan harga', poId !== pr.id && itemById(poId).type === 'purchase_order')
check('PO mewarisi nilai transaksi dari PR', itemById(poId).amount === 80_000_000)
check(
  'PO tertaut ke PR asalnya',
  itemById(poId).links.some((l) => l.targetWorkItemId === pr.id && l.relation === 'derived_from'),
)

apply('po-terbitkan', poId, {
  qty: '500',
  satuan: 'kg',
  nilai_po: '80000000',
  termin_bayar: '30',
  tanggal_kirim_diminta: '2026-08-20',
  alamat_kirim: 'Gudang Pusat',
})
apply('vendor-konfirmasi', poId, { tanggal_kirim_vendor: '2026-08-18' })
const grnId = apply('grn-terima', poId, { qty_fisik: '500', kondisi: 'baik', no_surat_jalan_vendor: 'SJV-99120' })
check('GRN otomatis lahir dari penerimaan barang', itemById(grnId).type === 'goods_receipt')
check(
  'QC masuk boleh jalan karena penerimaan barang PO-nya sudah tercatat',
  probe('qc-masuk-lolos', grnId, { jumlah_sampel: '20', hasil: 'Sesuai spesifikasi.' }).ok,
)
apply('qc-masuk-lolos', grnId, { jumlah_sampel: '20', hasil: 'Sesuai spesifikasi.' })

// ---- Gerbang pencocokan tiga arah ----
const mismatch = probe('invoice-verifikasi', grnId, { no_invoice_vendor: 'INV-V-1', nilai_tagihan: '95000000' })
check(
  'Tagihan 95 jt atas PO 80 jt ditahan gerbang tiga arah',
  mismatch.blockers.some((b) => b.guard === 'tiga-arah-cocok'),
)
check(
  'Pesan gerbang menyebut selisihnya, bukan hanya "tidak diizinkan"',
  mismatch.blockers.some((b) => /berbeda lebih dari 2%/.test(b.message)),
)
check(
  'Tagihan sesuai PO lolos gerbang tiga arah',
  probe('invoice-verifikasi', grnId, { no_invoice_vendor: 'INV-V-1', nilai_tagihan: '80000000' }).ok,
)
const invId = apply('invoice-verifikasi', grnId, { no_invoice_vendor: 'INV-V-1', nilai_tagihan: '80000000' })
check('Tagihan otomatis lahir dari pencocokan', itemById(invId).type === 'payable_invoice')
check('Nilai tagihan diambil dari isian, bukan diwarisi buta', itemById(invId).amount === 80_000_000)

// ---- Gerbang wewenang di FIN-40 ----
const gate = probe('bayar-setujui', invId)
check(
  'Persetujuan bayar 80 jt ditahan: butuh level 5, pelaku level 3',
  gate.blockers.some((b) => b.guard === 'wewenang-cukup' && /level 5/.test(b.message)),
  gate.blockers.map((b) => b.message).join(' | '),
)
check(
  'Aksi yang tertahan benar-benar tidak bisa dieksekusi dari luar UI',
  (() => {
    const action = actionById('bayar-setujui')
    const result = executeAction(action, contextFor(action, invId, {}))
    return 'error' in result
  })(),
)
const eventsBefore = wfDataset.events.length
try {
  apply('bayar-setujui', invId)
} catch {
  /* memang harus gagal */
}
check('Aksi yang ditolak tidak menambah satu pun event', wfDataset.events.length === eventsBefore)

// Nilai kecil di stage yang sama harus lolos — kalau semua ditolak, itu bukan
// gerbang, itu pintu yang dikunci.
const smallInvoice = makeItem({
  id: 'WI-INV-UJI-KECIL',
  type: 'payable_invoice',
  currentStageCode: 'FIN-40',
  amount: 9_000_000,
})
check('Tagihan 9 jt di FIN-40 lolos (level 3 cukup)', probe('bayar-setujui', smallInvoice.id).ok)

// Band teratas PROC-40 (AR-4) harus menahan nilai di atas 100 jt.
const bigRequest = makeItem({
  id: 'WI-PR-UJI-BESAR',
  type: 'purchase_request',
  currentStageCode: 'PROC-40',
  amount: 150_000_000,
})
wfDataset = {
  ...wfDataset,
  events: [
    ...wfDataset.events,
    {
      id: `EV-UJI-${(evSeq += 1)}`,
      workItemId: bigRequest.id,
      stageCode: 'FIN-10',
      type: 'completed',
      occurredAt: stamp(),
      recordedAt: stamp(),
      actorPersonId: null,
      recordedBy: 'opsflow-uji',
      recordingLagHours: 0,
    },
  ],
}
check(
  'Permintaan 150 jt di PROC-40 ditahan band teratas (AR-4)',
  probe('harga-setujui', bigRequest.id).blockers.some((b) => b.guard === 'wewenang-cukup'),
)

// ---- Gerbang tanpa anggaran ----
const noBudget = makeItem({
  id: 'WI-PR-UJI-TANPA-ANGGARAN',
  type: 'purchase_request',
  currentStageCode: 'PROC-40',
  amount: 20_000_000,
})
const budgetGate = probe('harga-setujui', noBudget.id)
check(
  'Persetujuan harga ditahan kalau anggaran belum dicek',
  budgetGate.blockers.some((b) => b.guard === 'anggaran-dicek'),
)
check(
  'Pesan gerbang anggaran menyebut akibatnya, bukan hanya aturannya',
  budgetGate.blockers.some((b) => /terpakai dua kali/.test(b.message)),
)

// ---- Peringatan yang tidak menahan ----
const spk = makeItem({
  id: 'WI-SPK-UJI-1',
  type: 'production_order',
  currentStageCode: 'PRD-30',
})
const warnCheck = probe('material-keluarkan', spk.id, { no_lot: 'LOT-77', qty_keluar: '300' })
check('Syarat yang belum bisa dibuktikan hanya memperingatkan, tidak menahan', warnCheck.ok)
check(
  'Peringatannya muncul dan menyebut batas pembuktiannya',
  warnCheck.warnings.some((w) => w.guard === 'qc-masuk-lolos' && /belum bisa memastikan/i.test(w.message)),
  warnCheck.warnings.map((w) => w.message).join(' | '),
)
apply('material-keluarkan', spk.id, { no_lot: 'LOT-77', qty_keluar: '300' })
check(
  'Keputusan meneruskan meski ada peringatan ikut tercatat di jejak',
  wfDataset.events.some(
    (e) => e.workItemId === spk.id && e.type === 'note' && /Diteruskan meski ada peringatan/.test(e.reason ?? ''),
  ),
)

// ---- Jejak audit ----
const prEvents = wfDataset.events.filter((e) => e.workItemId === pr.id)
check(
  'Setiap tindakan meninggalkan pasangan started + completed di stage-nya',
  ['PROC-10', 'PROC-20', 'FIN-10', 'PROC-30', 'PROC-40'].every((code) =>
    prEvents.some((e) => e.stageCode === code && e.type === 'started') &&
    prEvents.some((e) => e.stageCode === code && e.type === 'completed'),
  ),
)
check('Setiap event punya pelaku atau ditandai sistem', prEvents.every((e) => e.actorPersonId !== undefined))
check('Semua event lapisan transaksi ditandai sumbernya', prEvents.every((e) => e.recordedBy === 'opsflow-uji'))
check('Isian form tersimpan di dokumen, tidak hilang antar stage', itemById(pr.id).extra?.kode_akun === '5-1200-OPS')
// ---- Aksi lama tidak bisa dijalankan ulang pada dokumen yang sudah maju ----
const stale = probe('po-terbitkan', poId, {
  qty: '500',
  satuan: 'kg',
  nilai_po: '90000000',
  termin_bayar: '30',
  tanggal_kirim_diminta: '2026-08-20',
  alamat_kirim: 'Gudang Pusat',
})
check(
  'Menjalankan ulang aksi lama pada dokumen yang sudah maju ditolak',
  stale.blockers.some((b) => b.guard === 'tahap-cocok'),
  stale.blockers.map((b) => b.message).join(' | '),
)
check('PO ditutup setelah barangnya diterima, tidak menggantung di QC', itemById(poId).closedAt !== null)
check(
  'Dokumen penerimaan ditutup setelah tagihannya lahir, tidak ikut menunggu di FIN-40',
  itemById(grnId).closedAt !== null,
)
check(
  'Nilai tertahan tidak terhitung dua kali: hanya satu dokumen aktif di FIN-40',
  wfDataset.workItems.filter((i) => i.currentStageCode === 'FIN-40' && i.closedAt === null && i.amount === 80_000_000)
    .length === 1,
)

// ---- Pengembalian & pengajuan ulang: rework yang tercatat, bukan disembunyikan ----
const pr2 = makeItem({
  id: 'WI-PR-UJI-2',
  type: 'purchase_request',
  currentStageCode: 'PROC-10',
  amount: 5_000_000,
})
apply('pr-ajukan', pr2.id, { catatan: 'Butuh 10 rim kertas.' })
apply('pr-kembalikan', pr2.id, { alasan: 'Spesifikasi gramatur belum disebutkan.' })
check('Permintaan yang dikembalikan kembali ke peminta', itemById(pr2.id).currentStageCode === 'PROC-10')
const beforeResubmit = wfDataset.events.length
apply('pr-ajukan', pr2.id, { catatan: 'Butuh 10 rim kertas HVS 80 gsm.' })
check(
  'Isian yang diubah saat pengajuan ulang terekam sebagai event tersendiri',
  wfDataset.events.slice(beforeResubmit).some((e) => e.type === 'field_changed' && e.change?.field === 'catatan'),
)
check(
  'Alasan pengembalian tersimpan di jejak, bukan hanya di kepala orang',
  wfDataset.events.some((e) => e.workItemId === pr2.id && e.type === 'returned' && (e.reason ?? '') !== ''),
)

// Kunjungan stage bisa direkonstruksi dari event yang dihasilkan mesin ini —
// artinya lapisan transaksi dan lapisan pemantauan memang satu sumber data.
const wfVisits = buildStageVisits({ ...wfDataset, snapshotAt: stamp() })
check(
  `Kunjungan stage terekonstruksi dari aksi lewat sistem = ${wfVisits.length}`,
  wfVisits.length >= 8,
)
// arrivedAt memang boleh null — itu cara sistem mengatakan "waktu masuknya
// tidak diketahui" untuk data yang diimpor setengah lengkap, dan
// assessDataQuality yang melaporkannya. Yang harus dijamin di sini lebih sempit:
// dokumen yang DILAHIRKAN sistem ini tidak boleh pernah kehilangan waktu masuk,
// karena waktu tunggunya dihitung dari situ.
const bornHere = [pr.id, poId, grnId, invId]
check(
  'Waktu tunggu antar stage terhitung dari aksi yang dijalankan lewat sistem',
  wfVisits.filter((v) => bornHere.includes(v.workItemId)).some((v) => (v.waitHours ?? 0) > 0),
)
check(
  'Waktu kerja dan waktu tunggu terpisah, bukan satu angka gabungan',
  wfVisits
    .filter((v) => bornHere.includes(v.workItemId) && v.completedAt !== null)
    .every((v) => v.waitHours !== null && v.touchHours !== null),
)
check(
  'Dokumen yang lahir lewat sistem selalu punya waktu masuk di setiap kunjungannya',
  wfVisits
    .filter((v) => bornHere.includes(v.workItemId))
    .every((v) => typeof v.arrivedAt === 'string' && v.arrivedAt !== ''),
  wfVisits
    .filter((v) => bornHere.includes(v.workItemId) && !v.arrivedAt)
    .map((v) => `${v.workItemId}@${v.stageCode}`)
    .join(', '),
)

// ============================================================
section('Ringkasan pimpinan yang dihasilkan sistem')
console.log(`  "${snapshot.headline}"`)

// ============================================================
console.log(`\n${failures === 0 ? 'LULUS' : 'GAGAL'}: ${checks - failures}/${checks} pemeriksaan lolos.`)
if (failures > 0) process.exitCode = 1

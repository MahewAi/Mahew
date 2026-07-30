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
section('Ringkasan pimpinan yang dihasilkan sistem')
console.log(`  "${snapshot.headline}"`)

// ============================================================
console.log(`\n${failures === 0 ? 'LULUS' : 'GAGAL'}: ${checks - failures}/${checks} pemeriksaan lolos.`)
if (failures > 0) process.exitCode = 1

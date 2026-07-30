/**
 * OpsFlow — Skema data.
 *
 * Prinsip utama: **event-sourced**. Dashboard TIDAK menyimpan "status sekarang"
 * sebagai kebenaran. Yang disimpan adalah catatan kejadian yang tidak boleh
 * diubah (append-only), dan status sekarang dihitung ulang dari catatan itu.
 *
 * Alasannya langsung terkait masalah yang mau dipecahkan:
 * 1. Kalau hanya status terakhir yang disimpan, tidak mungkin tahu sebuah
 *    dokumen menganggur 6 hari di meja siapa. Bottleneck jadi tidak terlihat.
 * 2. Catatan yang tidak bisa diubah = jejak audit. Saat terjadi kelalaian,
 *    tidak ada perdebatan "saya sudah kirim kok".
 * 3. Definisi metrik bisa diperbaiki kapan saja lalu dihitung ulang dari awal
 *    tanpa kehilangan data.
 *
 * Semua timestamp: ISO 8601 dengan offset zona waktu (mis.
 * "2026-07-29T14:32:00+07:00"). Simpan dalam UTC, tampilkan dalam Asia/Jakarta.
 * Membandingkan timestamp antar departemen mustahil kalau zona waktu campur.
 */

import type { SectorId, WorkItemType } from './taxonomy.ts'

// ============================================================
// BAGIAN 1 — MASTER DATA (organisasi & referensi)
// ============================================================

export interface Person {
  /** ID pegawai dari HR. Jangan pakai nama sebagai kunci — nama bisa sama & bisa berubah. */
  id: string
  name: string
  /** ID sub-tim tempat orang ini bekerja. */
  teamId: string
  /** Jabatan sesuai HR. */
  position: string
  /** Level untuk matriks wewenang: makin besar makin tinggi. */
  authorityLevel: number
  /** Tanggal mulai bekerja. Dipakai membedakan kesalahan pegawai baru vs pola menahun. */
  joinedAt: string
  /** Pola shift kalau ada (mis. 'shift-1', 'non-shift'). */
  shift?: string
  active: boolean
}

export interface Team {
  id: string
  /** Nama sub-tim. Harus sama dengan StageDef.team di taxonomy.ts. */
  name: string
  sector: SectorId
  /** ID orang yang memimpin sub-tim ini — tujuan eskalasi otomatis. */
  leadPersonId: string
  /** Jumlah orang aktif. Dipakai menormalkan beban kerja per orang. */
  headcount: number
}

/**
 * Matriks wewenang persetujuan. Tanpa ini, tidak mungkin mendeteksi
 * "disetujui oleh orang yang tidak berwenang" — salah satu celah paling mahal.
 */
export interface ApprovalRule {
  id: string
  /** Stage tempat aturan ini berlaku, mis. 'FIN-40'. */
  stageCode: string
  /** Batas bawah nilai transaksi (inklusif), dalam rupiah. */
  minAmount: number
  /** Batas atas nilai (eksklusif). null = tanpa batas atas. */
  maxAmount: number | null
  /** Level wewenang minimum yang boleh menyetujui. */
  requiredAuthorityLevel: number
  /** Apakah butuh dua penyetuju berbeda (dual control). */
  requiresDualApproval: boolean
}

/** Delegasi wewenang saat penyetuju tidak di tempat. Penyebab macet approval nomor satu. */
export interface Delegation {
  id: string
  fromPersonId: string
  toPersonId: string
  startAt: string
  endAt: string
  reason: string
}

/**
 * Kalender kerja. WAJIB ada.
 * PO yang terbit Jumat 17:00 dan diproses Senin 09:00 bukan telat 64 jam —
 * itu telat 1 jam kerja. Tanpa kalender, semua SLA salah hitung dan orang
 * dihukum karena akhir pekan.
 */
export interface WorkCalendar {
  id: string
  /** Zona waktu IANA, mis. 'Asia/Jakarta'. */
  timezone: string
  /** 0 = Minggu … 6 = Sabtu. */
  workingDays: number[]
  /** Jam kerja format 'HH:mm'. */
  workStart: string
  workEnd: string
  /** Istirahat yang dikecualikan dari jam kerja. */
  breaks: Array<{ start: string; end: string }>
  /** Tanggal libur 'YYYY-MM-DD'. */
  holidays: string[]
  /** Untuk sub-tim yang jalan 24 jam (produksi shift, gudang). */
  is24Hour?: boolean
}

export interface Supplier {
  id: string
  name: string
  category: string
  /** Lead time yang dijanjikan vendor, hari kalender. Pembanding untuk performa nyata. */
  promisedLeadTimeDays: number
  /** Termin pembayaran, hari. */
  paymentTermDays: number
  active: boolean
}

export interface Customer {
  id: string
  name: string
  /** Kota/area — dipakai menganalisis performa pengiriman per wilayah. */
  region: string
  paymentTermDays: number
  creditLimit?: number
}

export interface Item {
  /** Kode item master. Ini kunci yang menyatukan pembelian, produksi, dan pengiriman. */
  id: string
  name: string
  category: string
  /** Satuan dasar. Salah satuan adalah sumber kesalahan klasik — simpan eksplisit. */
  uom: string
  /** Lead time pengadaan standar, hari kalender. */
  standardLeadTimeDays: number
  primarySupplierId?: string
  /** 'raw' = material, 'wip' = barang setengah jadi, 'fg' = barang jadi. */
  kind: 'raw' | 'wip' | 'fg'
}

/** Bill of Material — penghubung antara order pelanggan dan material yang harus dibeli. */
export interface BomLine {
  parentItemId: string
  componentItemId: string
  qtyPerUnit: number
  uom: string
}

export interface ProductionLine {
  id: string
  name: string
  /** Kapasitas per jam dalam satuan output. */
  capacityPerHour: number
  /** ID sub-tim yang mengoperasikan. */
  teamId: string
}

export interface Carrier {
  id: string
  name: string
  /** Area layanan. */
  regions: string[]
  /** Lead time janji per area, hari. */
  promisedTransitDays: Record<string, number>
}

// ============================================================
// BAGIAN 2 — OBJEK KERJA
// ============================================================

/**
 * PENTING — kesalahpahaman yang paling sering terjadi saat merancang sistem
 * seperti ini: mengira ada SATU "order" yang mengalir dari pembelian sampai
 * pengiriman. Kenyataannya ada BEBERAPA objek kerja berbeda yang saling
 * merujuk:
 *
 *   PR → PO → GRN → Invoice AP → Payment          (rantai pengadaan)
 *   SO → Production Order → QC → DO → POD → Invoice AR   (rantai pemenuhan)
 *
 * Keduanya bertemu di Item, Supplier, dan Customer. Karena itu setiap objek
 * kerja punya `links` — tanpa ini, pertanyaan "order pelanggan A telat karena
 * apa?" tidak bisa dijawab sampai ke akar (misalnya: karena PO material B
 * tertahan 9 hari di persetujuan finance).
 *
 * Inilah yang membuatnya jadi dashboard ekosistem, bukan empat dashboard
 * terpisah yang ditaruh berdampingan.
 */
export interface WorkItem {
  /** ID internal sistem OpsFlow. */
  id: string
  type: WorkItemType
  /** Nomor dokumen yang dikenal orang lapangan (mis. 'PO-2026-04821'). */
  documentNumber: string
  /**
   * ID di sistem sumber + nama sistemnya. Kombinasi keduanya harus unik —
   * ini yang mencegah data dobel saat ingestion dijalankan dua kali.
   */
  externalId: string
  sourceSystem: string
  /** Stage tempat item ini berada SEKARANG (hasil turunan dari event terakhir). */
  currentStageCode: string
  status: WorkItemStatus
  /** Kapan objek ini pertama kali lahir. Titik awal perhitungan lead time. */
  createdAt: string
  /** Kapan objek ini selesai sepenuhnya. null = masih berjalan (WIP). */
  closedAt: string | null
  /** Tanggal yang dijanjikan ke pihak yang menunggu (pelanggan / peminta internal). */
  promisedAt?: string
  /** Nilai transaksi dalam rupiah. Dipakai membobot dampak keterlambatan. */
  amount?: number
  /** Prioritas yang ditetapkan, bukan yang dirasakan. */
  priority: 'normal' | 'urgent' | 'critical'
  /** Referensi ke objek kerja lain. Inilah tulang punggung analisis lintas sektor. */
  links: WorkItemLink[]
  /** Referensi master data yang relevan. */
  refs: {
    itemIds?: string[]
    supplierId?: string
    customerId?: string
    productionLineId?: string
    carrierId?: string
    requestingTeamId?: string
  }
  /** Kolom tambahan khas perusahaan yang belum tercakup. Sengaja dibiarkan longgar. */
  extra?: Record<string, string | number | boolean | null>
}

export type WorkItemStatus =
  | 'open' // sedang berjalan di jalur normal
  | 'blocked' // tertahan pihak luar, SLA internal dijeda
  | 'on_hold' // ditahan atas keputusan internal
  | 'completed' // selesai normal
  | 'cancelled' // dibatalkan
  | 'rejected' // ditolak di sebuah gate

export interface WorkItemLink {
  /** Objek kerja yang dirujuk. */
  targetWorkItemId: string
  /**
   * 'derived_from' : objek ini lahir dari objek itu (PO derived_from PR)
   * 'fulfills'     : objek ini memenuhi objek itu (Production Order fulfills SO)
   * 'consumes'     : objek ini memakai keluaran objek itu (Production Order consumes GRN)
   * 'settles'      : objek ini menyelesaikan kewajiban objek itu (Payment settles Invoice)
   * 'disputes'     : objek ini menyanggah objek itu (Return disputes DO)
   */
  relation: 'derived_from' | 'fulfills' | 'consumes' | 'settles' | 'disputes'
}

// ============================================================
// BAGIAN 3 — EVENT LOG (inti sistem)
// ============================================================

/**
 * Tiga timestamp per stage — ini bagian paling penting di seluruh skema.
 *
 *   arrived  : pekerjaan MASUK antrean stage ini
 *   started  : seseorang MULAI mengerjakannya
 *   completed: pekerjaan diserahkan ke stage berikutnya
 *
 *   waitTime  = started   − arrived    → berapa lama menganggur di antrean
 *   touchTime = completed − started    → berapa lama benar-benar dikerjakan
 *
 * Kebanyakan perusahaan hanya mencatat `completed` (tanggal dokumen), lalu
 * bingung kenapa lead time 30 hari padahal total kerja cuma 11 jam. Jawabannya
 * ada di waitTime, dan waitTime hanya bisa dihitung kalau `arrived` dan
 * `started` dicatat terpisah.
 *
 * Kalau sistem lama Anda hanya punya satu tanggal per stage, mesin metrik tetap
 * jalan tapi hanya bisa melaporkan total durasi — tidak bisa memisahkan
 * "tidak ada yang pegang" dari "dikerjakan tapi lambat". Ini perbedaan penting,
 * karena solusinya berlawanan: yang pertama butuh perbaikan alur kerja & beban,
 * yang kedua butuh pelatihan atau alat kerja.
 */
export type EventType =
  | 'arrived' // masuk antrean sebuah stage
  | 'started' // mulai dikerjakan
  | 'completed' // selesai, diserahkan
  | 'approved'
  | 'rejected'
  | 'blocked' // mulai menunggu pihak luar (SLA dijeda)
  | 'unblocked' // pihak luar sudah merespons (SLA lanjut)
  | 'reassigned' // ganti PIC
  | 'returned' // dikembalikan ke stage sebelumnya karena tidak lengkap/salah
  | 'field_changed' // data diubah setelah dokumen jadi (perubahan qty/harga/tanggal)
  | 'cancelled'
  | 'incident_logged'
  | 'note'

export interface WorkEvent {
  id: string
  workItemId: string
  stageCode: string
  type: EventType
  /** Kapan kejadiannya BENAR-BENAR terjadi di lapangan. */
  occurredAt: string
  /** Kapan tercatat ke sistem. Selisih besar antara keduanya = disiplin pencatatan buruk. */
  recordedAt: string
  /** Siapa yang melakukan. null hanya untuk event yang dihasilkan sistem. */
  actorPersonId: string | null
  /**
   * Diisi kalau event ini dibuat oleh sistem/ingestion, bukan manusia,
   * mis. 'erp-sync', 'qr-scan-app', 'csv-import'.
   */
  recordedBy: string
  /** Stage tujuan untuk event 'completed' / 'returned'. */
  toStageCode?: string
  /** Alasan — wajib untuk 'rejected', 'returned', 'blocked', 'cancelled'. */
  reason?: string
  /** Untuk 'field_changed': apa yang berubah. Jejak perubahan setelah persetujuan. */
  change?: { field: string; from: string | number | null; to: string | number | null }
  /** Untuk 'blocked': pihak luar mana yang ditunggu. */
  blockedBy?: 'supplier' | 'customer' | 'carrier' | 'government' | 'bank' | 'other'
  /**
   * Selisih `recordedAt` − `occurredAt` dalam jam, dihitung saat ingestion.
   * Disimpan agar bisa dilaporkan sebagai metrik disiplin pencatatan.
   */
  recordingLagHours?: number
}

// ============================================================
// BAGIAN 4 — INSIDEN / KESALAHAN
// ============================================================

/**
 * Jenis kesalahan. Daftar tertutup dan sengaja pendek — kalau kategorinya
 * puluhan, orang akan memilih sembarangan dan datanya tidak berguna.
 */
export type IncidentType =
  | 'data_error' // salah input: qty, kode, harga, alamat
  | 'document_missing' // dokumen tidak ada / tidak lengkap
  | 'document_late' // dokumen ada tapi datang terlambat
  | 'approval_delay' // persetujuan menggantung tanpa alasan sah
  | 'authority_violation' // disetujui oleh yang tidak berwenang / urutan dilewati
  | 'spec_mismatch' // hasil tidak sesuai spesifikasi
  | 'quantity_variance' // selisih jumlah fisik vs dokumen
  | 'procedure_skipped' // SOP dilewati (mis. produksi jalan tanpa QC clearance)
  | 'unrecorded_work' // pekerjaan dilakukan tapi tidak dicatat di sistem
  | 'duplicate_entry' // dobel PO / dobel invoice / dobel bayar
  | 'communication_gap' // informasi tidak diteruskan ke pihak yang butuh
  | 'external_cause' // penyebab dari luar perusahaan
  | 'system_limitation' // sistem/alat kerja tidak mendukung

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Atribusi — bagian paling sensitif dan paling mudah salah.
 *
 * 'person'  : individu tertentu lalai padahal prosedur, alat, dan informasinya memadai
 * 'process' : SOP tidak jelas, tidak ada kontrol, atau alurnya memang bikin salah
 * 'system'  : alat kerja tidak mendukung (tidak ada validasi, data tidak tersedia)
 * 'external': vendor / ekspedisi / pelanggan / regulasi
 * 'unknown' : belum ditelusuri
 *
 * Aturan yang saya sarankan dipasang sebagai kebijakan, bukan hanya kode:
 * kalau jenis kesalahan yang sama, di stage yang sama, dilakukan oleh 3 orang
 * berbeda dalam 30 hari — itu 'process', bukan 'person'. Berapa pun orang yang
 * Anda ganti, kesalahannya akan terulang. Fungsi
 * `reclassifySystemicIncidents()` di metrics.ts menerapkan aturan ini otomatis.
 */
export type IncidentAttribution = 'person' | 'process' | 'system' | 'external' | 'unknown'

export interface Incident {
  id: string
  /** Objek kerja yang terkena. Boleh null untuk kesalahan yang tidak melekat pada dokumen. */
  workItemId: string | null
  /** Stage tempat kesalahan TERJADI. */
  occurredAtStage: string
  /**
   * Stage tempat kesalahan KETAHUAN. Kalau beda jauh dari occurredAtStage,
   * berarti kontrol mutu di antaranya tidak bekerja — dan biaya perbaikannya
   * berlipat. Ini metrik "escape".
   */
  detectedAtStage: string
  type: IncidentType
  severity: IncidentSeverity
  attribution: IncidentAttribution
  /** Orang yang terkait. Boleh null — dan untuk atribusi 'process'/'system' sebaiknya null. */
  personId: string | null
  /** Sub-tim yang bertanggung jawab atas stage sumber. Selalu diisi. */
  teamId: string
  occurredAt: string
  detectedAt: string
  /** Deskripsi ringkas apa yang terjadi. */
  description: string
  /** Akar masalah setelah ditelusuri. Kosong = belum ditelusuri. */
  rootCause?: string
  correctiveAction?: string
  /** Tindakan agar tidak terulang — beda dari perbaikan sesaat. */
  preventiveAction?: string
  status: 'open' | 'investigating' | 'resolved' | 'recurring'
  /** Perkiraan tambahan waktu akibat kesalahan ini, jam kerja. */
  delayImpactHours?: number
  /** Perkiraan kerugian rupiah (rework, denda, pengiriman ulang, diskon). */
  costImpactIdr?: number
  /** Diisi otomatis kalau pola yang sama sudah pernah terjadi. */
  recurrenceOf?: string
  /**
   * Ditandai true oleh `reclassifySystemicIncidents()`: kesalahan ini bagian
   * dari pola yang dilakukan banyak orang berbeda, jadi akar masalahnya proses.
   * Perlu disimpan terpisah karena `personId` sengaja dikosongkan saat
   * reklasifikasi — tanpa penanda ini, bukti bahwa polanya sistemik ikut hilang
   * dan laporan jadi menyembunyikan justru temuan terpentingnya.
   */
  systemicPattern?: boolean
  /** Jumlah orang berbeda yang melakukan kesalahan sejenis di stage yang sama. */
  systemicDistinctPeople?: number
  /** Bagaimana kesalahan ini ditemukan. */
  detectionMethod: 'automatic_rule' | 'inspection' | 'downstream_complaint' | 'customer_complaint' | 'audit' | 'self_report'
}

// ============================================================
// BAGIAN 5 — TARGET & KONFIGURASI SLA
// ============================================================

/**
 * SLA aktual yang dipakai sistem. Terpisah dari angka hipotesis di taxonomy.ts
 * supaya bisa dikalibrasi tanpa mengubah kode, dan supaya bisa berbeda per
 * kategori (material impor jelas beda dengan material lokal).
 */
export interface SlaTarget {
  stageCode: string
  /** Pembatas opsional: SLA berbeda untuk kategori/prioritas tertentu. */
  scope?: { itemCategory?: string; priority?: WorkItem['priority']; supplierId?: string }
  maxWaitHours: number
  maxTouchHours: number
  /** ID kalender kerja yang dipakai menghitung jam kerja untuk stage ini. */
  calendarId: string
  /** Dari mana angka ini berasal — penting untuk kepercayaan tim pada dashboard. */
  basis: 'hypothesis' | 'historical_p50' | 'historical_p75' | 'negotiated' | 'contractual'
  effectiveFrom: string
}

// ============================================================
// BAGIAN 6 — BUNDEL DATA & INGESTION
// ============================================================

/** Seluruh data yang dibutuhkan mesin metrik untuk menghitung satu snapshot dashboard. */
export interface OpsDataset {
  people: Person[]
  teams: Team[]
  approvalRules: ApprovalRule[]
  delegations: Delegation[]
  calendars: WorkCalendar[]
  slaTargets: SlaTarget[]
  suppliers: Supplier[]
  customers: Customer[]
  items: Item[]
  bom: BomLine[]
  productionLines: ProductionLine[]
  carriers: Carrier[]
  workItems: WorkItem[]
  events: WorkEvent[]
  incidents: Incident[]
  /** Kapan snapshot ini diambil — semua perhitungan "aging" relatif ke waktu ini. */
  snapshotAt: string
}

/**
 * Catatan hasil ingestion. Wajib ada supaya bisa membedakan
 * "tidak ada masalah di stage ini" dari "datanya memang belum masuk".
 * Tanpa ini, dashboard akan menampilkan kebohongan yang meyakinkan.
 */
export interface IngestionRun {
  id: string
  sourceSystem: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  /** Stage/entitas yang tercakup pada sinkronisasi ini. */
  coveredStageCodes: string[]
  recordsRead: number
  recordsWritten: number
  recordsRejected: number
  /** Alasan penolakan per baris — ini yang akan Anda pakai membenahi kualitas data. */
  rejections: Array<{ externalId: string; reason: string }>
}

/** Kualitas data per stage. Ditampilkan di dashboard sebagai indikator kepercayaan. */
export interface StageDataQuality {
  stageCode: string
  /** Persentase item yang punya timestamp `arrived`. Tanpa ini wait time tidak terukur. */
  arrivedCoveragePct: number
  /** Persentase item yang punya timestamp `started`. */
  startedCoveragePct: number
  /** Median selisih waktu kejadian vs waktu pencatatan, jam. Ukuran disiplin pencatatan. */
  medianRecordingLagHours: number
  /** Kesimpulan: metrik stage ini boleh dipercaya atau tidak. */
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
}

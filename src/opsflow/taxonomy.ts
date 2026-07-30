/**
 * OpsFlow — Taksonomi alur kerja ekosistem perusahaan.
 *
 * Empat sektor makro (Pembelian → Finance → Produksi → Pengiriman), tapi tiap
 * sektor dipecah jadi stage milik sub-tim yang berbeda. Pemecahan ini yang
 * bikin dashboard bisa bilang "macet di verifikasi 3-way match" alih-alih
 * cuma "macet di finance".
 *
 * File ini adalah SUMBER KEBENARAN untuk daftar stage. Kode metrik, ingestion
 * adapter, dan UI semuanya baca dari sini. Ubah di sini, bukan di tempat lain.
 *
 * Angka SLA di bawah adalah HIPOTESIS AWAL untuk dikalibrasi, bukan kebenaran.
 * Setelah 3 bulan data historis masuk, ganti dengan persentil-50 aktual per
 * stage (lihat docs/opsflow/04-KATALOG-METRIK.md § Kalibrasi SLA).
 */

// ============================================================
// Sektor
// ============================================================

export type SectorId = 'PROC' | 'FIN' | 'PRD' | 'DEL'

export interface SectorDef {
  id: SectorId
  /** Nama yang dipakai manajemen sehari-hari. */
  name: string
  /** Satu baris: sektor ini bertanggung jawab atas apa. */
  mandate: string
  /** Urutan tampilan di dashboard. */
  order: number
}

export const SECTORS: Record<SectorId, SectorDef> = {
  PROC: {
    id: 'PROC',
    name: 'Pembelian',
    mandate: 'Mengubah kebutuhan internal menjadi barang yang diterima dan lolos QC masuk.',
    order: 1,
  },
  FIN: {
    id: 'FIN',
    name: 'Finance',
    mandate: 'Memverifikasi, menyetujui, membayar, dan membukukan kewajiban tanpa kebocoran.',
    order: 2,
  },
  PRD: {
    id: 'PRD',
    name: 'Produksi',
    mandate: 'Mengubah material jadi barang jadi sesuai spesifikasi, jadwal, dan biaya.',
    order: 3,
  },
  DEL: {
    id: 'DEL',
    name: 'Pengiriman',
    mandate: 'Menyerahkan barang jadi ke pelanggan tepat waktu, utuh, dan tertagih.',
    order: 4,
  },
}

export const SECTOR_ORDER: SectorId[] = ['PROC', 'FIN', 'PRD', 'DEL']

// ============================================================
// Jenis stage
// ============================================================

/**
 * Jenis stage menentukan cara stage itu dinilai:
 * - `work`        : ada output nyata. Dinilai dari touch time.
 * - `approval`    : keputusan ya/tidak. Hampir selalu wait time, bukan kerja.
 * - `inspection`  : gerbang mutu. Dinilai dari first-pass yield + escape rate.
 * - `handoff`     : serah terima antar sub-tim. Titik paling rawan kesalahan data.
 * - `wait_external`: bola ada di pihak luar (vendor, ekspedisi, pelanggan).
 *                    SLA internal DIJEDA di sini — jangan hukum orang atas hal
 *                    di luar kendalinya.
 * - `exception`   : jalur tidak normal (retur, klaim, rework). Bukan bagian dari
 *                   lead time normal, tapi wajib dihitung frekuensinya.
 */
export type StageKind = 'work' | 'approval' | 'inspection' | 'handoff' | 'wait_external' | 'exception'

/** Jenis objek kerja yang mengalir di sistem. Lihat schema.ts. */
export type WorkItemType =
  | 'purchase_request'
  | 'purchase_order'
  | 'goods_receipt'
  | 'payable_invoice'
  | 'payment'
  | 'sales_order'
  | 'production_order'
  | 'qc_record'
  | 'delivery_order'
  | 'return_claim'
  | 'receivable_invoice'

export interface StageDef {
  /** Kode stabil. JANGAN diubah setelah data masuk — dipakai sebagai foreign key. */
  code: string
  sector: SectorId
  name: string
  /** Sub-tim pemilik stage. Ini yang bikin akuntabilitas jelas. */
  team: string
  /** Urutan dalam sektor. Stage exception boleh punya urutan di luar jalur utama. */
  order: number
  kind: StageKind
  /** Apa yang diterima stage ini dari stage sebelumnya. */
  input: string
  /** Apa yang dihasilkan, yang jadi input stage berikutnya. */
  output: string
  /** Keputusan/gerbang yang harus lewat sebelum lanjut. Kosong = tidak ada gate. */
  gate?: string
  /**
   * Target maksimum barang mengantre sebelum ada yang mulai mengerjakan (jam kerja).
   * Ini metrik yang paling sering diabaikan padahal paling sering jadi biang macet.
   */
  slaWaitHours: number
  /** Target maksimum durasi pengerjaan aktif (jam kerja). */
  slaTouchHours: number
  /** Berapa jam lewat SLA sebelum eskalasi otomatis ke atasan sub-tim. */
  escalateAfterHours: number
  /** Objek kerja yang lewat stage ini. */
  entities: WorkItemType[]
  /** Kesalahan yang paling sering terjadi di sini — dipakai untuk pilihan cepat saat log insiden. */
  commonFailures: string[]
  /** Stage yang biasanya jadi tempat kesalahan stage ini baru KETAHUAN. Kosong = ketahuan di tempat. */
  typicallyEscapesTo?: string[]
  /** True kalau stage ini tidak wajib dilewati semua item. */
  optional?: boolean
}

// ============================================================
// SEKTOR 1 — PEMBELIAN
// ============================================================

const PROCUREMENT_STAGES: StageDef[] = [
  {
    code: 'PROC-10',
    sector: 'PROC',
    name: 'Permintaan Barang (PR)',
    team: 'Departemen peminta',
    order: 10,
    kind: 'work',
    input: 'Kebutuhan operasional / rencana produksi / stok di bawah titik minimum',
    output: 'Purchase Request bernomor, dengan spesifikasi dan tanggal dibutuhkan',
    gate: 'Spesifikasi lengkap & tanggal dibutuhkan realistis',
    slaWaitHours: 4,
    slaTouchHours: 4,
    escalateAfterHours: 16,
    entities: ['purchase_request'],
    commonFailures: [
      'Spesifikasi tidak lengkap atau ambigu',
      'Tanggal dibutuhkan diisi mundur (sudah telat sejak diminta)',
      'Kode item salah / pakai nama pasaran, bukan kode master',
      'Permintaan dobel karena tidak cek PR yang sudah jalan',
    ],
    typicallyEscapesTo: ['PROC-30', 'PROC-80', 'PRD-30'],
  },
  {
    code: 'PROC-20',
    sector: 'PROC',
    name: 'Validasi & Konsolidasi PR',
    team: 'Admin Purchasing',
    order: 20,
    kind: 'work',
    input: 'PR mentah dari berbagai departemen',
    output: 'PR tervalidasi, dikelompokkan per kategori/supplier',
    gate: 'Kode item valid, tidak dobel, kategori benar',
    slaWaitHours: 8,
    slaTouchHours: 3,
    escalateAfterHours: 24,
    entities: ['purchase_request'],
    commonFailures: [
      'PR dobel lolos jadi dua PO',
      'PR mendesak tidak diprioritaskan karena diproses berurutan',
      'Konsolidasi terlalu lama sampai PR mendesak ikut tertahan',
    ],
    typicallyEscapesTo: ['PROC-50', 'FIN-20'],
  },
  {
    code: 'PROC-30',
    sector: 'PROC',
    name: 'Sourcing & Permintaan Penawaran',
    team: 'Sourcing / Buyer',
    order: 30,
    kind: 'work',
    input: 'PR tervalidasi',
    output: 'Minimal 2–3 penawaran vendor terbanding',
    gate: 'Jumlah penawaran memenuhi kebijakan pengadaan',
    slaWaitHours: 8,
    slaTouchHours: 16,
    escalateAfterHours: 48,
    entities: ['purchase_request'],
    commonFailures: [
      'Hanya 1 penawaran, kebijakan banding harga dilewati',
      'Vendor tidak balas, tidak ada follow-up terjadwal',
      'Penawaran kedaluwarsa saat approval baru turun',
      'Bandingkan harga tapi lupa bandingkan lead time',
    ],
    typicallyEscapesTo: ['PROC-60', 'FIN-40'],
  },
  {
    code: 'PROC-40',
    sector: 'PROC',
    name: 'Negosiasi & Persetujuan Harga',
    team: 'Lead Purchasing / Manajer',
    order: 40,
    kind: 'approval',
    input: 'Perbandingan penawaran',
    output: 'Vendor & harga terpilih, disetujui sesuai matriks wewenang',
    gate: 'Nilai di dalam batas wewenang penyetuju',
    slaWaitHours: 16,
    slaTouchHours: 2,
    escalateAfterHours: 48,
    entities: ['purchase_request'],
    commonFailures: [
      'Approval menggantung karena penyetuju cuti tanpa delegasi',
      'Nilai melewati batas wewenang tapi tetap disetujui level bawah',
      'Keputusan verbal (WhatsApp) tanpa jejak di sistem',
    ],
    typicallyEscapesTo: ['FIN-40', 'FIN-20'],
  },
  {
    code: 'PROC-50',
    sector: 'PROC',
    name: 'Penerbitan PO',
    team: 'Admin Purchasing',
    order: 50,
    kind: 'handoff',
    input: 'Keputusan vendor & harga',
    output: 'Purchase Order terkirim ke vendor',
    gate: 'PO merujuk PR yang benar; harga, qty, termin, alamat kirim sesuai',
    slaWaitHours: 4,
    slaTouchHours: 2,
    escalateAfterHours: 16,
    entities: ['purchase_order'],
    commonFailures: [
      'Qty atau satuan salah ketik (pcs vs box vs kg)',
      'Termin pembayaran di PO beda dengan kesepakatan',
      'Alamat/tanggal kirim salah',
      'PO tidak terhubung ke nomor PR — jejak audit terputus',
    ],
    typicallyEscapesTo: ['PROC-70', 'PROC-80', 'FIN-20'],
  },
  {
    code: 'PROC-60',
    sector: 'PROC',
    name: 'Konfirmasi & Pemantauan Vendor',
    team: 'Purchasing Expediting',
    order: 60,
    kind: 'wait_external',
    input: 'PO terkirim',
    output: 'Konfirmasi vendor + estimasi kedatangan terpantau sampai barang jalan',
    gate: 'Vendor konfirmasi tanggal kirim',
    slaWaitHours: 8,
    slaTouchHours: 4,
    escalateAfterHours: 72,
    entities: ['purchase_order'],
    commonFailures: [
      'PO terkirim tapi tidak pernah dikonfirmasi vendor, ketahuan saat barang tidak datang',
      'Tidak ada follow-up berkala, keterlambatan baru diketahui di hari jatuh tempo',
      'Vendor ubah tanggal kirim tapi produksi tidak diberi tahu',
    ],
    typicallyEscapesTo: ['PRD-20', 'PRD-30', 'DEL-40'],
  },
  {
    code: 'PROC-70',
    sector: 'PROC',
    name: 'Penerimaan Barang (GRN)',
    team: 'Gudang Inbound',
    order: 70,
    kind: 'handoff',
    input: 'Barang fisik + surat jalan vendor',
    output: 'Goods Receipt Note, stok tercatat',
    gate: 'Fisik cocok dengan PO (qty, item, kondisi)',
    slaWaitHours: 2,
    slaTouchHours: 3,
    escalateAfterHours: 8,
    entities: ['goods_receipt'],
    commonFailures: [
      'Barang diterima tapi GRN dibuat belakangan (stok sistem beda dengan fisik)',
      'Terima barang tanpa PO acuan',
      'Selisih jumlah dicatat sesuai surat jalan vendor, bukan hitungan fisik',
      'Barang masuk gudang tanpa lewat QC',
    ],
    typicallyEscapesTo: ['FIN-20', 'PRD-30'],
  },
  {
    code: 'PROC-80',
    sector: 'PROC',
    name: 'QC Barang Masuk',
    team: 'QC Incoming',
    order: 80,
    kind: 'inspection',
    input: 'Barang ter-GRN, status karantina',
    output: 'Keputusan terima / tolak / terima bersyarat',
    gate: 'Sesuai spesifikasi PR',
    slaWaitHours: 8,
    slaTouchHours: 4,
    escalateAfterHours: 24,
    entities: ['goods_receipt', 'qc_record'],
    commonFailures: [
      'Barang dipakai produksi sebelum QC keluar (SOP dilewati)',
      'Sampling tidak sesuai standar karena diburu produksi',
      'Hasil QC tidak dicatat, hanya lisan',
      'Barang tolak tidak dipisah fisik, ikut terpakai',
    ],
    typicallyEscapesTo: ['PRD-60', 'PRD-80', 'DEL-80'],
  },
  {
    code: 'PROC-90',
    sector: 'PROC',
    name: 'Retur / Klaim ke Vendor',
    team: 'Purchasing + Gudang',
    order: 90,
    kind: 'exception',
    input: 'Barang ditolak QC atau selisih jumlah',
    output: 'Nota retur / klaim, penggantian atau nota kredit',
    slaWaitHours: 8,
    slaTouchHours: 8,
    escalateAfterHours: 72,
    entities: ['return_claim'],
    commonFailures: [
      'Retur tidak diklaim ke vendor, jadi kerugian sendiri',
      'Nota kredit vendor tidak dikaitkan ke invoice, tetap dibayar penuh',
      'Barang retur menumpuk di gudang tanpa status jelas',
    ],
    typicallyEscapesTo: ['FIN-20', 'FIN-60'],
    optional: true,
  },
]

// ============================================================
// SEKTOR 2 — FINANCE
// ============================================================

const FINANCE_STAGES: StageDef[] = [
  {
    code: 'FIN-10',
    sector: 'FIN',
    name: 'Cek Ketersediaan Anggaran',
    team: 'Budget Control',
    order: 10,
    kind: 'approval',
    input: 'PR tervalidasi atau permintaan harga',
    output: 'Konfirmasi anggaran tersedia + kode akun biaya',
    gate: 'Ada pos anggaran & sisa cukup',
    slaWaitHours: 8,
    slaTouchHours: 2,
    escalateAfterHours: 24,
    entities: ['purchase_request'],
    commonFailures: [
      'PO diterbitkan dulu, anggaran dicek belakangan',
      'Kode akun biaya salah, laporan biaya per departemen jadi ngawur',
      'Anggaran dipakai dua kali karena komitmen PO tidak dibukukan',
    ],
    typicallyEscapesTo: ['FIN-70', 'FIN-80'],
  },
  {
    code: 'FIN-20',
    sector: 'FIN',
    name: 'Verifikasi Dokumen & 3-Way Match',
    team: 'Accounts Payable',
    order: 20,
    kind: 'work',
    input: 'Invoice vendor + PO + GRN',
    output: 'Invoice tervalidasi siap approval',
    gate: 'PO = GRN = Invoice (item, qty, harga)',
    slaWaitHours: 16,
    slaTouchHours: 3,
    escalateAfterHours: 48,
    entities: ['payable_invoice'],
    commonFailures: [
      'Invoice masuk tapi GRN belum dibuat gudang — invoice menganggur berhari-hari',
      'Selisih harga kecil diloloskan tanpa persetujuan',
      'Invoice fisik hilang / tertahan di meja seseorang',
      'Invoice dobel dibayar karena nomor invoice tidak diperiksa',
    ],
    typicallyEscapesTo: ['FIN-60', 'FIN-80'],
  },
  {
    code: 'FIN-30',
    sector: 'FIN',
    name: 'Verifikasi Pajak & Faktur',
    team: 'Tax',
    order: 30,
    kind: 'work',
    input: 'Invoice tervalidasi + faktur pajak',
    output: 'Faktur pajak sah & tercatat',
    gate: 'Faktur pajak valid dan periodenya benar',
    slaWaitHours: 16,
    slaTouchHours: 2,
    escalateAfterHours: 48,
    entities: ['payable_invoice'],
    commonFailures: [
      'Faktur pajak belum diterima tapi pembayaran jalan',
      'Faktur beda periode, kredit pajak hilang',
      'NPWP / data vendor salah',
    ],
    typicallyEscapesTo: ['FIN-80'],
  },
  {
    code: 'FIN-40',
    sector: 'FIN',
    name: 'Persetujuan Berjenjang',
    team: 'Manajer / Direktur',
    order: 40,
    kind: 'approval',
    input: 'Invoice tervalidasi',
    output: 'Persetujuan bayar sesuai matriks wewenang',
    gate: 'Penyetuju sesuai batas nilai; ada delegasi saat tidak di tempat',
    slaWaitHours: 24,
    slaTouchHours: 1,
    escalateAfterHours: 48,
    entities: ['payable_invoice'],
    commonFailures: [
      'Dokumen menumpuk menunggu satu orang (single point of approval)',
      'Tidak ada delegasi saat penyetuju cuti/dinas luar',
      'Disetujui tanpa dibaca karena volume terlalu banyak',
      'Urutan approval dilewati',
    ],
    typicallyEscapesTo: ['FIN-60', 'FIN-80'],
  },
  {
    code: 'FIN-50',
    sector: 'FIN',
    name: 'Penjadwalan Pembayaran',
    team: 'Treasury',
    order: 50,
    kind: 'work',
    input: 'Invoice disetujui',
    output: 'Masuk daftar payment run sesuai jatuh tempo & posisi kas',
    gate: 'Kas cukup pada tanggal jatuh tempo',
    slaWaitHours: 8,
    slaTouchHours: 3,
    escalateAfterHours: 24,
    entities: ['payable_invoice', 'payment'],
    commonFailures: [
      'Invoice lewat jatuh tempo karena masuk batch berikutnya',
      'Prioritas pembayaran berdasarkan tekanan vendor, bukan jatuh tempo',
      'Diskon pembayaran cepat hangus',
    ],
    typicallyEscapesTo: ['PROC-60'],
  },
  {
    code: 'FIN-60',
    sector: 'FIN',
    name: 'Eksekusi Pembayaran',
    team: 'Treasury / Kasir',
    order: 60,
    kind: 'work',
    input: 'Daftar payment run',
    output: 'Transfer terkirim + bukti bayar terarsip',
    gate: 'Rekening tujuan terverifikasi (dual control)',
    slaWaitHours: 4,
    slaTouchHours: 2,
    escalateAfterHours: 12,
    entities: ['payment'],
    commonFailures: [
      'Salah rekening tujuan / salah nominal',
      'Bukti transfer tidak diarsip, vendor mengklaim belum terima',
      'Perubahan rekening vendor tidak diverifikasi ulang (rawan fraud)',
      'Bayar dobel untuk invoice yang sama',
    ],
    typicallyEscapesTo: ['FIN-80'],
  },
  {
    code: 'FIN-70',
    sector: 'FIN',
    name: 'Pencatatan & Alokasi Biaya',
    team: 'Accounting',
    order: 70,
    kind: 'work',
    input: 'Pembayaran & dokumen pendukung',
    output: 'Jurnal terbukukan, biaya teralokasi ke pusat biaya / order produksi',
    gate: 'Alokasi sesuai objek biaya',
    slaWaitHours: 24,
    slaTouchHours: 4,
    escalateAfterHours: 72,
    entities: ['payment'],
    commonFailures: [
      'Biaya masuk pusat biaya yang salah',
      'Biaya produksi tidak dialokasikan ke order produksi, HPP per produk tidak akurat',
      'Pembukuan menumpuk di akhir bulan',
    ],
    typicallyEscapesTo: ['FIN-80'],
  },
  {
    code: 'FIN-80',
    sector: 'FIN',
    name: 'Rekonsiliasi & Penutupan Periode',
    team: 'Accounting',
    order: 80,
    kind: 'inspection',
    input: 'Semua transaksi periode',
    output: 'Buku tertutup, selisih teridentifikasi & terjelaskan',
    gate: 'Selisih nol atau terjelaskan',
    slaWaitHours: 24,
    slaTouchHours: 24,
    escalateAfterHours: 120,
    entities: ['payment', 'payable_invoice'],
    commonFailures: [
      'Selisih ditutup dengan jurnal penyesuaian tanpa cari akar masalah',
      'Penutupan telat, manajemen ambil keputusan dengan angka basi',
      'Selisih stok gudang vs buku tidak pernah tuntas',
    ],
  },
]

// ============================================================
// SEKTOR 3 — PRODUKSI
// ============================================================

const PRODUCTION_STAGES: StageDef[] = [
  {
    code: 'PRD-10',
    sector: 'PRD',
    name: 'Perencanaan Produksi',
    team: 'PPIC',
    order: 10,
    kind: 'work',
    input: 'Sales order / forecast / titik minimum stok',
    output: 'Production order terjadwal per line & shift',
    gate: 'Kapasitas line & tenaga tersedia',
    slaWaitHours: 8,
    slaTouchHours: 8,
    escalateAfterHours: 24,
    entities: ['production_order'],
    commonFailures: [
      'Jadwal dibuat tanpa cek ketersediaan material',
      'Jadwal berubah harian, line kehilangan waktu untuk setup ulang',
      'Order mendesak diselipkan tanpa menggeser jadwal resmi — jadwal sistem tidak lagi mencerminkan realita',
      'Kapasitas dihitung 100%, tanpa cadangan untuk gangguan',
    ],
    typicallyEscapesTo: ['PRD-30', 'PRD-50', 'DEL-10'],
  },
  {
    code: 'PRD-20',
    sector: 'PRD',
    name: 'Cek Ketersediaan & Alokasi Material',
    team: 'PPIC + Gudang',
    order: 20,
    kind: 'work',
    input: 'Production order terjadwal + BOM',
    output: 'Material teralokasi, kekurangan tereskalasi ke Purchasing',
    gate: 'Semua komponen BOM tersedia atau ada tanggal kedatangan pasti',
    slaWaitHours: 4,
    slaTouchHours: 4,
    escalateAfterHours: 16,
    entities: ['production_order'],
    commonFailures: [
      'Stok sistem ada, fisik tidak ada (akurasi stok rendah)',
      'Material dialokasikan dua kali untuk dua order',
      'Kekurangan material ketahuan pas mau produksi, bukan saat perencanaan',
      'BOM tidak diperbarui setelah perubahan desain',
    ],
    typicallyEscapesTo: ['PRD-30', 'PRD-50'],
  },
  {
    code: 'PRD-30',
    sector: 'PRD',
    name: 'Pengeluaran Material ke Line',
    team: 'Gudang Produksi',
    order: 30,
    kind: 'handoff',
    input: 'Alokasi material + permintaan line',
    output: 'Material di line, stok berkurang di sistem',
    gate: 'Material lolos QC masuk & jumlah sesuai BOM',
    slaWaitHours: 2,
    slaTouchHours: 2,
    escalateAfterHours: 8,
    entities: ['production_order'],
    commonFailures: [
      'Material keluar tanpa dokumen, stok sistem tidak berkurang',
      'Ambil material yang statusnya masih karantina QC',
      'Jumlah keluar tidak sama dengan yang tercatat, selisih baru ketahuan saat stock opname',
      'Salah batch / salah nomor lot, ketelusuran hilang',
    ],
    typicallyEscapesTo: ['PRD-60', 'PRD-80', 'FIN-80'],
  },
  {
    code: 'PRD-40',
    sector: 'PRD',
    name: 'Setup Mesin & Cek Kesiapan',
    team: 'Maintenance / Teknik',
    order: 40,
    kind: 'work',
    input: 'Jadwal produksi + spesifikasi produk',
    output: 'Mesin siap, parameter terset, checklist kesiapan terisi',
    gate: 'Checklist kesiapan lolos',
    slaWaitHours: 2,
    slaTouchHours: 3,
    escalateAfterHours: 8,
    entities: ['production_order'],
    commonFailures: [
      'Perawatan preventif dilewati karena line dikejar target',
      'Checklist ditandatangani tanpa benar-benar diperiksa',
      'Parameter mesin diubah operator tanpa dicatat',
      'Kerusakan berulang tidak dianalisis akar masalahnya, hanya diperbaiki sementara',
    ],
    typicallyEscapesTo: ['PRD-50', 'PRD-60'],
  },
  {
    code: 'PRD-50',
    sector: 'PRD',
    name: 'Eksekusi Produksi per Shift',
    team: 'Produksi (per line & shift)',
    order: 50,
    kind: 'work',
    input: 'Material di line + mesin siap',
    output: 'Output produksi + catatan hasil per shift',
    gate: 'Output sesuai target shift',
    slaWaitHours: 1,
    slaTouchHours: 8,
    escalateAfterHours: 8,
    entities: ['production_order'],
    commonFailures: [
      'Output dicatat di akhir shift dari ingatan, bukan saat kejadian',
      'Downtime tidak dicatat atau dicatat dengan alasan generik',
      'Serah terima antar shift tidak lengkap, shift berikutnya salah lanjut',
      'Produk cacat dicampur dengan yang bagus',
    ],
    typicallyEscapesTo: ['PRD-60', 'PRD-80', 'DEL-80'],
  },
  {
    code: 'PRD-60',
    sector: 'PRD',
    name: 'QC Dalam Proses',
    team: 'QC In-Process',
    order: 60,
    kind: 'inspection',
    input: 'Output produksi sedang berjalan',
    output: 'Hasil inspeksi + instruksi lanjut/setop',
    gate: 'Parameter mutu dalam batas kendali',
    slaWaitHours: 1,
    slaTouchHours: 2,
    escalateAfterHours: 4,
    entities: ['qc_record'],
    commonFailures: [
      'Frekuensi sampling dikurangi saat produksi padat',
      'Temuan tidak menghentikan line, produksi lanjut sampai satu batch penuh cacat',
      'Data inspeksi diisi belakangan / diseragamkan',
    ],
    typicallyEscapesTo: ['PRD-80', 'DEL-80'],
  },
  {
    code: 'PRD-70',
    sector: 'PRD',
    name: 'Rework / Perbaikan',
    team: 'Produksi',
    order: 70,
    kind: 'exception',
    input: 'Produk tidak lolos QC',
    output: 'Produk diperbaiki atau dinyatakan scrap',
    gate: 'Hasil rework lolos inspeksi ulang',
    slaWaitHours: 8,
    slaTouchHours: 8,
    escalateAfterHours: 48,
    entities: ['production_order', 'qc_record'],
    commonFailures: [
      'Rework tidak dicatat, biaya dan waktunya tidak terlihat di laporan',
      'Produk rework tidak diinspeksi ulang',
      'Akar masalah tidak diperbaiki, rework yang sama terulang setiap batch',
    ],
    typicallyEscapesTo: ['PRD-80', 'DEL-80'],
    optional: true,
  },
  {
    code: 'PRD-80',
    sector: 'PRD',
    name: 'QC Akhir',
    team: 'QC Final',
    order: 80,
    kind: 'inspection',
    input: 'Barang jadi',
    output: 'Sertifikat lolos / keputusan tahan',
    gate: 'Sesuai spesifikasi pelanggan',
    slaWaitHours: 4,
    slaTouchHours: 4,
    escalateAfterHours: 12,
    entities: ['qc_record'],
    commonFailures: [
      'Barang dikirim sebelum QC akhir keluar karena dikejar jadwal kirim',
      'Sertifikat lolos diterbitkan berdasarkan sampel batch sebelumnya',
      'Barang tahan tidak dipisah fisik, ikut terkirim',
    ],
    typicallyEscapesTo: ['DEL-30', 'DEL-80'],
  },
  {
    code: 'PRD-90',
    sector: 'PRD',
    name: 'Serah Terima ke Gudang Barang Jadi',
    team: 'Gudang Finished Goods',
    order: 90,
    kind: 'handoff',
    input: 'Barang jadi lolos QC',
    output: 'Stok barang jadi tercatat & siap dikirim',
    gate: 'Jumlah fisik = jumlah dokumen serah terima',
    slaWaitHours: 2,
    slaTouchHours: 2,
    escalateAfterHours: 8,
    entities: ['production_order'],
    commonFailures: [
      'Barang jadi masuk gudang tanpa dokumen serah terima',
      'Selisih jumlah antara laporan produksi dan penerimaan gudang tidak direkonsiliasi',
      'Penempatan tanpa lokasi tercatat, barang "hilang" di gudang sendiri',
    ],
    typicallyEscapesTo: ['DEL-30', 'FIN-80'],
  },
]

// ============================================================
// SEKTOR 4 — PENGIRIMAN
// ============================================================

const DELIVERY_STAGES: StageDef[] = [
  {
    code: 'DEL-10',
    sector: 'DEL',
    name: 'Sales Order & Konfirmasi Stok',
    team: 'Admin Sales',
    order: 10,
    kind: 'work',
    input: 'Pesanan pelanggan',
    output: 'Sales order terkonfirmasi + tanggal kirim yang dijanjikan',
    gate: 'Stok tersedia atau produksi terjadwal sebelum tanggal janji',
    slaWaitHours: 4,
    slaTouchHours: 2,
    escalateAfterHours: 12,
    entities: ['sales_order'],
    commonFailures: [
      'Tanggal kirim dijanjikan tanpa cek kapasitas produksi',
      'Alamat / kontak penerima salah',
      'Perubahan pesanan pelanggan tidak diteruskan ke produksi & gudang',
      'Order pelanggan diterima meski limit kredit terlampaui',
    ],
    typicallyEscapesTo: ['DEL-30', 'DEL-70', 'DEL-90'],
  },
  {
    code: 'DEL-20',
    sector: 'DEL',
    name: 'Penerbitan Surat Jalan / DO',
    team: 'Admin Logistik',
    order: 20,
    kind: 'work',
    input: 'Sales order siap kirim',
    output: 'Delivery order / surat jalan bernomor',
    gate: 'Barang tersedia & lolos QC akhir',
    slaWaitHours: 4,
    slaTouchHours: 1,
    escalateAfterHours: 12,
    entities: ['delivery_order'],
    commonFailures: [
      'Surat jalan dibuat untuk barang yang belum lolos QC',
      'Isi surat jalan beda dengan fisik yang dimuat',
      'Nomor surat jalan tidak terhubung ke sales order',
    ],
    typicallyEscapesTo: ['DEL-70', 'DEL-80', 'DEL-90'],
  },
  {
    code: 'DEL-30',
    sector: 'DEL',
    name: 'Picking & Packing',
    team: 'Gudang Finished Goods',
    order: 30,
    kind: 'work',
    input: 'Delivery order',
    output: 'Barang terkemas, siap muat',
    gate: 'Jumlah & item cocok dengan DO',
    slaWaitHours: 4,
    slaTouchHours: 3,
    escalateAfterHours: 12,
    entities: ['delivery_order'],
    commonFailures: [
      'Salah ambil varian / ukuran yang mirip',
      'Kemasan kurang pelindung, barang rusak di jalan',
      'Picking berdasarkan hafalan, bukan daftar',
      'Barang diambil dari lot yang salah, FIFO terlanggar',
    ],
    typicallyEscapesTo: ['DEL-70', 'DEL-80'],
  },
  {
    code: 'DEL-40',
    sector: 'DEL',
    name: 'Penjadwalan Ekspedisi / Armada',
    team: 'Logistik',
    order: 40,
    kind: 'work',
    input: 'Barang terkemas + tujuan',
    output: 'Armada/ekspedisi terjadwal dengan rute & jam muat',
    gate: 'Kapasitas armada cukup untuk tanggal janji',
    slaWaitHours: 8,
    slaTouchHours: 2,
    escalateAfterHours: 24,
    entities: ['delivery_order'],
    commonFailures: [
      'Barang siap tapi armada baru dicari hari itu',
      'Muatan tidak dikonsolidasi, biaya kirim membengkak',
      'Ekspedisi dipilih tanpa cek rekam jejak ketepatan waktu',
    ],
    typicallyEscapesTo: ['DEL-50', 'DEL-60'],
  },
  {
    code: 'DEL-50',
    sector: 'DEL',
    name: 'Loading & Keberangkatan',
    team: 'Gudang + Driver',
    order: 50,
    kind: 'handoff',
    input: 'Barang terkemas + armada di dock',
    output: 'Kendaraan berangkat, jam keberangkatan tercatat',
    gate: 'Muatan diverifikasi dua pihak (gudang & driver)',
    slaWaitHours: 2,
    slaTouchHours: 2,
    escalateAfterHours: 6,
    entities: ['delivery_order'],
    commonFailures: [
      'Jam keberangkatan tidak dicatat, tidak bisa hitung keterlambatan di jalan',
      'Muatan tidak dicek ulang saat dimuat',
      'Kendaraan berangkat tidak penuh padahal ada order tujuan sama',
    ],
    typicallyEscapesTo: ['DEL-70'],
  },
  {
    code: 'DEL-60',
    sector: 'DEL',
    name: 'Perjalanan & Pemantauan',
    team: 'Ekspedisi',
    order: 60,
    kind: 'wait_external',
    input: 'Kendaraan berangkat',
    output: 'Posisi terpantau + estimasi tiba terkini',
    gate: 'Tiba sesuai estimasi',
    slaWaitHours: 0,
    slaTouchHours: 24,
    escalateAfterHours: 12,
    entities: ['delivery_order'],
    commonFailures: [
      'Tidak ada pemantauan, keterlambatan diketahui dari komplain pelanggan',
      'Driver ubah rute/urutan tanpa memberi tahu',
      'Kendala di jalan tidak dilaporkan ke pelanggan',
    ],
    typicallyEscapesTo: ['DEL-70', 'DEL-80'],
  },
  {
    code: 'DEL-70',
    sector: 'DEL',
    name: 'Serah Terima & Bukti Terima (POD)',
    team: 'Driver / Customer Service',
    order: 70,
    kind: 'handoff',
    input: 'Barang tiba di lokasi pelanggan',
    output: 'Surat jalan bertanda tangan / bukti terima digital',
    gate: 'Pelanggan menerima tanpa keberatan',
    slaWaitHours: 1,
    slaTouchHours: 1,
    escalateAfterHours: 8,
    entities: ['delivery_order'],
    commonFailures: [
      'Bukti terima tidak kembali ke kantor berhari-hari, penagihan tertahan',
      'Surat jalan ditandatangani tanpa nama & jabatan penerima jelas',
      'Penolakan sebagian tidak dicatat di surat jalan',
      'Bukti terima hilang, pelanggan menolak bayar',
    ],
    typicallyEscapesTo: ['DEL-90'],
  },
  {
    code: 'DEL-80',
    sector: 'DEL',
    name: 'Retur / Klaim Pelanggan',
    team: 'Customer Service + Logistik',
    order: 80,
    kind: 'exception',
    input: 'Keluhan / penolakan pelanggan',
    output: 'Keputusan klaim + tindakan perbaikan',
    gate: 'Akar masalah teridentifikasi & ditugaskan ke stage sumber',
    slaWaitHours: 4,
    slaTouchHours: 8,
    escalateAfterHours: 24,
    entities: ['return_claim'],
    commonFailures: [
      'Klaim diselesaikan tanpa mencatat stage sumber kesalahan — pola tidak pernah terlihat',
      'Retur barang tidak masuk kembali ke stok',
      'Keluhan diselesaikan lisan, tidak masuk sistem',
    ],
    typicallyEscapesTo: ['FIN-80'],
    optional: true,
  },
  {
    code: 'DEL-90',
    sector: 'DEL',
    name: 'Penagihan & Piutang',
    team: 'Finance AR',
    order: 90,
    kind: 'work',
    input: 'Bukti terima pelanggan',
    output: 'Invoice terkirim, jatuh tempo terpantau',
    gate: 'Invoice sesuai barang yang benar-benar diterima',
    slaWaitHours: 8,
    slaTouchHours: 2,
    escalateAfterHours: 24,
    entities: ['receivable_invoice'],
    commonFailures: [
      'Invoice terlambat dibuat karena menunggu bukti terima fisik',
      'Invoice tidak sesuai barang diterima, pelanggan menahan pembayaran',
      'Jatuh tempo tidak dipantau, piutang menua tanpa penagihan',
    ],
    typicallyEscapesTo: ['FIN-80'],
  },
]

// ============================================================
// Agregat & helper
// ============================================================

export const STAGES: StageDef[] = [
  ...PROCUREMENT_STAGES,
  ...FINANCE_STAGES,
  ...PRODUCTION_STAGES,
  ...DELIVERY_STAGES,
]

const STAGE_INDEX: Map<string, StageDef> = new Map(STAGES.map((s) => [s.code, s]))

export function getStage(code: string): StageDef | undefined {
  return STAGE_INDEX.get(code)
}

/** Stage milik satu sektor, urut. Sertakan stage exception hanya jika diminta. */
export function stagesOfSector(sector: SectorId, includeExceptions = true): StageDef[] {
  return STAGES.filter((s) => s.sector === sector && (includeExceptions || s.kind !== 'exception')).sort(
    (a, b) => a.order - b.order,
  )
}

/** Jalur utama end-to-end tanpa stage exception. Dipakai untuk hitung lead time normal. */
export function mainPath(): StageDef[] {
  return SECTOR_ORDER.flatMap((sector) => stagesOfSector(sector, false))
}

/**
 * Jarak antar stage di jalur utama, dalam jumlah stage.
 * Dipakai untuk menghitung seberapa jauh sebuah kesalahan "lolos" sebelum ketahuan:
 * makin jauh, makin mahal biaya perbaikannya.
 * Mengembalikan null kalau salah satu stage bukan bagian jalur utama.
 */
export function stageDistance(fromCode: string, toCode: string): number | null {
  const path = mainPath()
  const from = path.findIndex((s) => s.code === fromCode)
  const to = path.findIndex((s) => s.code === toCode)
  if (from < 0 || to < 0) return null
  return to - from
}

/** Semua sub-tim unik, dipakai untuk filter dashboard dan pemetaan personel. */
export function allTeams(): Array<{ team: string; sector: SectorId; stageCodes: string[] }> {
  const map = new Map<string, { team: string; sector: SectorId; stageCodes: string[] }>()
  for (const stage of STAGES) {
    const key = `${stage.sector}::${stage.team}`
    const existing = map.get(key)
    if (existing) {
      existing.stageCodes.push(stage.code)
    } else {
      map.set(key, { team: stage.team, sector: stage.sector, stageCodes: [stage.code] })
    }
  }
  return [...map.values()]
}

/** Total SLA jalur utama (jam kerja). Ini janji lead time internal kalau semua stage tepat waktu. */
export function mainPathSlaHours(): number {
  return mainPath().reduce((total, s) => total + s.slaWaitHours + s.slaTouchHours, 0)
}

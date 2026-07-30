/**
 * OpsFlow — Instance palet visualisasi & pembantu format.
 *
 * Semua warna di bawah TERVALIDASI, bukan dipilih dengan mata. Hasil pemeriksaan
 * dicatat di komentar tiap bagian supaya bisa diaudit ulang kapan saja.
 *
 * Permukaan yang dipakai app ini: `#f9f7f3` (bg-surface) dan `#ffffff`
 * (bg-elevated). App tidak punya mode gelap, jadi dashboard ini juga tidak —
 * menambahkan mode gelap hanya di satu halaman akan terasa asing.
 *
 * ATURAN PEMAKAIAN — ini yang menjaga palet tetap sah:
 *
 *   1. Warna SEKTOR hanya muncul di peta alur, chip filter sektor, dan batang
 *      bertumpuk "waktu tunggu per sektor". Tidak di tempat lain.
 *   2. Warna STATUS hanya muncul di lencana dan batang keparahan, dan SELALU
 *      disertai ikon + teks. Tidak pernah jadi warna seri.
 *   3. Keduanya tidak pernah berada dalam satu kumpulan mark yang sama —
 *      beberapa pasangan sektor↔status memang berdekatan (lihat catatan di
 *      bawah), jadi pemisahnya adalah penempatan + ikon + label, bukan hue.
 *   4. Panjang batang yang membawa besaran, bukan warnanya. Kategori nominal
 *      (nama stage, nama sub-tim) memakai satu warna, tidak diberi ramp nilai.
 */

import type { SectorId } from './taxonomy.ts'

// ============================================================
// Warna sektor — kategorikal, 4 slot
// ============================================================

/**
 * Diturunkan dari keluarga hue merek app (brass/gold, teal-sage, rose, violet)
 * lalu di-"snap" ke langkah yang lolos gate. Warna token `role-*` app aslinya
 * chroma-nya di bawah floor (0.052–0.095) sehingga tidak sah dipakai sebagai
 * warna seri — itu tint merek, bukan slot data.
 *
 * Hasil validasi (mode terang, `--pairs all`, kedua permukaan app):
 *   Lightness band        PASS  semua di L 0.43–0.77
 *   Chroma floor          PASS  semua >= 0.10
 *   CVD separation        PASS  terburuk #279b88↔#b0893b ΔE 9.7 (protan) · tritan 15.0
 *   Normal-vision floor   PASS  terburuk #279b88↔#b0893b ΔE 16.0
 *   Contrast vs surface   PASS  semua >= 3:1  (3.03 / 3.20 / 5.45 / 7.88 @ #f9f7f3)
 *
 * Dipakai `--pairs all` (bukan hanya pasangan bertetangga) karena di peta alur
 * keempat sektor tampil bersamaan dan mana pun bisa bersebelahan.
 */
export const SECTOR_COLOR: Record<SectorId, string> = {
  PROC: '#b0893b',
  FIN: '#279b88',
  PRD: '#a44659',
  DEL: '#633a88',
}

/** Wash 10% untuk latar lembut — bukan blok pekat. */
export const SECTOR_WASH: Record<SectorId, string> = {
  PROC: 'rgba(176, 137, 59, 0.10)',
  FIN: 'rgba(39, 155, 136, 0.10)',
  PRD: 'rgba(164, 70, 89, 0.10)',
  DEL: 'rgba(99, 58, 136, 0.10)',
}

// ============================================================
// Status — skala tetap, makna khusus, selalu ikon + label
// ============================================================

export type SeverityLevel = 'good' | 'warning' | 'serious' | 'critical'

/**
 * Kontras terhadap permukaan app (dua-duanya lolos 3:1, lebih ketat dari
 * kebutuhan minimum):
 *   good     #2f7a4d   4.89 @ #f9f7f3   5.23 @ #ffffff
 *   warning  #b57b12   3.38             3.62
 *   serious  #c0632c   3.88             4.15
 *   critical #a8352f   6.10             6.53
 *
 * Kedekatan yang diketahui dengan warna sektor (ΔE normal, di bawah 15 berarti
 * TIDAK BOLEH bersandar pada hue saja):
 *   PROC gold ↔ warning 3.6 · ↔ serious 9.3
 *   PRD rose  ↔ critical 5.5 · ↔ serious 11.6
 *   FIN teal  ↔ good 11.1
 * Karena itu aturan 3 di atas: status selalu dengan ikon + teks, dan tidak
 * pernah satu kumpulan mark dengan warna sektor.
 */
export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  good: '#2f7a4d',
  warning: '#b57b12',
  serious: '#c0632c',
  critical: '#a8352f',
}

export const SEVERITY_WASH: Record<SeverityLevel, string> = {
  good: 'rgba(47, 122, 77, 0.12)',
  warning: 'rgba(181, 123, 18, 0.12)',
  serious: 'rgba(192, 99, 44, 0.12)',
  critical: 'rgba(168, 53, 47, 0.12)',
}

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  good: 'Aman',
  warning: 'Perlu dilihat',
  serious: 'Bermasalah',
  critical: 'Kritis',
}

/** Skor bottleneck → tingkat keparahan. Ambang dipilih agar sebaran terbaca, bukan agar terlihat bagus. */
export function severityOfScore(score: number): SeverityLevel {
  if (score >= 60) return 'critical'
  if (score >= 40) return 'serious'
  if (score >= 22) return 'warning'
  return 'good'
}

/** Umur WIP (jam kerja) → tingkat keparahan. Dipakai untuk batang umur. */
export function severityOfAge(bucket: 'under8h' | 'h8to24' | 'h24to72' | 'over72h'): SeverityLevel {
  switch (bucket) {
    case 'under8h':
      return 'good'
    case 'h8to24':
      return 'warning'
    case 'h24to72':
      return 'serious'
    case 'over72h':
      return 'critical'
  }
}

/** Persentase ketepatan waktu → tingkat keparahan. */
export function severityOfOnTime(pct: number): SeverityLevel {
  if (pct >= 90) return 'good'
  if (pct >= 75) return 'warning'
  if (pct >= 50) return 'serious'
  return 'critical'
}

/** Tingkat kepercayaan data → tingkat keparahan, untuk lencana kualitas data. */
export function severityOfConfidence(c: 'high' | 'medium' | 'low' | 'insufficient'): SeverityLevel {
  switch (c) {
    case 'high':
      return 'good'
    case 'medium':
      return 'warning'
    case 'low':
      return 'serious'
    case 'insufficient':
      return 'critical'
  }
}

// ============================================================
// Ramp tunggu vs kerja — satu hue netral, dua langkah (ordinal)
// ============================================================

/**
 * Sengaja NETRAL (hue brass dengan chroma sangat rendah) supaya tidak pernah
 * bertabrakan dengan hue sektor mana pun. Percobaan memakai pasangan biru
 * gagal dua kali: ujung terangnya di bawah 2:1, dan birunya bertabrakan dengan
 * violet sektor (ΔE 6.0 deutan / 13.0 normal) — kegagalan yang hanya kelihatan
 * karena divalidasi, bukan dikira-kira.
 *
 * Hasil validasi ordinal @ #f9f7f3:
 *   Lightness monotone   PASS
 *   Adjacent ΔL          PASS  semua celah >= 0.06
 *   Light-end contrast   PASS  #b6aa9a 2.13:1
 *   Single hue           PASS  sebaran hue 2°
 */
export const TIME_COLOR = {
  /** Waktu menganggur di antrean — ini yang jadi pokok masalah, jadi yang dominan. */
  wait: '#41392f',
  /** Waktu benar-benar dikerjakan. */
  touch: '#b6aa9a',
  /** Tertahan pihak luar — dikeluarkan dari penilaian SLA. */
  blocked: '#d8d0c4',
} as const

// ============================================================
// Chrome grafik
// ============================================================

/** Kontras terhadap #f9f7f3: grid 1.19, axis 1.54, muted 3.42 — recessive, solid, bukan putus-putus. */
export const CHART_CHROME = {
  grid: '#e8e4dc',
  axis: '#cfc9bd',
  muted: '#8c8578',
  /** Warna permukaan untuk celah 2px antar mark. */
  surface: '#ffffff',
} as const

// ============================================================
// Format angka
// ============================================================

/** Jam kerja: 0,5 j / 6 j / 18 j / 3,2 hk (hari kerja, 8 jam). */
export function formatWorkHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  if (hours < 1) return `${hours.toFixed(1).replace('.', ',')} j`
  if (hours < 24) return `${Math.round(hours)} j`
  return `${(hours / 8).toFixed(1).replace('.', ',')} hk`
}

/** Rupiah ringkas: Rp 654,8 jt / Rp 1,2 M. */
export function formatIdr(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)} rb`
  return `Rp ${amount}`
}

/** Persen tanpa desimal palsu: 36% bukan 35,7%. */
export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits).replace('.', ',')}%`
}

/** Angka ringkas untuk nilai stat tile. */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')} rb`
  return String(n)
}

/** Hari dengan koma desimal Indonesia. */
export function formatDays(days: number): string {
  return `${days.toFixed(1).replace('.', ',')}`
}

/** Tanggal & jam ringkas untuk garis waktu. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(d)
}

/** Label pemicu bottleneck dalam bahasa yang bisa langsung ditindaklanjuti. */
export const DRIVER_LABEL: Record<string, string> = {
  queue: 'Antrean menumpuk',
  idle_wait: 'Tidak ada yang pegang',
  slow_work: 'Pengerjaan lambat',
  rework: 'Diulang terus',
  errors: 'Banyak kesalahan',
  external: 'Tertahan pihak luar',
}

/** Label jenis kesalahan dalam bahasa Indonesia. */
export const INCIDENT_LABEL: Record<string, string> = {
  data_error: 'Salah input data',
  document_missing: 'Dokumen tidak lengkap',
  document_late: 'Dokumen terlambat',
  approval_delay: 'Persetujuan menggantung',
  authority_violation: 'Pelanggaran wewenang',
  spec_mismatch: 'Tidak sesuai spesifikasi',
  quantity_variance: 'Selisih jumlah',
  procedure_skipped: 'SOP dilewati',
  unrecorded_work: 'Kerja tidak dicatat',
  duplicate_entry: 'Entri dobel',
  communication_gap: 'Informasi tidak diteruskan',
  external_cause: 'Penyebab dari luar',
  system_limitation: 'Sistem tidak mendukung',
}

/** Label atribusi kesalahan. */
export const ATTRIBUTION_LABEL: Record<string, string> = {
  person: 'Individu',
  process: 'Proses',
  system: 'Sistem',
  external: 'Pihak luar',
  unknown: 'Belum ditelusuri',
}

/** Label jenis objek kerja. */
export const WORK_ITEM_LABEL: Record<string, string> = {
  purchase_request: 'Permintaan Barang',
  purchase_order: 'Purchase Order',
  goods_receipt: 'Penerimaan Barang',
  payable_invoice: 'Tagihan Vendor',
  payment: 'Pembayaran',
  sales_order: 'Sales Order',
  production_order: 'Order Produksi',
  qc_record: 'Catatan QC',
  delivery_order: 'Surat Jalan',
  return_claim: 'Retur / Klaim',
  receivable_invoice: 'Tagihan Pelanggan',
}

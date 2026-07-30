/**
 * OpsFlow — Mesin alur kerja transaksional.
 *
 * Ini bagian yang mengubah OpsFlow dari dashboard pemantau menjadi sistem tempat
 * pekerjaan benar-benar dikerjakan. Orang menerbitkan PR, menyetujui PO,
 * menerima barang, mengeluarkan surat produksi, dan menerbitkan surat jalan —
 * lewat sistem, bukan lewat WhatsApp.
 *
 * DUA HAL YANG MEMBUATNYA BEDA DARI WHATSAPP, dan keduanya ada di file ini:
 *
 * 1. **Gerbang.** Surat jalan TIDAK BISA diterbitkan sebelum QC akhir lolos.
 *    Produksi TIDAK BISA jalan sebelum material lolos QC masuk. Tagihan TIDAK
 *    BISA disetujui sebelum PO, penerimaan, dan invoice cocok. Di WhatsApp semua
 *    itu bergantung pada seseorang mengingat untuk memeriksa; di sini sistemnya
 *    yang menolak, dan menyebutkan alasannya.
 *
 * 2. **Jejak yang tidak bisa dibantah.** Setiap aksi menghasilkan event dengan
 *    siapa dan kapan. Tidak ada lagi "saya sudah kirim kok" — waktunya tercatat,
 *    dan yang tercatat itu langsung menjadi data yang dibaca dashboard. Tidak ada
 *    pencatatan terpisah, jadi tidak ada celah antara "yang dikerjakan" dan
 *    "yang dilaporkan".
 *
 * Cakupan tahap ini: rantai pengadaan (PR → PO → penerimaan → QC → tagihan →
 * bayar) dan rantai pemenuhan (SO → surat produksi → QC akhir → surat jalan →
 * bukti terima). Belum semua 35 stage — stage sisanya menyusul dengan pola yang
 * sama persis, karena aksinya dideklarasikan sebagai data, bukan ditulis sebagai
 * kode terpisah per stage.
 */

import type {
  EventType,
  OpsDataset,
  WorkEvent,
  WorkItem,
  WorkItemLink,
  WorkItemStatus,
} from './schema.ts'
import { getStage, mainPath, type WorkItemType } from './taxonomy.ts'

// ============================================================
// Bentuk field pada form aksi
// ============================================================

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'money'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: Array<{ value: string; label: string }>
  /** Keterangan di bawah field. Dipakai menjelaskan konsekuensi, bukan mengulang label. */
  hint?: string
  placeholder?: string
  suffix?: string
}

// ============================================================
// Gerbang
// ============================================================

/**
 * Gerbang dijalankan sebelum aksi boleh dieksekusi. Mengembalikan pesan kalau
 * tidak lolos, atau null kalau lolos.
 *
 * Pesannya sengaja menyebutkan APA yang kurang dan APA yang harus dilakukan.
 * Penolakan yang hanya berbunyi "tidak diizinkan" akan membuat orang mencari
 * jalan lain — biasanya WhatsApp.
 */
export type GuardId =
  | 'anggaran-dicek'
  | 'wewenang-cukup'
  | 'qc-masuk-lolos'
  | 'tiga-arah-cocok'
  | 'sudah-disetujui'
  | 'qc-akhir-lolos'
  | 'barang-sudah-diterima'
  | 'material-sudah-keluar'
  | 'pajak-sudah-diverifikasi'
  | 'pembayaran-sudah-dijadwalkan'
  | 'mesin-sudah-siap'
  | 'material-tersedia'
  | 'barang-jadi-sudah-masuk-gudang'
  | 'jumlah-cocok-produksi'
  | 'pelanggan-sudah-terima'

export interface GuardContext {
  dataset: OpsDataset
  item: WorkItem
  /** Siapa yang menjalankan aksi. */
  actorPersonId: string
  /** Nilai form yang diisi. */
  values: Record<string, string>
}

type GuardFn = (ctx: GuardContext) => string | null

/** Cari objek kerja yang ditautkan item ini, berdasarkan jenisnya. */
function linkedItems(dataset: OpsDataset, item: WorkItem, type: WorkItemType): WorkItem[] {
  const byId = new Map(dataset.workItems.map((i) => [i.id, i]))
  const direct = item.links.map((l) => byId.get(l.targetWorkItemId)).filter((i): i is WorkItem => i !== undefined)
  const reverse = dataset.workItems.filter((other) => other.links.some((l) => l.targetWorkItemId === item.id))
  return [...direct, ...reverse].filter((i) => i.type === type)
}

/** Apakah sebuah objek kerja pernah menyelesaikan stage tertentu? */
function hasCompleted(dataset: OpsDataset, workItemId: string, stageCode: string): boolean {
  return dataset.events.some(
    (e) => e.workItemId === workItemId && e.stageCode === stageCode && e.type === 'completed',
  )
}

const GUARDS: Record<GuardId, GuardFn> = {
  'anggaran-dicek': ({ dataset, item }) =>
    hasCompleted(dataset, item.id, 'FIN-10')
      ? null
      : 'Anggaran belum dicek Budget Control (FIN-10). Minta pengecekan anggaran dulu — kalau PO terbit sebelum anggaran dicek, komitmennya tidak terbukukan dan pos anggaran bisa terpakai dua kali.',

  'wewenang-cukup': ({ dataset, item, actorPersonId }) => {
    const amount = item.amount ?? 0
    const rule = dataset.approvalRules.find(
      (r) =>
        r.stageCode === item.currentStageCode &&
        amount >= r.minAmount &&
        (r.maxAmount === null || amount < r.maxAmount),
    )
    if (!rule) return null
    const person = dataset.people.find((p) => p.id === actorPersonId)
    if (!person) return 'Pelaku aksi tidak dikenali di daftar personel.'
    if (person.authorityLevel < rule.requiredAuthorityLevel) {
      return `Nilai Rp ${amount.toLocaleString('id-ID')} butuh wewenang level ${rule.requiredAuthorityLevel}; Anda level ${person.authorityLevel}. Teruskan ke atasan yang berwenang — persetujuan di luar batas wewenang adalah temuan audit, bukan jalan pintas.`
    }
    if (rule.requiresDualApproval) {
      const approvers = new Set(
        dataset.events
          .filter((e) => e.workItemId === item.id && e.type === 'approved' && e.actorPersonId)
          .map((e) => e.actorPersonId as string),
      )
      approvers.add(actorPersonId)
      if (approvers.size < 2) {
        return `Nilai sebesar ini butuh dua penyetuju berbeda. Baru ${approvers.size} orang menyetujui — mintakan persetujuan kedua.`
      }
    }
    return null
  },

  'qc-masuk-lolos': ({ dataset, item }) => {
    const receipts = linkedItems(dataset, item, 'goods_receipt')
    if (receipts.length === 0) {
      return 'Sistem belum bisa memastikan material yang dikeluarkan sudah lolos QC masuk, karena order ini tidak tertaut ke penerimaan barang mana pun. Pastikan sendiri nomor lot yang diambil berstatus lolos QC — batasnya akan hilang begitu stok dan nomor lot ikut dimodelkan.'
    }
    const passed = receipts.some((r) => hasCompleted(dataset, r.id, 'PROC-80'))
    return passed
      ? null
      : 'Material yang tertaut ke order ini BELUM lolos QC barang masuk (PROC-80). Menjalankan produksi dengan material yang masih karantina berarti seluruh batch berisiko — tunggu keputusan QC.'
  },

  'tiga-arah-cocok': ({ dataset, item, values }) => {
    // Pencocokan tiga arah bisa dijalankan dari sisi tagihan maupun dari sisi
    // penerimaan barang. Kalau dokumen yang dibuka adalah GRN-nya sendiri,
    // dialah bukti terimanya — mencari GRN lain lalu menolak bukti yang sudah
    // ada di tangan hanya akan membuat orang mengurus tagihan di luar sistem.
    const linkedReceipts = linkedItems(dataset, item, 'goods_receipt')
    const receipts = item.type === 'goods_receipt' ? [item, ...linkedReceipts] : linkedReceipts
    const orders = linkedItems(dataset, item, 'purchase_order')
    if (receipts.length === 0) {
      return 'Belum ada bukti penerimaan barang (GRN). Tagihan tanpa bukti terima adalah cara paling umum tagihan fiktif lolos — mintakan GRN dari gudang dulu.'
    }
    if (orders.length === 0) return 'Tagihan ini tidak tertaut ke PO mana pun.'
    const invoiceAmount = Number(values.nilai_tagihan ?? item.amount ?? 0)
    const poAmount = orders[0].amount ?? 0
    if (poAmount > 0 && Math.abs(invoiceAmount - poAmount) > poAmount * 0.02) {
      return `Nilai tagihan Rp ${invoiceAmount.toLocaleString('id-ID')} berbeda lebih dari 2% dari PO Rp ${poAmount.toLocaleString('id-ID')}. Selesaikan selisihnya dengan vendor, atau mintakan persetujuan selisih harga — jangan diloloskan diam-diam.`
    }
    return null
  },

  'sudah-disetujui': ({ dataset, item }) =>
    dataset.events.some((e) => e.workItemId === item.id && e.type === 'approved')
      ? null
      : 'Dokumen ini belum disetujui. Pembayaran tanpa persetujuan tidak punya dasar.',

  'qc-akhir-lolos': ({ dataset, item }) => {
    const productionOrders = linkedItems(dataset, item, 'production_order')
    const candidates = productionOrders.length > 0 ? productionOrders : [item]
    const passed = candidates.some((c) => hasCompleted(dataset, c.id, 'PRD-80'))
    return passed
      ? null
      : 'Barang belum lolos QC akhir (PRD-80). Surat jalan yang terbit sebelum QC akhir adalah penyebab paling sering barang ditolak di lokasi pelanggan — dan biaya kirim ulangnya sudah keluar.'
  },

  'barang-sudah-diterima': ({ dataset, item }) => {
    // Penerimaan barang dicatat pada PO-nya, sedangkan yang diperiksa QC adalah
    // GRN yang lahir dari pencatatan itu. Memeriksa hanya id GRN akan menolak QC
    // untuk barang yang justru sudah jelas diterima — jadi PO yang tertaut ikut
    // dihitung sebagai bukti.
    const candidates = [item.id, ...linkedItems(dataset, item, 'purchase_order').map((o) => o.id)]
    return candidates.some((id) => hasCompleted(dataset, id, 'PROC-70'))
      ? null
      : 'Barang belum tercatat diterima gudang (PROC-70). Catat penerimaannya dulu.'
  },

  'material-sudah-keluar': ({ dataset, item }) =>
    hasCompleted(dataset, item.id, 'PRD-30')
      ? null
      : 'Material belum tercatat keluar gudang (PRD-30). Tanpa catatan itu, stok sistem akan berbeda dari fisik dan selisihnya baru ketahuan saat stock opname.',

  'pajak-sudah-diverifikasi': ({ dataset, item }) =>
    hasCompleted(dataset, item.id, 'FIN-30')
      ? null
      : 'Faktur pajak belum diverifikasi Tax (FIN-30). Kalau pembayaran jalan sebelum fakturnya sah, kredit pajaknya bisa hilang — dan yang hilang itu uang perusahaan, bukan sekadar dokumen.',

  'pembayaran-sudah-dijadwalkan': ({ dataset, item }) =>
    hasCompleted(dataset, item.id, 'FIN-50')
      ? null
      : 'Pembayaran ini belum masuk jadwal Treasury (FIN-50). Transfer di luar jadwal membuat posisi kas tidak bisa direncanakan, dan urutan bayar akhirnya ditentukan siapa yang paling keras menagih.',

  'mesin-sudah-siap': ({ dataset, item }) =>
    hasCompleted(dataset, item.id, 'PRD-40')
      ? null
      : 'Kesiapan mesin belum dinyatakan Maintenance (PRD-40). Produksi yang jalan sebelum setup diperiksa adalah cara paling umum satu batch penuh jadi cacat.',

  // Gerbang ini menilai isian formnya sendiri, bukan riwayat event. Dipakai
  // sebagai peringatan: kekurangan material adalah fakta yang harus terlihat,
  // tapi keputusan menahan produksi ada di PPIC, bukan di sistem.
  'material-tersedia': ({ values }) => {
    const status = values.ketersediaan ?? ''
    if (status === '' || status === 'semua') return null
    const shortage = (values.kekurangan ?? '').trim()
    return status === 'tidak'
      ? `Material belum tersedia${shortage ? ` (${shortage})` : ''}. Kalau tetap diteruskan, line akan berhenti di tengah jalan — dan waktu setup yang sudah keluar tidak bisa ditarik kembali. Eskalasikan ke Purchasing dulu.`
      : `Material baru tersedia sebagian${shortage ? ` (${shortage})` : ''}. Produksi sebagian berarti order ini akan dibuka dua kali dan dihitung dua kali di laporan hasil.`
  },

  'barang-jadi-sudah-masuk-gudang': ({ dataset, item }) => {
    const orders = linkedItems(dataset, item, 'production_order')
    const candidates = orders.length > 0 ? orders : [item]
    return candidates.some((c) => hasCompleted(dataset, c.id, 'PRD-90'))
      ? null
      : 'Barang jadi belum tercatat serah terima ke Gudang Barang Jadi (PRD-90). Surat jalan untuk barang yang belum masuk stok adalah sumber "barang hilang di gudang sendiri".'
  },

  // Bisa dibuktikan dari data — jumlah yang dilaporkan produksi ada di dokumen
  // ini. Tapi selisih hitungan fisik itu kejadian nyata yang harus BOLEH
  // dicatat; yang tidak boleh adalah selisihnya lewat tanpa disebut.
  'jumlah-cocok-produksi': ({ item, values }) => {
    const produced = Number(item.extra?.qty_hasil ?? 0)
    const received = Number(values.qty_diterima ?? 0)
    if (!produced || !received || produced === received) return null
    const diff = received - produced
    return `Jumlah yang diterima gudang (${received.toLocaleString('id-ID')}) berbeda ${diff > 0 ? 'lebih' : 'kurang'} ${Math.abs(diff).toLocaleString('id-ID')} dari yang dilaporkan produksi (${produced.toLocaleString('id-ID')}). Selisih ini harus direkonsiliasi — kalau dibiarkan, ia muncul lagi sebagai selisih stok opname berbulan-bulan kemudian tanpa jejak asalnya.`
  },

  'pelanggan-sudah-terima': ({ dataset, item }) => {
    const deliveries = linkedItems(dataset, item, 'delivery_order')
    const candidates = deliveries.length > 0 ? deliveries : [item]
    return candidates.some((c) => hasCompleted(dataset, c.id, 'DEL-70'))
      ? null
      : 'Belum ada bukti terima pelanggan (DEL-70). Tagihan yang tidak sesuai barang yang benar-benar diterima adalah alasan paling sering pelanggan menahan pembayaran.'
  },
}

// ============================================================
// Aksi
// ============================================================

export interface ActionEffect {
  /** Event yang ditambahkan ke log. Stage default = stage aksi. */
  events: Array<{ type: EventType; stageCode?: string }>
  /** Stage berikutnya untuk objek kerja ini. */
  nextStage?: string
  /** Objek kerja baru yang dibuat aksi ini — mis. PO yang lahir dari PR. */
  creates?: {
    type: WorkItemType
    /** Awalan nomor dokumen, mis. 'PO'. */
    docPrefix: string
    /** Hubungan objek baru terhadap objek asalnya. */
    relation: WorkItemLink['relation']
    startStage: string
    /** Field form yang jadi nilai transaksi objek baru. */
    amountFrom?: string
  }
  /** Menutup objek kerja ini. */
  closes?: WorkItemStatus
}

export interface ActionDef {
  id: string
  label: string
  /** Satu baris: apa yang terjadi setelah tombol ini ditekan. */
  outcome: string
  stageCode: string
  appliesTo: WorkItemType[]
  /** Sub-tim yang berwenang. Harus sama dengan nama sub-tim di taksonomi. */
  team: string
  fields: FieldDef[]
  /** Gerbang yang menolak aksi kalau tidak lolos. */
  guards: GuardId[]
  /** Gerbang yang hanya memperingatkan — lihat catatan di `ValidationResult.warnings`. */
  warnGuards?: GuardId[]
  effect: ActionEffect
  /** Gaya tombol: aksi utama, atau jalur penolakan. */
  tone?: 'primary' | 'reject'
}

/**
 * Katalog aksi. Sengaja dideklarasikan sebagai DATA, bukan ditulis sebagai kode
 * terpisah per stage — menambah stage berarti menambah satu entri di sini, bukan
 * menulis halaman baru. Itu yang membuat 35 stage bisa dijangkau tanpa 35 kali
 * pekerjaan yang sama.
 */
export const ACTIONS: ActionDef[] = [
  // ---------- Rantai pengadaan ----------
  {
    id: 'pr-ajukan',
    label: 'Ajukan permintaan',
    outcome: 'Permintaan diteruskan ke Admin Purchasing untuk divalidasi.',
    stageCode: 'PROC-10',
    appliesTo: ['purchase_request'],
    team: 'Departemen peminta',
    fields: [
      { name: 'catatan', label: 'Catatan untuk purchasing', type: 'textarea', placeholder: 'Spesifikasi tambahan, urgensi, dsb.' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PROC-20' },
    tone: 'primary',
  },
  {
    id: 'pr-validasi',
    label: 'Validasi & teruskan',
    outcome: 'Permintaan dinyatakan lengkap dan diteruskan ke pengecekan anggaran.',
    stageCode: 'PROC-20',
    appliesTo: ['purchase_request'],
    team: 'Admin Purchasing',
    fields: [
      {
        name: 'kode_item_benar',
        label: 'Kode item sudah sesuai master?',
        type: 'select',
        required: true,
        options: [
          { value: 'ya', label: 'Ya, sesuai master item' },
          { value: 'dikoreksi', label: 'Saya koreksi dulu' },
        ],
        hint: 'Kode item yang salah adalah sumber kesalahan nomor satu di stage ini — barang yang datang beda varian.',
      },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'FIN-10' },
    tone: 'primary',
  },
  {
    id: 'pr-kembalikan',
    label: 'Kembalikan ke peminta',
    outcome: 'Permintaan dikembalikan karena tidak lengkap. Peminta harus melengkapi.',
    stageCode: 'PROC-20',
    appliesTo: ['purchase_request'],
    team: 'Admin Purchasing',
    fields: [
      { name: 'alasan', label: 'Apa yang kurang', type: 'textarea', required: true, hint: 'Sebutkan yang harus dilengkapi, bukan hanya "tidak lengkap".' },
    ],
    guards: [],
    effect: { events: [{ type: 'returned' }], nextStage: 'PROC-10' },
    tone: 'reject',
  },
  {
    id: 'anggaran-cek',
    label: 'Konfirmasi anggaran tersedia',
    outcome: 'Anggaran dinyatakan tersedia; permintaan lanjut ke sourcing.',
    stageCode: 'FIN-10',
    appliesTo: ['purchase_request'],
    team: 'Budget Control',
    fields: [
      { name: 'kode_akun', label: 'Kode akun biaya', type: 'text', required: true, hint: 'Kode akun yang salah membuat laporan biaya per departemen tidak bisa dipakai.' },
      { name: 'sisa_anggaran', label: 'Sisa anggaran setelah komitmen ini', type: 'money', suffix: 'Rp' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PROC-30' },
    tone: 'primary',
  },
  {
    id: 'sourcing-selesai',
    label: 'Catat penawaran vendor',
    outcome: 'Penawaran tercatat; lanjut ke persetujuan harga.',
    stageCode: 'PROC-30',
    appliesTo: ['purchase_request'],
    team: 'Sourcing / Buyer',
    fields: [
      { name: 'jumlah_penawaran', label: 'Jumlah penawaran dibandingkan', type: 'number', required: true, hint: 'Kebijakan pengadaan umumnya minimal 2–3. Satu penawaran berarti tidak ada pembanding harga.' },
      { name: 'vendor_terpilih', label: 'Vendor yang diusulkan', type: 'text', required: true },
      { name: 'nilai_penawaran', label: 'Nilai penawaran', type: 'money', required: true, suffix: 'Rp' },
      { name: 'lead_time_janji', label: 'Lead time yang dijanjikan vendor', type: 'number', suffix: 'hari' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PROC-40' },
    tone: 'primary',
  },
  {
    id: 'harga-setujui',
    label: 'Setujui harga & vendor',
    outcome: 'Harga disetujui. PO otomatis dibuat dan siap diterbitkan.',
    stageCode: 'PROC-40',
    appliesTo: ['purchase_request'],
    team: 'Lead Purchasing / Manajer',
    fields: [
      { name: 'catatan_persetujuan', label: 'Catatan persetujuan', type: 'textarea' },
    ],
    guards: ['anggaran-dicek', 'wewenang-cukup'],
    effect: {
      events: [{ type: 'approved' }, { type: 'completed' }],
      nextStage: 'PROC-50',
      creates: { type: 'purchase_order', docPrefix: 'PO', relation: 'derived_from', startStage: 'PROC-50' },
    },
    tone: 'primary',
  },
  {
    id: 'po-terbitkan',
    label: 'Terbitkan PO ke vendor',
    outcome: 'PO dinyatakan terkirim ke vendor; masuk pemantauan kedatangan.',
    stageCode: 'PROC-50',
    appliesTo: ['purchase_order'],
    team: 'Admin Purchasing',
    fields: [
      { name: 'qty', label: 'Jumlah', type: 'number', required: true },
      { name: 'satuan', label: 'Satuan', type: 'select', required: true, options: [
        { value: 'pcs', label: 'pcs' }, { value: 'box', label: 'box' }, { value: 'kg', label: 'kg' }, { value: 'liter', label: 'liter' }, { value: 'roll', label: 'roll' },
      ], hint: 'Satuan yang salah (pcs vs box) adalah kesalahan klasik di stage ini — pastikan sama dengan penawaran vendor.' },
      { name: 'nilai_po', label: 'Nilai PO', type: 'money', required: true, suffix: 'Rp' },
      { name: 'termin_bayar', label: 'Termin pembayaran', type: 'number', required: true, suffix: 'hari' },
      { name: 'tanggal_kirim_diminta', label: 'Tanggal kirim yang diminta', type: 'date', required: true },
      { name: 'alamat_kirim', label: 'Alamat kirim', type: 'text', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PROC-60' },
    tone: 'primary',
  },
  {
    id: 'vendor-konfirmasi',
    label: 'Catat konfirmasi vendor',
    outcome: 'Tanggal kirim vendor tercatat; menunggu barang datang.',
    stageCode: 'PROC-60',
    appliesTo: ['purchase_order'],
    team: 'Purchasing Expediting',
    fields: [
      { name: 'tanggal_kirim_vendor', label: 'Tanggal kirim yang dikonfirmasi vendor', type: 'date', required: true },
      { name: 'catatan', label: 'Catatan', type: 'textarea', hint: 'Kalau vendor mengubah tanggal, produksi harus diberi tahu — catat di sini supaya terlihat di riwayat.' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PROC-70' },
    tone: 'primary',
  },
  {
    id: 'grn-terima',
    label: 'Catat penerimaan barang',
    outcome: 'Penerimaan tercatat, barang masuk karantina menunggu QC.',
    stageCode: 'PROC-70',
    appliesTo: ['purchase_order'],
    team: 'Gudang Inbound',
    fields: [
      { name: 'qty_fisik', label: 'Jumlah hasil hitungan fisik', type: 'number', required: true, hint: 'Hitung sendiri, jangan menyalin surat jalan vendor. Selisih yang dicatat sesuai surat jalan vendor akan lolos ke pembayaran.' },
      { name: 'kondisi', label: 'Kondisi barang', type: 'select', required: true, options: [
        { value: 'baik', label: 'Baik' }, { value: 'sebagian-rusak', label: 'Sebagian rusak' }, { value: 'rusak', label: 'Rusak' },
      ] },
      { name: 'no_surat_jalan_vendor', label: 'Nomor surat jalan vendor', type: 'text', required: true },
    ],
    guards: [],
    // PO-nya ditutup di sini, bukan dipindahkan ikut ke QC. Yang diperiksa QC
    // adalah GRN yang baru lahir; kalau PO-nya ikut diparkir di PROC-80 ia akan
    // menggantung di sana selamanya — tidak ada aksi yang berlaku untuk PO di
    // stage itu — dan nilainya terus terhitung sebagai "nilai tertahan" di
    // dashboard. Kemacetan palsu lebih berbahaya daripada tidak ada angka.
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'goods_receipt', docPrefix: 'GRN', relation: 'derived_from', startStage: 'PROC-80' },
    },
    tone: 'primary',
  },
  {
    id: 'qc-masuk-lolos',
    label: 'Nyatakan lolos QC',
    outcome: 'Material lolos QC dan boleh dipakai produksi.',
    stageCode: 'PROC-80',
    appliesTo: ['goods_receipt'],
    team: 'QC Incoming',
    fields: [
      { name: 'jumlah_sampel', label: 'Jumlah sampel diperiksa', type: 'number', required: true },
      { name: 'hasil', label: 'Ringkasan hasil pemeriksaan', type: 'textarea', required: true },
    ],
    guards: ['barang-sudah-diterima'],
    effect: { events: [{ type: 'completed' }], nextStage: 'FIN-20' },
    tone: 'primary',
  },
  {
    id: 'qc-masuk-tolak',
    label: 'Tolak — tidak sesuai spesifikasi',
    outcome: 'Material ditolak dan masuk jalur retur ke vendor. Tidak boleh dipakai produksi.',
    stageCode: 'PROC-80',
    appliesTo: ['goods_receipt'],
    team: 'QC Incoming',
    fields: [
      { name: 'alasan', label: 'Ketidaksesuaian yang ditemukan', type: 'textarea', required: true },
    ],
    guards: ['barang-sudah-diterima'],
    effect: { events: [{ type: 'rejected' }], nextStage: 'PROC-90' },
    tone: 'reject',
  },
  {
    id: 'retur-vendor-ajukan',
    label: 'Ajukan retur / klaim ke vendor',
    outcome: 'Nota retur terbit dan dituntut ke vendor. Barangnya tidak boleh terbayar penuh.',
    stageCode: 'PROC-90',
    appliesTo: ['goods_receipt'],
    team: 'Purchasing + Gudang',
    fields: [
      { name: 'jenis_tuntutan', label: 'Yang dituntut ke vendor', type: 'select', required: true, options: [
        { value: 'ganti-barang', label: 'Penggantian barang' },
        { value: 'nota-kredit', label: 'Nota kredit / pengurangan tagihan' },
        { value: 'pengembalian-dana', label: 'Pengembalian dana' },
      ], hint: 'Retur yang tidak dituntut ke vendor berubah jadi kerugian sendiri — dan kerugian itu tidak pernah muncul di laporan mana pun.' },
      { name: 'qty_retur', label: 'Jumlah yang diretur', type: 'number', required: true },
      { name: 'nilai_tuntutan', label: 'Nilai yang dituntut', type: 'money', required: true, suffix: 'Rp' },
      { name: 'alasan', label: 'Dasar tuntutan', type: 'textarea', required: true },
    ],
    guards: [],
    effect: {
      events: [{ type: 'completed' }],
      closes: 'rejected',
      creates: { type: 'return_claim', docPrefix: 'RET', relation: 'disputes', startStage: 'PROC-90', amountFrom: 'nilai_tuntutan' },
    },
    tone: 'reject',
  },
  {
    id: 'retur-vendor-selesai',
    label: 'Catat penyelesaian retur',
    outcome: 'Tuntutan ke vendor ditutup dengan hasil yang tercatat.',
    stageCode: 'PROC-90',
    appliesTo: ['return_claim'],
    team: 'Purchasing + Gudang',
    fields: [
      { name: 'hasil', label: 'Hasil dari vendor', type: 'select', required: true, options: [
        { value: 'barang-diganti', label: 'Barang sudah diganti' },
        { value: 'nota-kredit-diterima', label: 'Nota kredit diterima' },
        { value: 'dana-kembali', label: 'Dana dikembalikan' },
        { value: 'ditolak-vendor', label: 'Ditolak vendor — jadi kerugian sendiri' },
      ] },
      { name: 'no_nota_kredit', label: 'Nomor nota kredit / bukti', type: 'text', hint: 'Nota kredit yang tidak dikaitkan ke tagihannya akan tetap terbayar penuh. Nomor ini yang menghubungkannya.' },
      { name: 'catatan', label: 'Catatan penyelesaian', type: 'textarea' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], closes: 'completed' },
    tone: 'primary',
  },
  {
    id: 'invoice-verifikasi',
    label: 'Verifikasi & cocokkan',
    outcome: 'Tagihan cocok dengan PO dan penerimaan; lanjut ke persetujuan bayar.',
    stageCode: 'FIN-20',
    appliesTo: ['payable_invoice', 'goods_receipt'],
    team: 'Accounts Payable',
    fields: [
      { name: 'no_invoice_vendor', label: 'Nomor invoice vendor', type: 'text', required: true, hint: 'Nomor ini yang dipakai sistem mendeteksi tagihan dobel.' },
      { name: 'nilai_tagihan', label: 'Nilai tagihan', type: 'money', required: true, suffix: 'Rp' },
    ],
    guards: ['tiga-arah-cocok'],
    // Sama seperti PO saat barangnya diterima: dokumen penerimaan ditutup di
    // sini dan pekerjaan berlanjut di tagihan yang baru lahir. Kalau keduanya
    // diparkir di FIN-40, yang satu akan menunggu tindakan yang tidak pernah
    // berlaku untuknya — dan nilainya terhitung dua kali sebagai nilai tertahan.
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'payable_invoice', docPrefix: 'INV', relation: 'derived_from', startStage: 'FIN-30', amountFrom: 'nilai_tagihan' },
    },
    tone: 'primary',
  },
  {
    id: 'pajak-verifikasi',
    label: 'Verifikasi faktur pajak',
    outcome: 'Faktur pajak dinyatakan sah dan masuk periode yang benar.',
    stageCode: 'FIN-30',
    appliesTo: ['payable_invoice'],
    team: 'Tax',
    fields: [
      { name: 'no_faktur_pajak', label: 'Nomor faktur pajak', type: 'text', required: true },
      { name: 'masa_pajak', label: 'Masa pajak', type: 'text', required: true, placeholder: '2026-07', hint: 'Faktur yang masuk beda periode membuat kredit pajaknya hangus. Periode yang benar adalah periode fakturnya, bukan periode pembayarannya.' },
      { name: 'data_vendor_cocok', label: 'NPWP & nama vendor cocok?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, cocok dengan master vendor' },
        { value: 'dikoreksi', label: 'Ada selisih, saya koreksi dulu' },
      ] },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'FIN-40' },
    tone: 'primary',
  },
  {
    id: 'bayar-setujui',
    label: 'Setujui pembayaran',
    outcome: 'Tagihan disetujui dan masuk penjadwalan pembayaran.',
    stageCode: 'FIN-40',
    appliesTo: ['payable_invoice'],
    team: 'Manajer / Direktur',
    fields: [{ name: 'catatan_persetujuan', label: 'Catatan persetujuan', type: 'textarea' }],
    guards: ['wewenang-cukup', 'pajak-sudah-diverifikasi'],
    effect: { events: [{ type: 'approved' }, { type: 'completed' }], nextStage: 'FIN-50' },
    tone: 'primary',
  },
  {
    id: 'bayar-jadwalkan',
    label: 'Masukkan ke jadwal pembayaran',
    outcome: 'Tagihan masuk payment run sesuai jatuh tempo dan posisi kas.',
    stageCode: 'FIN-50',
    appliesTo: ['payable_invoice'],
    team: 'Treasury',
    fields: [
      { name: 'tanggal_jatuh_tempo', label: 'Tanggal jatuh tempo', type: 'date', required: true },
      { name: 'tanggal_bayar_rencana', label: 'Tanggal bayar yang direncanakan', type: 'date', required: true, hint: 'Kalau tanggal ini lewat dari jatuh tempo, alasannya harus ada di catatan — bukan karena kebetulan masuk batch berikutnya.' },
      { name: 'batch_pembayaran', label: 'Batch / payment run', type: 'text', required: true },
      { name: 'catatan', label: 'Catatan penjadwalan', type: 'textarea' },
    ],
    guards: ['sudah-disetujui'],
    effect: { events: [{ type: 'completed' }], nextStage: 'FIN-60' },
    tone: 'primary',
  },
  {
    id: 'bayar-eksekusi',
    label: 'Catat pembayaran terkirim',
    outcome: 'Pembayaran tercatat lengkap dengan bukti transfer. Rantai pengadaan selesai.',
    stageCode: 'FIN-60',
    appliesTo: ['payable_invoice'],
    team: 'Treasury / Kasir',
    fields: [
      { name: 'rekening_tujuan', label: 'Rekening tujuan', type: 'text', required: true, hint: 'Perubahan rekening vendor wajib diverifikasi ulang lewat kontak resmi — ini titik rawan penipuan.' },
      { name: 'no_bukti_transfer', label: 'Nomor bukti transfer', type: 'text', required: true },
    ],
    guards: ['sudah-disetujui', 'pembayaran-sudah-dijadwalkan'],
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'payment', docPrefix: 'PAY', relation: 'settles', startStage: 'FIN-70' },
    },
    tone: 'primary',
  },
  {
    id: 'biaya-catat',
    label: 'Bukukan & alokasikan biaya',
    outcome: 'Jurnal terbukukan dan biayanya menempel ke pusat biaya yang benar.',
    stageCode: 'FIN-70',
    appliesTo: ['payment'],
    team: 'Accounting',
    fields: [
      { name: 'pusat_biaya', label: 'Pusat biaya', type: 'text', required: true },
      { name: 'order_produksi', label: 'Order produksi (kalau biaya produksi)', type: 'text', hint: 'Biaya produksi yang tidak dialokasikan ke order-nya membuat HPP per produk tidak akurat — dan harga jual ikut salah.' },
      { name: 'no_jurnal', label: 'Nomor jurnal', type: 'text', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], closes: 'completed' },
    tone: 'primary',
  },

  // ---------- Rantai pemenuhan ----------
  {
    id: 'so-konfirmasi',
    label: 'Konfirmasi pesanan',
    outcome: 'Pesanan dikonfirmasi. Surat produksi otomatis dibuat untuk PPIC.',
    stageCode: 'DEL-10',
    appliesTo: ['sales_order'],
    team: 'Admin Sales',
    fields: [
      { name: 'tanggal_janji', label: 'Tanggal kirim yang dijanjikan', type: 'date', required: true, hint: 'Jangan menjanjikan tanggal sebelum PPIC mengonfirmasi kapasitas — janji yang tidak bisa dipenuhi adalah sumber komplain terbanyak.' },
      { name: 'alamat_penerima', label: 'Alamat & kontak penerima', type: 'textarea', required: true },
    ],
    guards: [],
    effect: {
      events: [{ type: 'completed' }],
      nextStage: 'PRD-10',
      creates: { type: 'production_order', docPrefix: 'SPK', relation: 'fulfills', startStage: 'PRD-10' },
    },
    tone: 'primary',
  },
  {
    id: 'spk-jadwalkan',
    label: 'Jadwalkan produksi',
    outcome: 'Surat produksi dijadwalkan ke line dan shift tertentu.',
    stageCode: 'PRD-10',
    appliesTo: ['production_order'],
    team: 'PPIC',
    fields: [
      { name: 'line', label: 'Line produksi', type: 'select', required: true, options: [
        { value: 'LINE-1', label: 'Line 1' }, { value: 'LINE-2', label: 'Line 2' }, { value: 'LINE-3', label: 'Line 3' },
      ] },
      { name: 'tanggal_mulai', label: 'Tanggal mulai', type: 'date', required: true },
      { name: 'qty_target', label: 'Target jumlah produksi', type: 'number', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-20' },
    tone: 'primary',
  },
  {
    id: 'material-alokasi',
    label: 'Alokasikan material',
    outcome: 'Material untuk order ini dikunci; kekurangannya terlihat sebelum line jalan.',
    stageCode: 'PRD-20',
    appliesTo: ['production_order'],
    team: 'PPIC + Gudang',
    fields: [
      { name: 'ketersediaan', label: 'Ketersediaan komponen BOM', type: 'select', required: true, options: [
        { value: 'semua', label: 'Semua komponen tersedia' },
        { value: 'sebagian', label: 'Sebagian tersedia' },
        { value: 'tidak', label: 'Ada yang belum ada sama sekali' },
      ], hint: 'Kekurangan material yang baru ketahuan saat mau produksi adalah kekurangan yang paling mahal. Di sini tempatnya terlihat.' },
      { name: 'kekurangan', label: 'Komponen yang kurang', type: 'text', placeholder: 'mis. resin PP 20 kg' },
      { name: 'tanggal_material_siap', label: 'Tanggal material lengkap', type: 'date', hint: 'Kalau ada yang kurang, tanggal kedatangan pasti dari Purchasing — bukan perkiraan.' },
      { name: 'stok_fisik_dicek', label: 'Stok fisik dicek langsung?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, dihitung di gudang' },
        { value: 'sistem', label: 'Hanya lihat angka sistem' },
      ], hint: '"Stok sistem ada, fisik tidak ada" adalah kegagalan nomor satu di stage ini.' },
    ],
    guards: [],
    warnGuards: ['material-tersedia'],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-30' },
    tone: 'primary',
  },
  {
    id: 'material-keluarkan',
    label: 'Keluarkan material ke line',
    outcome: 'Material tercatat keluar gudang; stok berkurang di sistem.',
    stageCode: 'PRD-30',
    appliesTo: ['production_order'],
    team: 'Gudang Produksi',
    fields: [
      { name: 'no_lot', label: 'Nomor lot / batch material', type: 'text', required: true, hint: 'Tanpa nomor lot, ketelusuran hilang — kalau ada masalah mutu, tidak bisa ditarik batch mana yang terdampak.' },
      { name: 'qty_keluar', label: 'Jumlah dikeluarkan', type: 'number', required: true },
    ],
    // Peringatan, bukan penolakan: tanpa model stok dan nomor lot, sistem hanya
    // bisa memastikan status QC kalau penerimaan barangnya tertaut ke order ini.
    guards: [],
    warnGuards: ['qc-masuk-lolos'],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-40' },
    tone: 'primary',
  },
  {
    id: 'mesin-siapkan',
    label: 'Nyatakan mesin siap',
    outcome: 'Checklist kesiapan terisi dan parameter mesin tercatat sebelum line jalan.',
    stageCode: 'PRD-40',
    appliesTo: ['production_order'],
    team: 'Maintenance / Teknik',
    fields: [
      { name: 'mesin', label: 'Mesin / line yang disiapkan', type: 'text', required: true },
      { name: 'checklist_lolos', label: 'Checklist kesiapan', type: 'select', required: true, options: [
        { value: 'lolos', label: 'Lolos seluruhnya' },
        { value: 'lolos-catatan', label: 'Lolos dengan catatan' },
      ], hint: 'Checklist yang ditandatangani tanpa benar-benar diperiksa lebih berbahaya daripada tidak ada checklist — ia memberi rasa aman yang palsu.' },
      { name: 'parameter', label: 'Parameter yang diset', type: 'text', required: true, placeholder: 'suhu 180°C, tekanan 6 bar', hint: 'Parameter yang diubah operator tanpa dicatat membuat penyebab cacat tidak bisa dilacak.' },
      { name: 'perawatan_preventif', label: 'Perawatan preventif terakhir', type: 'date', hint: 'Perawatan yang dilewati karena line dikejar target akan menagih sendiri, biasanya di tengah batch besar.' },
    ],
    guards: ['material-sudah-keluar'],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-50' },
    tone: 'primary',
  },
  {
    id: 'produksi-lapor',
    label: 'Laporkan hasil produksi',
    outcome: 'Hasil produksi per shift tercatat; lanjut ke QC akhir.',
    stageCode: 'PRD-50',
    appliesTo: ['production_order'],
    team: 'Produksi (per line & shift)',
    fields: [
      { name: 'qty_hasil', label: 'Jumlah hasil baik', type: 'number', required: true },
      { name: 'qty_cacat', label: 'Jumlah cacat', type: 'number', required: true, hint: 'Catat apa adanya. Produk cacat yang dicampur dengan yang baik akan ketahuan di tangan pelanggan, dengan biaya jauh lebih besar.' },
      { name: 'downtime_menit', label: 'Downtime mesin', type: 'number', suffix: 'menit' },
      { name: 'shift', label: 'Shift', type: 'select', required: true, options: [
        { value: 'shift-1', label: 'Shift 1' }, { value: 'shift-2', label: 'Shift 2' }, { value: 'shift-3', label: 'Shift 3' },
      ] },
    ],
    guards: ['material-sudah-keluar', 'mesin-sudah-siap'],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-60' },
    tone: 'primary',
  },
  {
    id: 'qc-proses-lanjut',
    label: 'Catat QC dalam proses — lanjut',
    outcome: 'Parameter mutu masih dalam batas kendali; produksi lanjut ke QC akhir.',
    stageCode: 'PRD-60',
    appliesTo: ['production_order'],
    team: 'QC In-Process',
    fields: [
      { name: 'frekuensi_sampel', label: 'Berapa kali sampling dilakukan', type: 'number', required: true, hint: 'Frekuensi yang dikurangi saat produksi padat adalah saat cacat paling mungkin lolos. Catat apa adanya.' },
      { name: 'hasil_inspeksi', label: 'Hasil inspeksi', type: 'textarea', required: true },
      { name: 'waktu_pencatatan', label: 'Diisi saat inspeksi atau belakangan?', type: 'select', required: true, options: [
        { value: 'saat-inspeksi', label: 'Saat inspeksi' },
        { value: 'belakangan', label: 'Diisi belakangan' },
      ], hint: 'Data yang diisi belakangan biasanya diseragamkan, dan pola cacatnya hilang. Jujur di sini lebih berguna daripada rapi.' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-80' },
    tone: 'primary',
  },
  {
    id: 'qc-proses-setop',
    label: 'Setop line — parameter di luar batas',
    outcome: 'Line dihentikan dan order masuk jalur perbaikan sebelum batch penuh cacat.',
    stageCode: 'PRD-60',
    appliesTo: ['production_order'],
    team: 'QC In-Process',
    fields: [
      { name: 'alasan', label: 'Parameter yang di luar batas', type: 'textarea', required: true },
      { name: 'qty_terdampak', label: 'Perkiraan jumlah terdampak', type: 'number', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'rejected' }], nextStage: 'PRD-70' },
    tone: 'reject',
  },
  {
    id: 'rework-selesai',
    label: 'Catat hasil rework',
    outcome: 'Rework tercatat lengkap dengan biaya waktunya, lalu diinspeksi ulang.',
    stageCode: 'PRD-70',
    appliesTo: ['production_order'],
    team: 'Produksi',
    fields: [
      { name: 'qty_diperbaiki', label: 'Jumlah berhasil diperbaiki', type: 'number', required: true },
      { name: 'qty_scrap', label: 'Jumlah dinyatakan scrap', type: 'number', required: true },
      { name: 'jam_rework', label: 'Waktu rework', type: 'number', suffix: 'jam', hint: 'Rework yang tidak dicatat waktunya membuat biayanya tidak pernah terlihat di laporan — dan yang tidak terlihat tidak pernah diperbaiki.' },
      { name: 'akar_masalah', label: 'Akar masalah', type: 'textarea', required: true, hint: 'Wajib diisi. Rework yang sama terulang setiap batch justru karena bagian ini selalu dilewati.' },
    ],
    guards: [],
    // Kembali ke inspeksi, bukan langsung lanjut. Gate PRD-70 berbunyi "hasil
    // rework lolos inspeksi ulang" — produk rework yang tidak diperiksa ulang
    // adalah kegagalan yang paling sering terjadi di stage ini.
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-60' },
    tone: 'primary',
  },
  {
    id: 'qc-akhir-lolos',
    label: 'Nyatakan lolos QC akhir',
    outcome: 'Barang jadi lolos QC dan boleh dikirim.',
    stageCode: 'PRD-80',
    appliesTo: ['production_order'],
    team: 'QC Final',
    fields: [
      { name: 'jumlah_sampel', label: 'Jumlah sampel diperiksa', type: 'number', required: true },
      { name: 'hasil', label: 'Ringkasan hasil', type: 'textarea', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'PRD-90' },
    tone: 'primary',
  },
  {
    id: 'qc-akhir-tahan',
    label: 'Tahan — belum boleh dikirim',
    outcome: 'Barang ditahan dan dikembalikan ke produksi untuk diperbaiki.',
    stageCode: 'PRD-80',
    appliesTo: ['production_order'],
    team: 'QC Final',
    fields: [{ name: 'alasan', label: 'Temuan yang menahan', type: 'textarea', required: true }],
    guards: [],
    effect: { events: [{ type: 'returned' }], nextStage: 'PRD-70' },
    tone: 'reject',
  },
  {
    id: 'barang-jadi-terima',
    label: 'Terima barang jadi ke gudang',
    outcome: 'Stok barang jadi tercatat beserta lokasinya, siap dikirim.',
    stageCode: 'PRD-90',
    appliesTo: ['production_order'],
    team: 'Gudang Finished Goods',
    fields: [
      { name: 'qty_diterima', label: 'Jumlah hasil hitungan gudang', type: 'number', required: true, hint: 'Hitung sendiri. Menyalin angka laporan produksi membuat selisihnya baru ketahuan saat stock opname.' },
      { name: 'lokasi_simpan', label: 'Lokasi penyimpanan', type: 'text', required: true, placeholder: 'mis. RAK-B3', hint: 'Tanpa lokasi tercatat, barang bisa "hilang" di gudang sendiri.' },
    ],
    guards: ['qc-akhir-lolos'],
    warnGuards: ['jumlah-cocok-produksi'],
    effect: { events: [{ type: 'completed' }], nextStage: 'DEL-20' },
    tone: 'primary',
  },
  {
    id: 'sj-terbitkan',
    label: 'Terbitkan surat jalan',
    outcome: 'Surat jalan terbit; barang siap dimuat.',
    stageCode: 'DEL-20',
    appliesTo: ['production_order'],
    team: 'Admin Logistik',
    fields: [
      { name: 'qty_kirim', label: 'Jumlah dikirim', type: 'number', required: true },
      { name: 'ekspedisi', label: 'Ekspedisi / armada', type: 'text', required: true },
    ],
    guards: ['qc-akhir-lolos', 'barang-jadi-sudah-masuk-gudang'],
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'delivery_order', docPrefix: 'SJ', relation: 'derived_from', startStage: 'DEL-30' },
    },
    tone: 'primary',
  },
  {
    id: 'picking-packing',
    label: 'Catat picking & packing',
    outcome: 'Barang terkemas sesuai surat jalan dan siap dimuat.',
    stageCode: 'DEL-30',
    appliesTo: ['delivery_order'],
    team: 'Gudang Finished Goods',
    fields: [
      { name: 'qty_dipick', label: 'Jumlah yang diambil', type: 'number', required: true },
      { name: 'lot_diambil', label: 'Lot / batch yang diambil', type: 'text', required: true, hint: 'Lot yang salah berarti FIFO terlanggar — barang lama tertinggal sampai kedaluwarsa di rak.' },
      { name: 'pakai_daftar_pick', label: 'Diambil pakai daftar picking?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, sesuai daftar' },
        { value: 'hafalan', label: 'Berdasarkan hafalan' },
      ], hint: 'Picking dari hafalan adalah penyebab paling sering salah varian yang mirip.' },
      { name: 'kemasan', label: 'Jenis kemasan / pelindung', type: 'text', required: true },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'DEL-40' },
    tone: 'primary',
  },
  {
    id: 'ekspedisi-jadwalkan',
    label: 'Jadwalkan armada',
    outcome: 'Armada dan jam muat terjadwal untuk tanggal janji.',
    stageCode: 'DEL-40',
    appliesTo: ['delivery_order'],
    team: 'Logistik',
    fields: [
      { name: 'ekspedisi_terpilih', label: 'Ekspedisi / armada', type: 'text', required: true },
      { name: 'jam_muat', label: 'Jam muat', type: 'text', required: true, placeholder: 'mis. 08:00' },
      { name: 'tanggal_muat', label: 'Tanggal muat', type: 'date', required: true, hint: 'Barang siap tapi armada baru dicari hari itu adalah keterlambatan yang paling mudah dicegah — dan paling sering terjadi.' },
      { name: 'muatan_dikonsolidasi', label: 'Muatan dikonsolidasi dengan kiriman lain?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya' },
        { value: 'tidak', label: 'Tidak — kirim sendiri' },
      ] },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'DEL-50' },
    tone: 'primary',
  },
  {
    id: 'sj-muat',
    label: 'Catat keberangkatan',
    outcome: 'Jam keberangkatan tercatat; kiriman dalam perjalanan.',
    stageCode: 'DEL-50',
    appliesTo: ['delivery_order'],
    team: 'Gudang + Driver',
    fields: [
      { name: 'nama_driver', label: 'Nama driver', type: 'text', required: true },
      { name: 'no_kendaraan', label: 'Nomor kendaraan', type: 'text', required: true },
      { name: 'muatan_dicek_dua_pihak', label: 'Muatan dicek dua pihak?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, gudang & driver sama-sama cek' },
        { value: 'tidak', label: 'Tidak' },
      ], hint: 'Pengecekan dua pihak di dock adalah satu-satunya titik di mana salah muat masih murah diperbaiki.' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'DEL-60' },
    tone: 'primary',
  },
  {
    id: 'perjalanan-pantau',
    label: 'Catat posisi & estimasi tiba',
    outcome: 'Posisi kiriman terpantau, jadi keterlambatan tidak diketahui dari komplain pelanggan.',
    stageCode: 'DEL-60',
    appliesTo: ['delivery_order'],
    team: 'Ekspedisi',
    fields: [
      { name: 'posisi_terakhir', label: 'Posisi terakhir', type: 'text', required: true },
      { name: 'estimasi_tiba', label: 'Estimasi tiba', type: 'date', required: true },
      { name: 'kendala', label: 'Kendala di jalan', type: 'textarea', hint: 'Kendala yang dilaporkan lebih awal masih bisa dikomunikasikan ke pelanggan. Yang dilaporkan setelah tiba hanya jadi alasan.' },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], nextStage: 'DEL-70' },
    tone: 'primary',
  },
  {
    id: 'pod-catat',
    label: 'Catat bukti terima',
    outcome: 'Bukti terima tercatat. Tagihan pelanggan otomatis dibuat untuk Finance AR.',
    stageCode: 'DEL-70',
    appliesTo: ['delivery_order'],
    team: 'Driver / Customer Service',
    fields: [
      { name: 'nama_penerima', label: 'Nama & jabatan penerima', type: 'text', required: true, hint: 'Tanda tangan tanpa nama dan jabatan sering ditolak saat penagihan.' },
      { name: 'qty_diterima_pelanggan', label: 'Jumlah yang diterima', type: 'number', required: true },
      { name: 'catatan', label: 'Catatan penerimaan', type: 'textarea' },
    ],
    guards: [],
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'receivable_invoice', docPrefix: 'AR', relation: 'derived_from', startStage: 'DEL-90' },
    },
    tone: 'primary',
  },
  {
    id: 'pod-tolak-sebagian',
    label: 'Catat penolakan penerima',
    outcome: 'Penolakan tercatat dan masuk jalur klaim, bukan diselesaikan lisan di lokasi.',
    stageCode: 'DEL-70',
    appliesTo: ['delivery_order'],
    team: 'Driver / Customer Service',
    fields: [
      { name: 'nama_penerima', label: 'Nama & jabatan penerima', type: 'text', required: true },
      { name: 'qty_ditolak', label: 'Jumlah yang ditolak', type: 'number', required: true },
      { name: 'alasan', label: 'Alasan penolakan menurut penerima', type: 'textarea', required: true, hint: 'Tulis kata-kata penerimanya. Keluhan yang diringkas jadi "barang tidak sesuai" tidak bisa dilacak ke stage sumbernya.' },
    ],
    guards: [],
    effect: { events: [{ type: 'rejected' }], nextStage: 'DEL-80' },
    tone: 'reject',
  },
  {
    id: 'klaim-pelanggan-putuskan',
    label: 'Putuskan klaim & tunjuk stage sumber',
    outcome: 'Klaim diputuskan dan kesalahannya ditugaskan ke stage tempat masalahnya lahir.',
    stageCode: 'DEL-80',
    appliesTo: ['delivery_order'],
    team: 'Customer Service + Logistik',
    fields: [
      {
        name: 'stage_sumber',
        label: 'Stage tempat masalahnya lahir',
        type: 'select',
        required: true,
        // Pilihannya dibangun dari taksonomi, bukan ditulis ulang di sini —
        // supaya menambah stage tidak meninggalkan daftar ini basi.
        options: mainPath().map((stage) => ({ value: stage.code, label: `${stage.code} ${stage.name}` })),
        hint: 'Ini kolom terpenting di halaman ini. Klaim yang ditutup tanpa menunjuk stage sumber membuat pola kesalahan tidak pernah terlihat — masalah yang sama akan datang lagi bulan depan.',
      },
      { name: 'keputusan', label: 'Keputusan klaim', type: 'select', required: true, options: [
        { value: 'kirim-ulang', label: 'Kirim ulang' },
        { value: 'potong-tagihan', label: 'Potong tagihan' },
        { value: 'retur-penuh', label: 'Retur penuh' },
        { value: 'klaim-ditolak', label: 'Klaim ditolak' },
      ] },
      { name: 'barang_masuk_stok', label: 'Barang retur sudah masuk kembali ke stok?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, sudah tercatat' },
        { value: 'belum', label: 'Belum' },
      ], hint: 'Retur yang tidak masuk kembali ke stok akan hilang dua kali: dari gudang dan dari pembukuan.' },
      { name: 'tindakan_perbaikan', label: 'Tindakan perbaikan di stage sumber', type: 'textarea', required: true },
    ],
    guards: [],
    effect: {
      events: [{ type: 'completed' }],
      closes: 'completed',
      creates: { type: 'return_claim', docPrefix: 'KLM', relation: 'disputes', startStage: 'DEL-80' },
    },
    tone: 'primary',
  },
  {
    id: 'klaim-pelanggan-tutup',
    label: 'Tutup klaim pelanggan',
    outcome: 'Klaim ditutup setelah tindakan perbaikannya benar-benar dijalankan.',
    stageCode: 'DEL-80',
    appliesTo: ['return_claim'],
    team: 'Customer Service + Logistik',
    fields: [
      { name: 'hasil', label: 'Hasil akhir', type: 'textarea', required: true },
      { name: 'perbaikan_dijalankan', label: 'Tindakan perbaikan sudah dijalankan?', type: 'select', required: true, options: [
        { value: 'ya', label: 'Ya, sudah' },
        { value: 'belum', label: 'Belum — masih dipantau' },
      ] },
    ],
    guards: [],
    effect: { events: [{ type: 'completed' }], closes: 'completed' },
    tone: 'primary',
  },
  {
    id: 'tagih-terbitkan',
    label: 'Terbitkan tagihan ke pelanggan',
    outcome: 'Tagihan terkirim dengan jatuh tempo yang terpantau.',
    stageCode: 'DEL-90',
    appliesTo: ['receivable_invoice'],
    team: 'Finance AR',
    fields: [
      { name: 'no_invoice_pelanggan', label: 'Nomor invoice', type: 'text', required: true },
      { name: 'nilai_tagihan', label: 'Nilai tagihan', type: 'money', required: true, suffix: 'Rp' },
      { name: 'jatuh_tempo', label: 'Jatuh tempo', type: 'date', required: true, hint: 'Jatuh tempo yang tidak dipantau membuat piutang menua tanpa ada yang menagih — dan umurnya baru terlihat saat kas seret.' },
      { name: 'tanggal_kirim_invoice', label: 'Tanggal invoice dikirim', type: 'date', required: true },
    ],
    guards: ['pelanggan-sudah-terima'],
    effect: { events: [{ type: 'completed' }], closes: 'completed' },
    tone: 'primary',
  },
]

/**
 * Aksi yang tersedia untuk sebuah objek kerja, tanpa memandang siapa pelakunya.
 *
 * Dokumen yang sudah ditutup tidak punya aksi. Tanpa penyaringan ini, dokumen
 * selesai tetap memajang tombolnya — dan tombol yang bisa ditekan pada dokumen
 * yang sudah tutup buku adalah cara paling rapi untuk merusak catatan yang
 * sudah benar.
 */
export function actionsForItem(item: WorkItem): ActionDef[] {
  if (item.closedAt !== null) return []
  return ACTIONS.filter(
    (action) => action.stageCode === item.currentStageCode && action.appliesTo.includes(item.type),
  )
}

/** Aksi yang boleh dijalankan sebuah sub-tim. */
export function actionsForTeam(item: WorkItem, teamName: string): ActionDef[] {
  return actionsForItem(item).filter((action) => action.team === teamName)
}

// ============================================================
// Validasi & eksekusi
// ============================================================

/**
 * Penyebab sebuah aksi ditolak: gerbang bisnis dari katalog, atau pemeriksaan
 * struktural 'tahap-cocok' yang selalu berjalan untuk setiap aksi.
 */
export type BlockerId = GuardId | 'tahap-cocok'

export interface ValidationResult {
  ok: boolean
  /** Field yang belum diisi, dipetakan ke pesannya. */
  fieldErrors: Record<string, string>
  /** Gerbang yang menolak. Ini yang membedakan sistem dari WhatsApp. */
  blockers: Array<{ guard: BlockerId; message: string }>
  /**
   * Gerbang yang memperingatkan tapi tidak menolak.
   *
   * Ada pembedaan ini karena sebagian syarat belum bisa DIBUKTIKAN dari data yang
   * dimodelkan sekarang. Contohnya "material yang dikeluarkan sudah lolos QC":
   * tanpa model stok dan nomor lot, sistem hanya bisa memastikannya kalau
   * penerimaan barangnya kebetulan tertaut ke order produksi ini. Memblokir
   * berdasarkan bukti yang mungkin tidak ada akan menghentikan pekerjaan yang
   * sebenarnya sah — dan orang akan kembali ke WhatsApp.
   *
   * Jadi: yang bisa dipastikan → memblokir. Yang belum bisa dipastikan →
   * memperingatkan, dan peringatannya ikut tercatat di jejak audit. Berpura-pura
   * menegakkan aturan yang datanya belum ada lebih berbahaya daripada menyatakan
   * batasnya terbuka.
   */
  warnings: Array<{ guard: GuardId; message: string }>
}

export function validateAction(action: ActionDef, ctx: GuardContext): ValidationResult {
  const fieldErrors: Record<string, string> = {}
  for (const field of action.fields) {
    if (!field.required) continue
    const value = (ctx.values[field.name] ?? '').trim()
    if (value === '') fieldErrors[field.name] = 'Wajib diisi'
  }

  const blockers: ValidationResult['blockers'] = []

  // Pemeriksaan struktural, selalu jalan tanpa perlu dideklarasikan per aksi:
  // sebuah aksi hanya sah di stage dan jenis dokumen yang dideklarasikannya.
  // UI memang hanya menampilkan aksi yang cocok, tapi UI bisa dilewati — tanpa
  // pemeriksaan ini, aksi lama bisa dijalankan ulang pada dokumen yang sudah
  // maju dan justru MENARIKNYA KEMBALI ke stage sebelumnya (mis. menerbitkan
  // ulang PO yang barangnya sudah diterima), lengkap dengan event baru yang
  // terlihat sah di jejak audit.
  if (ctx.item.closedAt !== null) {
    blockers.push({
      guard: 'tahap-cocok',
      message: `Dokumen ini sudah ditutup pada ${ctx.item.closedAt}. Dokumen yang sudah selesai tidak bisa dikerjakan lagi — kalau ada yang salah, koreksinya lewat dokumen baru yang menunjuk dokumen ini, supaya yang lama tetap utuh sebagai catatan.`,
    })
  } else if (action.stageCode !== ctx.item.currentStageCode) {
    blockers.push({
      guard: 'tahap-cocok',
      message: `Tindakan "${action.label}" hanya berlaku di ${stageLabel(action.stageCode)}, sedangkan dokumen ini sekarang di ${stageLabel(ctx.item.currentStageCode)}. Dokumen tidak bisa ditarik kembali ke stage sebelumnya dengan menjalankan ulang tindakan lama — koreksi dilakukan lewat jalur pengembalian atau pembatalan yang tercatat.`,
    })
  } else if (!action.appliesTo.includes(ctx.item.type)) {
    blockers.push({
      guard: 'tahap-cocok',
      message: `Tindakan "${action.label}" tidak berlaku untuk jenis dokumen ini.`,
    })
  }

  for (const guardId of action.guards) {
    const message = GUARDS[guardId](ctx)
    if (message) blockers.push({ guard: guardId, message })
  }

  const warnings: ValidationResult['warnings'] = []
  for (const guardId of action.warnGuards ?? []) {
    const message = GUARDS[guardId](ctx)
    if (message) warnings.push({ guard: guardId, message })
  }

  return {
    ok: Object.keys(fieldErrors).length === 0 && blockers.length === 0,
    fieldErrors,
    blockers,
    warnings,
  }
}

export interface ExecuteResult {
  /** Event baru yang harus ditambahkan ke log. */
  events: WorkEvent[]
  /** Objek kerja yang berubah (item asal) dan yang baru dibuat. */
  updatedItems: WorkItem[]
  newItems: WorkItem[]
  /** Objek kerja baru yang dibuat, kalau ada — untuk diarahkan setelah aksi. */
  createdId: string | null
}

export interface ExecuteContext extends GuardContext {
  /** Waktu aksi. Diberikan dari luar supaya fungsi ini tetap murni dan bisa diuji. */
  now: string
  /** Pembuat id event yang unik. */
  nextEventId: () => string
  /** Pembuat nomor dokumen untuk objek kerja baru. */
  nextDocumentNumber: (prefix: string) => string
  /** Nama sistem sumber untuk jejak audit. */
  recordedBy: string
}

/**
 * Jalankan aksi. Fungsi murni: tidak menyentuh penyimpanan, hanya menghitung
 * event dan objek kerja yang berubah. Pemanggilnya yang menuliskannya.
 *
 * Validasi dijalankan ulang di sini, bukan hanya di UI. Validasi yang cuma ada
 * di UI bisa dilewati — dan gerbang yang bisa dilewati sama saja dengan tidak ada
 * gerbang.
 */
export function executeAction(action: ActionDef, ctx: ExecuteContext): ExecuteResult | { error: ValidationResult } {
  const validation = validateAction(action, ctx)
  if (!validation.ok) return { error: validation }

  const { item, values, now, actorPersonId } = ctx
  const events: WorkEvent[] = []
  const newItems: WorkItem[] = []

  // Semua nilai form disimpan di objek kerja supaya isian tidak hilang dan bisa
  // dibaca di jejak audit. Field yang sama diisi ulang akan menimpa yang lama —
  // dan perubahan itu tetap terekam sebagai event tersendiri di bawah.
  const extra: WorkItem['extra'] = { ...(item.extra ?? {}) }
  for (const field of action.fields) {
    const raw = values[field.name]
    if (raw === undefined || raw === '') continue
    const previous = extra[field.name]
    extra[field.name] = field.type === 'number' || field.type === 'money' ? Number(raw) : raw

    // Perubahan nilai setelah dokumen disetujui adalah celah kontrol; rekam
    // sebagai event tersendiri supaya aturan deteksi otomatis bisa menemukannya.
    if (previous !== undefined && previous !== extra[field.name]) {
      events.push({
        id: ctx.nextEventId(),
        workItemId: item.id,
        stageCode: item.currentStageCode,
        type: 'field_changed',
        occurredAt: now,
        recordedAt: now,
        actorPersonId,
        recordedBy: ctx.recordedBy,
        recordingLagHours: 0,
        change: { field: field.name, from: previous as string | number | null, to: extra[field.name] as string | number | null },
      })
    }
  }

  // Event 'started' ditambahkan otomatis kalau belum ada di kunjungan stage ini.
  // Tanpa ini, waktu tunggu tidak bisa dipisahkan dari waktu kerja — dan itu
  // pemisahan terpenting di seluruh sistem.
  const hasStarted = ctx.dataset.events.some(
    (e) => e.workItemId === item.id && e.stageCode === item.currentStageCode && e.type === 'started',
  )
  if (!hasStarted) {
    events.push({
      id: ctx.nextEventId(),
      workItemId: item.id,
      stageCode: item.currentStageCode,
      type: 'started',
      occurredAt: now,
      recordedAt: now,
      actorPersonId,
      recordedBy: ctx.recordedBy,
      recordingLagHours: 0,
    })
  }

  // Peringatan yang tetap dijalankan ikut dicatat, supaya keputusan meneruskan
  // meski ada peringatan tetap terlihat di jejak audit.
  const warnings = validation.warnings.map((w) => w.message)
  if (warnings.length > 0) {
    events.push({
      id: ctx.nextEventId(),
      workItemId: item.id,
      stageCode: item.currentStageCode,
      type: 'note',
      occurredAt: now,
      recordedAt: now,
      actorPersonId,
      recordedBy: ctx.recordedBy,
      recordingLagHours: 0,
      reason: `Diteruskan meski ada peringatan: ${warnings.join(' | ')}`,
    })
  }

  const reason = values.alasan ?? values.catatan ?? values.catatan_persetujuan
  for (const spec of action.effect.events) {
    events.push({
      id: ctx.nextEventId(),
      workItemId: item.id,
      stageCode: spec.stageCode ?? item.currentStageCode,
      type: spec.type,
      occurredAt: now,
      recordedAt: now,
      actorPersonId,
      recordedBy: ctx.recordedBy,
      recordingLagHours: 0,
      toStageCode: action.effect.nextStage,
      reason: reason && reason.trim() !== '' ? reason : undefined,
    })
  }

  // ---- Objek kerja baru, mis. PO yang lahir dari PR ----
  let createdId: string | null = null
  if (action.effect.creates) {
    const spec = action.effect.creates
    const documentNumber = ctx.nextDocumentNumber(spec.docPrefix)
    createdId = `WI-${documentNumber}`
    const amount =
      spec.amountFrom && values[spec.amountFrom] ? Number(values[spec.amountFrom]) : item.amount

    newItems.push({
      id: createdId,
      type: spec.type,
      documentNumber,
      externalId: documentNumber,
      sourceSystem: 'opsflow',
      currentStageCode: spec.startStage,
      status: 'open',
      createdAt: now,
      closedAt: null,
      promisedAt: item.promisedAt,
      amount,
      priority: item.priority,
      links: [{ targetWorkItemId: item.id, relation: spec.relation }],
      refs: { ...item.refs },
      // Isian aksi ini ikut ke dokumen yang baru lahir. Tanpa ini dokumen baru
      // muncul kosong — nomor invoice vendor, nomor surat jalan, keputusan
      // klaim, semuanya tertinggal di dokumen induk. Orang lalu harus membuka
      // dua dokumen untuk mengerti satu pekerjaan, dan itu persis kebiasaan yang
      // sedang diganti.
      extra: Object.fromEntries(
        action.fields
          .filter((field) => values[field.name] !== undefined && values[field.name] !== '')
          .map((field) => [
            field.name,
            field.type === 'number' || field.type === 'money'
              ? Number(values[field.name])
              : values[field.name],
          ]),
      ),
    })

    // Objek baru langsung masuk antrean stage awalnya.
    events.push({
      id: ctx.nextEventId(),
      workItemId: createdId,
      stageCode: spec.startStage,
      type: 'arrived',
      occurredAt: now,
      recordedAt: now,
      actorPersonId: null,
      recordedBy: ctx.recordedBy,
      recordingLagHours: 0,
    })
  }

  // ---- Objek kerja asal ----
  const updated: WorkItem = {
    ...item,
    extra,
    currentStageCode: action.effect.nextStage ?? item.currentStageCode,
    status: action.effect.closes ?? item.status,
    closedAt: action.effect.closes ? now : item.closedAt,
  }

  // Kalau pindah stage, objeknya masuk antrean stage berikutnya.
  if (action.effect.nextStage && action.effect.nextStage !== item.currentStageCode) {
    events.push({
      id: ctx.nextEventId(),
      workItemId: item.id,
      stageCode: action.effect.nextStage,
      type: 'arrived',
      occurredAt: now,
      recordedAt: now,
      actorPersonId: null,
      recordedBy: ctx.recordedBy,
      recordingLagHours: 0,
    })
  }

  return { events, updatedItems: [updated], newItems, createdId }
}

/** Label ramah untuk stage, dipakai di UI. */
export function stageLabel(stageCode: string): string {
  const stage = getStage(stageCode)
  return stage ? `${stage.code} ${stage.name}` : stageCode
}

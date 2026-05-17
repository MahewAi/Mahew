import type { Brief } from '@/lib/types'

/**
 * Voice canon untuk semua brief:
 * - Bahasa Indonesia premium, calm, refined.
 * - Istilah teknis tanpa padanan Indonesia (ROI, capex, runway, breakeven, SKU) tetap.
 * - Tidak ada metafora kekerasan ("bunuh", "hantam"), tidak ada slang ("nunjukkin").
 * - Tidak ada em-dash. Pakai titik, koma, atau "yaitu".
 * - "Gerai 1000 Pintu" lengkap, "tempat" bukan "rumah".
 */
export const mockBriefs: Brief[] = [
  {
    id: 'brief-cbc37cc3',
    status: 'decision',
    priority: 'high',
    title: 'Lokasi Mother Store Balikpapan',
    description: 'Mall versus strip retail. Empat dari lima C-suite merekomendasi B, hanya CMO yang berbeda pandangan.',
    summary:
      'Pilih **Lokasi B** (strip retail). Risiko lebih rendah, ROI breakeven 14 bulan dibanding 24 bulan di Lokasi A.',
    labels: ['Strategi'],
    contributors: ['ceo', 'coo', 'cmo', 'cfo', 'cco'],
    commentCount: 3,
    timeAgo: '5 menit',
    timestamp: '15 Mei, 10:38',
    csuiteInput: [
      {
        role: 'ceo',
        name: 'Atmaja',
        subtitle: 'Sintesis CEO',
        bullets: [
          'Lokasi B selaras dengan positioning premium curated Gerai 1000 Pintu.',
          'Lokasi A punya traffic premium tinggi, namun capex sewanya membebani runway 18 bulan.',
          'Lanjutkan B dengan klausul tinjau ulang di bulan ke-6.',
        ],
      },
      {
        role: 'coo',
        name: 'Operations',
        verdict: { type: 'B', text: 'Rekomendasi B' },
        bullets: [
          'Loading bay di B lebih mudah diakses, alur supply chain sederhana.',
          'Luas lantai 120m² cukup untuk peluncuran wave pertama.',
        ],
      },
      {
        role: 'cmo',
        name: 'Marketing',
        verdict: { type: 'A', text: 'Rekomendasi A' },
        bullets: [
          'Foot traffic premium di Lokasi A tiga kali lebih tinggi.',
          'Biaya brand discovery di B akan jauh lebih besar di fase awal.',
        ],
      },
      {
        role: 'cfo',
        name: 'Finance',
        verdict: { type: 'B', text: 'Rekomendasi B' },
        bullets: [
          'ROI breakeven B sekitar 14 bulan, A sekitar 24 bulan.',
          'Selisih capex Rp 280 juta dapat dialokasikan ke inventory wave kedua.',
        ],
      },
      {
        role: 'cco',
        name: 'Creative',
        verdict: { type: 'B', text: 'Rekomendasi B' },
        bullets: [
          'Strip retail selaras dengan estetika quiet luxury Gerai 1000 Pintu.',
          'Fasad Lokasi B memberi ruang nafas yang lebih intim untuk identitas visual.',
        ],
      },
    ],
  },
  {
    id: 'brief-9d2a48f1',
    status: 'decision',
    priority: 'high',
    title: 'Struktur Harga Wave Pertama',
    description: 'Margin target 42% atau 38% dengan volume lebih tinggi. C-suite terbelah 3 banding 2.',
    summary:
      'Pilih **margin 38% dengan volume lebih tinggi**. Membangun basis pelanggan lebih cepat, ruang menaikkan margin di wave kedua.',
    labels: ['Pricing', 'Strategi'],
    contributors: ['ceo', 'cfo', 'cmo', 'market_researcher', 'sales_strategist'],
    commentCount: 5,
    timeAgo: '32 menit',
    timestamp: '15 Mei, 10:11',
    csuiteInput: [
      {
        role: 'ceo',
        name: 'Atmaja',
        subtitle: 'Sintesis CEO',
        bullets: [
          'Premium curated tidak berarti harga tertinggi, melainkan rasio nilai terhadap pengalaman yang superior.',
          'Margin 38% di wave pertama memberi ruang menaikkan tier di wave kedua tanpa kehilangan kepercayaan.',
        ],
      },
      {
        role: 'cfo',
        name: 'Finance',
        verdict: { type: 'B', text: 'Margin 38%' },
        bullets: [
          'Volume target 1.400 unit per bulan tercapai di skenario 38%.',
          'Skenario 42% menuntut elastisitas yang belum tervalidasi di Balikpapan.',
        ],
      },
      {
        role: 'cmo',
        name: 'Marketing',
        verdict: { type: 'A', text: 'Margin 42%' },
        bullets: [
          'Harga lebih tinggi memperkuat sinyal premium di benak pelanggan baru.',
          'Risiko: 38% terbaca sebagai mass-premium, bukan curated.',
        ],
      },
      {
        role: 'market_researcher',
        name: 'Market Researcher',
        subtitle: 'Riset di bawah CMO',
        bullets: [
          'Kompetitor terdekat di Balikpapan berada di rentang margin 30 sampai 36 persen.',
          'Segmen target merespons positif terhadap kurasi, bukan diskon, di tiga survey terakhir.',
        ],
      },
      {
        role: 'sales_strategist',
        name: 'Sales Strategist',
        subtitle: 'Strategi penjualan di bawah CMO',
        bullets: [
          'Funnel awal lebih kuat dengan harga yang dapat diakses oleh segmen aspiratif.',
          'Strategi upsell di wave kedua memerlukan basis pelanggan yang sudah teredukasi.',
        ],
      },
    ],
  },
  {
    id: 'brief-4f81c2a0',
    status: 'doing',
    priority: 'normal',
    title: 'Audit SKU Wave Pertama',
    description: 'Tim Operasi sedang menyaring 240 SKU menjadi 160 prioritas. Estimasi rampung Jumat.',
    summary:
      'Audit berjalan sesuai jadwal. Operasi memimpin, Creative meninjau presentasi visual untuk tiap kategori.',
    labels: ['Operasi'],
    contributors: ['coo', 'cco', 'curator', 'production_manager'],
    timeAgo: '1 jam',
    timestamp: '15 Mei, 09:42',
    csuiteInput: [
      {
        role: 'coo',
        name: 'Operations',
        bullets: [
          '160 SKU prioritas mencakup empat kategori utama, distribusi merata.',
          'Lead time supplier sudah dikonfirmasi untuk 92% dari shortlist.',
        ],
      },
      {
        role: 'curator',
        name: 'Curator',
        subtitle: 'Kurasi katalog di bawah COO',
        bullets: [
          'Shortlist 160 SKU lolos tiga lapis kurasi: kualitas, narasi, dan kesesuaian dengan tone Gerai 1000 Pintu.',
          '80 SKU yang dieliminasi mayoritas karena overlap kategori, bukan karena kualitas.',
        ],
      },
      {
        role: 'production_manager',
        name: 'Production Manager',
        subtitle: 'Produksi dan supply chain di bawah COO',
        bullets: [
          '12 dari 14 vendor telah konfirmasi kapasitas untuk timeline wave pertama.',
          'Dua vendor di kategori homeware perlu backup, sudah dijajaki minggu ini.',
        ],
      },
      {
        role: 'cco',
        name: 'Creative',
        bullets: [
          'Tiap SKU akan dipotret dengan dua sudut dan satu shot konteks.',
          'Panduan styling untuk fotografer diselesaikan minggu ini.',
        ],
      },
    ],
  },
  {
    id: 'brief-7e09b3c5',
    status: 'doing',
    priority: 'normal',
    title: 'Rencana Loyalty Program',
    description: 'CMO menyusun struktur tier dan mekanisme reward. Draft pertama Selasa depan.',
    summary:
      'Tiga tier dengan reward bersifat eksperiensial, bukan diskon. Selaras dengan positioning quiet luxury.',
    labels: ['Marketing', 'Strategi'],
    contributors: ['cmo', 'cco'],
    commentCount: 2,
    timeAgo: '3 jam',
    timestamp: '15 Mei, 07:55',
    csuiteInput: [
      {
        role: 'cmo',
        name: 'Marketing',
        bullets: [
          'Tier "Pintu", "Beranda", "Halaman" merefleksikan jenjang kedalaman relasi.',
          'Reward fokus pada akses, bukan potongan harga.',
        ],
      },
      {
        role: 'cco',
        name: 'Creative',
        bullets: [
          'Nama tier diuji ulang agar tidak terbaca sebagai gimik.',
          'Card desain mengusung tipografi serif yang konsisten dengan brand kit.',
        ],
      },
    ],
  },
  {
    id: 'brief-1ab6e208',
    status: 'review',
    priority: 'normal',
    title: 'Tinjauan Identitas Visual Wave Kedua',
    description: 'Creative mengajukan revisi warna sekunder. Menunggu tinjauan akhir CEO.',
    summary:
      'Warna sekunder bergeser dari sage ke teal-sage demi diferensiasi dari kompetitor regional. Risiko brand recall rendah.',
    coverImage: '/cover-branding.svg',
    labels: ['Branding'],
    contributors: ['cco', 'cmo', 'ceo'],
    commentCount: 1,
    timeAgo: '6 jam',
    timestamp: '15 Mei, 05:12',
    csuiteInput: [
      {
        role: 'cco',
        name: 'Creative',
        bullets: [
          'Teal-sage memberi ruang dingin yang tidak dimiliki sage standar.',
          'Pengujian pada 12 sample material menunjukkan keterbacaan tetap kuat.',
        ],
      },
      {
        role: 'cmo',
        name: 'Marketing',
        bullets: [
          'Tidak ada konflik dengan kompetitor terdekat dalam radius 200 km.',
          'Penyesuaian aset peluncuran cukup terbatas pada layer sekunder.',
        ],
      },
    ],
  },
  {
    id: 'brief-3c20f4d7',
    status: 'final',
    priority: 'normal',
    title: 'Pemilihan Vendor Photography',
    description: 'Studio Hitam-Putih dipilih untuk wave pertama. Kontrak ditandatangani.',
    summary:
      'Studio Hitam-Putih memenangkan pitch dari empat kandidat. Estetika minimal mereka selaras dengan brand language Gerai.',
    labels: ['Operasi', 'Branding'],
    contributors: ['cco', 'coo', 'cfo'],
    timeAgo: '1 hari',
    timestamp: '14 Mei, 16:30',
    csuiteInput: [
      {
        role: 'cco',
        name: 'Creative',
        bullets: [
          'Portfolio menunjukkan penguasaan natural light yang konsisten.',
          'Visi estetika selaras tanpa perlu briefing intensif.',
        ],
      },
      {
        role: 'coo',
        name: 'Operations',
        bullets: [
          'Kapasitas studio mendukung output 160 SKU dalam tiga minggu.',
          'Lokasi di Balikpapan, tidak ada biaya travel.',
        ],
      },
      {
        role: 'cfo',
        name: 'Finance',
        bullets: [
          'Tarif paket Rp 48 juta, dalam alokasi budget visual wave pertama.',
          'Termin pembayaran 30/40/30 selaras dengan cash flow.',
        ],
      },
    ],
  },
]

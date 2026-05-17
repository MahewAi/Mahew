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
    id: 'brief-daily-digest-20260517',
    isDailyDigest: true,
    status: 'decision',
    priority: 'high',
    title: 'Laporan Harian Atmaja · 17 Mei 2026',
    description: 'Ringkasan kemarin, prioritas hari ini, dan dua brief menunggu keputusan Anda.',
    summary:
      '**Hari ini, 2 brief menunggu keputusan**: Lokasi Mother Store (B vs A) dan Struktur Harga Wave 1 (margin 38% vs 42%). Kemarin, tim Operations menutup audit SKU dengan 160 dari 240 lolos kurasi. Creative menyelesaikan revisi identitas visual, menunggu tinjauan akhir Anda.',
    labels: ['Strategi'],
    contributors: ['ceo'],
    timeAgo: '7:00 pagi',
    timestamp: '17 Mei, 07:00',
    csuiteInput: [
      {
        role: 'ceo',
        name: 'Atmaja',
        subtitle: 'Ringkasan harian',
        bullets: [
          'Dua brief menunggu keputusan Anda hari ini, keduanya bertanda prioritas tinggi.',
          'Kemarin: audit SKU selesai 160 dari 240 dikurasi, identitas visual wave kedua menunggu approval.',
          'Tim sedang mengerjakan: loyalty program (draft Selasa), tinjauan vendor photography (final).',
          'Rekomendasi prioritas: putuskan lokasi mother store hari ini, struktur harga bisa menunggu sampai besok kalau perlu input lebih.',
        ],
      },
    ],
  },
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
    commentCount: 2,
    timeAgo: '5 menit',
    timestamp: '15 Mei, 10:38',
    blocks: [
      {
        type: 'markdown',
        content:
          '## Konteks\n\nMatthew sedang evaluasi dua lokasi calon **Mother Store** di Balikpapan. Pilihan strategis ini akan mengunci posisi Gerai 1000 Pintu sebagai brand premium curated di wilayah ini selama minimal 18 bulan ke depan.\n\nKeputusan harus diambil sebelum **akhir Mei** karena kontrak sewa di kedua lokasi punya window approval terbatas.',
      },
      {
        type: 'callout',
        variant: 'warning',
        title: 'Devil\'s Advocate: 3 risiko utama yang teridentifikasi',
        content:
          '- **Capex Lokasi A** memakan 38% runway, menyisakan ruang gerak sempit untuk wave 2.\n- **Brand discovery di Lokasi B** akan butuh effort 3-4× lipat di 6 bulan pertama.\n- **Lock-in 5 tahun** di kedua lokasi mempersulit pivot kalau market thesis salah.',
      },
      {
        type: 'table',
        caption: 'Perbandingan kriteria kunci Lokasi A vs Lokasi B',
        headers: ['Kriteria', 'Lokasi A (Mall)', 'Lokasi B (Strip retail)'],
        align: ['left', 'center', 'center'],
        rows: [
          ['Rent / bulan', 'Rp 45 juta', 'Rp 18 juta'],
          ['Foot traffic harian', '8.000', '3.000'],
          ['Brand fit', 'Medium', 'High'],
          ['Capex fit-out', 'Rp 380 juta', 'Rp 220 juta'],
          ['ROI breakeven', '24 bulan', '14 bulan'],
          ['Lock-in kontrak', '5 tahun', '3 tahun + opsi 2'],
        ],
      },
      {
        type: 'chart',
        kind: 'line',
        caption: 'Proyeksi cash flow kumulatif 24 bulan (dalam juta Rp)',
        data: {
          xKey: 'bulan',
          series: [
            { key: 'A', label: 'Lokasi A', color: 'hsl(14, 50%, 51%)' },
            { key: 'B', label: 'Lokasi B', color: 'hsl(145, 28%, 34%)' },
          ],
          points: [
            { bulan: 'M1', A: -380, B: -220 },
            { bulan: 'M3', A: -440, B: -240 },
            { bulan: 'M6', A: -480, B: -180 },
            { bulan: 'M9', A: -490, B: -90 },
            { bulan: 'M12', A: -440, B: 20 },
            { bulan: 'M14', A: -380, B: 80 },
            { bulan: 'M18', A: -240, B: 220 },
            { bulan: 'M24', A: 60, B: 480 },
          ],
        },
        options: { legend: true },
      },
      {
        type: 'csuite-vote',
        votes: [
          {
            role: 'ceo',
            recommendation: 'B',
            reasoning:
              '**Strip retail** selaras dengan positioning premium curated. Capex hemat memberi ruang gerak di wave 2.',
          },
          {
            role: 'coo',
            recommendation: 'B',
            reasoning:
              'Loading bay lebih mudah diakses. Supply chain ke 120m² floor plan sederhana.',
          },
          {
            role: 'cmo',
            recommendation: 'A',
            reasoning:
              '_Dissenting_: foot traffic Mall 3× lebih tinggi. Biaya akuisisi pelanggan di Strip akan jauh lebih besar di 6 bulan pertama.',
          },
          {
            role: 'cfo',
            recommendation: 'B',
            reasoning:
              'ROI breakeven 14 vs 24 bulan. Selisih capex Rp 280 juta dapat dialokasikan ke inventory wave 2.',
          },
          {
            role: 'cco',
            recommendation: 'B',
            reasoning:
              'Fasad Lokasi B memberi ruang nafas yang intim untuk identitas visual. Sejalan dengan estetika **quiet luxury**.',
          },
        ],
      },
      {
        type: 'mermaid',
        caption: 'Pre-mortem: bila Lokasi B gagal di bulan ke-6, akar masalahnya mungkin di mana?',
        code: `flowchart TD
    A[Lokasi B gagal di M6] --> B{Penyebab utama?}
    B -->|Traffic discovery rendah| C[Brand awareness lemah]
    B -->|Conversion rate rendah| D[Pricing tidak match audience]
    B -->|Repeat rate rendah| E[Pengalaman tidak memorable]
    C --> F[Investasi awareness lebih agresif]
    D --> G[Restrukturisasi tier pricing]
    E --> H[Audit pengalaman in-store]
    F --> I[Cek ulang strategi M6 - M12]
    G --> I
    H --> I`,
      },
      {
        type: 'grid',
        columns: 2,
        items: [
          {
            title: 'Risiko di-mitigasi',
            content:
              'Klausul tinjau ulang di **bulan ke-6** dengan trigger metric pasti. Bila Lokasi B underperform di kriteria yang sudah disepakati, opsi exit tersedia tanpa penalti besar.',
            accent: 'hsl(145, 28%, 34%)',
          },
          {
            title: 'Modal yang dihemat',
            content:
              '**Rp 280 juta** selisih capex bisa langsung dialokasikan ke inventory wave 2 dan budget brand discovery di 6 bulan pertama.',
            accent: 'hsl(33, 36%, 57%)',
          },
        ],
      },
      {
        type: 'markdown',
        content:
          '## Rekomendasi akhir\n\nLanjutkan dengan **Lokasi B** dengan tiga klausul wajib:\n\n1. Trigger metric review di bulan ke-6 (rev/m², repeat rate, NPS).\n2. Budget brand discovery minimal Rp 120 juta untuk 6 bulan pertama.\n3. Opsi exit jelas di kontrak (sudah dinegosiasi, menunggu sign Anda).',
      },
    ],
    comments: [
      {
        id: 'c-cbc-1',
        author: 'matthew',
        text: 'Atmaja, bisa jelaskan kenapa CMO yang berbeda? Apa yang dia lihat yang lain tidak?',
        timeAgo: '3 menit',
      },
      {
        id: 'c-cbc-2',
        author: 'ceo',
        text: 'CMO melihat dari sudut akuisisi: di Lokasi A, traffic alami menggantikan biaya akuisisi awal. Beliau benar untuk jangka pendek. Namun untuk premium curated yang kita bangun, kualitas akuisisi lebih penting dari volume. Strip retail menyaring pengunjung yang memang mencari Gerai.',
        timeAgo: '2 menit',
      },
    ],
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
    blocks: [
      {
        type: 'markdown',
        content:
          '## Pertanyaan\n\nMana struktur margin yang dipakai di **wave 1**: 42% dengan volume konservatif, atau 38% dengan volume target lebih tinggi?\n\nKonteks: kompetitor terdekat di Balikpapan berada di rentang 30–36%. Riset segmen target menunjukkan elastisitas harga relatif stabil di range 38–45%.',
      },
      {
        type: 'chart',
        kind: 'bar',
        caption: 'Proyeksi revenue dan gross profit per skenario (Rp juta, 6 bulan)',
        data: {
          series: [
            { key: 'revenue', label: 'Revenue', color: 'hsl(33, 36%, 57%)' },
            { key: 'profit', label: 'Gross profit', color: 'hsl(145, 28%, 34%)' },
          ],
          points: [
            { label: '42% margin', revenue: 840, profit: 353 },
            { label: '38% margin', revenue: 1180, profit: 449 },
          ],
        },
        options: { legend: true },
      },
      {
        type: 'callout',
        variant: 'info',
        title: 'Insight dari Market Researcher',
        content:
          'Survey tiga bulan terakhir di 220 responden segmen target menunjukkan: **kurasi** lebih dihargai dibanding diskon. Premium curated dengan harga aksesibel = sweet spot.',
      },
      {
        type: 'csuite-vote',
        votes: [
          {
            role: 'ceo',
            recommendation: 'B',
            reasoning:
              'Premium curated bukan berarti harga tertinggi. Volume di wave 1 membangun basis, margin naik di wave 2.',
          },
          {
            role: 'cfo',
            recommendation: 'B',
            reasoning: 'Volume target 1.400 unit/bulan tercapai. Skenario A elastisitasnya belum tervalidasi.',
          },
          {
            role: 'cmo',
            recommendation: 'A',
            reasoning:
              '_Dissenting_: harga tinggi memperkuat sinyal premium di benak pelanggan baru. 38% berisiko terbaca sebagai mass-premium.',
          },
        ],
      },
    ],
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
    blocks: [
      {
        type: 'markdown',
        content:
          '## Usulan revisi\n\nCreative mengajukan pergeseran warna sekunder dari **sage** ke **teal-sage** untuk wave kedua. Tujuan: diferensiasi visual dari dua kompetitor regional yang juga pakai sage.',
      },
      {
        type: 'image',
        src: '/cover-branding.svg',
        alt: 'Tiga swatch palette: sage lama, teal-sage usulan baru, brass aksen',
        caption: 'Tiga swatch perbandingan. Tengah adalah usulan baru.',
      },
      {
        type: 'grid',
        columns: 3,
        items: [
          {
            title: 'Sage (lama)',
            content: '`#3D6F58` — Forest natural. Konflik visual dengan dua kompetitor.',
            accent: '#3D6F58',
          },
          {
            title: 'Teal-sage (usulan)',
            content: '`#56877D` — Sedikit lebih dingin. Distinct dalam radius 200 km.',
            accent: '#56877D',
          },
          {
            title: 'Brass (aksen)',
            content: '`#B8956B` — Tidak berubah. Tetap identitas brand utama.',
            accent: '#B8956B',
          },
        ],
      },
      {
        type: 'callout',
        variant: 'success',
        title: 'Hasil pengujian',
        content:
          'Pengujian pada 12 sample material (kain, kertas, signage, layar) menunjukkan keterbacaan tetap kuat. Tidak ada konflik dengan kompetitor terdekat dalam radius 200 km.',
      },
    ],
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

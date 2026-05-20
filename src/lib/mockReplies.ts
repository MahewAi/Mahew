import { CONTRIBUTOR_META, type Brief, type Contributor } from './types'
import { getLearningGuidanceLines } from './learningMemory'

/**
 * Fresh-start mock reply engine.
 *
 * This keeps Atmaja useful for local/demo interaction without carrying old
 * decision examples into a reset workspace.
 */

export interface ChatMessage {
  id: string
  author: 'matthew' | Contributor
  text: string
}

export interface MockReplyContext {
  /** Pesan baru dari user yang perlu dijawab. */
  userMessage: string
  /** Full thread history (excluding the just-sent user message). */
  history: ChatMessage[]
  /** Brief context (untuk AskRolePanel + Brief comment). Null untuk Atmaja general chat. */
  brief?: Brief
  /** Untuk personalisasi reply. Default 'atmaja' (untuk Atmaja page). */
  speaker?: 'atmaja' | Contributor
}

interface ReplyResult {
  text: string
  intent: string
  resetThread?: boolean
}

const META_RESET_KEYWORDS = ['lupakan', 'forget', 'reset', 'restart', 'mulai dari awal', 'mulai ulang', 'clear']
const META_STOP_KEYWORDS = ['stop', 'cukup', 'sudah', 'berhenti', 'batal']

const PATTERNS: Array<{
  match: (q: string) => boolean
  intent: string
  variants: (ctx: MockReplyContext) => string[]
}> = [
  {
    match: (q) => META_RESET_KEYWORDS.some((k) => q.includes(k)),
    intent: 'reset',
    variants: (ctx) => [
      `Baik, saya reset konteks percakapan kita. Yang saya pertahankan: business plan Anda dan pemahaman saya soal Gerai 1000 Pintu sebagai brand premium curated retail di Balikpapan. Mari mulai segar. Apa yang ingin Anda bahas?`,
      `Mengerti. Saya hapus konteks lain, kecuali fundamental business plan dan profil Gerai. Sekarang, dari halaman baru, apa fokus Anda?`,
      ctx.speaker === 'atmaja'
        ? `Reset selesai. Saya jaga apa yang Anda minta tetap: business plan dan pengetahuan tentang Gerai. Selebihnya kosong. Silakan lanjut.`
        : `Konteks di-reset. Apa yang ingin Anda bahas selanjutnya?`,
    ],
  },
  {
    match: (q) => META_STOP_KEYWORDS.some((k) => q.split(/\s+/).includes(k) || q === k),
    intent: 'stop',
    variants: () => [
      `Baik, saya berhenti di sini. Kalau ada yang ingin Anda lanjutkan, sebut saja.`,
      `Oke, saya pause. Anda yang pegang kemudi.`,
    ],
  },
  {
    match: (q) => /^(ya|iya|yes|setuju|ok|oke|sip|gas|jalan)[.!?]?$/.test(q.trim()),
    intent: 'affirm',
    variants: (ctx) => {
      const lastBot = lastReplyByRole(ctx.history, ctx.speaker ?? 'atmaja')
      if (lastBot && lastBot.text.includes('?')) {
        return [
          `Baik. Berdasarkan konfirmasi Anda, saya prioritaskan analisis ke arah itu. Mau saya elaborate aspek finansial dulu, atau implikasi operasional?`,
          `Diterima. Saya akan masuk lebih dalam. Mulai dari mana: risiko atau peluang?`,
        ]
      }
      return [
        `Baik. Lanjut ke topik berikutnya, atau ada yang ingin Anda bahas lebih dalam dari yang tadi?`,
        `Catat. Apa langkah berikutnya menurut Anda?`,
      ]
    },
  },
  {
    match: (q) => /^(tidak|enggak|gak|engga|no|belum)[.!?]?$/.test(q.trim()),
    intent: 'deny',
    variants: () => [
      `Mengerti. Kalau begitu, apa yang berbeda dari yang saya sampaikan? Saya butuh tahu agar bisa rephrase atau pivot.`,
      `Catat. Mau saya coba sudut pandang lain, atau Anda ingin saya berhenti membahas topik ini?`,
    ],
  },
  {
    match: (q) => /^(semua|all|seluruhnya|keseluruhan)[.!?]?$/.test(q.trim()),
    intent: 'scope_all',
    variants: () => [
      `Baik, saya beri sintesa menyeluruh dari posisi fresh-start. Belum ada brief aktif di app. Tiga langkah awal yang paling masuk akal: susun prioritas pembuka, buat brief pertama, lalu minta C-suite memberi push-back. Mau mulai dari business plan, operasi, marketing, finance, atau creative?`,
      `Mengerti, scope penuh. Saat ini ruang kerja app sudah kosong: tidak ada keputusan tertunda, tidak ada brief berjalan, dan tidak ada konten lama yang perlu ditindaklanjuti. Kita bisa mulai dari satu brief pondasi agar sistem bergerak lagi dengan arah yang bersih.`,
    ],
  },
  {
    match: (q) => /priorita|penting|urgent|terpenting|focus|fokus/.test(q),
    intent: 'priority',
    variants: () => [
      `Prioritas tertinggi sekarang: tentukan brief pertama untuk setup ulang. Saya sarankan mulai dari business plan snapshot: target wave pertama, asumsi revenue, kebutuhan operasi, dan brand promise yang tidak boleh bergeser.`,
      `Yang paling penting bukan keputusan lama, tapi pondasi baru. Urutannya: business plan ringkas, struktur department, lalu satu brief nyata yang bisa diproses C-suite.`,
      `Fokus hari ini: pilih satu masalah bisnis yang paling perlu dibuka. Dari sana saya bisa pecah menjadi input COO, CMO, CFO, CCO, lalu rangkum sebagai keputusan untuk Anda.`,
    ],
  },
  {
    match: (q) => /sintesa|sintesis|kondisi|status|sekarang|update|sitrep|situasi/.test(q),
    intent: 'status',
    variants: () => [
      `Kondisi sekarang: workspace app sudah fresh-start. Belum ada brief aktif, belum ada keputusan yang menunggu, dan thread lama sudah tidak jadi konteks kerja. Pengetahuan bisnis tetap dipertahankan sebagai fondasi.`,
      `Sintesa singkat: kita berada di halaman awal baru. Sistem siap menerima brief pertama, lalu saya bisa orkestrasi C-suite dan specialist untuk menghasilkan keputusan yang lebih rapi.`,
    ],
  },
  {
    match: (q) => /tertunda|blocked|stuck|paling lama|telat|tertahan|menunggu paling/.test(q),
    intent: 'blocker',
    variants: () => [
      `Belum ada blocker aktif di app karena workspace sudah kosong. Blocker berikutnya baru muncul setelah Anda membuat brief pertama atau memberi target setup ulang yang perlu diproses department.`,
      `Tidak ada keputusan lama yang tertahan. Blocker paling mungkin sekarang adalah definisi awal: apa brief pertama yang mau kita jalankan, dan output seperti apa yang Anda butuhkan dari C-suite.`,
    ],
  },
  {
    match: (q) => /risiko|risk|skenario|scenario|terburuk|worst|antisipasi|bahaya/.test(q),
    intent: 'risk',
    variants: () => [
      `Risiko terbesar saat setup ulang: sistem terlihat bersih tapi arah brief pertama terlalu kabur. Mitigasinya: setiap brief harus punya tujuan, konteks bisnis, opsi, kriteria keputusan, dan owner department.`,
      `Risiko fresh-start bukan kehilangan pengetahuan, karena business plan tetap dipertahankan. Risiko utamanya adalah keputusan baru tidak punya format. Saya sarankan kita pakai template: konteks, pilihan, trade-off, rekomendasi, next action.`,
    ],
  },
  {
    match: (q) => /keputusan|kepetusan|kepustusan|decision|putusan|memutuskan|memilih/.test(q),
    intent: 'decision_help',
    variants: (ctx) => {
      const involveLongTerm = /jangka panjang|strategi|strategic|long.?term/.test(ctx.userMessage.toLowerCase())
      if (involveLongTerm) {
        return [
          `Untuk keputusan jangka panjang, kita mulai dari prinsip dahulu: positioning, model revenue, struktur operasi, lalu kanal pertumbuhan. Belum ada decision brief aktif, jadi saya bisa bantu bentuk brief pertama dari salah satu area itu.`,
          `Anda menyebut dimensi strategis. Karena workspace sudah kosong, langkah terbaik adalah membuat satu decision brief baru dengan opsi yang jelas. Mau saya mulai dari brand, operasi, finance, atau market?`,
        ]
      }
      return [
        `Belum ada keputusan aktif yang menunggu di app. Kalau Anda kirim topik, saya bisa bantu ubah menjadi decision brief: opsi A/B, kriteria, dissent, rekomendasi, dan action.`,
        `Untuk mulai memutuskan sesuatu, kita perlu brief baru. Sebutkan masalahnya satu kalimat dulu, nanti saya bentuk menjadi struktur keputusan yang bisa dibaca C-suite.`,
      ]
    },
  },
  {
    match: (q) => /strategi|strategy|jangka panjang|long.?term|visi|roadmap/.test(q),
    intent: 'strategy',
    variants: () => [
      `Strategi jangka panjang Gerai bertumpu pada tiga pilar: kurasi yang konsisten, ekspansi terkontrol per wave, dan brand sebagai aset jangka panjang. Tiga pilar ini saling memperkuat tetapi tidak boleh dieksekusi paralel di tahun pertama. Mau saya zoom ke salah satu pilar?`,
      `Visi jangka panjang: Gerai sebagai destinasi premium curated yang dipercaya di rentang harga aksesibel. Setelah reset, tahun pertama sebaiknya fokus ke pondasi: struktur produk, operasi, brand identity, dan financial discipline.`,
    ],
  },
  {
    match: (q) => /arsitektur|architecture|denah|peta kerja|work map|workflow|blueprint|rancangan/.test(q),
    intent: 'work_architecture',
    variants: () => [
      `Saya akan pakai format itu sebagai default untuk brief strategis: gambaran arsitektur dulu, baru detail.\n\nDenah kerja C-level:\n| Zona | Owner | Yang dirancang | Output |\n|---|---|---|---|\n| Sintesa | Atmaja | Prioritas, trade-off, gate keputusan | Master plan |\n| Operasi | COO | SOP, vendor, staffing, fulfillment | Ops roadmap |\n| Market | CMO | Segment, positioning, channel, funnel | Growth roadmap |\n| Capital | CFO | ROI, margin, runway, budget | Scenario table |\n| Narrative | CCO | Memo, source log, visual brief | Document pack |\n\nKalau Anda kirim topik, saya pecah jadi peta kerja seperti ini sebelum masuk analisis panjang.`,
      `Baik. Mulai sekarang cara baca utama saya: input Matthew -> framing Atmaja -> lane COO/CMO/CFO/CCO -> specialist packet -> confirmation gate.\n\nYang akan saya tampilkan untuk rencana besar:\n- Architecture map: bentuk sistem dan alurnya.\n- Denah kerja: siapa merancang apa.\n- Dependency map: apa yang saling menunggu.\n- Gate keputusan: apa yang perlu Anda pilih sekarang.\n\nKirim satu topik, nanti saya bentuk sebagai blueprint kerja.`,
    ],
  },
  {
    match: (q) => /file|lampir|attachment|dokumen|pdf|csv|excel|xlsx|gambar|image/.test(q),
    intent: 'file_context',
    variants: (ctx) => {
      const q = ctx.userMessage.toLowerCase()
      if (/(warna|color|palette|palet|brand|branding)/.test(q) && /(pilih|rekomendasi|terbaik|alasan|menurut)/.test(q)) {
        return [
          `Jawaban langsung: saya pilih 3 warna terbaik untuk arah brand premium Gerai/GSP.\n\n1. Brass gold #B8956B\nAlasan: paling kuat sebagai warna signature. Rasanya premium, hangat, dan cukup berbeda dari gold yang terlalu mencolok. Ini cocok untuk tombol utama, aksen logo, line divider, dan highlight decision.\n\n2. Deep charcoal #1F1A14\nAlasan: memberi bobot, kontras, dan rasa mahal. Brass akan terlihat lebih elegan kalau ditemani charcoal, bukan putih polos terus-menerus. Ini cocok untuk header, canvas mapping, packaging gelap, dan background konten hero.\n\n3. Warm ivory #FAF8F4\nAlasan: menjaga brand tetap bersih dan breathable. Ivory membuat brass dan charcoal tidak terasa berat, cocok untuk background app, katalog, dokumen, dan materi presentasi.\n\nKalau harus dipersempit jadi 2 warna inti: pilih Brass gold + Deep charcoal. Ivory tetap dipakai sebagai warna dasar/support.\n\nCatatan: file ZIP besar belum bisa saya baca isi visualnya langsung di app, jadi ini rekomendasi cepat dari arah brand premium Gerai/GSP dan konteks warna yang sudah ada. Untuk final choice yang presisi, kirim screenshot palette atau 2-3 gambar opsi warna yang sudah diekstrak.`,
          `Saya langsung pilih: kombinasi terbaik adalah Brass gold #B8956B, Deep charcoal #1F1A14, dan Warm ivory #FAF8F4.\n\nBrass gold jadi identitas utama karena terasa premium dan hangat. Deep charcoal membuat brand terlihat tegas, mature, dan tidak terlalu manis. Warm ivory menjadi ruang napas agar visual tetap bersih di app, katalog, dan presentasi.\n\nJika hanya boleh 2: Brass gold + Deep charcoal. Itu pasangan paling kuat untuk brand yang ingin terlihat premium, curated, dan punya authority.\n\nSaya belum bisa membedah isi ZIP besar langsung dari app, jadi rekomendasi ini saya berikan sebagai keputusan awal yang bisa dipakai sekarang. Kalau Anda kirim gambar palette hasil ekstrak, saya bisa ranking ulang lebih akurat.`,
        ]
      }

      if (ctx.userMessage.includes('[Cuplikan isi file]')) {
        return [
          `File sudah saya terima dan cuplikan isinya sudah masuk sebagai konteks lokal. Saya akan baca dengan urutan: ringkasan isi, bagian yang perlu keputusan Matthew, risiko, lalu next action untuk C-level.`,
          `Saya sudah dapat lampiran beserta cuplikannya. Langkah kerja saya: ambil inti dokumen, pisahkan fakta dan asumsi, lalu ubah menjadi brief atau workmap jika Anda mau.`,
        ]
      }

      return [
        `File sudah saya terima sebagai lampiran. Untuk file teks saya bisa membaca cuplikan lokal; untuk PDF, Office, atau gambar, saat ini saya pakai metadata lampiran dulu dan Anda bisa beri instruksi bagian mana yang perlu saya analisis.`,
        `Lampiran masuk. Jika ini dokumen non-teks, saya akan perlakukan sebagai konteks file yang menunggu arahan Anda. Kalau Anda ingin analisis cepat, sebutkan targetnya: ringkasan, risiko, biaya, atau workmap.`,
      ]
    },
  },
  {
    match: (q) => /bisnis|business|usaha|operasi|operations|jualan/.test(q),
    intent: 'business',
    variants: () => [
      `Sisi bisnis yang saya pertahankan: Gerai adalah curated retail dengan aspirasi premium, perlu disiplin pada kurasi, margin, pengalaman tempat, dan cerita produk. Yang ingin Anda fokuskan dulu: revenue, cost structure, operasi, atau customer behavior?`,
      `Bisnis Gerai bisa dibaca sebagai rantai: kurasi -> display di tempat -> cerita produk -> conversion -> repeat. Tiap titik punya leverage berbeda. Mau saya breakdown sebagai business plan ringkas?`,
    ],
  },
  {
    match: (q) => /sku|produk|product|katalog|catalog|kurasi/.test(q),
    intent: 'product',
    variants: () => [
      `Belum ada audit SKU aktif di app. Untuk mulai ulang katalog, kita bisa susun kriteria kurasi: kategori, margin, supplier reliability, brand fit, dan alasan produk layak masuk Gerai.`,
      `Untuk produk, saya sarankan mulai dari curation logic dulu sebelum angka SKU. Jika kriteria sudah jelas, Curator dan Production Manager bisa lebih konsisten menyaring supplier.`,
    ],
  },
  {
    match: (q) => /^(halo|hai|hi|hello|selamat (pagi|siang|sore|malam)|assalamualaikum|p$)/.test(q.trim()),
    intent: 'greeting',
    variants: () => [
      `Halo Matthew. Workspace sudah bersih. Apa yang ingin Anda jadikan brief pertama?`,
      `Selamat datang. Apa fokus Anda sekarang?`,
      `Halo. Tidak ada keputusan lama yang menunggu. Kita bisa mulai dari business plan, department setup, atau satu brief baru.`,
    ],
  },
  {
    match: (q) => /market|pasar|kompetitor|competitor|saingan|industri/.test(q),
    intent: 'market',
    variants: () => [
      `Untuk market, kita mulai dari riset baru agar tidak membawa asumsi lama. Format yang sehat: target segmen, kompetitor, harga pembanding, channel discovery, dan alasan Gerai bisa berbeda.`,
      `Market brief pertama sebaiknya tidak terlalu luas. Pilih satu pertanyaan: siapa customer awal, kompetitor mana yang paling dekat, atau channel mana yang paling realistis untuk validasi.`,
    ],
  },
  {
    match: (q) => /roi|profit|margin|revenue|cash flow|cashflow|keuangan|finance|biaya|cost/.test(q),
    intent: 'finance',
    variants: () => [
      `Untuk finance, belum ada proyeksi aktif di app setelah reset. Saya bisa bantu buat baseline baru: modal awal, gross margin, biaya tetap, skenario konservatif, dan titik break-even.`,
      `Financial brief pertama sebaiknya dimulai dari asumsi, bukan kesimpulan. Kirim angka yang Anda punya, nanti CFO dan Financial Analyst bisa bantu susun ROI, pricing, forecast, dan risiko cash flow.`,
    ],
  },
  {
    match: (q) => /brand|identitas|positioning|logo|visual|warna|tone/.test(q),
    intent: 'brand',
    variants: () => [
      `Brand Gerai tetap saya pegang sebagai premium curated retail. Untuk reset yang bersih, kita bisa tulis ulang brand DNA: positioning, tone, visual feel, forbidden language, dan contoh copy.`,
      `Kalau mau mulai dari brand, brief pertamanya bisa berbentuk identity canon: apa yang Gerai boleh katakan, tidak boleh katakan, dan bagaimana brand terasa di app, tempat, dan konten.`,
    ],
  },
  {
    match: (q) => /tim|team|c.?suite|c level|atmaja|coo|cmo|cfo|cco/.test(q),
    intent: 'team',
    variants: () => [
      `Tim Anda terdiri dari: Atmaja sebagai CEO, 4 C-suite (COO, CMO, CFO, CCO), dan 12 specialist di bawahnya. Kita bisa setup ulang cara mereka menerima brief, memberi push-back, dan menghasilkan output rich content.`,
      `Struktur department tetap utuh: CEO untuk sintesa, C-suite untuk judgment domain, specialist untuk depth. Yang perlu disetel ulang sekarang adalah alur kerja dan standar output mereka.`,
    ],
  },
  {
    match: (q) => /self.?learning|belajar|dipelajari|memory|inget|ingat/.test(q),
    intent: 'learning_memory',
    variants: () => {
      const guidance = getLearningGuidanceLines(4)
      if (guidance.length === 0) {
        return [
          `Self-learning baru aktif sebagai lesson memory. Saya belum punya lesson tambahan dari interaksi app, jadi saya akan mulai belajar dari approval, revisi, dan preferensi yang Anda tulis.`,
        ]
      }
      return [
        `Yang sudah saya pakai sebagai memory kerja:\n- ${guidance.join('\n- ')}\n\nSaya tetap tidak menyimpan raw chat sebagai default. Yang disimpan adalah lesson ringkas yang bisa diaudit.`,
      ]
    },
  },
]

function lastReplyByRole(history: ChatMessage[], role: 'matthew' | Contributor | 'atmaja'): ChatMessage | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].author === role) return history[i]
  }
  return undefined
}

function lastIntent(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].author !== 'matthew') {
      const text = history[i].text.toLowerCase()
      for (const p of PATTERNS) {
        for (const variant of p.variants({ userMessage: '', history: [] })) {
          if (variant.toLowerCase().slice(0, 40) === text.slice(0, 40)) {
            return p.intent
          }
        }
      }
      return null
    }
  }
  return null
}

const FALLBACK_VARIANTS = [
  `Saya catat pesannya. Bisa Anda jelaskan sedikit lebih spesifik? Kita sedang di kondisi fresh-start, jadi saya perlu topik awal untuk membentuk brief baru.`,
  `Mohon perjelas: ini soal business plan, operasi, marketing, finance, creative, atau setup department? Kalau Anda sebut topik, saya bisa langsung susun sintesa awal.`,
  `Saya membaca pesan Anda tetapi belum yakin sudut pandangnya. Mau saya cek dari sudut keuangan, operasional, brand, atau tim?`,
  `Konteks-nya masih luas. Coba sebut kata kunci spesifik: business plan, produk, brand, market, finance, atau tim. Saya akan ambil dari sana.`,
]

export function generateMockReply(ctx: MockReplyContext): ReplyResult {
  const q = ctx.userMessage.toLowerCase().trim()
  const prevIntent = lastIntent(ctx.history)

  for (const pattern of PATTERNS) {
    if (pattern.match(q)) {
      const variants = pattern.variants(ctx)
      const startIdx = pattern.intent === prevIntent ? 1 : 0
      const idx = (Math.floor(Date.now() / 1000) + startIdx) % variants.length
      return {
        text: variants[idx],
        intent: pattern.intent,
        resetThread: pattern.intent === 'reset',
      }
    }
  }

  const fallbackIdx = ctx.history.length % FALLBACK_VARIANTS.length
  let text = FALLBACK_VARIANTS[fallbackIdx]

  if (ctx.brief) {
    text = `Berkaitan brief "${ctx.brief.title}", pertanyaan Anda layak didalami. Coba sebut aspek spesifik: ROI, risiko, tim, atau timeline?`
  } else {
    const guidance = getLearningGuidanceLines(2)
    if (guidance.length > 0 && /buat|rancang|gimana|bagaimana|apa|tolong|coba|cb/.test(q)) {
      text = `${text}\n\nSaya pakai memory kerja: ${guidance.join(' ')}`
    }
  }

  return { text, intent: 'fallback' }
}

export function generateRoleReply(
  role: Contributor,
  question: string,
  brief: Brief,
  history: ChatMessage[],
): string {
  const ctx: MockReplyContext = { userMessage: question, history, brief, speaker: role }
  const result = generateMockReply(ctx)

  const name = CONTRIBUTOR_META[role].name
  const rolePrefix: Partial<Record<string, string>> = {
    cfo: `Dari sudut finansial: `,
    cmo: `Dari sudut market dan akuisisi: `,
    coo: `Dari sudut operasional: `,
    cco: `Dari sudut creative dan brand: `,
    ceo: ``,
  }
  const prefix = rolePrefix[role] ?? ''

  if (prefix && !result.text.startsWith(prefix)) {
    return `${prefix}${result.text.charAt(0).toLowerCase()}${result.text.slice(1)}`
  }
  void name
  return result.text
}

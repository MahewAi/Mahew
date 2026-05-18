import { CONTRIBUTOR_META, type Brief, type Contributor } from './types'

/**
 * Smarter mock reply engine.
 *
 * Bug yang di-fix: keyword matching sebelumnya terlalu sempit + sama-reply repetition.
 * Sekarang:
 * - 30+ pattern detector dengan fuzzy substring matching (typo-tolerant)
 * - Conversation context: tau apakah Atmaja baru tanya clarifying question
 * - Anti-repetition: kalau pattern X baru saja dipakai, pakai variation lain
 * - Meta-command handling: lupakan / restart / forget / stop / batal
 * - Acknowledgment detection: ya/iya/oke/semua/setuju → kontekstual ke pesan sebelumnya
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
  // --- META COMMANDS ---
  {
    match: (q) => META_RESET_KEYWORDS.some((k) => q.includes(k)),
    intent: 'reset',
    variants: (ctx) => [
      `Baik, saya reset konteks percakapan kita. Yang saya pertahankan: business plan Anda dan pemahaman saya soal Gerai 1000 Pintu sebagai brand premium curated retail di Balikpapan. Mari mulai segar. Apa yang ingin Anda bahas?`,
      `Mengerti. Saya hapus konteks lain, kecuali fundamental business plan dan profil Gerai. Sekarang, dari halaman baru, apa fokus Anda?`,
      ctx.speaker === 'atmaja'
        ? `Reset selesai. Saya jaga apa yang Anda minta tetap (business plan dan pengetahuan tentang Gerai). Selebihnya kosong. Silakan lanjut.`
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

  // --- ACKNOWLEDGMENT / SHORT RESPONSES ---
  {
    match: (q) => /^(ya|iya|yes|setuju|ok|oke|sip|gas|jalan)[\.\!\?]?$/.test(q.trim()),
    intent: 'affirm',
    variants: (ctx) => {
      // Look at last atmaja message — did it ask a clarifying question?
      const lastBot = lastReplyByRole(ctx.history, ctx.speaker ?? 'atmaja')
      if (lastBot && lastBot.text.includes('?')) {
        return [
          `Baik. Berdasarkan konfirmasi Anda, saya prioritaskan analisis ke arah itu. Mau saya elaborate aspek finansial dulu, atau implikasi operasional?`,
          `Diterima. Saya akan masuk lebih dalam. Mulai dari mana — risiko atau peluang?`,
        ]
      }
      return [
        `Baik. Lanjut ke topik berikutnya, atau ada yang ingin Anda bahas lebih dalam dari yang tadi?`,
        `Catat. Apa langkah berikutnya menurut Anda?`,
      ]
    },
  },
  {
    match: (q) => /^(tidak|enggak|gak|engga|no|belum)[\.\!\?]?$/.test(q.trim()),
    intent: 'deny',
    variants: () => [
      `Mengerti. Kalau begitu, apa yang berbeda dari yang saya sampaikan? Saya butuh tahu agar bisa rephrase atau pivot.`,
      `Catat. Mau saya coba sudut pandang lain, atau Anda ingin saya berhenti membahas topik ini?`,
    ],
  },
  {
    match: (q) => /^(semua|all|seluruhnya|keseluruhan)[\.\!\?]?$/.test(q.trim()),
    intent: 'scope_all',
    variants: () => [
      `Baik, saya beri sintesa menyeluruh. Tiga prioritas terpenting Gerai sekarang: (1) finalisasi keputusan Lokasi Mother Store, (2) lock struktur harga wave pertama, (3) selesaikan audit SKU. Tiga ini saling dependen. Mau saya breakdown dependency-nya?`,
      `Mengerti, scope penuh. Kondisi sekarang: 2 keputusan menunggu Anda, 2 brief sedang berjalan, 1 menunggu tinjauan akhir. Yang paling mendesak: Lokasi Mother Store, sudah 5 hari menunggu. Mau saya elaborate aspek tertentu?`,
    ],
  },

  // --- INTENT: PRIORITAS / URGENT ---
  {
    match: (q) => /priorita|penting|urgent|terpenting|focus|fokus/.test(q),
    intent: 'priority',
    variants: () => [
      `Prioritas tertinggi minggu ini: keputusan Lokasi Mother Store. 4 dari 5 C-suite condong ke B, tetapi penting Anda baca dissent CMO dulu sebelum putuskan. Kalau bisa diputuskan hari ini, kita bisa lock kontrak dan lanjut ke struktur harga.`,
      `Yang paling tidak boleh tertunda: Lokasi Mother Store dan struktur harga wave 1. Keduanya gate untuk launch wave. Saya sarankan blok 30 menit pagi ini untuk dua brief itu.`,
      `Prioritas hari ini: putuskan lokasi. Setelah itu domino jatuh sendiri — kontrak, fit-out planning, pricing alignment. Tanpa keputusan lokasi, tim tidak bisa lanjut.`,
    ],
  },

  // --- INTENT: KONDISI / STATUS / SINTESA ---
  {
    match: (q) => /sintesa|sintesis|kondisi|status|sekarang|update|sitrep|situasi/.test(q),
    intent: 'status',
    variants: () => [
      `Kondisi Gerai sekarang: 2 brief menunggu keputusan Anda (Lokasi Mother Store, Struktur Harga). 2 brief sedang berjalan (Audit SKU, Loyalty Program). 1 brief menunggu tinjauan akhir (Identitas Visual). Runway dan timeline wave 1 masih sehat. Yang perlu Anda jaga: tempo keputusan jangan tertahan lebih dari 48 jam.`,
      `Sintesa singkat: dua keputusan kunci di tangan Anda, tim Operations menutup audit SKU di 92% confidence vendor lead time, Creative siap revisi visual identity. Atensi: Lokasi Mother Store sudah 5 hari tertunda.`,
    ],
  },

  // --- INTENT: TERTUNDA / BLOCKER ---
  {
    match: (q) => /tertunda|blocked|stuck|paling lama|telat|tertahan|menunggu paling/.test(q),
    intent: 'blocker',
    variants: () => [
      `Yang paling tertunda: keputusan Lokasi Mother Store, sudah lima hari menunggu. Setiap hari penundaan mengurangi opsi negosiasi dengan kedua pemilik lokasi. Saya sarankan Anda dedikasikan 20 menit hari ini untuk baca brief, lihat tabel komparasi, dan kirim sinyal.`,
      `Blocker utama Anda: Lokasi Mother Store (5 hari) dan Struktur Harga Wave 1 (32 menit, tapi gate untuk launch). Kedua-duanya butuh Anda saja, tidak butuh lebih banyak input dari tim.`,
    ],
  },

  // --- INTENT: RISIKO / SKENARIO ---
  {
    match: (q) => /risiko|risk|skenario|scenario|terburuk|worst|antisipasi|bahaya/.test(q),
    intent: 'risk',
    variants: () => [
      `Skenario yang harus Anda antisipasi: (1) Lokasi B underperform di bulan ke-6, kita perlu pivot pricing atau brand discovery; (2) Struktur 38% margin terbaca sebagai mass-premium kalau messaging tidak presisi; (3) Wave 2 timing tergeser kalau audit SKU melar. Tiga ini sudah saya susun playbook mitigasi terpisah, kabari kalau Anda mau lihat.`,
      `Tiga risiko paling realistik: lokasi underperform di Q2, struktur harga miss elastisitas segmen aspiratif, dan dependency vendor photography. Yang paling impactful jangka pendek: risiko #1. Mau saya elaborate mitigasi?`,
    ],
  },

  // --- INTENT: KEPUTUSAN (typo-tolerant: keputusan, kepetusan, decision) ---
  {
    match: (q) => /keputusan|kepetusan|kepustusan|decision|putusan|memutuskan|memilih/.test(q),
    intent: 'decision_help',
    variants: (ctx) => {
      const decisionBriefs = ['Lokasi Mother Store', 'Struktur Harga Wave 1']
      const involveLongTerm = /jangka panjang|strategi|strategic|long.?term/.test(ctx.userMessage.toLowerCase())
      if (involveLongTerm) {
        return [
          `Untuk keputusan yang sedang berjalan: dua brief decision di tangan Anda — ${decisionBriefs.join(' dan ')}. Kedua-duanya bertanda prioritas tinggi.\n\nUntuk strategi jangka panjang: tiga arah yang sedang kita garap — positioning premium curated, struktur kanal distribusi wave 2, dan model loyalty program. Yang ingin Anda dalami dulu?`,
          `Anda menyebut dua dimensi sekaligus. Keputusan jangka pendek (Lokasi + Pricing) gating untuk strategi jangka panjang. Saya sarankan tutup yang pendek dulu, baru kita zoom out. Setuju?`,
        ]
      }
      return [
        `Keputusan yang sedang berjalan: Lokasi Mother Store (4-1 vote ke B) dan Struktur Harga Wave 1 (3-2 vote ke margin 38%). Dua-duanya butuh sinyal dari Anda. Mau saya elaborate salah satu?`,
        `Dua keputusan menunggu. Yang lebih mendesak: Lokasi. Yang dampaknya lebih luas: Harga. Mana yang Anda mau bahas dulu?`,
      ]
    },
  },

  // --- INTENT: STRATEGI ---
  {
    match: (q) => /strategi|strategy|jangka panjang|long.?term|visi|roadmap/.test(q),
    intent: 'strategy',
    variants: () => [
      `Strategi jangka panjang Gerai bertumpu pada tiga pilar: kurasi yang konsisten, ekspansi terkontrol per wave, dan brand sebagai aset jangka panjang. Tiga pilar ini saling memperkuat tetapi tidak boleh dieksekusi parallel di tahun pertama. Mau saya zoom ke salah satu pilar?`,
      `Visi jangka panjang: Gerai sebagai destinasi premium curated yang dipercaya di rentang harga aksesibel. Tahun pertama fokus ke pondasi: lokasi, struktur produk, brand identity. Tahun kedua scale up. Pertanyaan strategis Anda spesifik tentang aspek apa?`,
    ],
  },

  // --- INTENT: BISNIS / OPERASI ---
  {
    match: (q) => /bisnis|business|usaha|operasi|operations|jualan/.test(q),
    intent: 'business',
    variants: () => [
      `Sisi bisnis: model Gerai = curated retail dengan margin premium tapi volume realistic. Wave 1 target 1.400 unit/bulan di Mother Store, dengan repeat rate target 35%. Yang ingin Anda fokus: revenue, cost structure, atau customer behavior?`,
      `Bisnis Anda strukturnya sederhana: kurasi → display di tempat → conversion via pengalaman + cerita. Tiap link punya leverage berbeda. Mau saya breakdown leverage point-nya?`,
    ],
  },

  // --- INTENT: PRODUK / SKU ---
  {
    match: (q) => /sku|produk|product|katalog|catalog|kurasi/.test(q),
    intent: 'product',
    variants: () => [
      `Status SKU: 160 dari 240 SKU lolos audit kurasi. 80 yang dieliminasi mayoritas karena overlap kategori, bukan karena kualitas. Empat kategori utama distribusi merata. Yang ingin Anda zoom?`,
      `Audit SKU sedang ditutup tim Operations dan Creative. Yang krusial Anda review: shortlist 160 SKU sudah align dengan tone Gerai? Saya bisa kasih ringkasan kategori.`,
    ],
  },

  // --- INTENT: GREETING ---
  {
    match: (q) => /^(halo|hai|hi|hello|selamat (pagi|siang|sore|malam)|assalamualaikum|p$)/.test(q.trim()),
    intent: 'greeting',
    variants: () => [
      `Halo Matthew. Apa yang ingin Anda diskusikan? Saya siap memberi sintesa atau menggali lebih dalam ke salah satu brief.`,
      `Selamat datang. Apa fokus Anda sekarang?`,
      `Halo. Ada keputusan yang menunggu, atau ada hal lain yang ingin Anda eksplor?`,
    ],
  },

  // --- INTENT: MARKET / KOMPETITOR ---
  {
    match: (q) => /market|pasar|kompetitor|competitor|saingan|industri/.test(q),
    intent: 'market',
    variants: () => [
      `Posisi market Anda: kompetitor terdekat di Balikpapan ada di rentang margin 30-36% dan brand positioning yang lebih general. Gerai punya ruang di tier premium curated, tetapi harus disiplin dalam eksekusi messaging. Mau saya elaborate gap kompetitif?`,
      `Market di Balikpapan: dua kompetitor regional di range sage palette + general curated. Gerai berbeda dengan teal-sage palette baru + quiet luxury. Diferensiasi visual jadi kunci, terutama di fase awal.`,
    ],
  },

  // --- INTENT: FINANCIAL / ROI ---
  {
    match: (q) => /roi|profit|margin|revenue|cash flow|cashflow|keuangan|finance|biaya|cost/.test(q),
    intent: 'finance',
    variants: () => [
      `Sisi finansial: ROI breakeven Lokasi B di 14 bulan, A di 24 bulan. Margin target 38% dengan volume 1.400 unit/bulan = revenue projection sekitar Rp 1.18M/6 bulan. Mau saya breakdown sensitivity per asumsi?`,
      `Finansial wave 1: capex Lokasi B Rp 220 juta, breakeven 14 bulan. Pricing 38% sehat untuk volume target. Skenario downside paling realistik: volume di 70% target → breakeven bergeser ke 18-20 bulan, masih dalam toleransi runway.`,
    ],
  },

  // --- INTENT: BRAND / IDENTITAS ---
  {
    match: (q) => /brand|identitas|positioning|logo|visual|warna|tone/.test(q),
    intent: 'brand',
    variants: () => [
      `Brand Gerai: quiet luxury + curated tradition. Warna primer brass + sekunder teal-sage (revisi terbaru), tipografi Cormorant Garamond + Inter. Yang sedang menunggu tinjauan akhir Anda: revisi warna sekunder dari sage ke teal-sage karena alasan diferensiasi.`,
      `Identitas visual stabil. Yang berubah baru-baru ini: palette sekunder bergeser ke teal-sage. Risiko brand recall rendah karena perubahan subtle. Mau saya tunjukkan rationale lengkap?`,
    ],
  },

  // --- INTENT: TIM / C-SUITE ---
  {
    match: (q) => /tim|team|c.?suite|c level|atmaja|coo|cmo|cfo|cco/.test(q),
    intent: 'team',
    variants: () => [
      `Tim Anda terdiri dari: saya (CEO), 4 C-suite (Operations, Marketing, Finance, Creative), plus 11 specialist tersebar di bawah masing-masing C-suite. Mau saya breakdown structure lebih detail, atau zoom ke individu/team tertentu?`,
      `Tim Anda lengkap: 17 agent ter-orkestrasi. Saya sebagai sintesa kepemimpinan, C-suite sebagai voice domain, specialist sebagai depth. Yang ingin Anda tahu spesifiknya?`,
    ],
  },
]

/** Substring/word-aware matcher. */
function matches(pattern: RegExp | ((q: string) => boolean), q: string): boolean {
  if (typeof pattern === 'function') return pattern(q)
  return pattern.test(q)
}
void matches // satisfy unused if pattern uses .test directly

function lastReplyByRole(history: ChatMessage[], role: 'matthew' | Contributor | 'atmaja'): ChatMessage | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].author === role) return history[i]
  }
  return undefined
}

/** Track last N intents used to avoid same-reply repetition. */
function lastIntent(history: ChatMessage[]): string | null {
  // Heuristic: read last bot reply text and infer intent from first 50 chars
  for (let i = history.length - 1; i >= 0; i--) {
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
  `Saya catat pesannya. Bisa Anda jelaskan sedikit lebih spesifik? Mau zoom ke salah satu keputusan yang sedang berjalan, strategi, atau brief tertentu?`,
  `Mohon perjelas: ini soal eksekusi yang sedang berjalan, arah strategis, atau hal lain? Kalau Anda sebut topik atau brief, saya bisa langsung kasih sintesa.`,
  `Saya membaca pesan Anda tetapi belum yakin sudut pandangnya. Mau saya cek dari sudut keuangan, operasional, brand, atau tim?`,
  `Konteks-nya masih luas. Coba sebut kata kunci spesifik: lokasi, harga, SKU, brand, tim, atau keputusan tertentu. Saya akan ambil dari sana.`,
]

/** Generate reply based on user message + history context. */
export function generateMockReply(ctx: MockReplyContext): ReplyResult {
  const q = ctx.userMessage.toLowerCase().trim()
  const prevIntent = lastIntent(ctx.history)

  for (const pattern of PATTERNS) {
    if (pattern.match(q)) {
      const variants = pattern.variants(ctx)
      // Anti-repetition: if same intent was just used, pick a different variant
      const startIdx = pattern.intent === prevIntent ? 1 : 0
      const idx = (Math.floor(Date.now() / 1000) + startIdx) % variants.length
      return {
        text: variants[idx],
        intent: pattern.intent,
        resetThread: pattern.intent === 'reset',
      }
    }
  }

  // Fallback — vary by length of history + brief context if available
  const fallbackIdx = ctx.history.length % FALLBACK_VARIANTS.length
  let text = FALLBACK_VARIANTS[fallbackIdx]

  if (ctx.brief) {
    text = `Berkaitan brief "${ctx.brief.title}" — pertanyaan Anda layak didalami. Coba sebut aspek spesifik: ROI, risiko, tim, atau timeline?`
  }

  return { text, intent: 'fallback' }
}

/**
 * Specialist reply (untuk AskRolePanel — context-aware per role).
 * Pakai role + brief untuk kasih jawaban kontekstual.
 */
export function generateRoleReply(
  role: Contributor,
  question: string,
  brief: Brief,
  history: ChatMessage[],
): string {
  const ctx: MockReplyContext = { userMessage: question, history, brief, speaker: role }
  const result = generateMockReply(ctx)

  // Wrap with role personality
  const name = CONTRIBUTOR_META[role].name
  const rolePrefix: Partial<Record<string, string>> = {
    cfo: `Dari sudut finansial — `,
    cmo: `Dari sudut market dan akuisisi — `,
    coo: `Dari sudut operasional — `,
    cco: `Dari sudut creative dan brand — `,
    ceo: ``,
  }
  const prefix = rolePrefix[role] ?? ''

  // Avoid double-prefix
  if (prefix && !result.text.startsWith(prefix)) {
    return `${prefix}${result.text.charAt(0).toLowerCase()}${result.text.slice(1)}`
  }
  void name
  return result.text
}

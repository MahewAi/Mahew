import type { Role } from '@/lib/types'

export interface CLevelPlan {
  role: Exclude<Role, 'ceo'>
  title: string
  mandate: string
  plannerMode: string
  planningCadence: string
  designing: string[]
  planningQuestions: string[]
  needsFromMatthew: string[]
  outputFormats: string[]
  status: 'ready' | 'draft' | 'needs-input'
}

export const cLevelPlans: CLevelPlan[] = [
  {
    role: 'coo',
    title: 'Operations blueprint',
    mandate: 'Merancang cara kerja internal, vendor, supply chain, dan fulfillment.',
    plannerMode: 'Mengubah strategi menjadi action plan yang punya owner, dependency, SOP, dan risk gate.',
    planningCadence: 'Weekly ops planning + daily blocker check',
    designing: [
      'SOP kerja internal dan ritme staffing',
      'Production vendor map',
      'Supplier vetting criteria',
      'Fulfillment flow dari order sampai serah barang',
    ],
    planningQuestions: [
      'Apa bottleneck yang membuat rencana tidak bisa dieksekusi minggu ini?',
      'Siapa owner yang benar-benar memegang next action?',
      'Vendor atau proses mana yang perlu fallback plan?',
    ],
    needsFromMatthew: ['Prioritas proses pertama', 'Batas toleransi lead time', 'Standar quality control'],
    outputFormats: ['flowchart', 'table', 'checklist'],
    status: 'ready',
  },
  {
    role: 'cmo',
    title: 'Market & brand growth system',
    mandate: 'Merancang positioning, riset market, funnel customer, dan channel akuisisi.',
    plannerMode: 'Mengubah insight market menjadi growth experiment yang bisa diuji dan dibaca hasilnya.',
    planningCadence: 'Weekly growth planning + monthly market review',
    designing: [
      'Positioning Gerai dan narrative utama',
      'Competitor landscape Balikpapan',
      'Customer funnel dan channel strategy',
      'Trend scouting untuk ide produk dan campaign',
    ],
    planningQuestions: [
      'Segmen mana yang paling layak dikejar sekarang?',
      'Channel apa yang paling cepat memberi signal?',
      'Apa pesan yang harus dikunci agar brand tidak terdengar generik?',
    ],
    needsFromMatthew: ['Target segmen awal', 'Batas tone brand', 'Channel yang ingin diuji dulu'],
    outputFormats: ['market map', 'chart', 'campaign grid'],
    status: 'ready',
  },
  {
    role: 'cfo',
    title: 'Business model control panel',
    mandate: 'Merancang model bisnis, pricing, budget, forecast, dan ROI discipline.',
    plannerMode: 'Mengubah ide menjadi capital plan yang jelas upside, downside, runway, dan batas rugi.',
    planningCadence: 'Weekly capital review + monthly scenario lock',
    designing: [
      'Revenue stream dan pricing baseline',
      'Forecast konservatif vs agresif',
      'Budget control dan cash runway',
      'ROI model untuk keputusan besar',
    ],
    planningQuestions: [
      'Asumsi angka mana yang paling lemah?',
      'Berapa batas rugi yang masih rasional untuk eksperimen ini?',
      'Keputusan apa yang harus ditolak kalau ROI tidak tembus guardrail?',
    ],
    needsFromMatthew: ['Modal awal', 'Target margin', 'Biaya tetap yang sudah diketahui'],
    outputFormats: ['projection chart', 'sensitivity table', 'scenario grid'],
    status: 'needs-input',
  },
  {
    role: 'cco',
    title: 'Creative documentation engine',
    mandate: 'Merancang dokumen bisnis, editorial system, brand voice, dan source research.',
    plannerMode: 'Mengubah keputusan menjadi dokumen dan visual brief yang bisa dipakai ulang oleh tim.',
    planningCadence: 'Weekly documentation planning + source audit',
    designing: [
      'Business plan document structure',
      'Internal memo format',
      'Brand voice consistency system',
      'Research source log dan fact-checking workflow',
    ],
    planningQuestions: [
      'Output apa yang harus jadi dokumen permanen?',
      'Source mana yang perlu dibuktikan sebelum dipakai?',
      'Bagian mana yang harus divisualkan agar mudah diputuskan?',
    ],
    needsFromMatthew: ['Urutan dokumen prioritas', 'Contoh tone yang disukai', 'Format output final'],
    outputFormats: ['memo', 'document', 'source table'],
    status: 'draft',
  },
]

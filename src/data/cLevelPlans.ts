import type { Role } from '@/lib/types'

export interface CLevelPlan {
  role: Exclude<Role, 'ceo'>
  title: string
  mandate: string
  designing: string[]
  needsFromMatthew: string[]
  outputFormats: string[]
  status: 'ready' | 'draft' | 'needs-input'
}

export const cLevelPlans: CLevelPlan[] = [
  {
    role: 'coo',
    title: 'Operations blueprint',
    mandate: 'Merancang cara kerja internal, vendor, supply chain, dan fulfillment.',
    designing: [
      'SOP kerja internal dan ritme staffing',
      'Production vendor map',
      'Supplier vetting criteria',
      'Fulfillment flow dari order sampai serah barang',
    ],
    needsFromMatthew: ['Prioritas proses pertama', 'Batas toleransi lead time', 'Standar quality control'],
    outputFormats: ['flowchart', 'table', 'checklist'],
    status: 'ready',
  },
  {
    role: 'cmo',
    title: 'Market & brand growth system',
    mandate: 'Merancang positioning, riset market, funnel customer, dan channel akuisisi.',
    designing: [
      'Positioning Gerai dan narrative utama',
      'Competitor landscape Balikpapan',
      'Customer funnel dan channel strategy',
      'Trend scouting untuk ide produk dan campaign',
    ],
    needsFromMatthew: ['Target segmen awal', 'Batas tone brand', 'Channel yang ingin diuji dulu'],
    outputFormats: ['market map', 'chart', 'campaign grid'],
    status: 'ready',
  },
  {
    role: 'cfo',
    title: 'Business model control panel',
    mandate: 'Merancang model bisnis, pricing, budget, forecast, dan ROI discipline.',
    designing: [
      'Revenue stream dan pricing baseline',
      'Forecast konservatif vs agresif',
      'Budget control dan cash runway',
      'ROI model untuk keputusan besar',
    ],
    needsFromMatthew: ['Modal awal', 'Target margin', 'Biaya tetap yang sudah diketahui'],
    outputFormats: ['projection chart', 'sensitivity table', 'scenario grid'],
    status: 'needs-input',
  },
  {
    role: 'cco',
    title: 'Creative documentation engine',
    mandate: 'Merancang dokumen bisnis, editorial system, brand voice, dan source research.',
    designing: [
      'Business plan document structure',
      'Internal memo format',
      'Brand voice consistency system',
      'Research source log dan fact-checking workflow',
    ],
    needsFromMatthew: ['Urutan dokumen prioritas', 'Contoh tone yang disukai', 'Format output final'],
    outputFormats: ['memo', 'document', 'source table'],
    status: 'draft',
  },
]

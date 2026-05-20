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
  workMap: CLevelWorkMap
  timeline: CLevelTimelineItem[]
  visualPanels: CLevelVisualPanel[]
  dataSignals: CLevelDataSignal[]
  latestOutputs: CLevelOutputItem[]
  status: 'ready' | 'draft' | 'needs-input'
}

export interface CLevelTimelineItem {
  phase: string
  window: string
  progress: number
  owner: string
  output: string
}

export interface CLevelVisualPanel {
  title: string
  type: 'map' | 'image' | 'chart' | 'grid'
  description: string
  nodes: string[]
}

export interface CLevelWorkMap {
  title: string
  summary: string
  lanes: CLevelWorkLane[]
  decisionGate: string
}

export interface CLevelWorkLane {
  label: string
  owner: string
  input: string
  action: string
  output: string
  dependency: string
}

export interface CLevelDataSignal {
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
  note: string
}

export interface CLevelOutputItem {
  title: string
  format: string
  status: 'ready' | 'draft' | 'needs-input'
  summary: string
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
    outputFormats: ['operating map', 'flowchart', 'vendor matrix', 'risk checklist'],
    workMap: {
      title: 'COO operating work map',
      summary: 'COO mengubah case menjadi peta operasi: scope, SOP, vendor, fulfillment, blocker, dan gate feasibility.',
      decisionGate: 'Matthew memilih proses mana yang masuk eksekusi, proses mana yang perlu redesign, dan vendor mana yang boleh diuji.',
      lanes: [
        {
          label: 'Operating scope',
          owner: 'COO',
          input: 'Tujuan case dan batas deadline',
          action: 'Memecah pekerjaan menjadi SOP, owner, dan dependency',
          output: 'Operating architecture',
          dependency: 'Prioritas proses dari Matthew',
        },
        {
          label: 'Vendor and production',
          owner: 'Production Planner',
          input: 'Daftar supplier, lead time, dan capacity',
          action: 'Membuat vendor readiness matrix dan fallback plan',
          output: 'Vendor map',
          dependency: 'Supplier list aktual',
        },
        {
          label: 'Fulfillment flow',
          owner: 'HR and Systems',
          input: 'Order path, QC rule, dan handover standard',
          action: 'Menggambar flow order sampai customer handover',
          output: 'Order-to-handover flow',
          dependency: 'Standar quality control',
        },
        {
          label: 'Blocker gate',
          owner: 'COO',
          input: 'Risk, missing owner, dan bottleneck',
          action: 'Menentukan stop rule dan next action owner',
          output: 'Ops risk map',
          dependency: 'Toleransi risiko Matthew',
        },
      ],
    },
    timeline: [
      { phase: 'Map SOP inti', window: 'Minggu ini', progress: 72, owner: 'HR & Systems', output: 'SOP backlog + owner' },
      { phase: 'Vendor readiness', window: '7 hari', progress: 58, owner: 'Production', output: 'Vendor matrix' },
      { phase: 'Fulfillment flow', window: '14 hari', progress: 46, owner: 'COO', output: 'Order-to-handover map' },
    ],
    visualPanels: [
      {
        title: 'Operating flow',
        type: 'map',
        description: 'Denah kerja dari order, vendor, QC, fulfillment, sampai serah barang.',
        nodes: ['Order masuk', 'Vendor confirm', 'QC gate', 'Fulfillment', 'Customer handover'],
      },
      {
        title: 'Vendor board',
        type: 'grid',
        description: 'Grid kesiapan vendor dan fallback plan.',
        nodes: ['Lead time', 'Quality', 'Capacity', 'Risk', 'Fallback'],
      },
    ],
    dataSignals: [
      { label: 'SOP readiness', value: '72%', confidence: 'medium', note: 'Sudah ada struktur, belum semua punya owner.' },
      { label: 'Vendor visibility', value: '58%', confidence: 'medium', note: 'Butuh data supplier aktual dan lead time.' },
      { label: 'Fulfillment risk', value: 'high', confidence: 'low', note: 'Belum ada test order flow.' },
    ],
    latestOutputs: [
      { title: 'Ops architecture map', format: 'flowchart', status: 'draft', summary: 'Alur operasi awal untuk Mother Store.' },
      { title: 'Vendor readiness table', format: 'table', status: 'needs-input', summary: 'Perlu supplier list dari Matthew.' },
    ],
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
    outputFormats: ['market map', 'positioning map', 'funnel map', 'campaign grid'],
    workMap: {
      title: 'CMO growth work map',
      summary: 'CMO mengubah case menjadi peta market: segment, positioning, channel, funnel, campaign, dan proof signal.',
      decisionGate: 'Matthew memilih segmen utama, channel test pertama, dan batas pesan brand yang tidak boleh dilanggar.',
      lanes: [
        {
          label: 'Segment thesis',
          owner: 'Market Researcher',
          input: 'Target customer dan konteks market',
          action: 'Membuat segment map dan competitor contrast',
          output: 'Market landscape',
          dependency: 'Segmen awal yang ingin diuji',
        },
        {
          label: 'Positioning lock',
          owner: 'Brand Strategist',
          input: 'Brand canon dan batas tone',
          action: 'Menyusun message hierarchy dan proof points',
          output: 'Positioning map',
          dependency: 'Tone yang Matthew setujui',
        },
        {
          label: 'Channel sprint',
          owner: 'Sales Strategist',
          input: 'Budget, channel, dan conversion goal',
          action: 'Menggambar funnel dari awareness sampai inquiry',
          output: 'Funnel map',
          dependency: 'Channel prioritas',
        },
        {
          label: 'Innovation signal',
          owner: 'Innovation Scout',
          input: 'Trend dan contoh campaign luar',
          action: 'Menandai ide yang layak diuji dan yang harus ditolak',
          output: 'Campaign experiment grid',
          dependency: 'Batas eksperimen brand',
        },
      ],
    },
    timeline: [
      { phase: 'Competitor radar', window: 'Minggu ini', progress: 64, owner: 'Market Researcher', output: 'Competitor landscape' },
      { phase: 'Positioning lock', window: '7 hari', progress: 78, owner: 'Brand Strategist', output: 'Message hierarchy' },
      { phase: 'Channel sprint', window: '14 hari', progress: 42, owner: 'Sales Strategist', output: 'Experiment grid' },
    ],
    visualPanels: [
      {
        title: 'Market map',
        type: 'chart',
        description: 'Peta posisi Gerai 1000 Pintu terhadap opsi marketplace, toko fisik, dan B2B grosir.',
        nodes: ['Premium curated', 'Flat catalog', 'Marketplace', 'B2B grosir', 'Architect segment'],
      },
      {
        title: 'Campaign board',
        type: 'image',
        description: 'Moodboard arah campaign dan contoh visual positioning.',
        nodes: ['Hero product', 'Consultative tone', 'Material detail', 'Trust signal', 'Local proof'],
      },
    ],
    dataSignals: [
      { label: 'Research engine', value: 'Tavily on', confidence: 'high', note: 'Search layer sudah aktif server-side.' },
      { label: 'Competitor coverage', value: '64%', confidence: 'medium', note: 'Butuh source list tetap dan scan berkala.' },
      { label: 'Brand clarity', value: '78%', confidence: 'high', note: 'Canon kuat, execution campaign belum diuji.' },
    ],
    latestOutputs: [
      { title: 'Market signal board', format: 'table + source log', status: 'draft', summary: 'Basis competitor radar awal.' },
      { title: 'Growth architecture', format: 'map', status: 'ready', summary: 'Hubungan segment, channel, message, dan conversion.' },
    ],
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
    outputFormats: ['capital map', 'projection chart', 'sensitivity table', 'scenario grid'],
    workMap: {
      title: 'CFO capital work map',
      summary: 'CFO mengubah case menjadi peta uang: assumption, pricing, margin, runway, ROI, dan stop rule.',
      decisionGate: 'Matthew memilih budget boleh dibuka, perlu data tambahan, atau harus ditahan karena guardrail tidak tembus.',
      lanes: [
        {
          label: 'Assumption ledger',
          owner: 'Financial Analyst',
          input: 'COGS, fixed cost, target revenue',
          action: 'Memisahkan angka diketahui, asumsi, dan angka kosong',
          output: 'Assumption map',
          dependency: 'Baseline biaya aktual',
        },
        {
          label: 'Revenue model',
          owner: 'Business Designer',
          input: 'Produk, pricing, volume, dan margin target',
          action: 'Menggambar revenue stream dan margin driver',
          output: 'Business model map',
          dependency: 'Target margin Matthew',
        },
        {
          label: 'Scenario control',
          owner: 'CFO',
          input: 'Konservatif, base, agresif, worst case',
          action: 'Membuat scenario grid dan sensitivity table',
          output: 'Scenario grid',
          dependency: 'Range penjualan realistis',
        },
        {
          label: 'Budget gate',
          owner: 'CFO',
          input: 'Upside, downside, runway impact',
          action: 'Menentukan approve, revise, atau hold',
          output: 'Capital decision gate',
          dependency: 'Batas rugi yang Matthew terima',
        },
      ],
    },
    timeline: [
      { phase: 'Assumption lock', window: 'Minggu ini', progress: 38, owner: 'Financial Analyst', output: 'Assumption ledger' },
      { phase: 'Pricing guardrail', window: '7 hari', progress: 52, owner: 'CFO', output: 'Margin threshold' },
      { phase: 'ROI scenario', window: '14 hari', progress: 44, owner: 'Business Designer', output: 'Scenario grid' },
    ],
    visualPanels: [
      {
        title: 'Capital control',
        type: 'chart',
        description: 'Visual runway, margin, ROI, dan budget gate untuk keputusan besar.',
        nodes: ['Revenue stream', 'Margin', 'Capex', 'Runway', 'ROI gate'],
      },
      {
        title: 'Scenario grid',
        type: 'grid',
        description: 'Konservatif, base, agresif, dan worst-case.',
        nodes: ['Conservative', 'Base', 'Aggressive', 'Worst case', 'Stop rule'],
      },
    ],
    dataSignals: [
      { label: 'Assumption quality', value: '38%', confidence: 'low', note: 'Modal, COGS, dan fixed cost belum lengkap.' },
      { label: 'Pricing clarity', value: '52%', confidence: 'medium', note: 'Butuh benchmark harga dan margin vendor.' },
      { label: 'ROI readiness', value: '44%', confidence: 'low', note: 'Belum cukup untuk keputusan investasi besar.' },
    ],
    latestOutputs: [
      { title: 'ROI guardrail', format: 'scenario table', status: 'needs-input', summary: 'Menunggu angka modal dan biaya tetap.' },
      { title: 'Business model map', format: 'grid', status: 'draft', summary: 'Revenue stream dan cost driver awal.' },
    ],
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
    outputFormats: ['document map', 'source table', 'visual brief', 'decision memo'],
    workMap: {
      title: 'CCO narrative work map',
      summary: 'CCO mengubah case menjadi peta komunikasi: memo, source log, narrative, visual brief, dan archive.',
      decisionGate: 'Matthew memilih format final, source yang boleh dipakai, dan apakah output sudah layak dibagikan.',
      lanes: [
        {
          label: 'Decision memo',
          owner: 'Document Architect',
          input: 'Keputusan yang perlu dijelaskan',
          action: 'Menyusun memo dengan konteks, opsi, risiko, dan next action',
          output: 'Decision memo',
          dependency: 'Keputusan final dari Matthew',
        },
        {
          label: 'Source proof',
          owner: 'Web Researcher',
          input: 'Claim, data, dan sumber yang perlu dipercaya',
          action: 'Membuat source log dan confidence note',
          output: 'Evidence table',
          dependency: 'Source yang bisa diverifikasi',
        },
        {
          label: 'Narrative design',
          owner: 'Editorial Reviewer',
          input: 'Audience, tone, dan brand boundary',
          action: 'Mengunci bahasa, struktur cerita, dan forbidden language',
          output: 'Narrative map',
          dependency: 'Contoh tone yang Matthew suka',
        },
        {
          label: 'Visual brief',
          owner: 'CCO',
          input: 'Insight, table, chart, dan diagram',
          action: 'Membungkus output menjadi visual brief yang bisa dibaca ulang',
          output: 'Visual brief deck',
          dependency: 'Format output final',
        },
      ],
    },
    timeline: [
      { phase: 'Document architecture', window: 'Minggu ini', progress: 70, owner: 'Document Writer', output: 'Business plan outline' },
      { phase: 'Source audit', window: '7 hari', progress: 62, owner: 'Web Researcher', output: 'Evidence log' },
      { phase: 'Visual brief system', window: '14 hari', progress: 74, owner: 'CCO', output: 'Brief template pack' },
    ],
    visualPanels: [
      {
        title: 'Document map',
        type: 'map',
        description: 'Arsitektur dokumen dari memo, business plan, source log, sampai visual brief.',
        nodes: ['Decision memo', 'Business plan', 'Source log', 'Visual brief', 'Archive'],
      },
      {
        title: 'Visual brief deck',
        type: 'image',
        description: 'Kerangka output visual yang bisa dibaca cepat oleh Matthew.',
        nodes: ['Hero insight', 'Table', 'Chart', 'Diagram', 'Decision gate'],
      },
    ],
    dataSignals: [
      { label: 'Document system', value: '70%', confidence: 'medium', note: 'Struktur ada, prioritas dokumen perlu dikunci.' },
      { label: 'Source quality', value: '62%', confidence: 'medium', note: 'Tavily aktif, evidence vault belum otomatis.' },
      { label: 'Visual readiness', value: '74%', confidence: 'high', note: 'Renderer kaya sudah ada di app.' },
    ],
    latestOutputs: [
      { title: 'Memo pack', format: 'document', status: 'draft', summary: 'Format memo internal untuk keputusan.' },
      { title: 'Source log', format: 'table', status: 'draft', summary: 'Template sumber untuk Web Researcher.' },
    ],
    status: 'draft',
  },
]

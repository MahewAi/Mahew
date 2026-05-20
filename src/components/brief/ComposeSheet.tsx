import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Send, X } from 'lucide-react'
import {
  CONTRIBUTOR_META,
  DEPARTMENT_ORDER,
  DEPARTMENT_LABEL,
  getContributorColorRole,
  type Brief,
  type BriefBlock,
  type Role,
} from '@/lib/types'
import { cLevelPlans, type CLevelPlan } from '@/data/cLevelPlans'
import { createAgentOutputEnvelope } from '@/lib/agentContracts'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'

interface ComposeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (brief: Brief) => void
}

const categories = ['Strategi', 'Pricing', 'Operasi', 'Marketing', 'Branding'] as const

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

export function ComposeSheet({ open, onOpenChange, onSubmit }: ComposeSheetProps) {
  const toast = useToast()
  const reduceMotion = useReducedMotion()

  const [target, setTarget] = useState<Role>('ceo')
  const [category, setCategory] = useState<string>('Strategi')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  const reset = () => {
    setTarget('ceo')
    setCategory('Strategi')
    setTitle('')
    setTopic('')
  }

  const handleSubmit = () => {
    if (!title.trim() || !topic.trim()) {
      toast.show('Isi judul dan deskripsi dulu.', { variant: 'error' })
      return
    }

    const id = `brief-req-${Date.now()}`
    const brief: Brief = {
      id,
      status: 'doing',
      priority: 'normal',
      title: title.trim(),
      description: topic.trim(),
      summary: `Sedang dianalisis oleh ${CONTRIBUTOR_META[target].name}.`,
      labels: [category],
      contributors: [target],
      timeAgo: 'Baru saja',
      timestamp: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      requestStatus: 'pending',
      csuiteInput: [
        {
          role: target,
          name: CONTRIBUTOR_META[target].name,
          subtitle: 'Sedang mempelajari',
          bullets: ['Mengumpulkan konteks...', 'Menyusun analisis awal...'],
        },
      ],
    }
    onSubmit(brief)
    toast.show(`Brief dikirim ke ${CONTRIBUTOR_META[target].name}. Analisis sedang berjalan.`, {
      variant: 'success',
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-sheet bg-text-primary/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'fixed left-0 right-0 bottom-0 z-sheet',
                  'mx-auto w-full md:max-w-xl',
                  'glass-strong rounded-t-[24px] shadow-glass-hero',
                  'flex flex-col',
                  'max-h-[88vh]',
                )}
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
                  <Dialog.Title className="text-page-title text-text-primary">Brief baru</Dialog.Title>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Tutup"
                    className="size-9 rounded-full glass-soft inline-flex items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-5">
                  {/* Target role */}
                  <div>
                    <label className="text-label-caps text-text-muted block mb-2">
                      Kirim ke
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {DEPARTMENT_ORDER.map((r) => {
                        const isActive = target === r
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setTarget(r)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] text-left transition-all duration-fast',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                              isActive
                                ? 'glass-strong shadow-glass ring-1 ring-accent/40'
                                : 'glass-soft hover:bg-white/60',
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                'inline-flex items-center justify-center rounded-full size-8 font-semibold shrink-0',
                                roleBg[getContributorColorRole(r)],
                                getContributorColorRole(r) === 'cfo' ? 'text-text-primary' : 'text-white',
                                'text-sm',
                              )}
                            >
                              {CONTRIBUTOR_META[r].initials}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-text-primary leading-tight">
                                {CONTRIBUTOR_META[r].name}
                              </p>
                              <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                                {DEPARTMENT_LABEL[r] === CONTRIBUTOR_META[r].name ? r.toUpperCase() : DEPARTMENT_LABEL[r]}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-label-caps text-text-muted block mb-2">Kategori</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {categories.map((c) => {
                        const isActive = category === c
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategory(c)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-fast',
                              isActive
                                ? 'bg-accent text-white shadow-glow-accent'
                                : 'glass-soft text-text-secondary hover:text-text-primary',
                            )}
                          >
                            {c}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label htmlFor="compose-title" className="text-label-caps text-text-muted block mb-2">
                      Judul brief
                    </label>
                    <input
                      id="compose-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Mis. Analisis kanal distribusi wave 2"
                      className={cn(
                        'w-full px-3.5 py-3 rounded-[12px]',
                        'glass-soft text-[15px] font-medium text-text-primary placeholder:text-text-faint',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      )}
                    />
                  </div>

                  {/* Topic */}
                  <div>
                    <label htmlFor="compose-topic" className="text-label-caps text-text-muted block mb-2">
                      Pertanyaan / konteks
                    </label>
                    <textarea
                      id="compose-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Jelaskan apa yang perlu Anda dapatkan dari mereka. Konteks yang relevan: tujuan, kendala, deadline."
                      rows={5}
                      className={cn(
                        'w-full px-3.5 py-3 rounded-[12px] resize-none',
                        'glass-soft text-sm text-text-primary placeholder:text-text-faint leading-relaxed',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      )}
                    />
                  </div>
                </div>

                <div className="shrink-0 border-t border-white/40 bg-white/50 backdrop-blur-md px-5 py-3 pb-safe-bottom">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className={cn(
                      'w-full min-h-touch rounded-md bg-accent hover:bg-accent-dark text-white',
                      'inline-flex items-center justify-center gap-2 px-4 py-3',
                      'text-sm font-medium shadow-glow-accent',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      'transition-colors duration-fast',
                    )}
                  >
                    <Send className="size-4" />
                    Kirim ke {CONTRIBUTOR_META[target].name}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Helper: simulate AI completion of a pending brief (mock). Returns updated brief. */
export function simulateAiResponse(brief: Brief): Brief {
  const targetRole = getContributorColorRole(brief.contributors[0] ?? 'ceo')
  const targetName = CONTRIBUTOR_META[targetRole].name
  const blocks = buildVisualBlocks(brief, targetRole, targetName)
  const envelope = createAgentOutputEnvelope({
    briefId: brief.id,
    sourceRole: targetRole,
    summary: `${targetName} membuat planning brief: objective, opsi, risiko, decision gate, dan next action sudah dipetakan. Matthew tinggal memilih lanjut, revisi data, atau tahan.`,
    blocks,
  })

  return {
    ...brief,
    status: 'review',
    requestStatus: 'completed',
    summary: envelope.summary,
    timeAgo: 'Baru saja',
    blocks: envelope.blocks,
    csuiteInput: [
      {
        role: targetRole,
        name: targetName,
        subtitle: `Planning output ${targetName}`,
        bullets: [
          'Objective, current state, opsi, risiko, dan decision gate sudah dipisahkan.',
          'Output utama membawa work map, table, diagram, dan visual draft agar rencana mudah dibandingkan.',
          'Matthew perlu memilih lanjut, revisi data, atau tahan sebelum masuk eksekusi.',
        ],
      },
    ],
  }
}

function buildVisualBlocks(brief: Brief, targetRole: Role, targetName: string): BriefBlock[] {
  const plan = targetRole === 'ceo' ? null : cLevelPlans.find((item) => item.role === targetRole) ?? null
  const visualWorkRows = getVisualWorkRows(plan)
  const visualMapTitle = plan?.workMap.title ?? 'Atmaja council work map'

  return [
    {
      type: 'callout',
      variant: 'info',
      title: 'Planning status',
      content: `Brief **${brief.title}** sudah dipetakan sebagai planning brief. Fokusnya bukan jawaban panjang, tapi rencana yang bisa diputuskan.`,
    },
    {
      type: 'markdown',
      content: `## Executive planning frame\n\n${targetName} membaca brief ini sebagai pekerjaan planning. Output wajibnya: **objective**, **current state**, **visual work map**, **2 opsi tindakan**, **risiko**, **decision needed**, dan **next action**. Kalau data belum cukup, agent wajib push-back dan meminta input spesifik.`,
    },
    {
      type: 'table',
      headers: ['Visual Lane', 'Owner', 'Input', 'Output'],
      rows: visualWorkRows,
      caption: `${visualMapTitle}: rancangan kerja visual yang wajib muncul sebelum detail panjang.`,
    },
    {
      type: 'table',
      headers: ['Planning Layer', 'Yang Diputuskan', 'Output'],
      rows: [
        ['Objective', 'Apa hasil bisnis yang dikejar', '1 kalimat target'],
        ['Current state', 'Apa yang sudah diketahui dan belum diketahui', 'Assumption log'],
        ['Options', 'Lanjut cepat atau tahan untuk data', 'Plan A / Plan B'],
        ['Risk gate', 'Risiko yang bisa membuat rencana batal', 'Red flag list'],
        ['Decision', 'Pilihan yang Matthew perlu ambil', 'Approve / revise / hold'],
      ],
      caption: 'Struktur wajib untuk setiap planning brief Atmaja dan C-level.',
    },
    {
      type: 'grid',
      columns: 2,
      items: [
        { title: 'Plan A: Fast track', content: 'Gunakan data sekarang, jalankan eksperimen kecil, baca signal cepat.', accent: '#3D6F58' },
        { title: 'Plan B: Validate first', content: 'Tahan eksekusi sampai angka, source, atau constraint utama lengkap.', accent: '#3F5F8C' },
        { title: 'Kill criteria', content: 'Rencana batal kalau asumsi inti tidak bisa dibuktikan atau ROI turun di bawah guardrail.', accent: '#C25541' },
        { title: 'Decision gate', content: 'Matthew pilih: approve, revise data, delegate ke C-level, atau hold.', accent: '#85547A' },
      ],
    },
    {
      type: 'chart',
      kind: 'bar',
      caption: 'Skor planning readiness. Angka preview ini menunjukkan cara app membaca kesiapan rencana.',
      data: {
        points: [
          { label: 'Clarity', score: 84 },
          { label: 'Impact', score: 82 },
          { label: 'Evidence', score: 58 },
          { label: 'Execution', score: 72 },
          { label: 'Risk', score: 64 },
        ],
        series: [{ key: 'score', label: 'Score', color: 'hsl(33, 36%, 57%)' }],
      },
    },
    {
      type: 'mermaid',
      caption: `${targetName} work map dari case sampai decision gate.`,
      code: buildRoleWorkMapMermaid(plan, targetName),
    },
    {
      type: 'grid',
      columns: 2,
      items: [
        { title: 'Objective', content: 'Tujuan bisnis dalam 1 kalimat, bukan pembahasan kabur.', accent: '#C25541' },
        { title: 'Owner', content: 'Siapa yang pegang next action dan kapan harus selesai.', accent: '#3F5F8C' },
        { title: 'Evidence', content: 'Data atau source yang perlu dipercaya sebelum eksekusi.', accent: '#85547A' },
        { title: 'Decision', content: 'Approve, revise, delegate, atau hold.', accent: '#3D6F58' },
      ],
    },
    {
      type: 'generated-image',
      title: 'Generated work map draft',
      prompt: `Premium planning visual untuk "${brief.title}". Tampilkan ${visualMapTitle}, lane kerja, dependency, output artifact, dan decision gate dalam gaya Gerai 1000 Pintu yang bersih dan editorial.`,
      src: buildGeneratedImage(brief.title, targetName),
      alt: `Generated visual draft untuk ${brief.title}`,
      caption: 'Hasil image generator bisa masuk sebagai URL, data image, atau asset CDN dari backend agent.',
      status: 'completed',
      provider: 'Gerai image generator',
      generatedAt: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      aspectRatio: '16:9',
    },
    {
      type: 'csuite-vote',
      votes: [
        {
          role: 'ceo',
          recommendation: 'A',
          reasoning: `Atmaja melihat planning frame ${targetName} cukup jelas untuk masuk decision gate Matthew.`,
        },
        {
          role: 'coo',
          recommendation: targetRole === 'coo' ? 'A' : 'Review',
          reasoning: 'Cek implikasi operasional: owner, timeline, SOP, dan dependency vendor/internal.',
        },
        {
          role: 'cmo',
          recommendation: targetRole === 'cmo' ? 'A' : 'Review',
          reasoning: 'Pastikan keputusan tidak mengaburkan positioning, channel, dan customer narrative.',
        },
        {
          role: 'cfo',
          recommendation: targetRole === 'cfo' ? 'A' : 'Review',
          reasoning: 'Butuh angka baseline: cost, upside, downside, dan runway impact.',
        },
        {
          role: 'cco',
          recommendation: targetRole === 'cco' ? 'A' : 'Review',
          reasoning: 'Output final perlu dikunci dalam memo agar bisa dibaca ulang dan tidak hilang di chat.',
        },
      ],
    },
  ]
}

function getVisualWorkRows(plan: CLevelPlan | null): string[][] {
  if (!plan) {
    return [
      ['Framing', 'Atmaja', 'Brief Matthew', 'Master planning frame'],
      ['COO lane', 'COO', 'Feasibility, SOP, vendor', 'Ops roadmap'],
      ['CMO lane', 'CMO', 'Segment, positioning, channel', 'Growth map'],
      ['CFO lane', 'CFO', 'Cost, margin, ROI', 'Scenario table'],
      ['CCO lane', 'CCO', 'Evidence, memo, narrative', 'Visual brief'],
    ]
  }

  return plan.workMap.lanes.map((lane) => [lane.label, lane.owner, lane.input, lane.output])
}

function buildRoleWorkMapMermaid(plan: CLevelPlan | null, targetName: string): string {
  if (!plan) {
    return `flowchart TD
  A["Matthew case"] --> B["Atmaja framing"]
  B --> C1["COO ops map"]
  B --> C2["CMO growth map"]
  B --> C3["CFO capital map"]
  B --> C4["CCO narrative map"]
  C1 --> D["Master decision brief"]
  C2 --> D
  C3 --> D
  C4 --> D
  D --> E{"Decision gate"}
  E -->|Approve| F["Execution queue"]
  E -->|Revise| G["Ask precise data"]
  E -->|Hold| H["Archive assumption"]`
  }

  const laneLines = plan.workMap.lanes
    .map((lane, index) => {
      const laneId = `L${index + 1}`
      const outputId = `O${index + 1}`
      return `  B --> ${laneId}["${escapeMermaidLabel(lane.label)}"]\n  ${laneId} --> ${outputId}["${escapeMermaidLabel(lane.output)}"]`
    })
    .join('\n')
  const outputJoins = plan.workMap.lanes.map((_, index) => `  O${index + 1} --> G`).join('\n')

  return `flowchart TD
  A["Matthew case"] --> B["${escapeMermaidLabel(targetName)} visual framing"]
${laneLines}
${outputJoins}
  G{"Decision gate Matthew"}
  G -->|Approve| H["Execution queue"]
  G -->|Revise| I["Ask missing data"]
  G -->|Hold| J["Park risk"]`
}

function escapeMermaidLabel(value: string) {
  return value.replace(/["[\]{}|]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildGeneratedImage(title: string, owner: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FAF8F4"/>
      <stop offset="1" stop-color="#EDDFC8"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1F1A14"/>
      <stop offset="1" stop-color="#3D342B"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1F1A14" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="1200" height="720" fill="url(#paper)"/>
  <path d="M0 560 C180 500 310 610 470 550 C650 482 760 408 940 472 C1064 516 1128 466 1200 420 L1200 720 L0 720 Z" fill="#FFFFFF" opacity="0.5"/>
  <g filter="url(#softShadow)">
    <rect x="74" y="68" width="1052" height="584" rx="32" fill="#FFFFFF" stroke="#E8DED0"/>
  </g>
  <text x="116" y="136" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="4" fill="#8A6B43">AI GENERATED VISUAL</text>
  <text x="116" y="198" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="850" fill="url(#ink)">${escapeSvg(title).slice(0, 42)}</text>
  <text x="116" y="246" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="650" fill="#6B6253">${escapeSvg(owner)} planning surface</text>
  <g transform="translate(116 318)">
    <rect width="250" height="178" rx="22" fill="#F4EBDC"/>
    <rect x="24" y="28" width="202" height="16" rx="8" fill="#B8956B"/>
    <rect x="24" y="64" width="148" height="12" rx="6" fill="#8A6B43" opacity="0.45"/>
    <rect x="24" y="94" width="178" height="12" rx="6" fill="#8A6B43" opacity="0.25"/>
    <text x="24" y="142" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="850" fill="#8A6B43">BRIEF</text>

    <rect x="320" width="250" height="178" rx="22" fill="#EDF3F6"/>
    <circle cx="382" cy="68" r="32" fill="#3F5F8C" opacity="0.18"/>
    <circle cx="448" cy="92" r="42" fill="#3F5F8C" opacity="0.26"/>
    <circle cx="506" cy="62" r="24" fill="#3F5F8C" opacity="0.32"/>
    <text x="344" y="142" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="850" fill="#3F5F8C">C-LEVEL</text>

    <rect x="640" width="250" height="178" rx="22" fill="#F7EDF2"/>
    <path d="M678 126 L724 72 L770 110 L820 48 L852 86" fill="none" stroke="#85547A" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="664" y="142" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="850" fill="#85547A">OUTPUT</text>
  </g>
  <g transform="translate(184 538)">
    <rect width="832" height="62" rx="31" fill="#151412"/>
    <circle cx="48" cy="31" r="10" fill="#3D6F58"/>
    <text x="74" y="39" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="750" fill="#FFFFFF">Decision gate: approve, revise, delegate, or hold</text>
  </g>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

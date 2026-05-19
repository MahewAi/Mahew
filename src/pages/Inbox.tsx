import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  Bell,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Image as ImageIcon,
  Layers3,
  ListChecks,
  MessageSquareText,
  Network,
  PlugZap,
  Plus,
  Settings,
  ServerCog,
  ShieldCheck,
  Table2,
  Timer,
  Workflow,
} from 'lucide-react'
import { BriefDetailSheet } from '@/components/brief/BriefDetailSheet'
import { ComposeSheet, simulateAiResponse } from '@/components/brief/ComposeSheet'
import { agentRegistry } from '@/data/agentRegistry'
import { cLevelPlans, type CLevelPlan } from '@/data/cLevelPlans'
import { departmentStrengthAreas, workflowStages, type DepartmentStrengthArea } from '@/data/departmentStrength'
import {
  fallbackAgentHealth,
  fetchAgentHealth,
  submitAgentBrief,
  type AgentHealth,
  type SubmitAgentBriefResult,
} from '@/lib/agentApi'
import { loadStoredBriefs, saveStoredBriefs } from '@/lib/briefStore'
import {
  CONTRIBUTOR_META,
  DEPARTMENT_LABEL_SHORT,
  DEPARTMENT_ORDER,
  getBriefDepartments,
  type Brief,
  type Comment,
  type Role,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type SectorValue = 'all' | Role
type SectionTone = 'decision' | 'doing' | 'review' | 'final' | 'neutral'

type StrengthIconKey = DepartmentStrengthArea['id']

const sectorMeta: Record<Role, { title: string; subtitle: string; specialists: string[] }> = {
  ceo: {
    title: 'Atmaja',
    subtitle: 'CEO synthesis',
    specialists: ['Orkestrasi', 'Push-back', 'Decision brief'],
  },
  coo: {
    title: 'COO',
    subtitle: 'Operations',
    specialists: ['HR & Systems', 'Production', 'Curator'],
  },
  cmo: {
    title: 'CMO',
    subtitle: 'Market & Brand',
    specialists: ['Brand', 'Market', 'Sales', 'Innovation'],
  },
  cfo: {
    title: 'CFO',
    subtitle: 'Finance',
    specialists: ['Business Design', 'Financial Analyst'],
  },
  cco: {
    title: 'CCO',
    subtitle: 'Creative',
    specialists: ['Document', 'Editorial', 'Web Research'],
  },
}

const roleAccent: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

function isInSector(brief: Brief, sector: SectorValue) {
  if (sector === 'all') return true
  return getBriefDepartments(brief.contributors).includes(sector)
}

function getLeadRole(brief: Brief): Role {
  return getBriefDepartments(brief.contributors)[0] ?? 'ceo'
}

function getPrimaryOwner(brief: Brief) {
  const contributor = brief.contributors[0] ?? 'ceo'
  return CONTRIBUTOR_META[contributor]?.name ?? 'Atmaja'
}

export default function Inbox() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [briefs, setBriefs] = useState<Brief[]>(() => loadStoredBriefs())
  const [sector, setSector] = useState<SectorValue>('all')
  const [composeOpen, setComposeOpen] = useState(false)
  const [agentHealth, setAgentHealth] = useState<AgentHealth>(fallbackAgentHealth)
  const [lastBridgeResult, setLastBridgeResult] = useState<SubmitAgentBriefResult | null>(null)

  useEffect(() => {
    saveStoredBriefs(briefs)
  }, [briefs])

  useEffect(() => {
    let cancelled = false
    void fetchAgentHealth().then((health) => {
      if (!cancelled) setAgentHealth(health)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const scopedBriefs = useMemo(() => briefs.filter((brief) => isInSector(brief, sector)), [briefs, sector])

  const confirmationBriefs = useMemo(
    () => scopedBriefs.filter((brief) => brief.status === 'decision'),
    [scopedBriefs],
  )
  const runningBriefs = useMemo(
    () => scopedBriefs.filter((brief) => brief.status === 'doing' || brief.requestStatus === 'pending'),
    [scopedBriefs],
  )
  const pendingInputBriefs = useMemo(
    () => scopedBriefs.filter((brief) => brief.requestStatus === 'pending'),
    [scopedBriefs],
  )
  const recentOutputBriefs = useMemo(
    () => scopedBriefs.filter((brief) => brief.status === 'final' || brief.requestStatus === 'completed'),
    [scopedBriefs],
  )
  const visiblePlans = useMemo(() => {
    if (sector === 'all' || sector === 'ceo') return cLevelPlans
    return cLevelPlans.filter((plan) => plan.role === sector)
  }, [sector])

  const attentionCount = confirmationBriefs.length + scopedBriefs.filter((brief) => brief.status === 'review').length
  const blockerCount = 0
  const activeCount = briefs.filter((brief) => brief.status !== 'final').length
  const openBrief = params.id ? briefs.find((brief) => brief.id === params.id) ?? null : null

  const handleApprove = (id: string) => {
    setBriefs((prev) => prev.map((brief) => (brief.id === id ? { ...brief, status: 'final' } : brief)))
  }

  const handleAddComment = (briefId: string, comment: Comment) => {
    setBriefs((prev) =>
      prev.map((brief) =>
        brief.id === briefId
          ? {
              ...brief,
              comments: [...(brief.comments ?? []), comment],
              commentCount: (brief.commentCount ?? 0) + 1,
            }
          : brief,
      ),
    )
  }

  const handleComposeSubmit = (newBrief: Brief) => {
    setBriefs((prev) => [newBrief, ...prev])
    void submitAgentBrief(newBrief).then((result) => {
      setLastBridgeResult(result)
    })
    window.setTimeout(() => {
      setBriefs((prev) => prev.map((brief) => (brief.id === newBrief.id ? simulateAiResponse(brief) : brief)))
    }, 2500)
  }

  return (
    <div className="min-h-screen bg-bg-app pb-36">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-safe-top">
        <DashboardHeader activeCount={activeCount} confirmationCount={confirmationBriefs.length} />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="mt-4 rounded-lg border border-border-med bg-bg-surface px-4 py-4 shadow-soft"
          aria-label="Ringkasan Atmaja"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-label-caps text-accent-dark">Ringkasan Atmaja</p>
              <h1 className="mt-2 text-[25px] font-extrabold leading-[1.05] tracking-[0] text-text-primary">
                Dashboard kerja
              </h1>
              <p className="mt-2 max-w-[280px] text-sm leading-5 text-text-secondary">
                Workspace bersih. Business knowledge tetap aktif. Mulai dari brief pertama saat siap.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-text-primary text-white shadow-card">
              <MessageSquareText className="size-5" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 divide-x divide-border-med rounded-md border border-border-med bg-white">
            <MetricTile value={attentionCount} label="perlu perhatian" />
            <MetricTile value={confirmationBriefs.length} label="konfirmasi" tone="decision" />
            <MetricTile value={runningBriefs.length} label="berjalan" tone="doing" />
            <MetricTile value={blockerCount} label="hambatan" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-text-primary px-3 text-sm font-bold text-white shadow-card transition-transform duration-fast active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Buat brief
            </button>
            <button
              type="button"
              onClick={() => navigate('/atmaja')}
              className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-border-med bg-white px-3 text-sm font-bold text-text-primary transition-transform duration-fast active:scale-[0.98]"
            >
              <MessageSquareText className="size-4" />
              Tanya Atmaja
            </button>
          </div>
        </motion.section>

        <SectorTabs active={sector} onChange={setSector} />

        <OperationalStrengthSection />

        <WorkflowFoundationSection />

        <IntegrationReadinessSection health={agentHealth} lastBridgeResult={lastBridgeResult} />

        <CLevelPlanSection plans={visiblePlans} />

        <VisualSurfaceSection />

        <div className="mt-4 space-y-3">
          <TaskSection
            title="Perlu Konfirmasi"
            count={confirmationBriefs.length}
            icon={CheckCircle2}
            tone="decision"
            emptyTitle="Tidak ada konfirmasi"
            emptyBody="Kalau ada brief yang butuh keputusan Matthew, ia akan muncul di sini."
          >
            {confirmationBriefs.slice(0, 4).map((brief) => (
              <TaskRow key={brief.id} brief={brief} tone="decision" onClick={() => navigate(`/brief/${brief.id}`)} />
            ))}
          </TaskSection>

          <TaskSection
            title="Sedang Berjalan"
            count={runningBriefs.length}
            icon={Timer}
            tone="doing"
            emptyTitle="Belum ada pekerjaan berjalan"
            emptyBody="Brief baru yang sedang dianalisis oleh agent akan masuk ke area ini."
          >
            {runningBriefs.slice(0, 4).map((brief) => (
              <TaskRow key={brief.id} brief={brief} tone={brief.status === 'review' ? 'review' : 'doing'} onClick={() => navigate(`/brief/${brief.id}`)} />
            ))}
          </TaskSection>

          <TaskSection
            title="Todo / Pending Input"
            count={pendingInputBriefs.length}
            icon={ListChecks}
            tone="neutral"
            emptyTitle="Belum ada input yang diminta"
            emptyBody="Jika agent butuh angka, dokumen, atau pilihan dari Anda, itemnya akan muncul di sini."
          >
            {pendingInputBriefs.slice(0, 3).map((brief) => (
              <TaskRow key={brief.id} brief={brief} tone="neutral" onClick={() => navigate(`/brief/${brief.id}`)} />
            ))}
          </TaskSection>

          <TaskSection
            title="Output Terbaru"
            count={recentOutputBriefs.length}
            icon={FileText}
            tone="final"
            emptyTitle="Belum ada output"
            emptyBody="Memo, report, table, atau brief selesai akan tersimpan di sini."
          >
            {recentOutputBriefs.slice(0, 3).map((brief) => (
              <TaskRow key={brief.id} brief={brief} tone="final" onClick={() => navigate(`/brief/${brief.id}`)} />
            ))}
          </TaskSection>
        </div>
      </main>

      <BriefDetailSheet
        brief={openBrief}
        open={openBrief !== null}
        onOpenChange={(open) => {
          if (!open) navigate('/')
        }}
        onApprove={handleApprove}
        onAddComment={handleAddComment}
      />

      <ComposeSheet open={composeOpen} onOpenChange={setComposeOpen} onSubmit={handleComposeSubmit} />
    </div>
  )
}

function CLevelPlanSection({ plans }: { plans: CLevelPlan[] }) {
  return (
    <section className="mt-4" aria-label="Rancangan C-Level">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-label-caps text-text-muted">Rancangan C-Level</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Apa yang sedang mereka susun</h2>
        </div>
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          {plans.length}
        </span>
      </div>

      <div className="mt-3 grid gap-2.5">
        {plans.map((plan) => (
          <CLevelPlanCard key={plan.role} plan={plan} />
        ))}
      </div>
    </section>
  )
}

const strengthIconMap: Record<StrengthIconKey, typeof Activity> = {
  concept: BrainCircuit,
  dashboard: Layers3,
  'rich-output': BarChart3,
  'agent-runtime': ServerCog,
  integration: Network,
  memory: Database,
  automation: Workflow,
  security: ShieldCheck,
}

function OperationalStrengthSection() {
  const averageScore = Math.round(
    departmentStrengthAreas.reduce((total, area) => total + area.score, 0) / departmentStrengthAreas.length,
  )
  const belowTarget = departmentStrengthAreas.filter((area) => area.score < area.target).length

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Penguatan sistem">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Penguatan sistem</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">8 area operasional</h2>
          <p className="mt-1 max-w-[300px] text-xs leading-5 text-text-secondary">
            Skor ini jadi peta kerja supaya app, agent, memory, workflow, dan security naik bareng.
          </p>
        </div>
        <div className="shrink-0 rounded-md border border-border-med bg-bg-surface px-3 py-2 text-right">
          <p className="text-[22px] font-extrabold leading-none text-text-primary">{averageScore}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">baseline</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {departmentStrengthAreas.map((area) => (
          <StrengthAreaCard key={area.id} area={area} />
        ))}
      </div>

      <div className="mt-3 rounded-md border border-status-decision/20 bg-status-decision-bg px-3 py-2.5">
        <p className="text-xs font-extrabold text-status-decision">{belowTarget} area belum mencapai target</p>
        <p className="mt-1 text-[11px] leading-4 text-text-secondary">
          Prioritas berikutnya: webhook live, job polling, runtime health, audit memory, dan security hardening.
        </p>
      </div>
    </section>
  )
}

function StrengthAreaCard({ area }: { area: DepartmentStrengthArea }) {
  const Icon = strengthIconMap[area.id]

  return (
    <article className="rounded-md border border-border-soft bg-bg-surface px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md', getStrengthStatusClass(area.status))}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[20px] font-extrabold leading-none text-text-primary">{area.score}%</p>
          <p className="mt-1 text-[10px] font-bold text-text-faint">target {area.target}%</p>
        </div>
      </div>
      <h3 className="mt-2 text-[12px] font-extrabold leading-4 text-text-primary">{area.title}</h3>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <span className={cn('block h-full rounded-full', getStrengthBarClass(area.status))} style={{ width: `${area.score}%` }} />
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-text-muted">{area.nextMove}</p>
    </article>
  )
}

function WorkflowFoundationSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Workflow foundation">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Operating flow</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Dari brief ke keputusan</h2>
        </div>
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-text-primary text-white">
          <Workflow className="size-4" />
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {workflowStages.map((stage, index) => (
          <div key={stage.id} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span className={cn('inline-flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold', getWorkflowStateClass(stage.state))}>
                {index + 1}
              </span>
              {index < workflowStages.length - 1 && <span className="my-1 h-7 w-px bg-border-med" />}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-extrabold text-text-primary">{stage.label}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em]', getWorkflowStateClass(stage.state))}>
                  {stage.state}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-text-muted">{stage.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function IntegrationReadinessSection({
  health,
  lastBridgeResult,
}: {
  health: AgentHealth
  lastBridgeResult: SubmitAgentBriefResult | null
}) {
  const readyAgents = agentRegistry.filter((agent) => agent.status === 'ready').length
  const missingAgents = agentRegistry.filter((agent) => agent.status === 'missing')
  const bridgeOnline = health.bridge.mode !== 'offline'

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Agent bridge">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Agent bridge</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">App siap disambungkan</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Brief sekarang masuk lewat API contract. Kalau webhook belum aktif, app tetap jalan di fallback lokal.
          </p>
        </div>
        <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-md', bridgeOnline ? 'bg-status-final-bg text-status-final' : 'bg-status-review-bg text-status-review')}>
          <PlugZap className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <BridgeMetric
          icon={Network}
          label="Bridge"
          value={health.bridge.mode}
          tone={health.bridge.webhookConfigured ? 'final' : 'review'}
        />
        <BridgeMetric
          icon={ServerCog}
          label="Runtime"
          value={health.runtime.status}
          tone={health.runtime.status === 'active' ? 'final' : 'doing'}
        />
        <BridgeMetric
          icon={KeyRound}
          label="Token"
          value={health.bridge.tokenConfigured ? 'ready' : 'needed'}
          tone={health.bridge.tokenConfigured ? 'final' : 'decision'}
        />
      </div>

      <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-text-primary">Registry agent</p>
            <p className="mt-1 text-[11px] leading-4 text-text-muted">
              {readyAgents} siap, {missingAgents.length} perlu dilengkapi.
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
            {readyAgents}/{agentRegistry.length}
          </span>
        </div>
        {missingAgents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingAgents.map((agent) => (
              <span key={agent.id} className="rounded-full bg-status-decision-bg px-2 py-1 text-[10px] font-bold text-status-decision">
                missing: {agent.folder}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <BridgeNote
          title="Submit path"
          body={lastBridgeResult ? `${lastBridgeResult.status} lewat mode ${lastBridgeResult.mode}` : 'Menunggu brief baru dari app.'}
        />
        <BridgeNote title="Security debt" body="Server masih perlu audit OpenClaw dan matikan insecure control UI sebelum target security dianggap tercapai." />
      </div>
    </section>
  )
}

function BridgeMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Network
  label: string
  value: string
  tone: SectionTone
}) {
  return (
    <div className="min-h-[82px] rounded-md border border-border-soft bg-bg-surface px-2.5 py-2.5">
      <span className={cn('inline-flex size-7 items-center justify-center rounded-md', getToneBg(tone), getToneText(tone))}>
        <Icon className="size-3.5" />
      </span>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-text-faint">{label}</p>
      <p className="mt-0.5 truncate text-[12px] font-extrabold text-text-primary">{value}</p>
    </div>
  )
}

function BridgeNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
      <p className="text-[11px] font-extrabold text-text-primary">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-text-muted">{body}</p>
    </div>
  )
}

function CLevelPlanCard({ plan }: { plan: CLevelPlan }) {
  return (
    <article className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', roleAccent[plan.role])} />
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">
              {DEPARTMENT_LABEL_SHORT[plan.role]} / {sectorMeta[plan.role].subtitle}
            </p>
          </div>
          <h3 className="mt-1 text-[15px] font-extrabold leading-5 text-text-primary">{plan.title}</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{plan.mandate}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]', getPlanStatusClass(plan.status))}>
          {getPlanStatusLabel(plan.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <PlanList label="Dirancang" items={plan.designing} />
        <PlanList label="Butuh dari Matthew" items={plan.needsFromMatthew} muted />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {plan.outputFormats.map((format) => (
          <span
            key={format}
            className="rounded-full border border-border-soft bg-bg-surface px-2.5 py-1 text-[10px] font-bold text-text-secondary"
          >
            {format}
          </span>
        ))}
      </div>
    </article>
  )
}

function PlanList({ label, items, muted = false }: { label: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-5">
            <span className={cn('mt-2 size-1 shrink-0 rounded-full', muted ? 'bg-border-strong' : 'bg-accent')} />
            <span className={muted ? 'text-text-muted' : 'text-text-primary'}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VisualSurfaceSection() {
  const visualItems = [
    { icon: Table2, label: 'Table', text: 'comparison, supplier, pricing' },
    { icon: BarChart3, label: 'Chart', text: 'ROI, forecast, trend' },
    { icon: GitBranch, label: 'Diagram', text: 'flow, mermaid, process' },
    { icon: ImageIcon, label: 'Image', text: 'visual map, reference, mockup' },
  ]

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Format visual output">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Visual output</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">App siap render data kaya</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Brief detail bisa berisi grafik, tabel, gambar, diagram, callout, dan grid C-suite.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {visualItems.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-md border border-border-soft bg-white px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
                  <Icon className="size-3.5" />
                </span>
                <p className="text-xs font-extrabold text-text-primary">{item.label}</p>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-text-muted">{item.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DashboardHeader({ activeCount, confirmationCount }: { activeCount: number; confirmationCount: number }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 bg-bg-app/92 px-4 pb-3 pt-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[18px] font-extrabold leading-none tracking-[0.02em] text-text-primary">
            GERAI 1000 PINTU
          </p>
          <p className="mt-1 text-xs font-semibold text-text-muted">Hari ini / Dashboard kerja</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${confirmationCount} konfirmasi menunggu`}
            className="relative inline-flex size-10 items-center justify-center rounded-md border border-border-med bg-white text-text-primary"
          >
            <Bell className="size-4" />
            {confirmationCount > 0 && (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-status-decision shadow-[0_0_8px_rgba(194,85,65,0.55)]" />
            )}
          </button>
          <button
            type="button"
            aria-label="Pengaturan"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border-med bg-white text-text-primary"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-text-muted">
        <span>{activeCount} brief aktif</span>
        <span className="h-1 w-1 rounded-full bg-border-strong" />
        <span>{confirmationCount} butuh konfirmasi</span>
      </div>
    </header>
  )
}

function MetricTile({ value, label, tone = 'neutral' }: { value: number; label: string; tone?: SectionTone }) {
  const toneClass =
    tone === 'decision'
      ? 'text-status-decision'
      : tone === 'doing'
        ? 'text-status-doing'
        : 'text-text-primary'

  return (
    <div className="min-h-[76px] px-2 py-3 text-center">
      <p className={cn('text-[24px] font-extrabold leading-none tracking-[0]', toneClass)}>{value}</p>
      <p className="mx-auto mt-2 max-w-[64px] text-[10px] font-semibold leading-[1.15] text-text-muted">{label}</p>
    </div>
  )
}

function SectorTabs({ active, onChange }: { active: SectorValue; onChange: (sector: SectorValue) => void }) {
  const items: Array<{ value: SectorValue; label: string }> = [
    { value: 'all', label: 'Semua' },
    ...DEPARTMENT_ORDER.map((role) => ({ value: role, label: DEPARTMENT_LABEL_SHORT[role] })),
  ]

  return (
    <section className="mt-4" aria-label="Sektor">
      <div className="flex items-center justify-between">
        <p className="text-label-caps text-text-muted">Sektor</p>
        <p className="text-[11px] font-semibold text-text-faint">Atmaja + C-level</p>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive = item.value === active
          const role = item.value === 'all' ? null : item.value

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'min-h-touch shrink-0 rounded-md border px-3 py-2 text-left transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive
                  ? 'border-text-primary bg-text-primary text-white'
                  : 'border-border-med bg-white text-text-secondary',
              )}
            >
              <span className="flex items-center gap-2">
                {role && <span className={cn('size-2 rounded-full', roleAccent[role])} />}
                <span className="text-xs font-extrabold tracking-[0.04em]">{item.label}</span>
              </span>
              {role && (
                <span className={cn('mt-1 block text-[10px] font-semibold', isActive ? 'text-white/62' : 'text-text-faint')}>
                  {sectorMeta[role].subtitle}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TaskSection({
  title,
  count,
  icon: Icon,
  tone,
  emptyTitle,
  emptyBody,
  children,
}: {
  title: string
  count: number
  icon: typeof CheckCircle2
  tone: SectionTone
  emptyTitle: string
  emptyBody: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border-med bg-white" aria-label={title}>
      <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-border-soft px-3.5">
        <div className="flex items-center gap-2.5">
          <span className={cn('inline-flex size-8 items-center justify-center rounded-md', getToneBg(tone), getToneText(tone))}>
            <Icon className="size-4" />
          </span>
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-text-primary">{title}</h2>
        </div>
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-extrabold', getToneBg(tone), getToneText(tone))}>
          {count}
        </span>
      </div>

      <div className="divide-y divide-border-soft">
        {count > 0 ? (
          children
        ) : (
          <div className="px-3.5 py-4">
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-surface text-text-muted">
                <CircleDashed className="size-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-text-primary">{emptyTitle}</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">{emptyBody}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function TaskRow({ brief, tone, onClick }: { brief: Brief; tone: SectionTone; onClick: () => void }) {
  const leadRole = getLeadRole(brief)
  const progress = brief.requestStatus === 'pending' ? 35 : brief.status === 'review' ? 82 : brief.status === 'final' ? 100 : 58

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-fast hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      <span className={cn('h-10 w-1 shrink-0 rounded-full', getToneBar(tone))} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em]', getToneBg(tone), getToneText(tone))}>
            {brief.status}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-text-faint">
            {DEPARTMENT_LABEL_SHORT[leadRole]}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-bold text-text-primary">{brief.title}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('size-1.5 rounded-full', roleAccent[leadRole])} />
          <span className="truncate text-[11px] font-semibold text-text-muted">{getPrimaryOwner(brief)}</span>
          <span className="h-1 w-1 rounded-full bg-border-strong" />
          <span className="text-[11px] font-semibold text-text-faint">{brief.timeAgo}</span>
        </div>
        {(brief.status === 'doing' || brief.status === 'review' || brief.requestStatus === 'pending') && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-soft">
            <span className={cn('block h-full rounded-full', getToneBar(tone))} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5" />
    </button>
  )
}

function getToneBg(tone: SectionTone) {
  if (tone === 'decision') return 'bg-status-decision-bg'
  if (tone === 'doing') return 'bg-status-doing-bg'
  if (tone === 'review') return 'bg-status-review-bg'
  if (tone === 'final') return 'bg-status-final-bg'
  return 'bg-bg-surface'
}

function getToneText(tone: SectionTone) {
  if (tone === 'decision') return 'text-status-decision'
  if (tone === 'doing') return 'text-status-doing'
  if (tone === 'review') return 'text-status-review'
  if (tone === 'final') return 'text-status-final'
  return 'text-text-secondary'
}

function getToneBar(tone: SectionTone) {
  if (tone === 'decision') return 'bg-status-decision'
  if (tone === 'doing') return 'bg-status-doing'
  if (tone === 'review') return 'bg-status-review'
  if (tone === 'final') return 'bg-status-final'
  return 'bg-accent'
}

function getPlanStatusLabel(status: CLevelPlan['status']) {
  if (status === 'ready') return 'ready'
  if (status === 'draft') return 'draft'
  return 'need input'
}

function getPlanStatusClass(status: CLevelPlan['status']) {
  if (status === 'ready') return 'bg-status-final-bg text-status-final'
  if (status === 'draft') return 'bg-status-review-bg text-status-review'
  return 'bg-status-decision-bg text-status-decision'
}

function getStrengthStatusClass(status: DepartmentStrengthArea['status']) {
  if (status === 'active') return 'bg-status-final-bg text-status-final'
  if (status === 'foundation') return 'bg-status-doing-bg text-status-doing'
  if (status === 'needs-build') return 'bg-status-decision-bg text-status-decision'
  return 'bg-status-review-bg text-status-review'
}

function getStrengthBarClass(status: DepartmentStrengthArea['status']) {
  if (status === 'active') return 'bg-status-final'
  if (status === 'foundation') return 'bg-status-doing'
  if (status === 'needs-build') return 'bg-status-decision'
  return 'bg-status-review'
}

function getWorkflowStateClass(state: 'ready' | 'partial' | 'missing') {
  if (state === 'ready') return 'bg-status-final-bg text-status-final'
  if (state === 'partial') return 'bg-status-doing-bg text-status-doing'
  return 'bg-status-decision-bg text-status-decision'
}

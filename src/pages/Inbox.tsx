import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  CreditCard,
  Database,
  DollarSign,
  ExternalLink,
  GitBranch,
  KeyRound,
  Image as ImageIcon,
  Layers3,
  Library,
  ListChecks,
  Loader2,
  MessageSquare,
  Minus,
  Network,
  PlugZap,
  Plus,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Table2,
  Timer,
  WalletCards,
  Workflow,
  Zap,
} from 'lucide-react'
import { BriefDetailSheet } from '@/components/brief/BriefDetailSheet'
import { ComposeSheet, simulateAiResponse } from '@/components/brief/ComposeSheet'
import { agentRegistry } from '@/data/agentRegistry'
import {
  cLevelPlans,
  type CLevelOutputItem,
  type CLevelPlan,
  type CLevelTimelineItem,
  type CLevelWorkMap,
} from '@/data/cLevelPlans'
import { departmentStrengthAreas, workflowStages, type DepartmentStrengthArea } from '@/data/departmentStrength'
import { intelligenceDimensions, intelligenceStages, type IntelligenceDimension } from '@/data/intelligenceMaturity'
import {
  communicationPrinciples,
  plannerRoles,
  planningNorthStar,
  planningRituals,
  type PlannerRole,
  type PlanningRitual,
} from '@/data/planningOperatingSystem'
import {
  fallbackAgentHealth,
  fetchAgentHealth,
  isAgentBridgeEnabled,
  submitAgentBrief,
  type AgentHealth,
  type SubmitAgentBriefResult,
} from '@/lib/agentApi'
import { isPrivacyLockEnabled } from '@/lib/privacyGuard'
import {
  advanceCaseAutomationRuns,
  createCaseAutomationRun,
  getAutomationSummary,
  loadStoredAutomationRuns,
  reconcileCaseAutomationRuns,
  saveStoredAutomationRuns,
  type CaseAutomationRun,
} from '@/lib/caseAutomation'
import {
  buildCostLedgerSummary,
  fetchOpenRouterCredits,
  getFallbackProviderCredit,
  type CostLedgerSummary,
  type ProviderCreditSnapshot,
} from '@/lib/costLedger'
import { loadStoredBriefs, saveStoredBriefs } from '@/lib/briefStore'
import {
  fetchTrace,
  formatDuration,
  formatRelativeTime,
  formatAbsoluteTime,
  type AtmajaTrace,
  type TraceStep,
} from '@/lib/atmajaTraceClient'
import {
  getLearningSnapshot,
  recordBriefApprovalLesson,
  recordBriefRevisionLesson,
  recordInteractionLessons,
  type LearningSnapshot,
} from '@/lib/learningMemory'
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
type DashboardView = 'today' | 'department' | 'workmap' | 'sectors' | 'learning' | 'costs' | 'system'

const DASHBOARD_VIEW_STORAGE_KEY = 'gerai.dashboard.view'
const dashboardViewValues: DashboardView[] = ['today', 'department', 'workmap', 'sectors', 'learning', 'costs', 'system']
type CLevelWorkbenchMode = 'brief' | 'timeline' | 'visual' | 'data' | 'output'

type StrengthIconKey = DepartmentStrengthArea['id']

const AI_ARCHITECTURE_NODE_COUNT = 12

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

export default function Inbox() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [briefs, setBriefs] = useState<Brief[]>(() => loadStoredBriefs())
  const [sector, setSector] = useState<SectorValue>('all')
  const [dashboardView, setDashboardView] = useState<DashboardView>(() => loadStoredDashboardView())
  const [composeOpen, setComposeOpen] = useState(false)
  const [agentHealth, setAgentHealth] = useState<AgentHealth>(fallbackAgentHealth)
  const [lastBridgeResult, setLastBridgeResult] = useState<SubmitAgentBriefResult | null>(null)
  const [learningVersion, setLearningVersion] = useState(0)
  const [automationRuns, setAutomationRuns] = useState<CaseAutomationRun[]>(() => loadStoredAutomationRuns())
  const [providerCredit, setProviderCredit] = useState<ProviderCreditSnapshot>(() => getFallbackProviderCredit())

  useEffect(() => {
    saveStoredBriefs(briefs)
  }, [briefs])

  useEffect(() => {
    window.sessionStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, dashboardView)
  }, [dashboardView])

  useEffect(() => {
    saveStoredAutomationRuns(automationRuns)
  }, [automationRuns])

  useEffect(() => {
    setAutomationRuns((runs) => reconcileCaseAutomationRuns(briefs, runs))
  }, [briefs])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAutomationRuns((runs) => advanceCaseAutomationRuns(runs, briefs))
    }, 1200)

    return () => window.clearInterval(intervalId)
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

  useEffect(() => {
    let cancelled = false
    void fetchOpenRouterCredits().then((snapshot) => {
      if (!cancelled) setProviderCredit(snapshot)
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
  const blockerBriefs = useMemo(
    () => scopedBriefs.filter((brief) => brief.status === 'review'),
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
  const learningSnapshot = useMemo(() => getLearningSnapshot(), [learningVersion])
  const automationSummary = useMemo(() => getAutomationSummary(automationRuns), [automationRuns])
  const costSummary = useMemo(() => buildCostLedgerSummary(briefs), [briefs])

  const attentionCount = confirmationBriefs.length + blockerBriefs.length
  const activeCount = briefs.filter((brief) => brief.status !== 'final').length
  const openBrief = params.id ? briefs.find((brief) => brief.id === params.id) ?? null : null

  const handleApprove = (id: string) => {
    const approvedBrief = briefs.find((brief) => brief.id === id)
    setBriefs((prev) => prev.map((brief) => (brief.id === id ? { ...brief, status: 'final' } : brief)))
    if (approvedBrief) {
      recordBriefApprovalLesson(approvedBrief)
      setLearningVersion((version) => version + 1)
    }
  }

  const handleRequestRevision = (id: string) => {
    const revisedBrief = briefs.find((brief) => brief.id === id)
    setBriefs((prev) => prev.map((brief) => (brief.id === id ? { ...brief, status: 'review' } : brief)))
    if (revisedBrief) {
      recordBriefRevisionLesson(revisedBrief)
      setLearningVersion((version) => version + 1)
    }
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
    if (comment.author === 'matthew') {
      const lessons = recordInteractionLessons(comment.text, {
        type: 'brief-comment',
        briefId,
        author: 'matthew',
      })
      if (lessons.length > 0) setLearningVersion((version) => version + 1)
    }
  }

  const handleComposeSubmit = (newBrief: Brief) => {
    setBriefs((prev) => [newBrief, ...prev])
    setAutomationRuns((prev) => [createCaseAutomationRun(newBrief), ...prev])
    void submitAgentBrief(newBrief).then((result) => {
      setLastBridgeResult(result)
      if (shouldUseLocalSimulation(result)) {
        window.setTimeout(() => {
          setBriefs((prev) => prev.map((brief) => (brief.id === newBrief.id ? simulateAiResponse(brief) : brief)))
        }, 2500)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg-app pb-36">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-safe-top">
        <DashboardHeader activeCount={activeCount} confirmationCount={confirmationBriefs.length} />

        <DashboardViewTabs
          active={dashboardView}
          onChange={setDashboardView}
          attentionCount={attentionCount}
          runningCount={runningBriefs.length}
          learningCount={learningSnapshot.total}
          costCount={costSummary.caseCount}
          systemCount={departmentStrengthAreas.length}
        />

        {dashboardView === 'today' && (
          <CommandCenterSection
            sector={sector}
            attentionCount={attentionCount}
            confirmationBriefs={confirmationBriefs}
            runningBriefs={runningBriefs}
            pendingInputBriefs={pendingInputBriefs}
            blockerBriefs={blockerBriefs}
            recentOutputBriefs={recentOutputBriefs}
            onCompose={() => setComposeOpen(true)}
            onOpenBrief={(id) => navigate(`/brief/${id}`)}
          />
        )}

        {dashboardView === 'department' && (
          <DepartmentArchitectureSection briefs={briefs} onCompose={() => setComposeOpen(true)} />
        )}

        {dashboardView === 'workmap' && (
          <WorkMapDashboardSection plans={cLevelPlans} />
        )}

        {dashboardView === 'sectors' && (
          <>
            <SectorTabs active={sector} onChange={setSector} />
            {sector === 'all' ? (
              <CLevelPlanSection plans={visiblePlans} mode="overview" />
            ) : (
              <SectorWorkspace
                role={sector}
                plans={visiblePlans}
                attentionCount={attentionCount}
                runningCount={runningBriefs.length}
                outputCount={recentOutputBriefs.length}
              />
            )}
          </>
        )}

        {dashboardView === 'learning' && (
          <>
            <IntelligenceOverviewSection snapshot={learningSnapshot} />
            <IntelligenceAutomationSection summary={automationSummary} runs={automationRuns} />
            <IntelligenceDimensionSection />
            <LearningMemorySection snapshot={learningSnapshot} />
            <IntelligenceUpgradePathSection />
          </>
        )}

        {dashboardView === 'costs' && (
          <CostDashboardSection summary={costSummary} providerCredit={providerCredit} />
        )}

        {dashboardView === 'system' && (
          <>
            <ImplementationStatusSection />
            <PlanningNorthStarSection />
            <ToolingAutomationSection />
            <OperationalStrengthSection />
            <PlannerCouncilSection />
            <PlanningRitualSection />
            <WorkflowFoundationSection />
            <IntegrationReadinessSection health={agentHealth} lastBridgeResult={lastBridgeResult} />
            <VisualSurfaceSection />
          </>
        )}
      </main>

      <BriefDetailSheet
        brief={openBrief}
        open={openBrief !== null}
        onOpenChange={(open) => {
          if (!open) navigate('/')
        }}
        onApprove={handleApprove}
        onRequestRevision={handleRequestRevision}
        onAddComment={handleAddComment}
      />

      <ComposeSheet open={composeOpen} onOpenChange={setComposeOpen} onSubmit={handleComposeSubmit} />
    </div>
  )
}

function shouldUseLocalSimulation(result: SubmitAgentBriefResult) {
  return result.mode !== 'webhook' || result.status !== 'accepted'
}

function isDashboardView(value: string | null): value is DashboardView {
  return dashboardViewValues.includes(value as DashboardView)
}

function loadStoredDashboardView(): DashboardView {
  if (typeof window === 'undefined') return 'today'
  const storedView = window.sessionStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY)
  return isDashboardView(storedView) ? storedView : 'today'
}

function shouldOpenWorkMapInApp() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)').matches
}

const implementationUpdates: Array<{
  icon: typeof Activity
  title: string
  status: string
  body: string
  metric: string
  tone: SectionTone
}> = [
  {
    icon: BarChart3,
    title: 'Performance scan',
    status: 'Split done',
    body: 'Main bundle turun dari 1.74MB ke sekitar 560KB dengan lazy-load Markdown, Recharts, Mermaid, dan C-suite renderer.',
    metric: '560KB',
    tone: 'review',
  },
  {
    icon: ImageIcon,
    title: 'Generated image',
    status: 'Renderer aktif',
    body: 'Brief output sekarang bisa membawa block generated-image dan tampil sebagai visual result di detail brief.',
    metric: 'ready',
    tone: 'final',
  },
  {
    icon: ListChecks,
    title: 'Skill audit',
    status: '23 OK',
    body: 'Skill registry dicek secara struktural. Skill automation sudah ditambahkan untuk audit dan runbook berulang.',
    metric: '23/23',
    tone: 'final',
  },
  {
    icon: ShieldCheck,
    title: 'Private sync',
    status: 'Privacy lock',
    body: 'Privacy lock aktif: bridge agent dan telemetry tidak boleh jalan walau env keliru dinyalakan.',
    metric: 'local',
    tone: 'doing',
  },
]

const toolingSignals: Array<{
  icon: typeof Activity
  label: string
  value: string
  detail: string
  tone: SectionTone
}> = [
  {
    icon: Workflow,
    label: 'Skill automation',
    value: 'Installed',
    detail: 'scripts/audit-skills.ps1 siap untuk audit; runbook automation tersimpan sebagai workflow lokal.',
    tone: 'final',
  },
  {
    icon: Timer,
    label: 'Automation scope',
    value: 'Manual gate',
    detail: 'Recurring job tetap butuh approval; app menampilkan jalur dan statusnya dulu.',
    tone: 'doing',
  },
  {
    icon: ServerCog,
    label: 'Bridge posture',
    value: 'Locked',
    detail: 'VITE_GERAI_PRIVACY_LOCK=on memblokir brief keluar ke backend.',
    tone: 'decision',
  },
  {
    icon: GitBranch,
    label: 'Next perf move',
    value: 'Manual chunks',
    detail: 'Langkah lanjut: pisahkan Mermaid diagram family agar chunk visual berat lebih granular.',
    tone: 'review',
  },
]

function CLevelPlanSection({ plans, mode = 'overview' }: { plans: CLevelPlan[]; mode?: 'overview' | 'workbench' }) {
  const isWorkbench = mode === 'workbench'

  return (
    <section className="mt-4" aria-label="Rancangan C-Level">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-label-caps text-text-muted">Rancangan C-Level</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">
            {isWorkbench ? 'Workbench sektor ini' : 'Apa yang sedang mereka susun'}
          </h2>
          <p className="mt-1 max-w-[340px] text-xs font-semibold leading-5 text-text-secondary">
            {isWorkbench
              ? 'Di sini baru muncul timeline, visual map, data signal, dan output yang dikirim C-level ini.'
              : 'Bagian Semua hanya ringkasan. Pilih COO, CMO, CFO, atau CCO untuk membuka workbench interaktifnya.'}
          </p>
        </div>
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          {plans.length}
        </span>
      </div>

      <div className="mt-3 grid gap-2.5">
        {plans.map((plan) => (
          <CLevelPlanCard key={plan.role} plan={plan} interactive={isWorkbench} />
        ))}
      </div>
    </section>
  )
}

function DepartmentArchitectureSection({
  briefs,
  onCompose,
}: {
  briefs: Brief[]
  onCompose: () => void
}) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<{
    files: number
    proposals: number
    schedules: number
    creditWarning: { severity: string; message: string } | null
    online: boolean
  }>({
    files: 0,
    proposals: 0,
    schedules: 0,
    creditWarning: null,
    online: true,
  })
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [showArchitecture, setShowArchitecture] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [currentTrace, setCurrentTrace] = useState<AtmajaTrace | null>(null)
  const [traceHistory, setTraceHistory] = useState<AtmajaTrace[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  // Live polling trace — 1.5s saat ada session running, 5s saat idle.
  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    const tick = async () => {
      const r = await fetchTrace()
      if (cancelled) return
      if (r?.ok) {
        setCurrentTrace(r.current)
        setTraceHistory(r.history ?? [])
      }
      const isRunning = r?.current?.status === 'running'
      timer = window.setTimeout(tick, isRunning ? 1500 : 5000)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [healthRes, filesRes, proposalsRes, schedulesRes] = await Promise.all([
          fetch('/api/agent/health', { cache: 'no-store' }).catch(() => null),
          fetch('/api/atmaja/memory?type=files', { cache: 'no-store' }).catch(() => null),
          fetch('/api/atmaja/memory?type=proposals&status=pending', { cache: 'no-store' }).catch(() => null),
          fetch('/api/atmaja/memory?type=schedule', { cache: 'no-store' }).catch(() => null),
        ])
        if (cancelled) return
        let creditWarning: { severity: string; message: string } | null = null
        let online = true
        if (healthRes?.ok) {
          const data = await healthRes.json().catch(() => null)
          const warnings: Array<{ severity: string; type: string; message: string }> =
            Array.isArray(data?.warnings) ? data.warnings : []
          const credit = warnings.find((w) => w.type?.includes('credit'))
          if (credit) creditWarning = { severity: credit.severity, message: credit.message }
          online = Boolean(data?.chat?.capabilities)
        }
        const filesData = filesRes?.ok ? await filesRes.json().catch(() => null) : null
        const proposalsData = proposalsRes?.ok ? await proposalsRes.json().catch(() => null) : null
        const schedulesData = schedulesRes?.ok ? await schedulesRes.json().catch(() => null) : null
        if (cancelled) return
        setStats({
          files: filesData?.count ?? 0,
          proposals: Array.isArray(proposalsData?.proposals) ? proposalsData.proposals.length : 0,
          schedules: schedulesData?.count ?? 0,
          creditWarning,
          online,
        })
        setStatsLoaded(true)
      } catch {
        setStatsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeBriefs = briefs.filter((b) => b.status !== 'final').length
  const recentBriefs = [...briefs].slice(0, 5)

  // Quick actions buat akses cepat ke fitur Atmaja
  const quickActions = [
    { id: 'chat', label: 'Chat Atmaja', icon: MessageSquare, onClick: () => navigate('/atmaja'), tone: 'primary' as const },
    { id: 'brief', label: 'Brief baru', icon: Plus, onClick: onCompose, tone: 'primary' as const },
    { id: 'schedule', label: 'Jadwal', icon: CalendarClock, onClick: () => navigate('/atmaja'), tone: 'default' as const },
    { id: 'library', label: 'Library', icon: Library, onClick: () => navigate('/atmaja'), tone: 'default' as const },
    { id: 'proposals', label: 'Proposals', icon: Sparkles, onClick: () => navigate('/atmaja'), tone: 'default' as const },
  ]

  // C-Level roster (5 cards: Atmaja + 4 C-level)
  const roster = [
    { id: 'atmaja', name: 'Atmaja', role: 'CEO', mandate: 'Sintesis kepemimpinan', color: 'role-ceo' },
    { id: 'coo', name: 'COO', role: 'Operations', mandate: 'SOP & fulfillment', color: 'role-coo' },
    { id: 'cmo', name: 'CMO', role: 'Marketing', mandate: 'Growth & positioning', color: 'role-cmo' },
    { id: 'cfo', name: 'CFO', role: 'Finance', mandate: 'Margin & runway', color: 'role-cfo' },
    { id: 'cco', name: 'CCO', role: 'Creative', mandate: 'Narrative & brand', color: 'role-cco' },
  ]

  const viewTrace = selectedHistoryId
    ? traceHistory.find((t) => t.sessionId === selectedHistoryId) ?? null
    : currentTrace

  return (
    <section className="mt-4 space-y-3" aria-label="AI Department live execution trace">
      {/* Header */}
      <div className="rounded-2xl border border-white/55 bg-white/55 p-4 shadow-card backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-caps text-accent-dark">AI Department</p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-[1.1] tracking-[-0.01em] text-text-primary">
              Live Execution Trace
            </h1>
            <p className="mt-2 max-w-[420px] text-[13px] font-medium leading-relaxed text-text-secondary">
              Lacak proses Atmaja dari saat Matthew kirim prompt sampai jawaban kembali, step-by-step real-time seperti n8n workflow.
            </p>
          </div>
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-card">
            <Zap className="size-5" />
          </span>
        </div>
      </div>

      {/* LIVE EXECUTION TRACE (primary feature) */}
      <LiveTraceCard
        trace={viewTrace}
        isHistoryView={Boolean(selectedHistoryId)}
        onBackToLive={selectedHistoryId ? () => setSelectedHistoryId(null) : undefined}
      />

      {/* History Sessions (collapsible) */}
      {traceHistory.length > 0 && (
        <div className="rounded-2xl border border-white/55 bg-white/40 shadow-soft backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            aria-expanded={showHistory}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-bg text-accent-dark">
                <Activity className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-extrabold text-text-primary">Riwayat eksekusi</p>
                <p className="text-[11px] font-semibold text-text-muted">
                  {traceHistory.length} sesi terakhir
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'size-4 text-text-faint transition-transform duration-fast',
                showHistory && 'rotate-180',
              )}
            />
          </button>
          {showHistory && (
            <div className="border-t border-white/55 px-3 pb-3 pt-3 space-y-1.5">
              {traceHistory.map((t) => (
                <button
                  key={t.sessionId}
                  type="button"
                  onClick={() => setSelectedHistoryId(t.sessionId)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-fast',
                    selectedHistoryId === t.sessionId
                      ? 'border-accent bg-accent-bg/60'
                      : 'border-white/60 bg-white/70 hover:border-accent/40 hover:bg-white',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 inline-flex size-2 shrink-0 rounded-full',
                      t.status === 'completed'
                        ? 'bg-status-final shadow-[0_0_6px_rgba(61,111,88,0.5)]'
                        : t.status === 'error'
                          ? 'bg-status-review'
                          : 'bg-amber-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-extrabold text-text-primary">
                      {t.userMessagePreview || '(no prompt)'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-text-muted">
                      {formatRelativeTime(t.startedAt)} · {formatDuration(t.totalDurationMs)} ·{' '}
                      {t.model?.split('/').pop() ?? '-'}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 self-center text-text-faint group-hover:text-accent-dark" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Health Grid */}
      <div className="rounded-2xl border border-white/55 bg-white/55 p-3.5 shadow-soft backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-label-caps text-accent-dark">Status layanan</p>
          {!statsLoaded && <span className="text-[10px] font-bold text-text-faint">Memuat...</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HealthTile
            icon={MessageSquare}
            label="Atmaja"
            value={stats.online ? 'Online' : 'Offline'}
            tone={stats.online ? 'ok' : 'down'}
          />
          <HealthTile
            icon={CreditCard}
            label="OpenRouter"
            value={stats.creditWarning ? 'Perlu top-up' : 'Aman'}
            tone={stats.creditWarning ? (stats.creditWarning.severity === 'critical' ? 'down' : 'warn') : 'ok'}
            subtitle={stats.creditWarning?.message ?? undefined}
          />
          <HealthTile
            icon={Library}
            label="Library"
            value={`${stats.files} / 50`}
            tone="ok"
            subtitle="File PDF"
          />
          <HealthTile
            icon={CalendarClock}
            label="Jadwal"
            value={`${stats.schedules} aktif`}
            tone={stats.schedules > 0 ? 'ok' : 'idle'}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-white/55 bg-white/55 p-3.5 shadow-soft backdrop-blur-md">
        <p className="mb-2.5 text-label-caps text-accent-dark">Aksi cepat</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition-all duration-fast active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  a.tone === 'primary'
                    ? 'border-accent/30 bg-gradient-to-br from-accent-bg/80 to-white/80 hover:border-accent/60 hover:shadow-card'
                    : 'border-white/65 bg-white/75 hover:border-accent/35 hover:bg-white',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-lg',
                    a.tone === 'primary' ? 'bg-accent text-white shadow-soft' : 'bg-accent-bg text-accent-dark',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <p className="text-[13px] font-extrabold text-text-primary">{a.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* C-Level Roster */}
      <div className="rounded-2xl border border-white/55 bg-white/55 p-3.5 shadow-soft backdrop-blur-md">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-label-caps text-accent-dark">Council aktif</p>
          <p className="text-[10px] font-bold text-text-faint">{activeBriefs} brief sedang berjalan</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {roster.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/65 bg-white/80 px-3 py-2.5 shadow-soft"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-full text-[12px] font-extrabold text-white shadow-soft',
                    `bg-${r.color}`,
                  )}
                  style={{ fontFamily: r.id === 'atmaja' ? '"Cormorant Garamond", Georgia, serif' : undefined }}
                >
                  {r.id === 'atmaja' ? 'A' : r.role.slice(0, 1)}
                </span>
                <p className="text-[13px] font-extrabold text-text-primary">{r.name}</p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-text-faint">{r.role}</p>
              <p className="mt-0.5 text-[10px] font-semibold leading-3 text-text-muted">{r.mandate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-white/55 bg-white/55 p-3.5 shadow-soft backdrop-blur-md">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-label-caps text-accent-dark">Aktivitas terbaru</p>
          {stats.proposals > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-review-bg px-2 py-0.5 text-[10px] font-extrabold text-status-review">
              <Sparkles className="size-2.5" />
              {stats.proposals} proposal pending
            </span>
          )}
        </div>
        {recentBriefs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-soft bg-bg-soft/60 px-3 py-4 text-center">
            <p className="text-xs font-bold text-text-secondary">Belum ada aktivitas brief.</p>
            <p className="mt-1 text-[11px] font-semibold text-text-muted">Mulai dengan brief pertama dari aksi cepat di atas.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {recentBriefs.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/brief/${b.id}`)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-left transition-colors duration-fast hover:border-accent/40 hover:bg-white"
                >
                  <span className="mt-1 inline-flex size-2 shrink-0 rounded-full bg-accent shadow-[0_0_6px_rgba(184,149,107,0.45)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-text-primary">{b.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-text-muted">
                      {b.timeAgo} · status {b.status}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 self-center text-text-faint group-hover:text-accent-dark" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Collapsible Architecture Diagram (secondary, default closed) */}
      <div className="rounded-2xl border border-white/55 bg-white/40 shadow-soft backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowArchitecture((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-expanded={showArchitecture}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-bg text-accent-dark">
              <Network className="size-4" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-text-primary">Struktur arsitektur</p>
              <p className="text-[11px] font-semibold text-text-muted">Lihat 12 node tier-based (intake sampai output)</p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'size-4 text-text-faint transition-transform duration-fast',
              showArchitecture && 'rotate-180',
            )}
          />
        </button>
        {showArchitecture && (
          <div className="border-t border-white/55 px-3 pb-3 pt-3">
            <LiveDepartmentMap />
          </div>
        )}
      </div>
    </section>
  )
}

function WorkMapDashboardSection({ plans }: { plans: CLevelPlan[] }) {
  return (
    <section className="mt-4 space-y-3" aria-label="Workmap C-level dashboard">
      <div className="rounded-lg border border-text-primary bg-text-primary p-4 text-white shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/62">C-level workmap</p>
            <h1 className="mt-1 text-[24px] font-extrabold leading-7">Rancangan kerja langsung terlihat</h1>
            <p className="mt-2 max-w-[360px] text-xs font-semibold leading-5 text-white/72">
              Ini peta kerja COO, CMO, CFO, dan CCO: lane, input, action, output, dependency, dan gate keputusan Matthew.
            </p>
          </div>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
            <GitBranch className="size-4" />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {plans.map((plan) => (
            <div key={plan.role} className="rounded-md bg-white px-2 py-2 text-center text-text-primary">
              <p className="text-[13px] font-extrabold leading-none">{DEPARTMENT_LABEL_SHORT[plan.role]}</p>
              <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.05em] text-text-muted">
                {plan.workMap.lanes.length} lane
              </p>
            </div>
          ))}
        </div>
      </div>

      {plans.map((plan) => (
        <CLevelWorkMapCard key={plan.role} role={plan.role} map={plan.workMap} />
      ))}
    </section>
  )
}

function LiveTraceCard({
  trace,
  isHistoryView,
  onBackToLive,
}: {
  trace: AtmajaTrace | null
  isHistoryView: boolean
  onBackToLive?: () => void
}) {
  if (!trace) {
    return (
      <div className="rounded-2xl border border-white/55 bg-white/55 p-5 shadow-soft backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-accent-bg text-accent-dark">
            <Zap className="size-5" />
          </span>
          <p className="mt-3 text-sm font-extrabold text-text-primary">Belum ada eksekusi tercatat</p>
          <p className="mt-1 max-w-[380px] text-[12px] font-semibold leading-relaxed text-text-muted">
            Setiap kali Matthew chat Atmaja, tab ini akan otomatis menampilkan step-by-step proses real-time.
            Coba kirim prompt di tab Atmaja, lalu kembali ke sini.
          </p>
        </div>
      </div>
    )
  }

  const statusColor =
    trace.status === 'running'
      ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.55)]'
      : trace.status === 'completed'
        ? 'bg-status-final shadow-[0_0_10px_rgba(61,111,88,0.55)]'
        : 'bg-status-review shadow-[0_0_10px_rgba(168,89,116,0.55)]'

  const statusLabel =
    trace.status === 'running' ? 'Sedang berjalan' : trace.status === 'completed' ? 'Selesai' : 'Error'

  const completedSteps = trace.steps.filter((s) => s.status === 'done').length
  const totalSteps = trace.steps.filter((s) => s.status !== 'skipped').length
  const runningStep = trace.steps.find((s) => s.status === 'running')

  return (
    <div className="rounded-2xl border border-white/55 bg-white/65 p-4 shadow-card backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('inline-flex size-2.5 shrink-0 rounded-full', statusColor)} />
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-secondary">
              {isHistoryView ? 'Riwayat' : 'Sesi saat ini'} · {statusLabel}
            </p>
            {trace.status === 'running' && (
              <Loader2 className="size-3 animate-spin text-amber-600" />
            )}
          </div>
          <p className="mt-2 text-[15px] font-extrabold leading-snug text-text-primary line-clamp-2">
            {trace.userMessagePreview || '(prompt kosong)'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-text-muted">
            <span>Mulai: {formatAbsoluteTime(trace.startedAt)}</span>
            {trace.totalDurationMs != null && <span>Durasi: {formatDuration(trace.totalDurationMs)}</span>}
            {trace.model && <span>Model: {trace.model.split('/').pop()}</span>}
            <span>
              Step: {completedSteps} / {totalSteps}
            </span>
          </div>
        </div>
        {isHistoryView && onBackToLive && (
          <button
            type="button"
            onClick={onBackToLive}
            className="shrink-0 rounded-full bg-accent-bg px-2.5 py-1 text-[10px] font-extrabold text-accent-dark hover:bg-accent/15"
          >
            Kembali live
          </button>
        )}
      </div>

      {/* Step pills timeline */}
      <div className="mt-4">
        <div className="grid gap-1.5 sm:grid-cols-7">
          {trace.steps.map((step) => {
            return <TraceStepPill key={step.id} step={step} />
          })}
        </div>
      </div>

      {/* Active step detail */}
      {runningStep && trace.status === 'running' && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-50/70 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-amber-600" />
            <p className="text-[12px] font-extrabold text-amber-900">{runningStep.label}</p>
          </div>
          {runningStep.detail && (
            <p className="mt-1 text-[11px] font-semibold text-amber-800">{runningStep.detail}</p>
          )}
        </div>
      )}

      {/* Error message */}
      {trace.status === 'error' && trace.error && (
        <div className="mt-3 rounded-xl border border-status-review/40 bg-status-review-bg/70 px-3.5 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-3.5 shrink-0 text-status-review mt-0.5" />
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold text-status-review">Error</p>
              <p className="mt-0.5 text-[11px] font-semibold text-text-secondary break-words">{trace.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Response preview (when completed) */}
      {trace.status === 'completed' && trace.responsePreview && (
        <div className="mt-3 rounded-xl border border-status-final/30 bg-status-final-bg/50 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-status-final" />
            <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-status-final">
              Output (preview)
            </p>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-text-primary line-clamp-3">
            {trace.responsePreview}
          </p>
        </div>
      )}

      {/* All steps detail (expandable) */}
      <details className="mt-3 group">
        <summary className="cursor-pointer list-none rounded-lg bg-bg-soft/50 px-3 py-2 text-[11px] font-extrabold text-text-secondary hover:bg-bg-soft/80">
          <span className="inline-flex items-center gap-1">
            Detail tiap step
            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <ul className="mt-2 space-y-1">
          {trace.steps.map((step) => (
            <li
              key={step.id}
              className="flex items-start gap-2 rounded-lg bg-white/40 px-2.5 py-1.5 text-[11px]"
            >
              <TraceStepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-text-primary">{step.label}</p>
                  {step.at && (
                    <span className="text-[10px] font-semibold text-text-faint">
                      {formatAbsoluteTime(step.at)}
                    </span>
                  )}
                </div>
                {step.detail && (
                  <p className="mt-0.5 text-[10px] font-semibold text-text-muted">{step.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function TraceStepPill({ step }: { step: TraceStep }) {
  const isDone = step.status === 'done'
  const isRunning = step.status === 'running'
  const isSkipped = step.status === 'skipped'
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-2 transition-colors duration-fast',
        isDone
          ? 'border-status-final/40 bg-status-final-bg/60'
          : isRunning
            ? 'border-amber-500/50 bg-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
            : isSkipped
              ? 'border-white/50 bg-white/30 opacity-50'
              : 'border-white/60 bg-white/50',
      )}
      title={step.detail || step.label}
    >
      <div className="flex items-center gap-1.5">
        <TraceStepIcon status={step.status} />
        <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.05em] text-text-secondary">
          {step.id.replace(/_/g, ' ').slice(0, 12)}
        </p>
      </div>
      <p
        className={cn(
          'mt-1 truncate text-[11px] font-bold',
          isDone ? 'text-status-final' : isRunning ? 'text-amber-700' : isSkipped ? 'text-text-faint' : 'text-text-muted',
        )}
      >
        {step.label}
      </p>
    </div>
  )
}

function TraceStepIcon({ status }: { status: TraceStep['status'] }) {
  if (status === 'done')
    return <CheckCircle2 className="size-3.5 shrink-0 text-status-final" aria-label="Selesai" />
  if (status === 'running')
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-600" aria-label="Berjalan" />
  if (status === 'skipped') return <Minus className="size-3.5 shrink-0 text-text-faint" aria-label="Skipped" />
  return <Circle className="size-3.5 shrink-0 text-text-faint" aria-label="Pending" />
}

function HealthTile({
  icon: Icon,
  label,
  value,
  tone,
  subtitle,
}: {
  icon: typeof Activity
  label: string
  value: string
  tone: 'ok' | 'warn' | 'down' | 'idle'
  subtitle?: string
}) {
  const dotColor =
    tone === 'ok'
      ? 'bg-status-final shadow-[0_0_8px_rgba(61,111,88,0.55)]'
      : tone === 'warn'
        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)]'
        : tone === 'down'
          ? 'bg-status-review shadow-[0_0_8px_rgba(168,89,116,0.55)]'
          : 'bg-text-faint'
  return (
    <div className="rounded-xl border border-white/65 bg-white/80 px-3 py-2.5 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent-bg text-accent-dark">
          <Icon className="size-3.5" />
        </span>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-text-faint">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('inline-flex size-1.5 shrink-0 rounded-full', dotColor)} />
        <p className="text-[13px] font-extrabold leading-4 text-text-primary truncate">{value}</p>
      </div>
      {subtitle && <p className="mt-1 text-[10px] font-semibold leading-3 text-text-muted truncate">{subtitle}</p>}
    </div>
  )
}

function LiveDepartmentMap() {
  // Redesigned: clean tier-based glass card grid, brand canon (brass + ivory),
  // inspired by Aether Management atmospheric layout. Lebih sederhana, premium feel.
  type MapNode = {
    id: string
    label: string
    owner: string
    status: string
    activity: string
    output: string
    tier: 1 | 2 | 3 | 4
  }
  const mapNodes: MapNode[] = [
    { id: 'intake', label: 'Brief Intake', owner: 'Atmaja', status: 'Signal intake', activity: 'Membaca brief Matthew, konteks bisnis, constraint, dan tujuan keputusan sebelum dibagi ke council.', output: 'Problem frame dan planning question.', tier: 1 },
    { id: 'atmaja', label: 'Atmaja CEO', owner: 'Atmaja', status: 'Chief planner', activity: 'Mengorkestrasi C-level, memberi push-back, menyatukan trade-off, dan menentukan kapan perlu approval Matthew.', output: 'Master planning frame dan decision gate.', tier: 1 },
    { id: 'council', label: 'C-Level Council', owner: 'Atmaja', status: 'Delegation hub', activity: 'Membagi pekerjaan ke COO, CMO, CFO, dan CCO sesuai domain keputusan.', output: 'Lane kerja C-level yang siap dieksekusi agent.', tier: 2 },
    { id: 'coo', label: 'COO', owner: 'Operations', status: 'Ops system', activity: 'Merancang SOP, staffing, vendor, fulfillment, timeline, dan dependency operasional.', output: 'Operating roadmap dan blocker list.', tier: 2 },
    { id: 'cmo', label: 'CMO', owner: 'Marketing', status: 'Growth system', activity: 'Merancang positioning, market thesis, channel, funnel, dan innovation signal.', output: 'Market map dan growth plan.', tier: 2 },
    { id: 'cfo', label: 'CFO', owner: 'Finance', status: 'Capital system', activity: 'Mengunci ROI, budget, pricing, margin, runway, dan scenario guardrail.', output: 'Financial decision frame.', tier: 2 },
    { id: 'cco', label: 'CCO', owner: 'Creative', status: 'Narrative system', activity: 'Menjaga source, document pack, copy, brand voice, dan format komunikasi final.', output: 'Narrative dan evidence pack.', tier: 2 },
    { id: 'specialists', label: 'Specialists', owner: 'C-level', status: 'Execution cells', activity: 'HR, production, curator, brand, market, sales, innovation, business design, finance, document, editorial, dan web researcher menjalankan subtask.', output: 'Specialist packets per domain.', tier: 3 },
    { id: 'research', label: 'Research Tools', owner: 'Web Researcher', status: 'Evidence', activity: 'Mengambil sinyal web, Tavily atau source evidence, kompetitor, market, dan fact-check untuk planning.', output: 'Evidence log dengan confidence.', tier: 3 },
    { id: 'memory', label: 'Business Memory', owner: 'Atmaja', status: 'Learning layer', activity: 'Menyimpan keputusan, preferensi Matthew, business canon, source log, dan lesson penting di storage lokal.', output: 'Context privat untuk keputusan berikutnya.', tier: 3 },
    { id: 'automation', label: 'Skill Automation', owner: 'Atmaja', status: 'Trigger layer', activity: 'Menjalankan recurring scan, follow-up, queue routing, approval reminder, skill checklist, dan Private Sync Vault.', output: 'Automation runbook dan job trigger.', tier: 3 },
    { id: 'contract', label: 'Output Contract', owner: 'Agent runtime', status: 'Structured result', activity: 'Membungkus hasil agent menjadi AgentOutputEnvelope v1: summary, planning frame, visual map, blocks, gates, actions, dan memory policy.', output: 'Planning-grade output yang bisa dirender app.', tier: 4 },
  ]
  const [selectedNodeId, setSelectedNodeId] = useState('atmaja')
  const selectedNode = mapNodes.find((n) => n.id === selectedNodeId) ?? mapNodes[0]

  const tierLabels: Record<1 | 2 | 3 | 4, { label: string; sublabel: string }> = {
    1: { label: 'Lapis 1', sublabel: 'Intake & Orkestrasi' },
    2: { label: 'Lapis 2', sublabel: 'Council & Delegasi' },
    3: { label: 'Lapis 3', sublabel: 'Eksekusi & Memori' },
    4: { label: 'Lapis 4', sublabel: 'Output Terstruktur' },
  }

  const tiers: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4]

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/55 bg-white/40 p-3.5 shadow-soft backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-status-final shadow-[0_0_10px_rgba(61,111,88,0.55)]" />
            <p className="text-label-caps text-accent-dark">Arsitektur AI Department</p>
          </div>
          <p className="text-[10px] font-bold text-text-faint">{mapNodes.length} node aktif</p>
        </div>

        <div className="space-y-2.5">
          {tiers.map((tier, tierIdx) => {
            const tierNodes = mapNodes.filter((n) => n.tier === tier)
            const meta = tierLabels[tier]
            const isLastTier = tierIdx === tiers.length - 1
            return (
              <div key={tier}>
                <div className="rounded-xl border border-white/55 bg-white/65 p-3 shadow-soft">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="inline-flex min-w-[52px] items-center justify-center rounded-full bg-accent-bg px-2 py-1 text-[10px] font-extrabold text-accent-dark">
                      {meta.label}
                    </span>
                    <p className="text-[12px] font-extrabold text-text-primary">{meta.sublabel}</p>
                    <p className="ml-auto text-[10px] font-bold text-text-faint">{tierNodes.length} node</p>
                  </div>
                  <div
                    className={cn(
                      'grid gap-2',
                      tierNodes.length <= 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : tierNodes.length <= 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
                    )}
                  >
                    {tierNodes.map((node) => {
                      const isSelected = node.id === selectedNode.id
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          className={cn(
                            'group relative rounded-xl border px-3 py-2.5 text-left transition-all duration-fast',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                            isSelected
                              ? 'border-accent bg-accent-bg/70 shadow-[0_4px_14px_rgba(184,149,107,0.22)] ring-1 ring-accent/40'
                              : 'border-white/70 bg-white/85 hover:border-accent/45 hover:bg-white hover:-translate-y-px',
                          )}
                        >
                          <p
                            className={cn(
                              'text-[10px] font-extrabold uppercase tracking-[0.06em] truncate',
                              isSelected ? 'text-accent-dark' : 'text-text-faint group-hover:text-accent-dark',
                            )}
                          >
                            {node.owner}
                          </p>
                          <p className="mt-0.5 text-[13px] font-extrabold leading-[1.2] text-text-primary">
                            {node.label}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-text-muted truncate">{node.status}</p>
                          {isSelected && (
                            <span
                              aria-hidden="true"
                              className="absolute -right-1 -top-1 inline-flex size-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(184,149,107,0.55)] ring-2 ring-white"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Flow connector — visual hint antar lapis */}
                {!isLastTier && (
                  <div aria-hidden="true" className="flex justify-center py-1.5">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/60 shadow-soft">
                      <ChevronRight className="size-3 rotate-90 text-accent-dark" />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <motion.div
        key={selectedNode.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-2xl border border-accent/25 bg-white/85 p-4 shadow-card backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
              {selectedNode.owner}
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-[1.2] text-text-primary">{selectedNode.label}</h2>
          </div>
          <span className="shrink-0 rounded-full border border-accent/35 bg-accent-bg/70 px-2.5 py-1 text-[10px] font-extrabold text-accent-dark">
            {selectedNode.status}
          </span>
        </div>
        <p className="mt-3 text-[13px] font-medium leading-relaxed text-text-secondary">{selectedNode.activity}</p>
        <div className="mt-3 rounded-xl border border-white/65 bg-bg-soft/60 px-3.5 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Output</p>
          <p className="mt-1 text-[13px] font-bold leading-[1.4] text-text-primary">{selectedNode.output}</p>
        </div>
      </motion.div>
    </div>
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

function ImplementationStatusSection() {
  return (
    <section className="mt-4 rounded-lg border border-text-primary bg-text-primary p-3.5 text-white shadow-card" aria-label="Update implementasi">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/58">Update implementasi</p>
          <h2 className="mt-1 text-[20px] font-extrabold leading-6">Request Matthew sudah masuk cockpit</h2>
          <p className="mt-2 max-w-[340px] text-xs font-semibold leading-5 text-white/70">
            Panel ini merangkum perubahan yang tadi diminta: performa, image generation, skill audit, skill automation, dan security sync.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
          <CheckCircle2 className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {implementationUpdates.map((item) => (
          <ImplementationUpdateCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  )
}

function ImplementationUpdateCard({ item }: { item: (typeof implementationUpdates)[number] }) {
  const Icon = item.icon

  return (
    <article className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md', getToneBg(item.tone), getToneText(item.tone))}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[12px] font-extrabold text-white">{item.title}</h3>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.04em] text-text-primary">
              {item.metric}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#e6caa6]">{item.status}</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-white/68">{item.body}</p>
        </div>
      </div>
    </article>
  )
}

function ToolingAutomationSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Tooling dan automation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Tooling & automation</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Skill, tools, dan next automation terlihat</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Ini status operasional dari audit tadi: skill berjalan, automation skill dibuat, dan jalur tool berikutnya sudah jelas.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <Workflow className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {toolingSignals.map((signal) => (
          <ToolingSignalCard key={signal.label} signal={signal} />
        ))}
      </div>

      <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
        <p className="text-[11px] font-extrabold text-text-primary">Audit command</p>
        <p className="mt-1 break-words text-[10px] font-semibold leading-4 text-text-muted">
          powershell -ExecutionPolicy Bypass -File .agents/skills/skill-automation/scripts/audit-skills.ps1
        </p>
      </div>
    </section>
  )
}

function ToolingSignalCard({ signal }: { signal: (typeof toolingSignals)[number] }) {
  const Icon = signal.icon

  return (
    <article className="rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md', getToneBg(signal.tone), getToneText(signal.tone))}>
          <Icon className="size-3.5" />
        </span>
        <span className={cn('truncate text-[11px] font-extrabold', getToneText(signal.tone))}>{signal.value}</span>
      </div>
      <p className="mt-2 text-[11px] font-extrabold text-text-primary">{signal.label}</p>
      <p className="mt-1 line-clamp-3 text-[10px] font-semibold leading-4 text-text-muted">{signal.detail}</p>
    </article>
  )
}

function PlanningNorthStarSection() {
  return (
    <section className="mt-4 rounded-lg border border-text-primary bg-text-primary p-4 text-white shadow-card" aria-label="Planning north star">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/62">North star</p>
          <h2 className="mt-1 text-[20px] font-extrabold leading-6">{planningNorthStar.title}</h2>
          <p className="mt-2 max-w-[320px] text-xs leading-5 text-white/72">{planningNorthStar.body}</p>
        </div>
        <div className="shrink-0 rounded-md bg-white px-3 py-2 text-right text-text-primary">
          <p className="text-[24px] font-extrabold leading-none">{planningNorthStar.score}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">target</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <NorthStarPill label="Planner" value="Atmaja" />
        <NorthStarPill label="Council" value="C-level" />
        <NorthStarPill label="Output" value="Plan" />
      </div>
    </section>
  )
}

function NorthStarPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/14 bg-white/8 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/52">{label}</p>
      <p className="mt-0.5 text-[12px] font-extrabold text-white">{value}</p>
    </div>
  )
}

function IntelligenceOverviewSection({ snapshot }: { snapshot: LearningSnapshot }) {
  const intelligenceIndex = getIntelligenceIndex(snapshot)
  const activeStage = getIntelligenceStage(intelligenceIndex)
  const averageDimension = Math.round(
    intelligenceDimensions.reduce((total, dimension) => total + dimension.score, 0) / intelligenceDimensions.length,
  )
  const weakestDimension = intelligenceDimensions.reduce((weakest, dimension) =>
    dimension.score < weakest.score ? dimension : weakest,
  )

  return (
    <section className="mt-4 rounded-lg border border-text-primary bg-text-primary p-4 text-white shadow-card" aria-label="Otak AI">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/62">Otak AI</p>
          <h2 className="mt-1 text-[24px] font-extrabold leading-7">Seberapa pintar sekarang</h2>
          <p className="mt-2 max-w-[340px] text-xs font-semibold leading-5 text-white/72">
            Ini bukan IQ. Ini intelligence readiness: seberapa baik Atmaja memahami bisnis, belajar dari Matthew, riset data, menyusun rencana, dan menjaga batas aman.
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-white px-3 py-2 text-right text-text-primary">
          <p className="text-[28px] font-extrabold leading-none">{intelligenceIndex}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">index</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NorthStarPill label="Stage" value={activeStage.label} />
        <NorthStarPill label="Core" value={`${averageDimension}%`} />
        <NorthStarPill label="Lessons" value={`${snapshot.total}`} />
      </div>

      <div className="mt-3 rounded-md border border-white/14 bg-white/8 px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <BrainCircuit className="mt-0.5 size-4 shrink-0 text-white/72" />
          <div>
            <p className="text-xs font-extrabold text-white">Yang paling menahan: {weakestDimension.title}</p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-white/68">{weakestDimension.upgradeMove}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function IntelligenceAutomationSection({
  summary,
  runs,
}: {
  summary: ReturnType<typeof getAutomationSummary>
  runs: CaseAutomationRun[]
}) {
  const visibleRuns = runs.slice(0, 4)
  const latest = summary.latest

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Live automation kecerdasan">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Live automation</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Case langsung masuk loop kecerdasan</h2>
          <p className="mt-1 max-w-[330px] text-xs leading-5 text-text-secondary">
            Tiap case baru membuat run otomatis: framing, routing C-level, reasoning, evidence check, lalu output contract.
          </p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-status-doing-bg text-status-doing">
          <Activity className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MemoryMetric label="running" value={summary.running} />
        <MemoryMetric label="done" value={summary.completed} />
        <MemoryMetric label="blocked" value={summary.blocked} />
      </div>

      {latest && (
        <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold text-text-primary">{latest.title}</p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">{latest.currentStage}</p>
            </div>
            <span className={cn('rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.05em]', getAutomationStatusClass(latest.status))}>
              {latest.status}
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
            <span className="block h-full rounded-full bg-status-doing transition-all duration-base" style={{ width: `${latest.progress}%` }} />
          </div>
          <div className="mt-3 grid gap-1.5">
            {latest.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-2">
                <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold', getAutomationStepClass(step.status))}>
                  {step.status === 'done' ? 'OK' : step.status === 'running' ? 'GO' : step.status === 'blocked' ? '!' : '...'}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-text-primary">{step.label}</p>
                <span className="shrink-0 text-[10px] font-semibold text-text-muted">{step.owner}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleRuns.length > 1 && (
        <div className="mt-3 grid gap-1.5">
          {visibleRuns.slice(1).map((run) => (
            <div key={run.id} className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold text-text-primary">{run.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-text-muted">{run.currentStage}</p>
              </div>
              <span className="shrink-0 text-[11px] font-extrabold text-accent-dark">{run.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CostDashboardSection({
  summary,
  providerCredit,
}: {
  summary: CostLedgerSummary
  providerCredit: ProviderCreditSnapshot
}) {
  const connected = providerCredit.status === 'connected'
  const remaining = providerCredit.remainingCredits
  const projectedRemaining = remaining === null ? null : Math.max(0, remaining - summary.estimatedSpendUsd)

  return (
    <>
      <section className="mt-4 rounded-lg border border-text-primary bg-text-primary p-4 text-white shadow-card" aria-label="Kontrol biaya AI">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/62">AI cost control</p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-7">Biaya dan credits AI</h2>
            <p className="mt-2 max-w-[340px] text-xs font-semibold leading-5 text-white/72">
              Sektor ini menghitung estimasi biaya case lokal dan membaca credits provider lewat server-side endpoint.
            </p>
          </div>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
            <WalletCards className="size-4" />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <CostHeroMetric label="est spend" value={formatUsd(summary.estimatedSpendUsd)} />
          <CostHeroMetric label="tokens" value={formatCompactNumber(summary.estimatedTotalTokens)} />
          <CostHeroMetric label="cases" value={`${summary.caseCount}`} />
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Provider credits">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label-caps text-accent-dark">Provider credits</p>
            <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">OpenRouter balance</h2>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{providerCredit.note}</p>
          </div>
          <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-md', connected ? 'bg-status-final-bg text-status-final' : 'bg-status-review-bg text-status-review')}>
            <CreditCard className="size-4" />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <CostMetric label="remaining" value={remaining === null ? '-' : formatUsd(remaining)} tone={connected ? 'final' : 'review'} />
          <CostMetric label="used" value={providerCredit.totalUsage === null ? '-' : formatUsd(providerCredit.totalUsage)} tone="doing" />
          <CostMetric label="after cases" value={projectedRemaining === null ? '-' : formatUsd(projectedRemaining)} tone={projectedRemaining !== null && projectedRemaining < 2 ? 'decision' : 'final'} />
        </div>

        <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
          <p className="text-[11px] font-extrabold text-text-primary">Server-only setup</p>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            Set `OPENROUTER_MANAGEMENT_KEY` di Vercel untuk live balance. Endpoint app memakai `/api/openrouter/credits`; key tidak dibundle ke browser.
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Estimasi biaya per case">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label-caps text-accent-dark">Case ledger</p>
            <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Estimasi biaya per case</h2>
          </div>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
            <DollarSign className="size-4" />
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          {summary.recent.length === 0 ? (
            <p className="rounded-md border border-border-soft bg-bg-surface px-3 py-3 text-xs font-semibold text-text-muted">
              Belum ada case yang dihitung.
            </p>
          ) : (
            summary.recent.map((item) => (
              <div key={item.briefId} className="rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-extrabold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-[10px] font-semibold text-text-muted">
                      {formatCompactNumber(item.inputTokens + item.outputTokens)} tokens / {DEPARTMENT_LABEL_SHORT[item.owner]}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-accent-dark">
                    {formatUsd(item.estimatedCostUsd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}

function CostHeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-2.5 py-2 text-text-primary">
      <p className="truncate text-[15px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">{label}</p>
    </div>
  )
}

function CostMetric({ label, value, tone }: { label: string; value: string; tone: SectionTone }) {
  return (
    <div className="min-h-[78px] rounded-md border border-border-soft bg-bg-surface px-2.5 py-2.5">
      <span className={cn('inline-flex size-7 items-center justify-center rounded-md', getToneBg(tone), getToneText(tone))}>
        <DollarSign className="size-3.5" />
      </span>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-text-faint">{label}</p>
      <p className="mt-0.5 truncate text-[12px] font-extrabold text-text-primary">{value}</p>
    </div>
  )
}

function getAutomationStatusClass(status: CaseAutomationRun['status']) {
  if (status === 'completed') return 'bg-status-final-bg text-status-final'
  if (status === 'blocked') return 'bg-status-decision-bg text-status-decision'
  return 'bg-status-doing-bg text-status-doing'
}

function getAutomationStepClass(status: CaseAutomationRun['steps'][number]['status']) {
  if (status === 'done') return 'bg-status-final-bg text-status-final'
  if (status === 'blocked') return 'bg-status-decision-bg text-status-decision'
  if (status === 'running') return 'bg-status-doing-bg text-status-doing'
  return 'bg-bg-soft text-text-muted'
}

function formatUsd(value: number) {
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function IntelligenceDimensionSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Breakdown kecerdasan AI">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Intelligence breakdown</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">7 sektor kecerdasan</h2>
          <p className="mt-1 max-w-[320px] text-xs leading-5 text-text-secondary">
            Setiap sektor punya current score, target 110, beyond 120, evidence, dan gap yang harus dibuka.
          </p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <BarChart3 className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {intelligenceDimensions.map((dimension) => (
          <IntelligenceDimensionCard key={dimension.id} dimension={dimension} />
        ))}
      </div>
    </section>
  )
}

function IntelligenceDimensionCard({ dimension }: { dimension: IntelligenceDimension }) {
  const [expanded, setExpanded] = useState(false)
  const currentWidth = Math.min(100, Math.round((dimension.score / dimension.northStar) * 100))
  const targetLeft = Math.min(100, Math.round((dimension.target / dimension.northStar) * 100))

  return (
    <article className="rounded-md border border-border-soft bg-bg-surface px-3 py-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold', getIntelligenceStatusClass(dimension.status))}>
                {dimension.shortLabel.slice(0, 2).toUpperCase()}
              </span>
              <h3 className="min-w-0 text-[13px] font-extrabold leading-4 text-text-primary">{dimension.title}</h3>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-4 text-text-secondary">{dimension.meaning}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] font-extrabold leading-none text-text-primary">{dimension.score}%</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.05em] text-text-faint">target {dimension.target}</p>
          </div>
        </div>

        <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-white">
          <span
            className={cn('absolute inset-y-0 left-0 rounded-full', getIntelligenceBarClass(dimension.status))}
            style={{ width: `${currentWidth}%` }}
          />
          <span className="absolute inset-y-[-2px] w-0.5 rounded-full bg-text-primary/60" style={{ left: `${targetLeft}%` }} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {dimension.evidence.slice(0, 3).map((item) => (
              <span key={item} className="rounded-full border border-border-soft bg-white px-2 py-1 text-[10px] font-bold text-text-secondary">
                {item}
              </span>
            ))}
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-accent-dark">
            {expanded ? 'Tutup' : 'Arsitektur'}
          </span>
        </div>
      </button>

      {expanded && (
        <ArchitectureDetailPanel
          title="Struktur arsitektural"
          nodes={['Input', ...dimension.evidence.slice(0, 4), 'Gap', 'Upgrade']}
          flow={getIntelligenceFlow(dimension)}
          notes={[
            { label: 'Gap', body: dimension.blindSpot },
            { label: 'Naikkan', body: dimension.upgradeMove },
          ]}
        />
      )}
    </article>
  )
}

function ArchitectureDetailPanel({
  title,
  nodes,
  notes,
  flow,
}: {
  title: string
  nodes: string[]
  flow?: string[]
  notes: Array<{ label: string; body: string }>
}) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">{title}</p>
        <GitBranch className="size-4 text-text-faint" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {nodes.map((node, index) => (
          <div key={`${node}-${index}`} className="rounded-md border border-border-soft bg-bg-surface px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-text-muted">
                {index + 1}
              </span>
              <p className="min-w-0 truncate text-[10px] font-extrabold text-text-primary">{node}</p>
            </div>
          </div>
        ))}
      </div>
      {flow && flow.length > 0 && (
        <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Alur kinerja</p>
          <div className="mt-2 space-y-2">
            {flow.map((step, index) => (
              <div key={`${step}-${index}`} className="flex gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-text-muted">
                  {index + 1}
                </span>
                <p className="text-[11px] font-semibold leading-4 text-text-secondary">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 grid gap-1.5">
        {notes.map((note) => (
          <MaturityNote key={note.label} label={note.label} body={note.body} />
        ))}
      </div>
    </div>
  )
}

function IntelligenceUpgradePathSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Tahap kecerdasan AI">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Tahap pintar</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Cara membaca skornya</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Makin tinggi bukan berarti makin bebas. Makin tinggi berarti makin bisa bekerja mandiri dengan evidence dan approval gate.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-text-primary">
          <ShieldCheck className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {intelligenceStages.map((stage) => (
          <div key={stage.label} className="rounded-md border border-border-soft bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold text-text-primary">{stage.label}</p>
              <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[10px] font-extrabold text-text-muted">
                {stage.range}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">{stage.meaning}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function LearningMemorySection({ snapshot }: { snapshot: LearningSnapshot }) {
  const categoryLabels: Array<{ key: keyof LearningSnapshot['byCategory']; label: string }> = [
    { key: 'format', label: 'format' },
    { key: 'decision', label: 'decision' },
    { key: 'workflow', label: 'workflow' },
    { key: 'ux', label: 'UX' },
  ]

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Self-learning memory">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Self-learning V1</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Lesson memory yang bisa diaudit</h2>
          <p className="mt-1 max-w-[310px] text-xs leading-5 text-text-secondary">
            App menyimpan pelajaran ringkas dari approval, revisi, dan preferensi Matthew. Raw chat tidak dijadikan memory default.
          </p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-status-final-bg text-status-final">
          <Database className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MemoryMetric label="lessons" value={snapshot.total} />
        <MemoryMetric label="high trust" value={snapshot.highConfidence} />
        <MemoryMetric label="recent" value={snapshot.recent.length} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {categoryLabels.map((item) => (
          <div key={item.key} className="rounded-md border border-border-soft bg-bg-surface px-2 py-2 text-center">
            <p className="text-[15px] font-extrabold leading-none text-text-primary">{snapshot.byCategory[item.key]}</p>
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.04em] text-text-muted">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {snapshot.recent.slice(0, 3).map((lesson) => (
          <article key={lesson.id} className="rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-extrabold text-text-primary">{lesson.title}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.04em] text-text-muted">
                {lesson.confidence}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-text-secondary">{lesson.lesson}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function MemoryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
      <p className="text-[20px] font-extrabold leading-none text-text-primary">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">{label}</p>
    </div>
  )
}

function OperationalStrengthSection() {
  const averageScore = Math.round(
    departmentStrengthAreas.reduce((total, area) => total + area.score, 0) / departmentStrengthAreas.length,
  )
  const averageTarget = Math.round(
    departmentStrengthAreas.reduce((total, area) => total + area.target, 0) / departmentStrengthAreas.length,
  )
  const averageNorthStar = Math.round(
    departmentStrengthAreas.reduce((total, area) => total + area.northStar, 0) / departmentStrengthAreas.length,
  )
  const belowTarget = departmentStrengthAreas.filter((area) => area.score < area.target).length
  const beyondBaseline = departmentStrengthAreas.filter((area) => area.score >= 100).length

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Penguatan sistem">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Maturity upgrade</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">8 area dinaikkan menuju 110%</h2>
          <p className="mt-1 max-w-[300px] text-xs leading-5 text-text-secondary">
            Persen ini membaca kesiapan sistem: struktur, data, workflow, runtime, security, dan kemampuan jalan mandiri.
          </p>
        </div>
        <div className="shrink-0 rounded-md border border-border-med bg-bg-surface px-3 py-2 text-right">
          <p className="text-[22px] font-extrabold leading-none text-text-primary">{averageScore}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">current</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MaturityMetric label="current" value={`${averageScore}%`} tone="final" />
        <MaturityMetric label="target" value={`${averageTarget}%`} tone="doing" />
        <MaturityMetric label="beyond" value={`${averageNorthStar}%`} tone="review" />
      </div>

      <MaturityBarChart areas={departmentStrengthAreas} />

      <div className="mt-3 grid gap-2">
        {departmentStrengthAreas.map((area) => (
          <StrengthAreaCard key={area.id} area={area} />
        ))}
      </div>

      <div className="mt-3 rounded-md border border-status-decision/20 bg-status-decision-bg px-3 py-2.5">
        <p className="text-xs font-extrabold text-status-decision">{belowTarget} area belum mencapai target 110%</p>
        <p className="mt-1 text-[11px] leading-4 text-text-secondary">
          {beyondBaseline} area sudah melewati baseline 100%. Prioritas berikutnya: live job polling, recurring Tavily radar, memory sync, audit trail, dan autonomous approval routing.
        </p>
      </div>
    </section>
  )
}

function MaturityMetric({ label, value, tone }: { label: string; value: string; tone: SectionTone }) {
  return (
    <div className={cn('rounded-md border px-2.5 py-2', getToneBg(tone), tone === 'final' ? 'border-status-final/20' : 'border-border-soft')}>
      <p className={cn('text-[18px] font-extrabold leading-none', getToneText(tone))}>{value}</p>
      <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.06em] text-text-muted">{label}</p>
    </div>
  )
}

function MaturityBarChart({ areas }: { areas: DepartmentStrengthArea[] }) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3" aria-label="Maturity chart">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Breakdown chart</p>
          <p className="mt-1 text-xs font-bold text-text-primary">Current vs 110 target vs 120 beyond</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-text-muted">
          {areas.length} area
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {areas.map((area) => {
          const currentWidth = Math.min(100, Math.round((area.score / area.northStar) * 100))
          const targetLeft = Math.min(100, Math.round((area.target / area.northStar) * 100))

          return (
            <div key={area.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-extrabold text-text-primary">{area.title}</p>
                <p className="shrink-0 text-[11px] font-extrabold text-text-secondary">{area.score}%</p>
              </div>
              <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-white">
                <span
                  className={cn('absolute inset-y-0 left-0 rounded-full', getStrengthBarClass(area.status))}
                  style={{ width: `${currentWidth}%` }}
                />
                <span
                  className="absolute inset-y-[-2px] w-0.5 rounded-full bg-text-primary/65"
                  style={{ left: `${targetLeft}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StrengthAreaCard({ area }: { area: DepartmentStrengthArea }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = strengthIconMap[area.id]
  const currentWidth = Math.min(100, Math.round((area.score / area.northStar) * 100))
  const targetLeft = Math.min(100, Math.round((area.target / area.northStar) * 100))

  return (
    <article className="rounded-md border border-border-soft bg-bg-surface px-3 py-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md', getStrengthStatusClass(area.status))}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[20px] font-extrabold leading-none text-text-primary">{area.score}%</p>
            <p className="mt-1 text-[10px] font-bold text-text-faint">target {area.target}% / beyond {area.northStar}%</p>
          </div>
        </div>
        <h3 className="mt-2 text-[12px] font-extrabold leading-4 text-text-primary">{area.title}</h3>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white">
          <span className={cn('absolute inset-y-0 left-0 rounded-full', getStrengthBarClass(area.status))} style={{ width: `${currentWidth}%` }} />
          <span className="absolute inset-y-[-2px] w-0.5 rounded-full bg-text-primary/60" style={{ left: `${targetLeft}%` }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-4 text-text-secondary">{area.maturityMeaning}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-text-faint">
            {area.capabilityBreakdown.length} capability
          </span>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-accent-dark">
            {expanded ? 'Tutup' : 'Arsitektur'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3">
          <ArchitectureDetailPanel
            title="Struktur sistem"
            nodes={area.capabilityBreakdown.map((capability) => capability.label)}
            flow={getSystemFlow(area)}
            notes={[
              { label: 'Next', body: area.nextMove },
              { label: 'Beyond', body: area.beyondMove },
            ]}
          />

          <div className="mt-2 grid gap-1.5">
            {area.capabilityBreakdown.map((capability) => (
              <CapabilityRow key={capability.label} capability={capability} />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function CapabilityRow({ capability }: { capability: DepartmentStrengthArea['capabilityBreakdown'][number] }) {
  return (
    <div className="rounded-md bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-extrabold text-text-primary">{capability.label}</p>
        <p className="shrink-0 text-[11px] font-extrabold text-accent-dark">{capability.score}%</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-surface">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, capability.score)}%` }}
        />
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-text-muted">{capability.evidence}</p>
    </div>
  )
}

function MaturityNote({ label, body }: { label: string; body: string }) {
  return (
    <p className="rounded-md border border-border-soft bg-white px-2.5 py-2 text-[10px] font-semibold leading-4 text-text-muted">
      <span className="font-extrabold text-text-primary">{label}: </span>
      {body}
    </p>
  )
}

function PlannerCouncilSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Planner council">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Planner council</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Atmaja + C-level sebagai perencana</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Setiap role punya mandat planning, hak keputusan, output wajib, dan gaya penyampaian.
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <BrainCircuit className="size-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2.5">
        {plannerRoles.map((planner) => (
          <PlannerRoleCard key={planner.role} planner={planner} />
        ))}
      </div>
    </section>
  )
}

function PlannerRoleCard({ planner }: { planner: PlannerRole }) {
  return (
    <article className="rounded-md border border-border-soft bg-bg-surface px-3 py-3">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-extrabold text-white', roleAccent[planner.role])}>
          {DEPARTMENT_LABEL_SHORT[planner.role]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-extrabold leading-4 text-text-primary">{planner.plannerName}</h3>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] text-text-muted">
              {planner.cadence}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-text-secondary">{planner.planningMandate}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MiniList label="Output" items={planner.planningOutputs.slice(0, 3)} />
            <MiniList label="Decision" items={planner.decisionRights.slice(0, 3)} />
          </div>
          <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-[11px] font-semibold leading-4 text-text-muted">
            {planner.communicationStyle}
          </p>
        </div>
      </div>
    </article>
  )
}

function PlanningRitualSection() {
  return (
    <section className="mt-4 rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Planning rituals">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Planning ritual</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Ritme kerja yang harus hidup</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          {planningRituals.length}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {planningRituals.map((ritual) => (
          <PlanningRitualCard key={ritual.id} ritual={ritual} />
        ))}
      </div>

      <div className="mt-3 rounded-md border border-border-soft bg-white px-3 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Standar penyampaian</p>
        <div className="mt-2 grid gap-1.5">
          {communicationPrinciples.map((principle) => (
            <div key={principle.title} className="flex gap-2 text-[11px] leading-4">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-text-muted">
                <span className="font-extrabold text-text-primary">{principle.title}: </span>
                {principle.rule}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PlanningRitualCard({ ritual }: { ritual: PlanningRitual }) {
  return (
    <article className="rounded-md border border-border-soft bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', roleAccent[ritual.owner])} />
            <h3 className="text-xs font-extrabold text-text-primary">{ritual.title}</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-text-secondary">{ritual.purpose}</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">Output: {ritual.output}</p>
        </div>
        <span className="shrink-0 rounded-full bg-bg-surface px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] text-text-muted">
          {ritual.cadence}
        </span>
      </div>
    </article>
  )
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-md bg-white px-2.5 py-2">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-text-faint">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="truncate text-[10px] font-semibold text-text-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectorWorkspace({
  role,
  plans,
  attentionCount,
  runningCount,
  outputCount,
}: {
  role: Role
  plans: CLevelPlan[]
  attentionCount: number
  runningCount: number
  outputCount: number
}) {
  const planner = plannerRoles.find((item) => item.role === role)
  const ownedStrength = departmentStrengthAreas.filter((area) => area.owner === role)
  const roster = agentRegistry.filter((agent) => agent.parent === role || agent.id === role)
  const isCeo = role === 'ceo'

  return (
    <section className="mt-4 space-y-3" aria-label={`${DEPARTMENT_LABEL_SHORT[role]} workspace`}>
      <div className={cn('rounded-lg border border-border-med p-4 text-white shadow-card', roleAccent[role])}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/68">
              {DEPARTMENT_LABEL_SHORT[role]} workspace
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-6">{sectorMeta[role].title}</h2>
            <p className="mt-2 max-w-[320px] text-xs font-semibold leading-5 text-white/78">
              {planner?.planningMandate ?? 'Ruang kerja khusus untuk keputusan dan rencana role ini.'}
            </p>
          </div>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-white/16 text-sm font-extrabold text-white ring-1 ring-white/20">
            {DEPARTMENT_LABEL_SHORT[role]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <RoleMetric value={attentionCount} label="attention" />
          <RoleMetric value={runningCount} label="running" />
          <RoleMetric value={outputCount} label="output" />
        </div>
      </div>

      {planner && <RolePlannerCard planner={planner} />}

      {isCeo ? (
        <CeoCouncilSnapshot />
      ) : (
        <>
          <CLevelPlanSection plans={plans} mode="workbench" />
          <RoleSpecialistRoster role={role} roster={roster} />
        </>
      )}

      <RoleStrengthSection role={role} areas={ownedStrength} />
      <RoleDecisionStandard planner={planner} />
    </section>
  )
}

function RoleMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-white/16 bg-white/12 px-2.5 py-2">
      <p className="text-[22px] font-extrabold leading-none text-white">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/62">{label}</p>
    </div>
  )
}

function RolePlannerCard({ planner }: { planner: PlannerRole }) {
  return (
    <article className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Planner mandate</p>
          <h3 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">{planner.plannerName}</h3>
          <p className="mt-2 text-xs leading-5 text-text-secondary">{planner.communicationStyle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-bg-surface px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.05em] text-text-muted">
          {planner.cadence}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniList label="Output wajib" items={planner.planningOutputs} />
        <MiniList label="Hak keputusan" items={planner.decisionRights} />
      </div>
      <div className="mt-2 rounded-md border border-border-soft bg-bg-surface px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Butuh dari Matthew</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-text-primary">{planner.asksMatthewFor.join(', ')}</p>
      </div>
    </article>
  )
}

function CeoCouncilSnapshot() {
  return (
    <section className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="CEO council snapshot">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Council control</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Yang Atmaja orkestrasi</h2>
        </div>
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          4 C-level
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {plannerRoles
          .filter((planner) => planner.role !== 'ceo')
          .map((planner) => (
            <div key={planner.role} className="rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <span className={cn('mt-0.5 size-2 shrink-0 rounded-full', roleAccent[planner.role])} />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-text-primary">{planner.plannerName}</p>
                  <p className="mt-1 text-[11px] leading-4 text-text-muted">{planner.planningMandate}</p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}

function RoleSpecialistRoster({ role, roster }: { role: Role; roster: typeof agentRegistry }) {
  return (
    <section className="rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label={`${DEPARTMENT_LABEL_SHORT[role]} specialist roster`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Specialist</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">{sectorMeta[role].subtitle} roster</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          {roster.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {roster.map((agent) => (
          <div key={agent.id} className="rounded-md border border-border-soft bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-text-primary">{CONTRIBUTOR_META[agent.id]?.name ?? agent.folder}</p>
                <p className="mt-1 text-[11px] leading-4 text-text-muted">{agent.responsibility}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em]', agent.status === 'ready' ? 'bg-status-final-bg text-status-final' : 'bg-status-decision-bg text-status-decision')}>
                {agent.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RoleStrengthSection({ role, areas }: { role: Role; areas: DepartmentStrengthArea[] }) {
  return (
    <section className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label={`${DEPARTMENT_LABEL_SHORT[role]} strength`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-muted">Area yang dijaga</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">{DEPARTMENT_LABEL_SHORT[role]} responsibility</h2>
        </div>
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-secondary">
          {areas.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {areas.length > 0 ? (
          areas.map((area) => <StrengthAreaCard key={area.id} area={area} />)
        ) : (
          <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-3">
            <p className="text-xs font-semibold leading-5 text-text-muted">
              Role ini bekerja melalui rencana C-level dan task lane, bukan owner langsung area sistem.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function RoleDecisionStandard({ planner }: { planner?: PlannerRole }) {
  return (
    <section className="rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Role decision standard">
      <p className="text-label-caps text-text-muted">Standar output</p>
      <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">Cara role ini harus bicara</h2>
      <div className="mt-3 grid gap-1.5">
        {communicationPrinciples.slice(0, 4).map((principle) => (
          <div key={principle.title} className="rounded-md border border-border-soft bg-white px-3 py-2">
            <p className="text-[11px] font-extrabold text-text-primary">{principle.title}</p>
            <p className="mt-1 text-[11px] leading-4 text-text-muted">{principle.rule}</p>
          </div>
        ))}
      </div>
      {planner && (
        <p className="mt-3 rounded-md bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-text-secondary">
          Tone khusus: {planner.communicationStyle}
        </p>
      )}
    </section>
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
  const bridgeConfigured = isAgentBridgeEnabled()
  const privacyLocked = isPrivacyLockEnabled()
  const bridgeOnline = bridgeConfigured && health.bridge.mode !== 'offline'

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Agent bridge">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Agent bridge</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">
            {privacyLocked ? 'Privacy lock aktif' : bridgeConfigured ? 'App siap disambungkan' : 'Private mode aktif'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {privacyLocked
              ? 'Data AI Department tidak keluar dari device. Bridge dan telemetry diblokir dari kode.'
              : bridgeConfigured
                ? 'Brief masuk lewat API contract. Kalau webhook gagal, app tetap jalan di fallback lokal.'
                : 'Brief tetap di device sampai bridge sengaja dinyalakan lewat environment.'}
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
          value={bridgeConfigured ? (health.bridge.tokenConfigured ? 'ready' : 'needed') : 'locked'}
          tone={bridgeConfigured && health.bridge.tokenConfigured ? 'final' : 'decision'}
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
        <BridgeNote
          title="Atmaja chat"
          body={
            health.chat.enabled
              ? `OpenRouter aktif lewat ${health.chat.model ?? 'server default'}; lampiran hanya dikirim sebagai metadata.`
              : 'Chat Atmaja memakai fallback lokal sampai privacy lock dimatikan, bridge diizinkan, dan OPENROUTER_API_KEY diset di server.'
          }
        />
        <BridgeNote
          title="Security posture"
          body={
            bridgeConfigured
              ? 'Bridge aktif: audit server, token, log, dan control UI sebelum dipakai untuk data sensitif.'
              : privacyLocked
                ? 'Privacy lock on: gunakan Private Sync Vault + Syncthing antar device milik sendiri.'
                : 'Bridge off: gunakan Private Sync Vault + Syncthing untuk memindahkan data antar device milik sendiri.'
          }
        />
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

function DashboardViewTabs({
  active,
  onChange,
  attentionCount,
  runningCount,
  learningCount,
  costCount,
  systemCount,
}: {
  active: DashboardView
  onChange: (view: DashboardView) => void
  attentionCount: number
  runningCount: number
  learningCount: number
  costCount: number
  systemCount: number
}) {
  const items: Array<{ value: DashboardView; label: string; helper: string; count: number }> = [
    { value: 'today', label: 'Hari ini', helper: 'prioritas', count: attentionCount + runningCount },
    { value: 'department', label: 'AI Dept', helper: 'struktur', count: AI_ARCHITECTURE_NODE_COUNT },
    { value: 'workmap', label: 'Workmap', helper: 'rancangan', count: cLevelPlans.length },
    { value: 'sectors', label: 'Sektor', helper: 'C-level', count: DEPARTMENT_ORDER.length },
    { value: 'learning', label: 'Otak', helper: 'learning', count: learningCount },
    { value: 'costs', label: 'Biaya', helper: 'credits', count: costCount },
    { value: 'system', label: 'Sistem', helper: 'fondasi', count: systemCount },
  ]

  return (
    <nav
      className="mt-3 rounded-2xl border border-white/55 bg-white/40 p-1.5 shadow-soft backdrop-blur-md"
      aria-label="Mode dashboard"
    >
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive = item.value === active

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'min-h-[52px] min-w-[78px] flex-1 rounded-xl px-2.5 py-2 text-left transition-all duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive
                  ? 'bg-white/90 shadow-card ring-1 ring-accent/30'
                  : 'text-text-secondary hover:bg-white/55',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-[12px] font-extrabold',
                    isActive ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                    isActive ? 'bg-accent-bg text-accent-dark' : 'bg-white/50 text-text-muted',
                  )}
                >
                  {item.count}
                </span>
              </span>
              <span
                className={cn(
                  'mt-1 block text-[10px] font-semibold',
                  isActive ? 'text-accent-dark' : 'text-text-faint',
                )}
              >
                {item.helper}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function CommandCenterSection({
  sector,
  attentionCount,
  confirmationBriefs,
  runningBriefs,
  pendingInputBriefs,
  blockerBriefs,
  recentOutputBriefs,
  onCompose,
  onOpenBrief,
}: {
  sector: SectorValue
  attentionCount: number
  confirmationBriefs: Brief[]
  runningBriefs: Brief[]
  pendingInputBriefs: Brief[]
  blockerBriefs: Brief[]
  recentOutputBriefs: Brief[]
  onCompose: () => void
  onOpenBrief: (id: string) => void
}) {
  const sectorLabel = sector === 'all' ? 'Semua sektor' : `${DEPARTMENT_LABEL_SHORT[sector]} / ${sectorMeta[sector].subtitle}`
  const totalQueue = confirmationBriefs.length + runningBriefs.length + pendingInputBriefs.length + blockerBriefs.length

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="mt-4 rounded-2xl border border-white/55 bg-white/55 p-4 shadow-card backdrop-blur-md"
      aria-label="Pusat kendali"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-caps text-accent-dark">Pusat kendali</p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-[1.1] tracking-[-0.01em] text-text-primary">
            Prioritas hari ini
          </h1>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-text-secondary">
            {sectorLabel}. Lihat yang menunggu keputusan, sedang berjalan, butuh input, dan tertahan.
          </p>
        </div>
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-card">
          <Activity className="size-5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MetricTile value={attentionCount} label="attention" />
        <MetricTile value={confirmationBriefs.length} label="confirm" tone="decision" />
        <MetricTile value={runningBriefs.length} label="running" tone="doing" />
        <MetricTile value={blockerBriefs.length} label="blocked" tone="review" />
      </div>

      <div className="mt-3 grid gap-2.5">
        <QueueLaneCard
          title="Perlu Konfirmasi"
          icon={CheckCircle2}
          tone="decision"
          items={confirmationBriefs}
          emptyText="Belum ada keputusan yang menunggu."
          onOpenBrief={onOpenBrief}
        />
        <QueueLaneCard
          title="Sedang Running"
          icon={Timer}
          tone="doing"
          items={runningBriefs}
          emptyText="Belum ada agent yang sedang memproses brief."
          onOpenBrief={onOpenBrief}
        />
        <QueueLaneCard
          title="Todo / Butuh Input"
          icon={ListChecks}
          tone="neutral"
          items={pendingInputBriefs}
          emptyText="Belum ada data yang diminta dari Matthew."
          onOpenBrief={onOpenBrief}
        />
        <QueueLaneCard
          title="Blocked / Review"
          icon={CircleDashed}
          tone="review"
          items={blockerBriefs}
          emptyText="Belum ada hambatan yang perlu dibuka."
          onOpenBrief={onOpenBrief}
        />
      </div>

      {totalQueue === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-accent/30 bg-accent-bg/30 px-3.5 py-3.5">
          <p className="text-sm font-extrabold text-text-primary">Workspace masih bersih</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary">
            Business knowledge tetap aktif. Mulai dengan brief pertama atau tanya Atmaja untuk framing.
          </p>
        </div>
      )}

      {recentOutputBriefs.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/55 bg-white/55 px-3.5 py-3 shadow-soft backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Output terbaru</p>
            <span className="rounded-full bg-status-final-bg px-2 py-0.5 text-[10px] font-extrabold text-status-final">
              {recentOutputBriefs.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenBrief(recentOutputBriefs[0].id)}
            className="mt-2 flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-extrabold text-text-primary">{recentOutputBriefs[0].title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-text-muted">{recentOutputBriefs[0].timeAgo}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-accent-dark" />
          </button>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-3 text-sm font-bold text-white shadow-glow-accent transition-transform duration-fast active:scale-[0.98]"
        >
          <Plus className="size-4" />
          Buat brief baru
        </button>
      </div>
    </motion.section>
  )
}

function QueueLaneCard({
  title,
  icon: Icon,
  tone,
  items,
  emptyText,
  onOpenBrief,
}: {
  title: string
  icon: typeof CheckCircle2
  tone: SectionTone
  items: Brief[]
  emptyText: string
  onOpenBrief: (id: string) => void
}) {
  return (
    <section className="rounded-md border border-border-soft bg-bg-surface px-3 py-2.5" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex size-8 items-center justify-center rounded-md', getToneBg(tone), getToneText(tone))}>
            <Icon className="size-4" />
          </span>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.04em] text-text-primary">{title}</h2>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold', getToneBg(tone), getToneText(tone))}>
          {items.length}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.slice(0, 2).map((brief) => (
            <QueueMiniRow key={brief.id} brief={brief} tone={tone} onClick={() => onOpenBrief(brief.id)} />
          ))
        ) : (
          <p className="rounded-md bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-text-muted">{emptyText}</p>
        )}
      </div>
    </section>
  )
}

function QueueMiniRow({ brief, tone, onClick }: { brief: Brief; tone: SectionTone; onClick: () => void }) {
  const leadRole = getLeadRole(brief)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-md bg-white px-2.5 py-2 text-left shadow-soft transition-colors duration-fast hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className={cn('h-8 w-1 shrink-0 rounded-full', getToneBar(tone))} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-1.5 rounded-full', roleAccent[leadRole])} />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-text-faint">
            {DEPARTMENT_LABEL_SHORT[leadRole]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs font-extrabold text-text-primary">{brief.title}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5" />
    </button>
  )
}

function CLevelPlanCard({ plan, interactive = false }: { plan: CLevelPlan; interactive?: boolean }) {
  const [activeMode, setActiveMode] = useState<CLevelWorkbenchMode>(interactive ? 'visual' : 'brief')

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

      {interactive ? (
        <>
          <CLevelWorkbenchTabs active={activeMode} onChange={setActiveMode} />
          <CLevelWorkbenchPanel mode={activeMode} plan={plan} />
        </>
      ) : (
        <CLevelOverviewPreview plan={plan} />
      )}
    </article>
  )
}

function CLevelOverviewPreview({ plan }: { plan: CLevelPlan }) {
  const timelineAverage = Math.round(plan.timeline.reduce((total, item) => total + item.progress, 0) / plan.timeline.length)

  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Ringkasan sektor</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-text-secondary">
            1 work map, {plan.timeline.length} timeline, {plan.visualPanels.length} visual, {plan.dataSignals.length} data signal.
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-white px-2.5 py-2 text-right">
          <span className="block text-[16px] font-extrabold leading-none text-text-primary">{timelineAverage}%</span>
          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.05em] text-text-faint">progress</span>
        </span>
      </div>
      <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-[11px] font-semibold leading-4 text-text-muted">
        Buka tab sektor {DEPARTMENT_LABEL_SHORT[plan.role]} untuk melihat tombol Timeline, Visual, Data, dan Output.
      </p>
    </div>
  )
}

function CLevelWorkbenchTabs({
  active,
  onChange,
}: {
  active: CLevelWorkbenchMode
  onChange: (mode: CLevelWorkbenchMode) => void
}) {
  const items: Array<{ mode: CLevelWorkbenchMode; label: string; icon: typeof Timer }> = [
    { mode: 'brief', label: 'Brief', icon: ListChecks },
    { mode: 'timeline', label: 'Timeline', icon: Timer },
    { mode: 'visual', label: 'Visual', icon: ImageIcon },
    { mode: 'data', label: 'Data', icon: BarChart3 },
    { mode: 'output', label: 'Output', icon: Table2 },
  ]

  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface p-1" aria-label="C-level workbench mode">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.mode === active

          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => onChange(item.mode)}
              className={cn(
                'inline-flex min-h-touch flex-col items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[10px] font-extrabold transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive ? 'bg-text-primary text-white shadow-soft' : 'text-text-muted hover:bg-white',
              )}
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CLevelWorkbenchPanel({ mode, plan }: { mode: CLevelWorkbenchMode; plan: CLevelPlan }) {
  if (mode === 'brief') return <CLevelBriefPanel plan={plan} />
  if (mode === 'timeline') return <CLevelTimeline items={plan.timeline} />
  if (mode === 'visual') return <CLevelVisualBoard plan={plan} />
  if (mode === 'data') return <CLevelDataSignals plan={plan} />
  return <CLevelOutputList outputs={plan.latestOutputs} />
}

function CLevelBriefPanel({ plan }: { plan: CLevelPlan }) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3" aria-label="C-level brief panel">
      <div className="rounded-md border border-border-soft bg-white px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Mode kerja</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-text-primary">{plan.plannerMode}</p>
      </div>
      <div className="mt-2 rounded-md border border-border-soft bg-white px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Cadence</p>
        <p className="mt-1 text-xs font-bold leading-5 text-text-primary">{plan.planningCadence}</p>
      </div>
      <div className="mt-2 grid gap-2">
        <PlanList label="Dirancang" items={plan.designing} />
        <PlanList label="Pertanyaan planning" items={plan.planningQuestions} />
        <PlanList label="Butuh dari Matthew" items={plan.needsFromMatthew} muted />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {plan.outputFormats.map((format) => (
          <span
            key={format}
            className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-[10px] font-bold text-text-secondary"
          >
            {format}
          </span>
        ))}
      </div>
    </div>
  )
}

function CLevelTimeline({ items }: { items: CLevelTimelineItem[] }) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3" aria-label="C-level timeline">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Timeline kerja</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-text-muted">
          {items.length} phase
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <div key={item.phase} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-text-primary">
                {index + 1}
              </span>
              {index < items.length - 1 && <span className="my-1 h-8 w-px bg-border-med" />}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-text-primary">{item.phase}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-text-muted">{item.window} / {item.owner}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-accent-dark">
                  {item.progress}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${item.progress}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold leading-4 text-text-secondary">Output: {item.output}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CLevelVisualBoard({ plan }: { plan: CLevelPlan }) {
  const { role, visualPanels, workMap } = plan

  return (
    <div className="mt-3 grid gap-2" aria-label="C-level visual board">
      <CLevelWorkMapCard role={role} map={workMap} />
      {visualPanels.map((panel) => (
        <article key={panel.title} className="overflow-hidden rounded-md border border-border-soft bg-bg-surface">
          <div className={cn('relative min-h-[118px] p-3 text-white', roleAccent[role])}>
            <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(90deg,rgba(255,255,255,.36)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.32)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/68">{panel.type}</p>
                <ImageIcon className="size-4 text-white/76" />
              </div>
              <h3 className="mt-1 text-[15px] font-extrabold leading-5">{panel.title}</h3>
              <p className="mt-1 max-w-[320px] text-[11px] font-semibold leading-4 text-white/76">{panel.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-2.5">
            {panel.nodes.map((node) => (
              <div key={node} className="rounded-md border border-border-soft bg-white px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', roleAccent[role])} />
                  <p className="truncate text-[10px] font-extrabold text-text-primary">{node}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

function CLevelWorkMapCard({ role, map }: { role: Exclude<Role, 'ceo'>; map: CLevelWorkMap }) {
  const navigate = useNavigate()

  const openLaneMap = (event: MouseEvent<HTMLAnchorElement>, detailUrl: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    if (shouldOpenWorkMapInApp()) {
      event.preventDefault()
      navigate(detailUrl)
      return
    }

    const opened = window.open(detailUrl, '_blank', 'noopener,noreferrer')
    if (!opened) return

    event.preventDefault()
    opened.opener = null
    opened.focus()
  }

  return (
    <article className="overflow-hidden rounded-md border border-border-med bg-white shadow-soft">
      <div className="relative border-b border-border-soft bg-text-primary px-3 py-3 text-white">
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(90deg,rgba(255,255,255,.34)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.32)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/62">
              Rancangan kerja / {DEPARTMENT_LABEL_SHORT[role]}
            </p>
            <h3 className="mt-1 text-[16px] font-extrabold leading-5">{map.title}</h3>
            <p className="mt-1 max-w-[340px] text-[11px] font-semibold leading-4 text-white/72">{map.summary}</p>
          </div>
          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-md text-white', roleAccent[role])}>
            <GitBranch className="size-4" />
          </span>
        </div>
      </div>

      <div className="bg-bg-surface px-3 py-3">
        <div className="grid gap-2">
          {map.lanes.map((lane, index) => (
            <a
              key={lane.label}
              href={`/workmap/${role}/${index + 1}`}
              target="_blank"
              rel="noopener noreferrer"
              data-workmap-url={`/workmap/${role}/${index + 1}`}
              onClick={(event) => openLaneMap(event, `/workmap/${role}/${index + 1}`)}
              aria-label={`Buka canvas mapping ${lane.label} ${DEPARTMENT_LABEL_SHORT[role]}`}
              className="relative block min-h-[112px] w-full cursor-pointer rounded-md border border-border-soft bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <div className="flex items-start gap-2.5">
                <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white', roleAccent[role])}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold text-text-primary">{lane.label}</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-text-faint">{lane.owner}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-surface px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.04em] text-text-muted">
                      <span className="sm:hidden">buka</span>
                      <span className="hidden sm:inline">buka tab</span>
                      <ChevronRight className="size-3 sm:hidden" />
                      <ExternalLink className="hidden size-3 sm:block" />
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold leading-4 text-text-secondary">{lane.action}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <CLevelMapChip label="Input" value={lane.input} />
                    <CLevelMapChip label="Output" value={lane.output} />
                    <CLevelMapChip label="Need" value={lane.dependency} wide />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-2 rounded-md border border-border-soft bg-white px-3 py-2.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-final" />
            <div>
              <p className="text-[11px] font-extrabold text-text-primary">Decision gate Matthew</p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">{map.decisionGate}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function CLevelMapChip({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('min-h-[48px] rounded-md bg-bg-surface px-2 py-1.5', wide && 'col-span-2')}>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.06em] text-text-faint">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-3 text-text-secondary">{value}</p>
    </div>
  )
}

function CLevelDataSignals({ plan }: { plan: CLevelPlan }) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3" aria-label="C-level data signals">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Data signal</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-text-muted">
          {plan.dataSignals.length} signal
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {plan.dataSignals.map((signal) => (
          <div key={signal.label} className="rounded-md border border-border-soft bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-text-primary">{signal.label}</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">{signal.note}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-extrabold text-text-primary">{signal.value}</p>
                <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.04em]', getConfidenceClass(signal.confidence))}>
                  {signal.confidence}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CLevelOutputList({ outputs }: { outputs: CLevelOutputItem[] }) {
  return (
    <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-3" aria-label="C-level output list">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Output dikirim</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-text-muted">
          {outputs.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {outputs.map((output) => (
          <article key={output.title} className="rounded-md border border-border-soft bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-text-primary">{output.title}</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-text-muted">{output.summary}</p>
                <span className="mt-2 inline-flex rounded-full bg-bg-surface px-2 py-0.5 text-[10px] font-extrabold text-text-secondary">
                  {output.format}
                </span>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.04em]', getPlanStatusClass(output.status))}>
                {getPlanStatusLabel(output.status)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
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
    { icon: GitBranch, label: 'C-level work map', text: 'lane, dependency, artifact, gate' },
    { icon: Table2, label: 'Table', text: 'comparison, supplier, pricing' },
    { icon: BarChart3, label: 'Chart', text: 'ROI, forecast, trend' },
    { icon: GitBranch, label: 'Diagram', text: 'flow, mermaid, process' },
    { icon: ImageIcon, label: 'Image', text: 'visual map, reference, mockup' },
    { icon: ImageIcon, label: 'Generated image', text: 'generated work map draft' },
    { icon: CheckCircle2, label: 'Output contract', text: 'AgentOutputEnvelope siap membawa visual result' },
  ]

  return (
    <section className="mt-4 rounded-lg border border-border-med bg-bg-surface p-3.5" aria-label="Format visual output">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-accent-dark">Visual output</p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">C-level wajib memberi gambaran kerja</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Brief detail bisa berisi work map, grafik, tabel, gambar, diagram, callout, grid C-suite, dan hasil generate image dari agent.
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
    <header className="sticky top-0 z-20 -mx-4 bg-white/60 px-4 pb-3 pt-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[19px] font-extrabold leading-none tracking-[0.01em] text-text-primary">
            Gerai 1000 Pintu
          </p>
          <p className="mt-1.5 text-xs font-semibold text-text-secondary">Hari ini / Dashboard kerja</p>
        </div>
        <div className="rounded-xl border border-white/55 bg-white/70 px-3.5 py-2 text-right shadow-soft backdrop-blur-md">
          <p className="text-[18px] font-extrabold leading-none text-text-primary">{activeCount}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-accent-dark">aktif</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-text-muted">
        <span className="inline-flex size-1.5 rounded-full bg-status-final shadow-[0_0_6px_rgba(61,111,88,0.5)]" />
        <span>{activeCount} brief aktif</span>
        <span className="size-1 rounded-full bg-text-faint" />
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
        : tone === 'review'
          ? 'text-status-review'
          : 'text-text-primary'
  const bgTone =
    tone === 'decision'
      ? 'bg-status-decision-bg/40'
      : tone === 'doing'
        ? 'bg-status-doing-bg/40'
        : tone === 'review'
          ? 'bg-status-review-bg/40'
          : 'bg-white/55'

  return (
    <div
      className={cn(
        'min-h-[80px] rounded-xl border border-white/55 px-2 py-3 text-center shadow-soft backdrop-blur-sm',
        bgTone,
      )}
    >
      <p className={cn('text-[26px] font-extrabold leading-none tracking-[-0.01em]', toneClass)}>{value}</p>
      <p className="mx-auto mt-2 max-w-[64px] text-[10px] font-semibold uppercase tracking-[0.06em] leading-[1.15] text-text-muted">
        {label}
      </p>
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

function getConfidenceClass(confidence: 'high' | 'medium' | 'low') {
  if (confidence === 'high') return 'bg-status-final-bg text-status-final'
  if (confidence === 'medium') return 'bg-status-doing-bg text-status-doing'
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

function getIntelligenceFlow(dimension: IntelligenceDimension) {
  const base = {
    input: 'Matthew memberi brief, approval, revisi, atau preference signal.',
    output: 'Atmaja mengubahnya menjadi rekomendasi, visual brief, atau decision gate.',
    feedback: 'Hasil approval/revisi masuk kembali sebagai lesson untuk keputusan berikutnya.',
  }

  if (dimension.id === 'self-learning') {
    return [
      base.input,
      'App mengekstrak lesson ringkas, bukan menyimpan raw chat sebagai memory default.',
      'Lesson dipakai untuk menyesuaikan format, tone, workflow, dan standar output.',
      base.feedback,
    ]
  }

  if (dimension.id === 'research-intelligence') {
    return [
      'Brief riset memicu Web Researcher atau Market Researcher.',
      'Tavily mencari source, lalu agent memisahkan fact, inference, dan limited data.',
      'Evidence masuk ke table, market signal, competitor map, atau source log.',
      base.output,
    ]
  }

  if (dimension.id === 'autonomy') {
    return [
      'Trigger datang dari jadwal, market signal, blocker, atau brief Matthew.',
      'Atmaja menentukan apakah cukup aman untuk jalan sendiri atau perlu approval dulu.',
      'C-level menjalankan scan, draft plan, dan follow-up sesuai role.',
      'Aksi penting tetap berhenti di Matthew approval gate.',
    ]
  }

  if (dimension.id === 'safety-judgment') {
    return [
      'Sistem membaca apakah data, tool, dan aksi punya risiko keamanan atau platform.',
      'Action berisiko seperti social scraping login/cookies/proxy ditolak.',
      'Agent memilih jalur resmi, source publik, atau menandai limited visibility.',
      'Keputusan sensitif naik ke Matthew approval gate.',
    ]
  }

  return [
    base.input,
    `${dimension.title} membaca konteks, evidence, dan gap yang tersedia.`,
    'Agent menyusun arsitektur kerja: siapa pegang apa, data apa kurang, output apa keluar.',
    base.output,
    base.feedback,
  ]
}

function getSystemFlow(area: DepartmentStrengthArea) {
  if (area.id === 'integration') {
    return [
      'Brief dibuat di app dan disimpan lokal lebih dulu.',
      'Submit bridge hanya aktif jika VITE_GERAI_AGENT_BRIDGE=on.',
      'Hasil agent nantinya dipolling kembali sebagai structured result.',
      'Matthew approve, revisi, atau arsipkan ke memory.',
    ]
  }

  if (area.id === 'agent-runtime') {
    return [
      'OpenClaw menjalankan Atmaja dan 16 agent lain di droplet.',
      'Atmaja membagi brief ke C-level, C-level memanggil specialist.',
      'Tool seperti Tavily dipakai saat data eksternal dibutuhkan.',
      'Runtime health dan job metrics akan ditampilkan balik ke app.',
    ]
  }

  if (area.id === 'automation') {
    return [
      'Trigger berasal dari jadwal, dashboard pending, market alert, atau follow-up.',
      'Skill automation memberi checklist audit, runbook, dan approval gate.',
      'Queue menentukan owner dan prioritas saat runtime sudah diaktifkan.',
      'Approval routing menentukan mana yang boleh lanjut dan mana yang harus ditahan.',
    ]
  }

  if (area.id === 'security') {
    return [
      'Bridge agent dan telemetry off by default.',
      'Private Sync Vault memindahkan data lewat file yang bisa masuk folder Syncthing.',
      'Secret tetap server-side dan tidak dibundle ke frontend.',
      'Runtime server tetap perlu allowlist, audit log, dan backup rotation.',
    ]
  }

  return [
    'Input datang dari brief, dashboard, atau ritme planning.',
    `${area.title} memproses capability inti dan gap yang belum matang.`,
    'Output menjadi visual brief, workflow, table, chart, atau decision gate.',
    'Feedback Matthew menaikkan maturity melalui approval, revisi, dan memory.',
  ]
}

function getIntelligenceIndex(snapshot: LearningSnapshot) {
  const baseScore = Math.round(
    intelligenceDimensions.reduce((total, dimension) => total + dimension.score, 0) / intelligenceDimensions.length,
  )
  const lessonBonus = Math.min(5, Math.floor(snapshot.total / 3))
  const trustBonus = Math.min(4, snapshot.highConfidence)

  return Math.min(120, baseScore + lessonBonus + trustBonus)
}

function getIntelligenceStage(score: number) {
  if (score >= 111) return intelligenceStages[4]
  if (score >= 101) return intelligenceStages[3]
  if (score >= 86) return intelligenceStages[2]
  if (score >= 61) return intelligenceStages[1]
  return intelligenceStages[0]
}

function getIntelligenceStatusClass(status: IntelligenceDimension['status']) {
  if (status === 'strong') return 'bg-status-final-bg text-status-final'
  if (status === 'active') return 'bg-status-doing-bg text-status-doing'
  if (status === 'developing') return 'bg-status-review-bg text-status-review'
  return 'bg-status-decision-bg text-status-decision'
}

function getIntelligenceBarClass(status: IntelligenceDimension['status']) {
  if (status === 'strong') return 'bg-status-final'
  if (status === 'active') return 'bg-status-doing'
  if (status === 'developing') return 'bg-status-review'
  return 'bg-status-decision'
}

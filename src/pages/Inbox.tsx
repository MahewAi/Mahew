import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Database,
  GitBranch,
  KeyRound,
  Image as ImageIcon,
  Layers3,
  ListChecks,
  Network,
  PlugZap,
  Plus,
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
  submitAgentBrief,
  type AgentHealth,
  type SubmitAgentBriefResult,
} from '@/lib/agentApi'
import { loadStoredBriefs, saveStoredBriefs } from '@/lib/briefStore'
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
type DashboardView = 'today' | 'sectors' | 'system'

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

export default function Inbox() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [briefs, setBriefs] = useState<Brief[]>(() => loadStoredBriefs())
  const [sector, setSector] = useState<SectorValue>('all')
  const [dashboardView, setDashboardView] = useState<DashboardView>('today')
  const [composeOpen, setComposeOpen] = useState(false)
  const [agentHealth, setAgentHealth] = useState<AgentHealth>(fallbackAgentHealth)
  const [lastBridgeResult, setLastBridgeResult] = useState<SubmitAgentBriefResult | null>(null)
  const [learningVersion, setLearningVersion] = useState(0)

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

        <DashboardViewTabs
          active={dashboardView}
          onChange={setDashboardView}
          attentionCount={attentionCount}
          runningCount={runningBriefs.length}
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

        {dashboardView === 'sectors' && (
          <>
            <SectorTabs active={sector} onChange={setSector} />
            {sector === 'all' ? (
              <CLevelPlanSection plans={visiblePlans} />
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

        {dashboardView === 'system' && (
          <>
            <PlanningNorthStarSection />
            <LearningMemorySection snapshot={learningSnapshot} />
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
          <CLevelPlanSection plans={plans} />
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

function DashboardViewTabs({
  active,
  onChange,
  attentionCount,
  runningCount,
  systemCount,
}: {
  active: DashboardView
  onChange: (view: DashboardView) => void
  attentionCount: number
  runningCount: number
  systemCount: number
}) {
  const items: Array<{ value: DashboardView; label: string; helper: string; count: number }> = [
    { value: 'today', label: 'Hari ini', helper: 'prioritas', count: attentionCount + runningCount },
    { value: 'sectors', label: 'Sektor', helper: 'C-level', count: DEPARTMENT_ORDER.length },
    { value: 'system', label: 'Sistem', helper: 'fondasi', count: systemCount },
  ]

  return (
    <nav className="mt-3 rounded-lg border border-border-med bg-white p-1 shadow-soft" aria-label="Mode dashboard">
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => {
          const isActive = item.value === active

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'min-h-[58px] rounded-md px-2 py-2 text-left transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive ? 'bg-text-primary text-white shadow-card' : 'text-text-secondary hover:bg-bg-surface',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold">{item.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                    isActive ? 'bg-white/16 text-white' : 'bg-bg-surface text-text-muted',
                  )}
                >
                  {item.count}
                </span>
              </span>
              <span className={cn('mt-1 block text-[10px] font-semibold', isActive ? 'text-white/60' : 'text-text-faint')}>
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
      className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-card"
      aria-label="Pusat kendali"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-caps text-accent-dark">Pusat kendali</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-[1.08] tracking-[0] text-text-primary">
            Prioritas hari ini
          </h1>
          <p className="mt-2 text-xs font-semibold leading-5 text-text-secondary">
            {sectorLabel}. Lihat yang menunggu keputusan, sedang berjalan, butuh input, dan tertahan.
          </p>
        </div>
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-text-primary text-white shadow-card">
          <Activity className="size-5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 divide-x divide-border-med rounded-md border border-border-med bg-bg-surface">
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
        <div className="mt-3 rounded-md border border-dashed border-border-med bg-bg-surface px-3 py-3">
          <p className="text-sm font-extrabold text-text-primary">Workspace masih bersih</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-text-muted">
            Business knowledge tetap aktif. Mulai dengan brief pertama atau tanya Atmaja untuk framing.
          </p>
        </div>
      )}

      {recentOutputBriefs.length > 0 && (
        <div className="mt-3 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Output terbaru</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-status-final">
              {recentOutputBriefs.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenBrief(recentOutputBriefs[0].id)}
            className="mt-2 flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-extrabold text-text-primary">{recentOutputBriefs[0].title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-text-muted">{recentOutputBriefs[0].timeAgo}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-text-faint" />
          </button>
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-md bg-text-primary px-3 text-sm font-bold text-white shadow-card transition-transform duration-fast active:scale-[0.98]"
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
          <p className="mt-2 rounded-md bg-bg-surface px-2.5 py-2 text-[11px] font-semibold leading-4 text-text-primary">
            {plan.plannerMode}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]', getPlanStatusClass(plan.status))}>
          {getPlanStatusLabel(plan.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded-md border border-border-soft bg-bg-surface px-3 py-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-faint">Cadence</p>
          <p className="mt-1 text-xs font-bold leading-5 text-text-primary">{plan.planningCadence}</p>
        </div>
        <PlanList label="Dirancang" items={plan.designing} />
        <PlanList label="Pertanyaan planning" items={plan.planningQuestions} />
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
        <div className="rounded-md border border-border-med bg-white px-3 py-2 text-right shadow-soft">
          <p className="text-[17px] font-extrabold leading-none text-text-primary">{activeCount}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">aktif</p>
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
        : tone === 'review'
          ? 'text-status-review'
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

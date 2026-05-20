import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Image as ImageIcon,
  Layers3,
  Network,
  Route,
  ShieldCheck,
  Table2,
  Workflow,
} from 'lucide-react'
import { cLevelPlans, type CLevelPlan, type CLevelWorkLane } from '@/data/cLevelPlans'
import { DEPARTMENT_LABEL_SHORT, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'

const roleAccent: Record<Exclude<Role, 'ceo'>, string> = {
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

const roleBorder: Record<Exclude<Role, 'ceo'>, string> = {
  coo: 'border-role-coo/35',
  cmo: 'border-role-cmo/35',
  cfo: 'border-role-cfo/35',
  cco: 'border-role-cco/35',
}

type WorkMapNode = {
  id: string
  label: string
  value: string
  x: number
  y: number
  w: number
}

export default function WorkMapDetail() {
  const params = useParams<{ role?: string; lane?: string }>()
  const plan = cLevelPlans.find((item) => item.role === params.role)
  const laneIndex = Math.max(0, Number(params.lane ?? '1') - 1)
  const lane = plan?.workMap.lanes[laneIndex]

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [params.role, params.lane])

  if (!plan || !lane) {
    return <WorkMapMissing />
  }

  const role = plan.role
  const laneNumber = laneIndex + 1

  return (
    <main className="min-h-screen bg-bg-app px-4 pb-12 pt-safe-top">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-3 py-4">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-med bg-white px-3 text-xs font-extrabold text-text-secondary shadow-soft transition hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <span className={cn('inline-flex min-h-11 items-center rounded-md px-3 text-xs font-extrabold text-white shadow-soft', roleAccent[role])}>
            {DEPARTMENT_LABEL_SHORT[role]} map
          </span>
        </header>

        <section className="overflow-hidden rounded-lg border border-text-primary bg-text-primary text-white shadow-card">
          <div className="relative px-4 py-5 md:px-6">
            <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(90deg,rgba(255,255,255,.34)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.32)_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/62">
                  Workmap canvas / lane {laneNumber}
                </p>
                <h1 className="mt-2 max-w-2xl text-[28px] font-extrabold leading-8 md:text-[36px] md:leading-10">
                  {lane.label}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/74">{lane.action}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 md:min-w-[300px]">
                <HeroMetric label="owner" value={lane.owner} />
                <HeroMetric label="output" value={lane.output} />
                <HeroMetric label="role" value={DEPARTMENT_LABEL_SHORT[role]} />
              </div>
            </div>
          </div>
        </section>

        <WorkMapVisualImage role={role} plan={plan} lane={lane} laneIndex={laneIndex} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-lg border border-border-med bg-white shadow-soft" aria-label="Canvas mapping alur kerja">
            <div className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
              <div>
                <p className="text-label-caps text-accent-dark">Canvas mapping</p>
                <h2 className="mt-1 text-[18px] font-extrabold leading-6 text-text-primary">Alur kerja yang harus terjadi</h2>
              </div>
              <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-md text-white', roleAccent[role])}>
                <Workflow className="size-4" />
              </span>
            </div>
            <WorkMapCanvas role={role} plan={plan} lane={lane} laneIndex={laneIndex} />
          </section>

          <aside className="space-y-3">
            <InfoPanel icon={Layers3} title="Input" value={lane.input} />
            <InfoPanel icon={Network} title="Dependency" value={lane.dependency} />
            <InfoPanel icon={CheckCircle2} title="Output" value={lane.output} />
            <InfoPanel icon={ShieldCheck} title="Decision gate Matthew" value={plan.workMap.decisionGate} />
          </aside>
        </div>

        <section className="mt-4 rounded-lg border border-border-med bg-white p-3.5 shadow-soft" aria-label="Lane lain dalam workmap">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-label-caps text-text-muted">Sequence</p>
              <h2 className="mt-1 text-[17px] font-extrabold leading-5 text-text-primary">{plan.workMap.title}</h2>
            </div>
            <GitBranch className="size-4 text-text-muted" />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {plan.workMap.lanes.map((item, index) => {
              const active = index === laneIndex

              return (
                <Link
                  key={item.label}
                  to={`/workmap/${role}/${index + 1}`}
                  className={cn(
                    'min-h-[72px] rounded-md border px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    active ? cn('bg-bg-surface', roleBorder[role]) : 'border-border-soft bg-white hover:bg-bg-surface',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white', roleAccent[role])}>
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-text-primary">{item.label}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-text-muted">{item.action}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

function WorkMapVisualImage({
  role,
  plan,
  lane,
  laneIndex,
}: {
  role: Exclude<Role, 'ceo'>
  plan: CLevelPlan
  lane: CLevelWorkLane
  laneIndex: number
}) {
  const visualPanel = plan.visualPanels[laneIndex % Math.max(1, plan.visualPanels.length)]
  const visualNodes = visualPanel?.nodes.slice(0, 5) ?? plan.workMap.lanes.map((item) => item.label)
  const nextLane = plan.workMap.lanes[laneIndex + 1] ?? plan.workMap.lanes[0]

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-label="Visual image dan mapping workmap">
      <div className="overflow-hidden rounded-lg border border-border-med bg-white shadow-soft">
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div>
            <p className="text-label-caps text-accent-dark">Visual image</p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-6 text-text-primary">Blueprint gambar kerja</h2>
          </div>
          <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-md text-white', roleAccent[role])}>
            <ImageIcon className="size-4" />
          </span>
        </div>

        <div className="overflow-x-auto bg-bg-surface p-3 [scrollbar-width:thin]">
          <div
            className="relative h-[360px] w-[780px] overflow-hidden rounded-md border border-[#2b2926] bg-[#151412]"
            data-testid="workmap-visual-image"
            role="img"
            aria-label={`Visual blueprint ${lane.label} ${DEPARTMENT_LABEL_SHORT[role]}`}
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          >
            <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/48">
              <span className={cn('inline-flex size-2 rounded-full shadow-[0_0_16px_rgba(255,255,255,0.35)]', roleAccent[role])} />
              {visualPanel?.type ?? 'map'} blueprint
            </div>

            <svg className="absolute inset-0 size-full" viewBox="0 0 780 360" aria-hidden="true">
              <defs>
                <marker id="visual-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#b8a98f" />
                </marker>
              </defs>
              <g fill="none" stroke="#b8a98f" strokeLinecap="round" strokeWidth="1.4" opacity="0.82" markerEnd="url(#visual-arrow)">
                <path d="M 116 118 C 170 70, 254 68, 326 118" />
                <path d="M 326 118 C 408 168, 486 164, 566 112" />
                <path d="M 566 112 C 612 154, 634 206, 604 262" />
                <path d="M 604 262 C 480 306, 318 300, 184 256" />
                <path d="M 184 256 C 126 222, 94 172, 116 118" />
              </g>
              <g>
                <rect x="48" y="76" width="136" height="84" rx="10" fill="#2d2c2b" stroke="#746b61" />
                <rect x="258" y="78" width="136" height="84" rx="10" fill="#40372f" stroke="#b8956b" />
                <rect x="498" y="70" width="136" height="84" rx="10" fill="#2d2c2b" stroke="#746b61" />
                <rect x="502" y="230" width="204" height="74" rx="10" fill="#262524" stroke="#746b61" />
                <rect x="78" y="218" width="212" height="80" rx="10" fill="#262524" stroke="#746b61" />
                <text x="68" y="104" fill="#f6efe7" fontSize="12" fontWeight="800">INPUT</text>
                <text x="68" y="126" fill="#d6c8b8" fontSize="11">{shortenForSvg(lane.input, 22)}</text>
                <text x="278" y="106" fill="#f6efe7" fontSize="12" fontWeight="800">ACTION</text>
                <text x="278" y="128" fill="#d6c8b8" fontSize="11">{shortenForSvg(lane.label, 24)}</text>
                <text x="518" y="98" fill="#f6efe7" fontSize="12" fontWeight="800">OUTPUT</text>
                <text x="518" y="120" fill="#d6c8b8" fontSize="11">{shortenForSvg(lane.output, 24)}</text>
                <text x="522" y="258" fill="#f6efe7" fontSize="12" fontWeight="800">NEXT MAP</text>
                <text x="522" y="280" fill="#d6c8b8" fontSize="11">{shortenForSvg(nextLane.label, 28)}</text>
                <text x="98" y="246" fill="#f6efe7" fontSize="12" fontWeight="800">DECISION GATE</text>
                <text x="98" y="268" fill="#d6c8b8" fontSize="11">{shortenForSvg(lane.dependency, 30)}</text>
              </g>
            </svg>

            <div className="absolute bottom-4 left-4 right-4 grid grid-cols-5 gap-2">
              {visualNodes.map((node, index) => (
                <div key={node} className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-white">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-white/42">node {index + 1}</p>
                  <p className="mt-1 truncate text-[11px] font-extrabold">{node}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <VisualBriefPanel icon={Route} title={visualPanel?.title ?? plan.workMap.title} body={visualPanel?.description ?? plan.workMap.summary} />
        <VisualBriefPanel icon={Table2} title="Mapping output" body={`${lane.output} dikaitkan ke ${nextLane.label} agar alur lanjutnya terlihat.`} />
        <VisualBriefPanel icon={ShieldCheck} title="Decision guard" body={plan.workMap.decisionGate} />
      </div>
    </section>
  )
}

function WorkMapCanvas({
  role,
  plan,
  lane,
  laneIndex,
}: {
  role: Exclude<Role, 'ceo'>
  plan: CLevelPlan
  lane: CLevelWorkLane
  laneIndex: number
}) {
  const nodes: WorkMapNode[] = [
    { id: 'input', label: 'Input', value: lane.input, x: 36, y: 44, w: 156 },
    { id: 'action', label: 'Action', value: lane.action, x: 248, y: 44, w: 198 },
    { id: 'output', label: 'Output', value: lane.output, x: 506, y: 44, w: 166 },
    { id: 'gate', label: 'Gate', value: lane.dependency, x: 330, y: 180, w: 228 },
  ]

  return (
    <div className="overflow-x-auto bg-bg-surface p-3 [scrollbar-width:thin]">
      <div
        className="relative h-[318px] w-[760px] overflow-hidden rounded-md border border-border-soft bg-[#171614]"
        data-testid="workmap-canvas"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/48">
          <span className={cn('inline-flex size-2 rounded-full shadow-[0_0_16px_rgba(255,255,255,0.35)]', roleAccent[role])} />
          {DEPARTMENT_LABEL_SHORT[role]} lane {laneIndex + 1}
        </div>

        <svg className="absolute inset-0 size-full" viewBox="0 0 760 318" aria-hidden="true">
          <defs>
            <marker id="workmap-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#9a9288" />
            </marker>
          </defs>
          <g fill="none" stroke="#9a9288" strokeLinecap="round" strokeWidth="1.3" opacity="0.86" markerEnd="url(#workmap-arrow)">
            <path d="M 192 92 C 212 92, 226 92, 248 92" />
            <path d="M 446 92 C 468 92, 484 92, 506 92" />
            <path d="M 588 124 C 588 160, 532 178, 558 216" />
            <path d="M 330 216 C 258 210, 156 172, 124 124" />
          </g>
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              'absolute z-20 min-h-[82px] rounded-md border px-3 py-2.5 text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)]',
              node.id === 'action' ? 'border-[#B8956B] bg-[#40372f]' : 'border-white/12 bg-[#2c2b29]',
            )}
            style={{ left: node.x, top: node.y, width: node.w }}
          >
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/50">{node.label}</p>
            <p className="mt-1 text-[12px] font-extrabold leading-4">{node.value}</p>
          </div>
        ))}

        <div className="absolute bottom-3 left-3 right-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-white">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/48">Context</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-white/72">{plan.workMap.summary}</p>
        </div>
      </div>
    </div>
  )
}

function VisualBriefPanel({ icon: Icon, title, body }: { icon: typeof Route; title: string; body: string }) {
  return (
    <section className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-[12px] font-extrabold text-text-primary">{title}</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-text-muted">{body}</p>
        </div>
      </div>
    </section>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[58px] rounded-md bg-white px-3 py-2 text-text-primary">
      <p className="truncate text-[13px] font-extrabold leading-4">{value}</p>
      <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.06em] text-text-faint">{label}</p>
    </div>
  )
}

function shortenForSvg(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function InfoPanel({ icon: Icon, title, value }: { icon: typeof Layers3; title: string; value: string }) {
  return (
    <section className="rounded-lg border border-border-med bg-white p-3.5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-faint">{title}</p>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-text-secondary">{value}</p>
        </div>
      </div>
    </section>
  )
}

function WorkMapMissing() {
  return (
    <main className="min-h-screen bg-bg-app px-4 pt-safe-top">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center">
        <section className="rounded-lg border border-border-med bg-white p-5 text-center shadow-soft">
          <p className="text-label-caps text-text-muted">Workmap tidak ditemukan</p>
          <h1 className="mt-2 text-[24px] font-extrabold leading-7 text-text-primary">Canvas ini belum tersedia</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-text-secondary">
            Pilih lane dari dashboard Workmap agar route detail memakai data C-level yang valid.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-text-primary px-4 text-sm font-extrabold text-white shadow-card"
          >
            Kembali ke dashboard
          </Link>
        </section>
      </div>
    </main>
  )
}

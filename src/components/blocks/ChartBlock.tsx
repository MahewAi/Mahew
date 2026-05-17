import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import type { ChartData, ChartKind, ChartOptions } from '@/lib/types'

interface ChartBlockProps {
  kind: ChartKind
  data: ChartData
  options?: ChartOptions
  caption?: string
}

const defaultPalette = [
  'hsl(33, 36%, 57%)', // accent brass
  'hsl(215, 38%, 40%)', // doing blue
  'hsl(145, 28%, 34%)', // final green
  'hsl(14, 50%, 51%)', // decision coral
  'hsl(313, 22%, 43%)', // review plum
  'hsl(46, 65%, 50%)', // gold
]

const axisStyle = { fontSize: 11, fill: 'hsl(30, 12%, 45%)' }
const gridStyle = { stroke: 'hsl(36, 14%, 86%)', strokeDasharray: '3 3' }

export function ChartBlock({ kind, data, options, caption }: ChartBlockProps) {
  const xKey = data.xKey ?? 'label'
  const showLegend = options?.legend ?? data.series.length > 1

  return (
    <figure className="my-4">
      <div className="rounded-[16px] glass-soft shadow-glass p-3 pr-1">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart({ kind, data, xKey, showLegend })}
          </ResponsiveContainer>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2 text-meta text-text-muted italic text-center">{caption}</figcaption>
      )}
    </figure>
  )
}

function renderChart({
  kind,
  data,
  xKey,
  showLegend,
}: {
  kind: ChartKind
  data: ChartData
  xKey: string
  showLegend: boolean
}) {
  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: '12px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px -8px rgba(31,26,20,0.2)',
      fontSize: '12px',
    },
    labelStyle: { color: 'hsl(30, 20%, 10%)', fontWeight: 600, fontSize: '11px' },
    itemStyle: { color: 'hsl(30, 15%, 37%)' },
  }

  switch (kind) {
    case 'bar':
      return (
        <BarChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <YAxis tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
          {data.series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label ?? s.key}
              fill={s.color ?? defaultPalette[i % defaultPalette.length]}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      )
    case 'line':
      return (
        <LineChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <YAxis tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
          {data.series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color ?? defaultPalette[i % defaultPalette.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      )
    case 'area':
      return (
        <AreaChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <defs>
            {data.series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={s.color ?? defaultPalette[i % defaultPalette.length]}
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor={s.color ?? defaultPalette[i % defaultPalette.length]}
                  stopOpacity={0.05}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <YAxis tick={axisStyle} stroke="hsl(30, 12%, 45%)" />
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
          {data.series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color ?? defaultPalette[i % defaultPalette.length]}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
            />
          ))}
        </AreaChart>
      )
    case 'pie': {
      const series = data.series[0]
      if (!series) return <></>
      return (
        <PieChart margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
          <Tooltip {...tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
          <Pie
            data={data.points}
            dataKey={series.key}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={2}
          >
            {data.points.map((_, i) => (
              <Cell key={i} fill={defaultPalette[i % defaultPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      )
    }
  }
}

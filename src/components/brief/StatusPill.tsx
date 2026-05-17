import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const pill = cva(
  'inline-flex items-center font-semibold tracking-wider uppercase whitespace-nowrap',
  {
    variants: {
      variant: {
        decision: 'bg-status-decision-bg text-status-decision',
        doing: 'bg-status-doing-bg text-status-doing',
        review: 'bg-status-review-bg text-status-review',
        final: 'bg-status-final-bg text-status-final',
        priority: 'bg-status-decision-bg text-status-decision',
        strategi: 'bg-accent-bg text-accent-dark',
        pricing: 'bg-accent-bg text-accent-dark',
        operasi: 'bg-accent-bg text-accent-dark',
        marketing: 'bg-accent-bg text-accent-dark',
        branding: 'bg-accent-bg text-accent-dark',
        neutral: 'bg-bg-soft text-text-secondary',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px] rounded-md',
        md: 'px-3 py-1 text-xs rounded-md',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'sm',
    },
  },
)

type StatusPillVariant = NonNullable<VariantProps<typeof pill>['variant']>

interface StatusPillProps extends VariantProps<typeof pill> {
  children: React.ReactNode
  className?: string
}

export function StatusPill({ variant, size, className, children }: StatusPillProps) {
  return <span className={cn(pill({ variant, size }), className)}>{children}</span>
}

const labelByStatus: Record<'decision' | 'doing' | 'review' | 'final', string> = {
  decision: 'Keputusan',
  doing: 'Berjalan',
  review: 'Tinjau',
  final: 'Final',
}

export function getStatusLabel(status: keyof typeof labelByStatus): string {
  return labelByStatus[status]
}

const categoryToVariant: Record<string, StatusPillVariant> = {
  Strategi: 'strategi',
  Pricing: 'pricing',
  Operasi: 'operasi',
  Marketing: 'marketing',
  Branding: 'branding',
}

export function getCategoryVariant(label: string): StatusPillVariant {
  return categoryToVariant[label] ?? 'neutral'
}

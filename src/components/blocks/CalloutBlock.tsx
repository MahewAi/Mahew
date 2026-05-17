import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { CalloutVariant } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MarkdownBlock } from './MarkdownBlock'

interface CalloutBlockProps {
  variant: CalloutVariant
  title?: string
  content: string
}

const variantStyle: Record<
  CalloutVariant,
  { bg: string; border: string; icon: typeof Info; iconColor: string; titleColor: string }
> = {
  info: {
    bg: 'bg-status-doing-bg',
    border: 'border-status-doing/30',
    icon: Info,
    iconColor: 'text-status-doing',
    titleColor: 'text-status-doing',
  },
  warning: {
    bg: 'bg-[hsl(38,70%,94%)]',
    border: 'border-[hsl(38,55%,60%)]/40',
    icon: AlertTriangle,
    iconColor: 'text-[hsl(38,75%,40%)]',
    titleColor: 'text-[hsl(38,75%,32%)]',
  },
  success: {
    bg: 'bg-status-final-bg',
    border: 'border-status-final/30',
    icon: CheckCircle2,
    iconColor: 'text-status-final',
    titleColor: 'text-status-final',
  },
  danger: {
    bg: 'bg-status-decision-bg',
    border: 'border-status-decision/30',
    icon: XCircle,
    iconColor: 'text-status-decision',
    titleColor: 'text-status-decision',
  },
}

export function CalloutBlock({ variant, title, content }: CalloutBlockProps) {
  const style = variantStyle[variant]
  const Icon = style.icon

  return (
    <div className={cn('my-4 rounded-[16px] border-l-4 p-4 shadow-glass', style.bg, style.border)}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn('size-5 shrink-0 mt-0.5', style.iconColor)} />
        <div className="flex-1 min-w-0">
          {title && <p className={cn('text-sm font-semibold mb-1', style.titleColor)}>{title}</p>}
          <MarkdownBlock content={content} className="[&_p]:mb-0 [&_p]:text-sm [&_p]:text-text-primary [&_p:last-child]:mb-0" />
        </div>
      </div>
    </div>
  )
}

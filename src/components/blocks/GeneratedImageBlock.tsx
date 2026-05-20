import { AlertTriangle, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { GeneratedImageAspectRatio, GeneratedImageStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GeneratedImageBlockProps {
  title?: string
  prompt: string
  src?: string
  alt: string
  caption?: string
  status?: GeneratedImageStatus
  provider?: string
  generatedAt?: string
  aspectRatio?: GeneratedImageAspectRatio
}

const ratioClass: Record<GeneratedImageAspectRatio, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
}

const statusMeta: Record<
  GeneratedImageStatus,
  { label: string; className: string; icon: typeof Sparkles }
> = {
  queued: {
    label: 'Queued',
    className: 'bg-bg-soft text-text-muted',
    icon: Loader2,
  },
  generating: {
    label: 'Generating',
    className: 'bg-status-doing-bg text-status-doing',
    icon: Loader2,
  },
  completed: {
    label: 'Generated',
    className: 'bg-status-final-bg text-status-final',
    icon: Sparkles,
  },
  failed: {
    label: 'Failed',
    className: 'bg-status-decision-bg text-status-decision',
    icon: AlertTriangle,
  },
}

export function GeneratedImageBlock({
  title,
  prompt,
  src,
  alt,
  caption,
  status = src ? 'completed' : 'generating',
  provider,
  generatedAt,
  aspectRatio = '16:9',
}: GeneratedImageBlockProps) {
  const [loadFailed, setLoadFailed] = useState(false)
  const meta = statusMeta[loadFailed ? 'failed' : status]
  const StatusIcon = meta.icon
  const canShowImage = Boolean(src) && status !== 'failed' && !loadFailed

  return (
    <figure className="my-4 overflow-hidden rounded-[16px] border border-border-soft bg-bg-surface shadow-glass">
      <div className="flex items-start justify-between gap-3 border-b border-border-soft bg-white/70 px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
              <ImageIcon aria-hidden="true" className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-label-caps text-text-muted">Generated image</p>
              {title && <h3 className="truncate text-sm font-extrabold text-text-primary">{title}</h3>}
            </div>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]',
            meta.className,
          )}
        >
          <StatusIcon
            aria-hidden="true"
            className={cn('size-3', (status === 'queued' || status === 'generating') && !loadFailed && 'animate-spin')}
          />
          {meta.label}
        </span>
      </div>

      <div className={cn('relative overflow-hidden bg-[#151412]', ratioClass[aspectRatio])}>
        {canShowImage ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setLoadFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#FAF8F4,#EDDFC8)] px-6 text-center">
            {loadFailed || status === 'failed' ? (
              <AlertTriangle aria-hidden="true" className="size-8 text-status-decision" />
            ) : (
              <Loader2 aria-hidden="true" className="size-8 animate-spin text-accent-dark" />
            )}
            <p className="text-sm font-extrabold text-text-primary">
              {loadFailed || status === 'failed' ? 'Gambar belum bisa dimuat' : 'Gambar sedang digenerate'}
            </p>
            <p className="max-w-[280px] text-xs font-semibold leading-5 text-text-muted">
              {loadFailed || status === 'failed'
                ? 'Cek URL atau hasil generator dari backend.'
                : 'Preview akan muncul otomatis saat generator mengirim URL atau data image.'}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 px-3.5 py-3">
        <div className="rounded-md border border-border-soft bg-white px-3 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Prompt</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-text-primary">{prompt}</p>
        </div>

        {(provider || generatedAt) && (
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-text-muted">
            {provider && <span className="rounded-full bg-white px-2 py-1">{provider}</span>}
            {generatedAt && <span className="rounded-full bg-white px-2 py-1">{generatedAt}</span>}
          </div>
        )}
      </div>

      {caption && <figcaption className="px-3.5 pb-3 text-center text-meta italic text-text-muted">{caption}</figcaption>}
    </figure>
  )
}

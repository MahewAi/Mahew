import type { GridItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MarkdownBlock } from './MarkdownBlock'

interface GridBlockProps {
  columns: number
  items: GridItem[]
}

export function GridBlock({ columns, items }: GridBlockProps) {
  const cols = Math.min(Math.max(columns, 1), 4)
  const gridCols =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-4'

  return (
    <div className={cn('my-4 grid gap-2.5', gridCols)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            'rounded-[14px] glass-soft shadow-glass p-4 relative overflow-hidden',
          )}
          style={item.accent ? { borderLeft: `3px solid ${item.accent}` } : undefined}
        >
          <p className="text-label-caps text-text-muted mb-1.5">{item.title}</p>
          <MarkdownBlock
            content={item.content}
            className="[&_p]:mb-0 [&_p]:text-[13px] [&_p]:leading-[18px]"
          />
        </div>
      ))}
    </div>
  )
}

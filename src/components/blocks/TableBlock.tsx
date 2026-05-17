import type { CellAlign } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TableBlockProps {
  headers: string[]
  rows: string[][]
  align?: CellAlign[]
  caption?: string
}

const alignClass: Record<CellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function TableBlock({ headers, rows, align, caption }: TableBlockProps) {
  return (
    <figure className="my-4">
      <div className="overflow-x-auto rounded-[16px] glass-soft shadow-glass">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/40">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-3.5 py-3 text-label-caps text-text-muted whitespace-nowrap',
                    align?.[i] ? alignClass[align[i]] : 'text-left',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={cn(ri > 0 && 'border-t border-white/25')}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'px-3.5 py-3 text-text-primary text-sm leading-relaxed',
                      align?.[ci] ? alignClass[align[ci]] : 'text-left',
                      ci === 0 && 'font-medium',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <figcaption className="mt-2 text-meta text-text-muted italic text-center">{caption}</figcaption>
      )}
    </figure>
  )
}

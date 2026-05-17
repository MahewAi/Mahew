import { CONTRIBUTOR_META, type CSuiteVote, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MarkdownBlock } from './MarkdownBlock'

interface CSuiteVoteBlockProps {
  votes: CSuiteVote[]
}

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

/** Tally votes — count recommendations and find majority. */
function tallyVotes(votes: CSuiteVote[]) {
  const counts: Record<string, number> = {}
  for (const v of votes) counts[v.recommendation] = (counts[v.recommendation] ?? 0) + 1
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
  return { majority: sorted[0]?.[0], counts, total: votes.length }
}

export function CSuiteVoteBlock({ votes }: CSuiteVoteBlockProps) {
  const tally = tallyVotes(votes)

  return (
    <section className="my-4" aria-label="Suara C-suite">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-label-caps text-text-muted">Suara C-suite</p>
        {tally.majority && (
          <p className="text-meta text-text-secondary">
            <span className="font-semibold text-status-final">{tally.counts[tally.majority]}</span>
            <span className="text-text-muted"> / {tally.total} memilih </span>
            <span className="font-semibold text-text-primary">{tally.majority}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {votes.map((v) => {
          const meta = CONTRIBUTOR_META[v.role]
          const isCfo = v.role === 'cfo'
          const isMajority = v.recommendation === tally.majority

          return (
            <div
              key={v.role}
              className={cn(
                'rounded-[14px] p-3.5 shadow-glass',
                isMajority ? 'glass-strong ring-1 ring-status-final/40' : 'glass-soft',
              )}
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex items-center justify-center rounded-full font-semibold shrink-0 size-9 text-sm',
                    roleBg[v.role],
                    isCfo ? 'text-text-primary' : 'text-white',
                  )}
                >
                  {meta.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text-primary leading-tight truncate">
                    {meta.name}
                  </p>
                  <p
                    className={cn(
                      'text-label-caps mt-0.5',
                      isMajority ? 'text-status-final' : 'text-text-muted',
                    )}
                  >
                    Rekom {v.recommendation}
                  </p>
                </div>
              </div>
              <MarkdownBlock
                content={v.reasoning}
                className="[&_p]:mb-0 [&_p]:text-xs [&_p]:leading-[17px] [&_p]:text-text-secondary"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

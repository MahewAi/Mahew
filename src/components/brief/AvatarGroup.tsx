import { CONTRIBUTOR_META, getContributorColorRole, type Contributor, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AvatarGroupProps {
  contributors: Contributor[]
  max?: number
  size?: 'sm' | 'md'
  className?: string
}

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

const sizeMap = {
  sm: { wrapper: 'size-6', overlap: '-ml-2', oneLetter: 'text-[11px]', twoLetter: 'text-[9px]' },
  md: { wrapper: 'size-8', overlap: '-ml-2.5', oneLetter: 'text-sm', twoLetter: 'text-[11px]' },
} as const

function buildAriaLabel(contributors: Contributor[]): string {
  if (contributors.length === 0) return 'Tidak ada kontributor'
  const names = contributors.map((c) => CONTRIBUTOR_META[c].name).join(', ')
  return `${contributors.length} kontributor: ${names}`
}

export function AvatarGroup({ contributors, max = 3, size = 'sm', className }: AvatarGroupProps) {
  const visible = contributors.slice(0, max)
  const overflow = contributors.length - visible.length
  const cfg = sizeMap[size]

  return (
    <div role="group" aria-label={buildAriaLabel(contributors)} className={cn('flex items-center', className)}>
      {visible.map((c, idx) => {
        const meta = CONTRIBUTOR_META[c]
        const colorRole = getContributorColorRole(c)
        const isCfo = colorRole === 'cfo'
        const isTwo = meta.initials.length > 1
        return (
          <span
            key={c}
            aria-hidden="true"
            className={cn(
              'inline-flex items-center justify-center rounded-full font-semibold',
              'ring-2 ring-bg-elevated',
              cfg.wrapper,
              idx > 0 && cfg.overlap,
              roleBg[colorRole],
              isCfo ? 'text-text-primary' : 'text-white',
              isTwo ? cfg.twoLetter : cfg.oneLetter,
            )}
          >
            {meta.initials}
          </span>
        )
      })}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'ring-2 ring-bg-elevated bg-bg-soft text-text-secondary font-semibold',
            cfg.wrapper,
            cfg.overlap,
            'text-[10px]',
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

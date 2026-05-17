import { cn } from '@/lib/utils'

interface MonogramProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  ariaLabel?: string
}

const sizeMap = {
  sm: 'size-7 text-base',
  md: 'size-9 text-xl',
  lg: 'size-14 text-3xl',
} as const

export function Monogram({ size = 'md', className, ariaLabel }: MonogramProps) {
  return (
    <div
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-serif font-medium text-white',
        'bg-gradient-to-br from-accent to-accent-dark',
        'ring-1 ring-inset ring-white/20',
        'shadow-[0_4px_12px_rgba(184,149,107,0.3)]',
        sizeMap[size],
        className,
      )}
    >
      G
    </div>
  )
}

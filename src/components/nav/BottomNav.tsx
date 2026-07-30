import { NavLink } from 'react-router-dom'
import { ClipboardList, LayoutGrid, Sparkles, User, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  icon: typeof LayoutGrid
  label: string
  disabled?: boolean
}

const items: NavItem[] = [
  { to: '/', icon: LayoutGrid, label: 'Dashboard' },
  { to: '/kerja', icon: ClipboardList, label: 'Kerja' },
  { to: '/opsflow', icon: Workflow, label: 'Alur' },
  { to: '/atmaja', icon: Sparkles, label: 'Atmaja' },
  { to: '/settings', icon: User, label: 'Profile' },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-nav',
        'flex gap-1 p-1.5',
        'glass-strong rounded-pill shadow-glass-hero',
        'mb-safe-bottom',
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        if (item.disabled) {
          return (
            <button
              key={item.to}
              type="button"
              disabled
              aria-label={`${item.label} (segera hadir)`}
              className={cn(
                'inline-flex flex-col items-center justify-center min-h-touch min-w-touch px-4 py-1.5 rounded-pill',
                'text-text-faint cursor-not-allowed',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          )
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            // Hanya root yang butuh pencocokan persis; tab lain tetap aktif di sub-halamannya.
            end={item.to === '/'}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                'inline-flex flex-col items-center justify-center min-h-touch min-w-touch px-4 py-1.5 rounded-pill',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden="true" className="size-5" />
                <span className={cn('text-[10px] mt-0.5', isActive ? 'text-white/90' : '')}>{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface FABProps {
  showAfter?: number
  onClick?: () => void
  ariaLabel?: string
  icon?: typeof ArrowUp
}

export function FAB({
  showAfter = 240,
  onClick,
  ariaLabel = 'Kembali ke atas',
  icon: Icon = ArrowUp,
}: FABProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > showAfter)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [showAfter])

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.9, y: visible ? 0 : 8 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      className={cn(
        'fixed right-4 bottom-24 z-nav',
        'inline-flex items-center justify-center size-12 rounded-full',
        'bg-accent text-white shadow-pop',
        'hover:bg-accent-dark',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'mb-safe-bottom',
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </motion.button>
  )
}

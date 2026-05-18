import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { cn } from '@/lib/utils'

/**
 * Listens for service worker updates and shows a toast prompt.
 * Saat ada deploy baru, service worker download di background → user dapat toast
 * "Versi baru tersedia · Muat ulang" → tap → service worker swap + reload.
 *
 * Ini menggantikan behavior 'autoUpdate' silent yang sebelumnya.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Check for updates every 60 seconds (penting untuk PWA installed yang lama dibuka)
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {
            /* ignore — offline or other transient errors */
          })
        }, 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  // Kalau user dismiss, jangan langsung trigger lagi (silent until next update)
  useEffect(() => {
    if (!needRefresh) return
    // Auto-dismiss setelah 60 detik kalau user diam
    const id = window.setTimeout(() => setNeedRefresh(false), 60_000)
    return () => window.clearTimeout(id)
  }, [needRefresh, setNeedRefresh])

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          role="status"
          aria-live="polite"
          className={cn(
            'fixed bottom-24 left-1/2 -translate-x-1/2 z-toast mb-safe-bottom',
            'glass-strong rounded-full shadow-glass-hero',
            'px-3 py-2 flex items-center gap-2.5',
            'min-w-[280px] max-w-[88vw]',
          )}
        >
          <RefreshCw aria-hidden="true" className="size-4 text-accent-dark shrink-0" />
          <span className="text-sm font-medium text-text-primary flex-1">
            Versi baru tersedia
          </span>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-meta font-medium text-text-muted hover:text-text-primary px-2"
          >
            Nanti
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'bg-accent text-white text-meta font-semibold shadow-glow-accent',
              'hover:bg-accent-dark transition-colors duration-fast',
            )}
          >
            Muat ulang
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

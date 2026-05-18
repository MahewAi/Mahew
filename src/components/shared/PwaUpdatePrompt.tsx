import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { cn } from '@/lib/utils'

/**
 * Listens for service worker updates and shows a toast prompt.
 *
 * Update detection triggers:
 * 1. Periodic — setiap 60 detik (untuk PWA yang lama dibuka)
 * 2. Visibility change — saat user buka app dari background (use case paling umum)
 * 3. Online status change — saat reconnect ke internet
 * 4. Window focus — saat user tap PWA icon dari homescreen
 *
 * Konsekuensi: setelah user pertama kali install versi ini, semua deploy baru
 * akan otomatis ke-detect dalam beberapa detik tanpa perlu uninstall.
 */
export function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const hasReloadedRef = useRef(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (!registration) return
      registrationRef.current = registration
      // Periodic check setiap 60 detik
      setInterval(() => {
        registration.update().catch(() => {
          /* ignore — offline atau transient error */
        })
      }, 60 * 1000)
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  // Trigger update check di banyak event — bukan cuma timer
  useEffect(() => {
    const checkForUpdate = () => {
      registrationRef.current?.update().catch(() => {
        /* ignore */
      })
    }

    // Saat user buka app dari background (pin di homescreen → buka)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate()
      }
    }

    // Saat reconnect ke internet (user dari offline → online)
    const onOnline = () => checkForUpdate()

    // Saat window dapat focus (desktop tab switch)
    const onFocus = () => checkForUpdate()

    const onControllerChange = () => {
      if (hasReloadedRef.current) return
      hasReloadedRef.current = true
      window.location.reload()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

    // Initial check kalau registration sudah ready
    if (registrationRef.current) checkForUpdate()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

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

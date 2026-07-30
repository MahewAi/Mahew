import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const hasReloadedRef = useRef(false)
  const intervalRef = useRef<number | null>(null)
  const dismissedUntilRef = useRef(0)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [serverUpdateAvailable, setServerUpdateAvailable] = useState(false)

  const checkServerBundle = useCallback(async () => {
    if (dismissedUntilRef.current > Date.now()) return

    const currentBundle = Array.from(document.scripts)
      .map((script) => script.src)
      .find((src) => /\/assets\/index-[\w-]+\.js$/.test(src))

    if (!currentBundle) return

    try {
      const response = await fetch(`/?__gerai_update_check=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })
      const html = await response.text()
      const nextBundle = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
      if (nextBundle && !currentBundle.endsWith(nextBundle)) {
        setServerUpdateAvailable(true)
      }
    } catch {
      // Offline or transient network failure.
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      void checkServerBundle()
      return
    }

    let active = true

    const markRefreshNeeded = () => {
      if (!active) return
      setNeedRefresh(true)
      setServerUpdateAvailable(true)
    }

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          markRefreshNeeded()
        }
      })
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (!active) return
        registrationRef.current = registration
        watchWorker(registration.installing)

        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing)
        })

        if (registration.waiting && navigator.serviceWorker.controller) {
          markRefreshNeeded()
        }

        registration.update().catch(() => {
          // Ignore transient update failures.
        })
        void checkServerBundle()

        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current)
        }
        intervalRef.current = window.setInterval(() => {
          registration.update().catch(() => {
            // Offline or transient network failure.
          })
          void checkServerBundle()
        }, 20 * 1000)
      })
      .catch((error) => {
        console.error('SW registration error', error)
      })

    return () => {
      active = false
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [checkServerBundle])

  const hardRefreshApp = useCallback(async () => {
    try {
      registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      // Continue with cache-busting fallback.
    }

    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
    } catch {
      // Cache API unavailable.
    }

    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.()
      await Promise.all((registrations ?? []).map((registration) => registration.unregister()))
    } catch {
      // Service worker cleanup unavailable.
    }

    const url = new URL(window.location.href)
    url.searchParams.set('refresh', `pwa-${Date.now()}`)
    window.location.replace(url.toString())
  }, [])

  useEffect(() => {
    const checkForUpdate = () => {
      registrationRef.current?.update().catch(() => {
        // Ignore transient update failures.
      })
      void checkServerBundle()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate()
      }
    }

    const onOnline = () => checkForUpdate()
    const onFocus = () => checkForUpdate()

    const onControllerChange = () => {
      if (hasReloadedRef.current) return
      hasReloadedRef.current = true
      setServerUpdateAvailable(true)
      setNeedRefresh(true)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

    checkForUpdate()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
    }
  }, [checkServerBundle])

  const showPrompt = needRefresh || serverUpdateAvailable

  const dismissPrompt = () => {
    dismissedUntilRef.current = Date.now() + 10 * 60 * 1000
    setNeedRefresh(false)
    setServerUpdateAvailable(false)
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          // `x: '-50%'` harus ikut dianimasikan, bukan diserahkan ke kelas
          // `-translate-x-1/2`: framer-motion menulis `transform` sebagai gaya
          // inline, dan itu menimpa kelas Tailwind-nya. Akibatnya panel ini
          // sebenarnya tidak pernah benar-benar di tengah — ia menempel di titik
          // 50% lalu memanjang ke kanan, dan di layar sempit tombolnya terpotong
          // keluar layar.
          initial={{ opacity: 0, y: 16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 8, x: '-50%' }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          role="status"
          aria-live="polite"
          className={cn(
            'fixed bottom-24 left-1/2 z-toast mb-safe-bottom',
            'glass-strong rounded-full shadow-glass-hero',
            'px-3 py-2 flex items-center gap-2.5',
            // Isinya harus boleh menyusut di layar sempit. Dengan lebar minimum
            // tetap, tombol "Update sekarang" terpotong di ponsel kecil — dan
            // pemberitahuan yang tombolnya tidak terlihat bukan pemberitahuan.
            'w-[calc(100vw-24px)] max-w-[92vw] sm:w-auto sm:min-w-[300px]',
          )}
        >
          <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-accent-dark" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">Versi baru siap dipakai</span>
          <button
            type="button"
            onClick={dismissPrompt}
            className="shrink-0 px-2 text-meta font-medium text-text-muted hover:text-text-primary"
          >
            Nanti
          </button>
          <button
            type="button"
            onClick={() => void hardRefreshApp()}
            aria-label="Update sekarang"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5',
              'bg-accent text-meta font-semibold text-white shadow-glow-accent',
              'transition-colors duration-fast hover:bg-accent-dark',
            )}
          >
            {/* Di layar sempit tombolnya dipendekkan supaya kalimat pemberitahuannya
                tidak habis dipotong. Nama panjangnya tetap ada untuk pembaca layar. */}
            <span className="sm:hidden">Update</span>
            <span className="hidden sm:inline">Update sekarang</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

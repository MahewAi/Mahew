import { useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { ToastProvider } from '@/components/shared/Toast'
import { BottomNav } from '@/components/nav/BottomNav'
import { PwaUpdatePrompt } from '@/components/shared/PwaUpdatePrompt'
import { runAppMigrations } from '@/lib/appReset'
import Routes from './routes'

// Run once on module load (sebelum first render).
// Clear stale state dari versi lama setiap APP_VERSION bump.
runAppMigrations()

export default function App() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/preview-')

  return (
    <ToastProvider>
      <div className="canvas-brass min-h-screen text-text-primary relative">
        {/* Global grain texture overlay */}
        <svg
          aria-hidden="true"
          className="fixed inset-0 size-full opacity-[0.07] mix-blend-multiply pointer-events-none z-0"
        >
          <filter id="app-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#app-grain)" />
        </svg>

        <div className="relative z-10">
          <Routes />
          {!hideNav && <BottomNav />}
        </div>
      </div>
      <PwaUpdatePrompt />
      <Analytics />
      <SpeedInsights />
    </ToastProvider>
  )
}

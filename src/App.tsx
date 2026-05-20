import { useEffect, useState, type ComponentType } from 'react'
import { useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/shared/Toast'
import { BottomNav } from '@/components/nav/BottomNav'
import { PwaUpdatePrompt } from '@/components/shared/PwaUpdatePrompt'
import { runAppMigrations } from '@/lib/appReset'
import { installPrivacyRuntimeGuard, TELEMETRY_ALLOWED } from '@/lib/privacyGuard'
import Routes from './routes'

const telemetryEnabled = TELEMETRY_ALLOWED

// Run once on module load (sebelum first render).
// Clear stale state dari versi lama setiap APP_VERSION bump.
installPrivacyRuntimeGuard()
runAppMigrations()

export default function App() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/preview-') || location.pathname.startsWith('/workmap/')

  return (
    <ToastProvider>
      <div className="canvas-brass min-h-screen text-text-primary relative">
        {/* Global grain texture overlay */}
        <svg
          aria-hidden="true"
          className="fixed inset-0 size-full opacity-[0.02] mix-blend-multiply pointer-events-none z-0"
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
      <OptionalTelemetry />
    </ToastProvider>
  )
}

function OptionalTelemetry() {
  const [components, setComponents] = useState<{
    Analytics: ComponentType
    SpeedInsights: ComponentType
  } | null>(null)

  useEffect(() => {
    if (!telemetryEnabled) return

    let active = true
    void Promise.all([import('@vercel/analytics/react'), import('@vercel/speed-insights/react')]).then(
      ([analyticsModule, speedInsightsModule]) => {
        if (!active) return
        setComponents({
          Analytics: analyticsModule.Analytics,
          SpeedInsights: speedInsightsModule.SpeedInsights,
        })
      },
    )

    return () => {
      active = false
    }
  }, [])

  if (!telemetryEnabled || !components) return null

  const { Analytics, SpeedInsights } = components

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}

import { useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { ToastProvider } from '@/components/shared/Toast'
import { BottomNav } from '@/components/nav/BottomNav'
import Routes from './routes'

export default function App() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/preview-')

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-app text-text-primary">
        <Routes />
        {!hideNav && <BottomNav />}
      </div>
      <Analytics />
      <SpeedInsights />
    </ToastProvider>
  )
}

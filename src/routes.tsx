import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Inbox from './pages/Inbox'
import Settings from './pages/Settings'
import Atmaja from './pages/Atmaja'
import WorkMapDetail from './pages/WorkMapDetail'

// OpsFlow dipisah jadi chunk sendiri: dataset simulasi + mesin metriknya tidak
// perlu ikut terbawa di initial load PWA kalau halamannya belum dibuka.
const OpsflowOverview = lazy(() => import('./pages/opsflow/OpsflowOverview'))
const OpsflowSector = lazy(() => import('./pages/opsflow/OpsflowSector'))
const OpsflowStage = lazy(() => import('./pages/opsflow/OpsflowStage'))
const OpsflowTrace = lazy(() => import('./pages/opsflow/OpsflowTrace'))
const OpsflowWork = lazy(() => import('./pages/opsflow/OpsflowWork'))
const OpsflowDocument = lazy(() => import('./pages/opsflow/OpsflowDocument'))

function OpsflowFallback() {
  return (
    <main className="min-h-screen bg-bg-app px-3 pt-safe-top md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-3 py-8">
        <div className="skeleton-line h-8 w-56 rounded-md" />
        <div className="skeleton-line h-32 rounded-md" />
        <div className="skeleton-line h-24 rounded-md" />
      </div>
    </main>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inbox />} />
      <Route path="/brief/:id" element={<Inbox />} />
      <Route path="/workmap/:role/:lane" element={<WorkMapDetail />} />
      <Route path="/atmaja" element={<Atmaja />} />
      <Route path="/settings" element={<Settings />} />
      <Route
        path="/opsflow"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowOverview />
          </Suspense>
        }
      />
      <Route
        path="/opsflow/sektor/:sector"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowSector />
          </Suspense>
        }
      />
      <Route
        path="/opsflow/stage/:code"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowStage />
          </Suspense>
        }
      />
      <Route
        path="/opsflow/telusur/:workItemId"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowTrace />
          </Suspense>
        }
      />
      {/* Lapisan transaksi: tempat pekerjaan dikerjakan, bukan dipantau. */}
      <Route
        path="/kerja"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowWork />
          </Suspense>
        }
      />
      <Route
        path="/kerja/dokumen/:id"
        element={
          <Suspense fallback={<OpsflowFallback />}>
            <OpsflowDocument />
          </Suspense>
        }
      />
    </Routes>
  )
}

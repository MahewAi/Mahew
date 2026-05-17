import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, Globe2, Building2, LogOut } from 'lucide-react'
import { Monogram } from '@/components/shared/Monogram'
import { cn } from '@/lib/utils'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-32">
      <header className="px-4 pt-safe-top pt-4 pb-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Kembali ke Inbox"
          className={cn(
            'inline-flex items-center justify-center min-h-touch min-w-touch rounded-pill',
            '-ml-2 text-text-secondary hover:text-text-primary hover:bg-bg-soft',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="mt-3 text-display text-text-primary">Profil</h1>
        <p className="mt-1 text-meta text-text-muted">Pengaturan dan tentang aplikasi</p>
      </header>

      <main className="px-4 space-y-6 mt-2">
        <section aria-labelledby="user-heading">
          <h2 id="user-heading" className="text-label-caps text-text-muted px-1 mb-2">
            Pengguna
          </h2>
          <div className="rounded-[16px] glass-soft shadow-glass p-4 flex items-center gap-3">
            <Monogram size="md" />
            <div className="min-w-0">
              <p className="text-card-title-lg text-text-primary">Matthew</p>
              <p className="text-meta text-text-muted">Solo founder · Gerai 1000 Pintu</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-heading">
          <h2 id="brand-heading" className="text-label-caps text-text-muted px-1 mb-2">
            Tentang Brand
          </h2>
          <div className="rounded-[16px] glass-soft shadow-glass divide-y divide-white/30">
            <Row icon={Building2} label="Brand" value="Gerai 1000 Pintu" />
            <Row icon={Info} label="Positioning" value="Premium curated retail" />
            <Row icon={Globe2} label="Lokasi mother store" value="Balikpapan" />
          </div>
        </section>

        <section aria-labelledby="app-heading">
          <h2 id="app-heading" className="text-label-caps text-text-muted px-1 mb-2">
            Aplikasi
          </h2>
          <div className="rounded-[16px] glass-soft shadow-glass divide-y divide-white/30">
            <Row label="Versi" value="0.1.0 MVP" />
            <Row label="Build" value="Vite + React PWA" />
            <Row label="Bahasa" value="Indonesia" />
            <Row label="Zona waktu" value="Asia/Makassar (WITA)" />
          </div>
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-label-caps text-text-muted px-1 mb-2">
            Akun
          </h2>
          <div className="rounded-[16px] glass-soft shadow-glass">
            <button
              type="button"
              disabled
              className={cn(
                'w-full px-4 py-3 flex items-center gap-3',
                'text-sm font-medium text-text-faint cursor-not-allowed',
              )}
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
              <span className="ml-auto text-meta text-text-faint">Segera hadir</span>
            </button>
          </div>
        </section>

        <p className="text-center text-meta text-text-faint pt-4">
          Dibuat untuk Matthew · 2026
        </p>
      </main>
    </div>
  )
}

interface RowProps {
  icon?: typeof Info
  label: string
  value: string
}

function Row({ icon: Icon, label, value }: RowProps) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {Icon && <Icon aria-hidden="true" className="size-4 text-text-muted shrink-0" />}
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="ml-auto text-sm font-medium text-text-primary truncate">{value}</span>
    </div>
  )
}

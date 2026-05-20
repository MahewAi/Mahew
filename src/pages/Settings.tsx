import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CloudOff,
  Download,
  Globe2,
  HardDrive,
  Info,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { Monogram } from '@/components/shared/Monogram'
import { useToast } from '@/components/shared/Toast'
import {
  buildPrivateSyncVault,
  getPrivateSyncSnapshotStatus,
  restorePrivateSyncVault,
} from '@/lib/privateSync'
import { getPrivacyPosture } from '@/lib/privacyGuard'
import { cn } from '@/lib/utils'

export default function Settings() {
  const navigate = useNavigate()
  const { show } = useToast()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() => getPrivateSyncSnapshotStatus())
  const privacyPosture = getPrivacyPosture()

  const syncSummary = syncStatus.labels.length > 0 ? syncStatus.labels.join(', ') : 'Belum ada data privat'

  const handleExportVault = async () => {
    setSyncBusy(true)
    try {
      const vault = await buildPrivateSyncVault()
      const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gerai-private-vault-${vault.exportedAt.slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setSyncStatus(getPrivateSyncSnapshotStatus())
      show('Private vault siap ditaruh di folder Syncthing.', { variant: 'success' })
    } catch {
      show('Vault belum bisa diekspor dari browser ini.', { variant: 'error' })
    } finally {
      setSyncBusy(false)
    }
  }

  const handleImportVault = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setSyncBusy(true)
    try {
      const result = await restorePrivateSyncVault(await file.text())
      setSyncStatus(getPrivateSyncSnapshotStatus())
      show(
        result.checksumVerified
          ? `Vault masuk: ${result.imported} area dipulihkan.`
          : `Vault masuk: ${result.imported} area dipulihkan, checksum tidak cocok.`,
        { variant: result.checksumVerified ? 'success' : 'info', duration: 4500 },
      )
    } catch {
      show('File vault tidak cocok dengan format Gerai.', { variant: 'error' })
    } finally {
      setSyncBusy(false)
    }
  }

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

        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-label-caps text-text-muted px-1 mb-2">
            Keamanan & Sync
          </h2>
          <div className="rounded-[16px] glass-soft shadow-glass divide-y divide-white/30">
            <Row icon={ShieldCheck} label="Mode data" value="Local-first" />
            <Row icon={LockKeyhole} label="Privacy lock" value={privacyPosture.privacyLockEnabled ? 'Aktif' : 'Off'} />
            <Row icon={CloudOff} label="AI egress" value={privacyPosture.agentBridgeAllowed ? 'Bridge on' : 'Blocked'} />
            <Row icon={CloudOff} label="Cloud telemetry" value={privacyPosture.telemetryAllowed ? 'On' : 'Blocked'} />
            <Row icon={HardDrive} label="Private vault" value={`${syncStatus.recordCount} area · ${formatBytes(syncStatus.sizeInBytes)}`} />
            <Row icon={LockKeyhole} label="Sync target" value="Syncthing folder" />
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <SyncActionButton
                  icon={Download}
                  label="Export"
                  disabled={syncBusy}
                  onClick={handleExportVault}
                />
                <SyncActionButton
                  icon={Upload}
                  label="Import"
                  disabled={syncBusy}
                  onClick={() => importInputRef.current?.click()}
                />
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportVault}
              />
              <p className="mt-2 text-[11px] leading-4 text-text-muted">
                Vault: {syncSummary}. Simpan file ini di folder Syncthing antar device milik sendiri.
              </p>
            </div>
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
  icon?: LucideIcon
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

function SyncActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-border-med bg-white px-3 text-sm font-extrabold text-text-primary shadow-soft',
        'transition-colors duration-fast hover:bg-bg-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        disabled && 'cursor-wait opacity-60',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

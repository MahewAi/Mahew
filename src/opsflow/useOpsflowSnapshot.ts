/**
 * OpsFlow — Sumber data dashboard.
 *
 * Sekarang: dihitung di browser dari dataset simulasi (`example.ts`).
 * Nanti: satu endpoint yang menyajikan snapshot yang sudah dihitung di server.
 *
 * Pertukarannya sengaja dibuat satu titik saja — ganti isi `loadSnapshot()`
 * dengan `fetch('/api/opsflow/snapshot?window=30')` dan seluruh UI tidak perlu
 * disentuh, karena bentuk `DashboardSnapshot` sudah sama.
 *
 * Catatan penting soal kejujuran tampilan: `source` dibawa sampai ke layar dan
 * ditampilkan sebagai lencana. Dashboard yang tidak menyatakan datanya simulasi
 * adalah cara tercepat membuat orang mengambil keputusan atas angka karangan.
 */

import { useEffect, useMemo, useState } from 'react'
import { buildExampleDataset } from './example.ts'
import { buildDashboardSnapshot, buildStageVisits, type DashboardSnapshot, type StageVisit } from './metrics.ts'
import type { OpsDataset } from './schema.ts'

export type SnapshotSource = 'simulasi' | 'live'

/** Pilihan jendela analisis. Satu baris filter di atas semua grafik, bukan per grafik. */
export const WINDOW_OPTIONS = [
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 60, label: '60 hari' },
] as const

export type WindowDays = (typeof WINDOW_OPTIONS)[number]['days']

export interface OpsflowData {
  snapshot: DashboardSnapshot
  /** Kunjungan stage mentah — dipakai halaman detail stage & penelusuran. */
  visits: StageVisit[]
  dataset: OpsDataset
  source: SnapshotSource
}

/**
 * Dataset dibangun sekali per sesi. Membangunnya ~300 objek kerja dengan
 * ~4.000 event, jadi tidak perlu diulang setiap perubahan filter.
 */
let cachedDataset: OpsDataset | null = null
let cachedVisits: StageVisit[] | null = null

function loadDataset(): { dataset: OpsDataset; visits: StageVisit[]; source: SnapshotSource } {
  if (!cachedDataset || !cachedVisits) {
    cachedDataset = buildExampleDataset()
    cachedVisits = buildStageVisits(cachedDataset)
  }
  return { dataset: cachedDataset, visits: cachedVisits, source: 'simulasi' }
}

/** Snapshot per jendela waktu, di-cache supaya ganti filter terasa seketika. */
const snapshotCache = new Map<number, DashboardSnapshot>()

export function useOpsflowSnapshot(windowDays: WindowDays): OpsflowData | null {
  const [ready, setReady] = useState(false)

  // Bangun dataset di luar render pertama supaya halaman tidak terasa membeku.
  useEffect(() => {
    const id = window.setTimeout(() => {
      loadDataset()
      setReady(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  return useMemo(() => {
    if (!ready) return null
    const { dataset, visits, source } = loadDataset()
    let snapshot = snapshotCache.get(windowDays)
    if (!snapshot) {
      snapshot = buildDashboardSnapshot(dataset, { windowDays })
      snapshotCache.set(windowDays, snapshot)
    }
    return { snapshot, visits, dataset, source }
  }, [ready, windowDays])
}

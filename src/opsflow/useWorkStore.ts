/**
 * OpsFlow — Jembatan React ke penyimpanan kerja.
 *
 * Memakai `useSyncExternalStore` supaya setiap komponen yang membaca store ikut
 * ter-render ulang setelah sebuah aksi dijalankan — termasuk dashboard. Itu inti
 * dari janji "kerjakan lewat sistem, dashboard terisi sendiri": tidak ada
 * penyegaran manual, tidak ada pencatatan kedua.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { commit, getStoreVersion, loadStore, nextDocumentNumber, nextEventId, subscribe } from './store.ts'
import { buildStageVisits, type StageVisit } from './metrics.ts'
import type { OpsDataset, WorkItem } from './schema.ts'
import { executeAction, validateAction, type ActionDef, type ValidationResult } from './workflow.ts'

export interface WorkStore {
  dataset: OpsDataset
  visits: StageVisit[]
  /**
   * Jalankan aksi. Mengembalikan id objek kerja baru kalau aksinya membuat
   * dokumen (mis. PO dari PR), atau hasil validasi kalau ditolak gerbang.
   */
  run: (
    action: ActionDef,
    input: { item: WorkItem; actorPersonId: string; values: Record<string, string> },
  ) => { ok: true; createdId: string | null } | { ok: false; validation: ValidationResult }
  /** Periksa aksi tanpa menjalankannya — dipakai menampilkan gerbang di UI. */
  check: (
    action: ActionDef,
    input: { item: WorkItem; actorPersonId: string; values: Record<string, string> },
  ) => ValidationResult
}

export function useWorkStore(): WorkStore {
  const version = useSyncExternalStore(subscribe, getStoreVersion, getStoreVersion)

  // Dataset dan kunjungan stage dihitung ulang hanya saat store berubah.
  const dataset = useMemo(() => loadStore(), [version])
  const visits = useMemo(() => buildStageVisits(dataset), [dataset])

  const check = useCallback<WorkStore['check']>(
    (action, input) => validateAction(action, { dataset, ...input }),
    [dataset],
  )

  const run = useCallback<WorkStore['run']>(
    (action, input) => {
      // Waktu aksi diambil sekali di sini, lalu dipakai untuk seluruh event yang
      // dihasilkan — supaya satu aksi menghasilkan satu titik waktu, bukan
      // beberapa yang berbeda beberapa milidetik.
      const now = new Date().toISOString()

      const result = executeAction(action, {
        dataset,
        ...input,
        now,
        nextEventId,
        nextDocumentNumber: (prefix) => nextDocumentNumber(prefix, now),
        recordedBy: 'opsflow-ui',
      })

      if ('error' in result) return { ok: false, validation: result.error }

      commit({
        events: result.events,
        updatedItems: result.updatedItems,
        newItems: result.newItems,
        at: now,
      })

      return { ok: true, createdId: result.createdId }
    },
    [dataset],
  )

  return { dataset, visits, run, check }
}

/**
 * Objek kerja yang menunggu tindakan sebuah sub-tim.
 *
 * Diurutkan dari yang paling tua, karena itu urutan yang benar untuk dikerjakan —
 * dan karena dokumen yang paling lama menganggur adalah yang paling mungkin sudah
 * jadi masalah di tempat lain.
 */
export function inboxForTeam(
  dataset: OpsDataset,
  visits: StageVisit[],
  teamName: string,
  actionsByStage: (item: WorkItem) => ActionDef[],
): Array<{ item: WorkItem; ageHours: number; actions: ActionDef[] }> {
  const ageByItem = new Map<string, number>()
  for (const visit of visits) {
    if (!visit.isOpen) continue
    ageByItem.set(visit.workItemId, visit.ageHours ?? 0)
  }

  return dataset.workItems
    .filter((item) => item.closedAt === null && item.status !== 'cancelled')
    .map((item) => ({ item, ageHours: ageByItem.get(item.id) ?? 0, actions: actionsByStage(item) }))
    .filter((row) => row.actions.length > 0 && row.actions.some((a) => a.team === teamName))
    .sort((a, b) => b.ageHours - a.ageHours)
}

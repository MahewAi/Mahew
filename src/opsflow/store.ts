/**
 * OpsFlow — Penyimpanan.
 *
 * Event log append-only. Aksi tidak mengubah data yang sudah ada; ia menambahkan
 * catatan baru. Itu yang membuat jejaknya tidak bisa dibantah, dan yang membuat
 * definisi metrik bisa diperbaiki kapan saja lalu dihitung ulang dari awal.
 *
 * Sekarang tersimpan di `localStorage` — satu perangkat, tanpa server. Itu
 * keputusan sadar untuk tahap prototipe: tim bisa langsung mencoba alurnya hari
 * ini, dan pertanyaan "apakah alurnya benar" terjawab sebelum uang dikeluarkan
 * untuk server dan autentikasi.
 *
 * BATAS YANG PERLU DINYATAKAN TERBUKA: dengan localStorage, dua orang di dua
 * perangkat tidak melihat data yang sama. Untuk dipakai sungguhan oleh beberapa
 * departemen sekaligus, penyimpanannya harus pindah ke server. Seluruh sambungan
 * ke penyimpanan ada di file ini — `loadStore`, `commit`, dan `subscribe` — jadi
 * penggantiannya terbatas di satu tempat, bukan menyebar ke seluruh UI.
 */

import { buildExampleDataset } from './example.ts'
import type { OpsDataset, WorkEvent, WorkItem } from './schema.ts'

const KEY = 'opsflow.store.v1'
/** Naikkan kalau bentuk data berubah tidak kompatibel. */
const SCHEMA_VERSION = 1

interface PersistedStore {
  version: number
  events: WorkEvent[]
  workItems: WorkItem[]
  /** Nomor urut terakhir per awalan dokumen per tahun, mis. { 'PO-2026': 12 }. */
  counters: Record<string, number>
  /** Kapan terakhir ada perubahan. Dipakai sebagai `snapshotAt`. */
  updatedAt: string
}

/**
 * Master data (orang, sub-tim, aturan wewenang, kalender, SLA, item, supplier)
 * masih datang dari dataset contoh. Begitu bagian A dokumen 05 terisi, bagian ini
 * yang diganti — dan hanya bagian ini.
 */
function masterData(): Omit<OpsDataset, 'workItems' | 'events' | 'incidents' | 'snapshotAt'> {
  const example = buildExampleDataset()
  return {
    people: example.people,
    teams: example.teams,
    approvalRules: example.approvalRules,
    delegations: example.delegations,
    calendars: example.calendars,
    slaTargets: example.slaTargets,
    suppliers: example.suppliers,
    customers: example.customers,
    items: example.items,
    bom: example.bom,
    productionLines: example.productionLines,
    carriers: example.carriers,
  }
}

let cache: PersistedStore | null = null
const listeners = new Set<() => void>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function seedStore(): PersistedStore {
  // Diisi dengan riwayat simulasi supaya dashboard langsung punya isi dan
  // perbandingan sebelum/sesudah terasa. Dokumen yang Anda buat sendiri
  // bergabung ke riwayat yang sama.
  const example = buildExampleDataset()
  return {
    version: SCHEMA_VERSION,
    events: example.events,
    workItems: example.workItems,
    counters: {},
    updatedAt: example.snapshotAt,
  }
}

function read(): PersistedStore {
  if (cache) return cache
  if (!isBrowser()) {
    cache = seedStore()
    return cache
  }
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedStore
      // Data dari versi skema lama dibuang dan diganti seed, bukan dipaksa
      // dibaca. Membaca bentuk lama dengan kode baru menghasilkan kesalahan yang
      // sulit dilacak — lebih baik jujur mulai ulang.
      if (parsed.version === SCHEMA_VERSION && Array.isArray(parsed.events)) {
        cache = parsed
        return cache
      }
    }
  } catch {
    // Penyimpanan rusak atau diblokir (mode privat). Jalan dengan seed.
  }
  cache = seedStore()
  return cache
}

function write(next: PersistedStore): void {
  cache = next
  if (isBrowser()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Kuota penuh atau penyimpanan diblokir. Data tetap hidup di memori
      // selama sesi ini; yang hilang hanya ketahanannya setelah muat ulang.
      // Sengaja tidak melempar error: kehilangan penyimpanan tidak boleh
      // membuat aksi yang sudah dikerjakan orang gagal.
    }
  }
  for (const listener of listeners) listener()
}

// ============================================================
// API publik
// ============================================================

/** Dataset lengkap: master data + event log + objek kerja. */
export function loadStore(): OpsDataset {
  const store = read()
  return {
    ...masterData(),
    workItems: store.workItems,
    events: store.events,
    incidents: [],
    // Waktu acuan = kejadian terakhir yang tercatat. Bukan waktu sekarang,
    // supaya angka "umur pekerjaan" tidak melar sendiri saat halaman dibuka
    // besok tanpa ada aktivitas baru.
    snapshotAt: store.updatedAt,
  }
}

/**
 * Tambahkan event dan perubahan objek kerja sebagai satu kesatuan.
 *
 * Event lama tidak pernah disentuh. Objek kerja diperbarui karena ia memang
 * turunan yang di-cache — kalau perlu, seluruh objek kerja bisa dibangun ulang
 * dari event log.
 */
export function commit(input: {
  events: WorkEvent[]
  updatedItems?: WorkItem[]
  newItems?: WorkItem[]
  /** Waktu perubahan, dipakai sebagai snapshotAt berikutnya. */
  at: string
}): void {
  const store = read()
  const byId = new Map(store.workItems.map((i) => [i.id, i]))
  for (const item of input.updatedItems ?? []) byId.set(item.id, item)
  for (const item of input.newItems ?? []) byId.set(item.id, item)

  // Id kembar pernah lolos sekali dan akibatnya tidak kelihatan sampai jejak
  // audit dua dokumen tercampur di layar. Sejak itu setiap commit memeriksanya,
  // dan kalau terjadi lagi id-nya diperbaiki di sini — event-nya tidak boleh
  // dibuang, karena pekerjaan orangnya sudah benar-benar terjadi.
  const known = new Set(store.events.map((e) => e.id))
  const events = input.events.map((event) => {
    if (!known.has(event.id)) {
      known.add(event.id)
      return event
    }
    let candidate = event.id
    let suffix = 1
    while (known.has(candidate)) {
      suffix += 1
      candidate = `${event.id}-${suffix}`
    }
    known.add(candidate)
    console.error(`[opsflow] id event kembar: ${event.id} → diganti ${candidate}`)
    return { ...event, id: candidate }
  })

  write({
    ...store,
    events: [...store.events, ...events],
    workItems: [...byId.values()],
    // Jangan sampai waktu acuan mundur kalau ada aksi yang waktunya lebih awal.
    updatedAt:
      Date.parse(input.at) > Date.parse(store.updatedAt) ? input.at : store.updatedAt,
  })
}

/** Nomor dokumen berurutan per awalan per tahun, mis. PO-2026-0007. */
export function nextDocumentNumber(prefix: string, at: string): string {
  const store = read()
  const year = new Date(at).getFullYear()
  const key = `${prefix}-${year}`
  const next = (store.counters[key] ?? 0) + 1
  write({ ...store, counters: { ...store.counters, [key]: next } })
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`
}

/**
 * Id event unik dan berurutan di dalam satu penyimpanan.
 *
 * `issued` wajib ada. Sebelumnya id hanya dihitung dari panjang event log, dan
 * karena satu tindakan menghasilkan BEBERAPA event sebelum di-commit, semuanya
 * mendapat id yang sama. Id kembar membuat React memakai ulang elemen daftar
 * milik dokumen yang dibuka sebelumnya — jejak audit sebuah tagihan sempat
 * menampilkan event permintaan barang. Di halaman yang seluruh gunanya adalah
 * "catatan ini bisa dipercaya", itu kerusakan paling parah yang bisa terjadi.
 */
let issued = 0

export function nextEventId(): string {
  const store = read()
  issued += 1
  // Panjang log tidak pernah menyusut dan `issued` tidak pernah mundur, jadi
  // jumlahnya selalu naik — termasuk setelah halaman dimuat ulang.
  return `E-${String(store.events.length + issued).padStart(6, '0')}`
}

/** Berlangganan perubahan. Dipakai `useSyncExternalStore` di React. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Penanda versi data, berubah setiap ada commit. Dipakai memicu render ulang. */
export function getStoreVersion(): string {
  return read().updatedAt + ':' + read().events.length
}

/** Kembalikan ke riwayat simulasi awal. Dipakai tombol "mulai ulang demo". */
export function resetStore(): void {
  write(seedStore())
}

/** Kosongkan seluruhnya — mulai dari nol, tanpa riwayat simulasi. */
export function clearStore(): void {
  write({ version: SCHEMA_VERSION, events: [], workItems: [], counters: {}, updatedAt: new Date().toISOString() })
}

/** Berapa banyak yang dibuat lewat sistem ini, bukan berasal dari seed simulasi. */
export function ownActivityCount(): number {
  return read().events.filter((e) => e.recordedBy === 'opsflow-ui').length
}

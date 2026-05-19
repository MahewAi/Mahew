/**
 * App-level reset migration.
 *
 * Saat bundle version bump (lihat APP_VERSION), runs once on app init:
 * - Clear semua `gerai:*` keys di localStorage
 * - Set new version key
 *
 * Sehingga user lama yang punya cached state (Atmaja thread, dll) otomatis
 * reset saat update tiba. Tidak perlu manual clear.
 */

// Bump ini setiap kali butuh force-reset state user.
export const APP_VERSION = '2026-05-18-fresh-start-v2'

const VERSION_KEY = 'gerai:app-version'

export function runAppMigrations(): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(VERSION_KEY)
    if (stored === APP_VERSION) return

    // Migration: clear stale app state, but keep durable business learning.
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith('gerai:') && key !== VERSION_KEY && !key.startsWith('gerai:learning-memory')) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))
    localStorage.setItem(VERSION_KEY, APP_VERSION)
  } catch {
    // localStorage disabled / quota: silent fail.
  }
}

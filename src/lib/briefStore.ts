import { mockBriefs } from '@/data/mockBriefs'
import type { Brief } from '@/lib/types'

const STORAGE_KEY = 'gerai:briefs:v1'
const MAX_STORED_BRIEFS = 80

export function loadStoredBriefs(): Brief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return mockBriefs

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return mockBriefs

    return parsed as Brief[]
  } catch {
    return mockBriefs
  }
}

export function saveStoredBriefs(briefs: Brief[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(briefs.slice(0, MAX_STORED_BRIEFS)))
  } catch {
    // Storage can be unavailable in private mode or under quota pressure.
  }
}

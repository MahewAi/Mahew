import type { Brief } from '@/lib/types'

/**
 * Brief list: clean slate state.
 *
 * Sebelumnya berisi mock brief demo plus Daily Digest. Di-kosongkan pada
 * 18 Mei 2026 atas permintaan Matthew supaya app start fresh.
 *
 * Brief baru akan masuk via:
 * - Compose flow (FAB "Brief baru") -> simulateAiResponse generates a mocked brief
 * - Phase 2: fetch from /opt/openclaw-atmaja/outputs/ via backend API
 *
 * Voice canon untuk brief yang dibuat ulang:
 * - Bahasa Indonesia premium, calm, refined
 * - Istilah teknis tanpa padanan Indonesia (ROI, capex, runway) tetap
 * - Tidak ada metafora kekerasan, slang, atau em dash
 * - "Gerai 1000 Pintu" lengkap, "tempat" bukan "rumah"
 */
export const mockBriefs: Brief[] = []

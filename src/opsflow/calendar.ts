/**
 * OpsFlow — Perhitungan jam kerja.
 *
 * Kenapa file terpisah: hampir semua kesimpulan dashboard bergantung pada satu
 * pertanyaan — "berapa lama pekerjaan ini menganggur?" — dan jawabannya salah
 * kalau dihitung pakai jam kalender.
 *
 * PO terbit Jumat 16:30, diproses Senin 09:00:
 *   - jam kalender  : 64,5 jam  → terlihat seperti kelalaian berat
 *   - jam kerja     : 1,5 jam   → sebenarnya wajar
 *
 * Menghukum orang berdasarkan angka pertama adalah cara tercepat membuat tim
 * berhenti mempercayai dashboard, dan setelah itu mereka akan berhenti mencatat
 * data dengan jujur. Jadi ini bukan detail teknis, ini penentu apakah sistemnya
 * dipakai atau ditinggalkan.
 *
 * Catatan implementasi: konversi zona waktu memakai `Intl.DateTimeFormat`, tanpa
 * dependensi tambahan. Untuk zona tanpa DST (termasuk seluruh Indonesia)
 * hasilnya tepat. Untuk zona berDST ada potensi selisih sampai 1 jam dua kali
 * setahun pada hari pergantian DST — tidak relevan untuk operasi di Indonesia.
 */

import type { WorkCalendar } from './schema.ts'

/** Kalender bawaan: Senin–Jumat 08:00–17:00, istirahat 12:00–13:00, zona Jakarta. */
export const DEFAULT_CALENDAR: WorkCalendar = {
  id: 'default-office',
  timezone: 'Asia/Jakarta',
  workingDays: [1, 2, 3, 4, 5],
  workStart: '08:00',
  workEnd: '17:00',
  breaks: [{ start: '12:00', end: '13:00' }],
  holidays: [],
}

/** Kalender untuk sub-tim yang jalan terus (produksi shift, gudang inbound). */
export const CONTINUOUS_CALENDAR: WorkCalendar = {
  id: 'continuous-24h',
  timezone: 'Asia/Jakarta',
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  workStart: '00:00',
  workEnd: '24:00',
  breaks: [],
  holidays: [],
  is24Hour: true,
}

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Minggu … 6 = Sabtu. */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(new Date(instantMs))
  const lookup: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: WEEKDAY_INDEX[lookup.weekday] ?? 0,
  }
}

/**
 * Ubah instant jadi "waktu dinding" di zona kalender, dinyatakan sebagai ms
 * seolah-olah UTC. Selisih antara dua nilai wall time = durasi nyata (untuk zona
 * tanpa DST), sehingga seluruh aritmetika hari/jam di bawah jadi sederhana.
 */
function toWallMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

function parseHhMm(value: string): number {
  const [h, m] = value.split(':')
  return Number(h) * 60 + Number(m ?? '0')
}

function dateKey(wallMs: number): string {
  return new Date(wallMs).toISOString().slice(0, 10)
}

function weekdayOfWallMs(wallMs: number): number {
  return new Date(wallMs).getUTCDay()
}

/** Jendela kerja satu hari dalam menit-dari-tengah-malam, sudah dikurangi istirahat. */
function dailyWindows(cal: WorkCalendar): Array<[number, number]> {
  const start = parseHhMm(cal.workStart)
  const end = cal.workEnd === '24:00' ? 1440 : parseHhMm(cal.workEnd)
  if (end <= start) return []
  if (cal.breaks.length === 0) return [[start, end]]

  const sortedBreaks = [...cal.breaks]
    .map((b) => [parseHhMm(b.start), parseHhMm(b.end)] as [number, number])
    .filter(([bs, be]) => be > bs)
    .sort((a, b) => a[0] - b[0])

  const windows: Array<[number, number]> = []
  let cursor = start
  for (const [bs, be] of sortedBreaks) {
    const clampedStart = Math.max(bs, start)
    const clampedEnd = Math.min(be, end)
    if (clampedEnd <= cursor) continue
    if (clampedStart > cursor) windows.push([cursor, clampedStart])
    cursor = Math.max(cursor, clampedEnd)
  }
  if (cursor < end) windows.push([cursor, end])
  return windows
}

function isWorkingDay(cal: WorkCalendar, wallDayStartMs: number): boolean {
  if (cal.holidays.includes(dateKey(wallDayStartMs))) return false
  return cal.workingDays.includes(weekdayOfWallMs(wallDayStartMs))
}

/**
 * Jam kerja antara dua instant menurut kalender yang diberikan.
 * Mengembalikan 0 kalau `endIso` lebih awal dari `startIso`.
 */
export function workingHoursBetween(startIso: string, endIso: string, cal: WorkCalendar): number {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  if (endMs <= startMs) return 0

  if (cal.is24Hour && cal.holidays.length === 0 && cal.workingDays.length === 7) {
    return (endMs - startMs) / MS_PER_HOUR
  }

  const startWall = toWallMs(startMs, cal.timezone)
  const endWall = toWallMs(endMs, cal.timezone)
  const windows = dailyWindows(cal)
  if (windows.length === 0) return 0

  let totalMinutes = 0
  let dayStart = Date.UTC(
    new Date(startWall).getUTCFullYear(),
    new Date(startWall).getUTCMonth(),
    new Date(startWall).getUTCDate(),
  )

  // Batas aman: 10 tahun. Melindungi dari timestamp korup di data sumber.
  const maxIterations = 3660
  let iterations = 0

  while (dayStart <= endWall && iterations < maxIterations) {
    iterations += 1
    if (isWorkingDay(cal, dayStart)) {
      for (const [winStart, winEnd] of windows) {
        const windowStartMs = dayStart + winStart * 60_000
        const windowEndMs = dayStart + winEnd * 60_000
        const overlapStart = Math.max(windowStartMs, startWall)
        const overlapEnd = Math.min(windowEndMs, endWall)
        if (overlapEnd > overlapStart) totalMinutes += (overlapEnd - overlapStart) / 60_000
      }
    }
    dayStart += MS_PER_DAY
  }

  return totalMinutes / 60
}

/** Jam kalender (bukan jam kerja). Dipakai untuk lead time yang dijanjikan ke pihak luar. */
export function calendarHoursBetween(startIso: string, endIso: string): number {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0
  return (endMs - startMs) / MS_PER_HOUR
}

/** Cari kalender berdasarkan id, jatuh ke kalender kantor kalau tidak ditemukan. */
export function resolveCalendar(calendars: WorkCalendar[], calendarId: string | undefined): WorkCalendar {
  if (!calendarId) return DEFAULT_CALENDAR
  return calendars.find((c) => c.id === calendarId) ?? DEFAULT_CALENDAR
}

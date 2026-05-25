// Client untuk Atmaja NL Scheduler — Hermes-inspired automation.
// Backend: api/atmaja/memory.js?type=schedule
//
// Atmaja parse intent dari chat ("ingatkan saya X tiap Y"), emit marker [ATMAJA_SCHEDULE_CREATE]
// dengan task + cronHuman. Frontend regex parse, POST ke endpoint, append ke schedules list.

export interface AtmajaSchedule {
  id: string
  task: string
  cron: string | null
  cronHuman: string
  status: 'active' | 'paused' | 'deleted'
  createdAt: string
  nextRunAt: string | null
  lastRunAt: string | null
  source: string
}

export interface AtmajaScheduleListResponse {
  ok: boolean
  schedules: AtmajaSchedule[]
  count: number
  max: number
}

export interface CreateScheduleInput {
  task: string
  cronHuman: string
  cron?: string
  source?: string
}

const ENDPOINT = '/api/atmaja/memory?type=schedule'

export async function listSchedules(): Promise<AtmajaScheduleListResponse | null> {
  try {
    const cacheBust = `&_=${Date.now()}`
    const response = await fetch(`${ENDPOINT}${cacheBust}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    })
    if (!response.ok) {
      console.error('[atmajaScheduler] list HTTP', response.status)
      return null
    }
    return (await response.json()) as AtmajaScheduleListResponse
  } catch (error) {
    console.error('[atmajaScheduler] list error:', error)
    return null
  }
}

export async function createSchedule(input: CreateScheduleInput): Promise<AtmajaSchedule | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        task: input.task,
        cronHuman: input.cronHuman,
        cron: input.cron ?? null,
        source: input.source ?? 'atmaja_chat',
      }),
    })
    const data = await response.json()
    if (!response.ok || !data?.ok) {
      console.error('[atmajaScheduler] create error:', data?.error ?? response.status)
      return null
    }
    return data.schedule as AtmajaSchedule
  } catch (error) {
    console.error('[atmajaScheduler] create network error:', error)
    return null
  }
}

export async function pauseSchedule(id: string): Promise<boolean> {
  return await toggleSchedule(id, 'pause')
}

export async function resumeSchedule(id: string): Promise<boolean> {
  return await toggleSchedule(id, 'resume')
}

async function toggleSchedule(id: string, action: 'pause' | 'resume'): Promise<boolean> {
  try {
    const response = await fetch(`${ENDPOINT}&id=${encodeURIComponent(id)}&action=${action}`, {
      method: 'PUT',
    })
    return response.ok
  } catch {
    return false
  }
}

export async function deleteSchedule(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${ENDPOINT}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch {
    return false
  }
}

// Parse marker [ATMAJA_SCHEDULE_CREATE] from Atmaja response text.
// Returns parsed schedule input + cleaned response text (marker removed for display).
export interface ParsedScheduleFromMarker {
  schedules: CreateScheduleInput[]
  cleanedText: string
}

const SCHEDULE_MARKER_RE = /\[ATMAJA_SCHEDULE_CREATE\]\s*([\s\S]*?)\s*\[\/ATMAJA_SCHEDULE_CREATE\]/gi

export function parseScheduleMarkers(text: string): ParsedScheduleFromMarker {
  if (!text) return { schedules: [], cleanedText: text }
  const schedules: CreateScheduleInput[] = []
  let cleanedText = text

  // Reset regex state
  SCHEDULE_MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SCHEDULE_MARKER_RE.exec(text)) !== null) {
    const inner = match[1]
    const taskMatch = inner.match(/task\s*:\s*(.+?)(?:\n|$)/i)
    const cronMatch = inner.match(/cronHuman\s*:\s*(.+?)(?:\n|$)/i)
    const task = taskMatch?.[1]?.trim()
    const cronHuman = cronMatch?.[1]?.trim()
    if (task && cronHuman) {
      schedules.push({ task, cronHuman })
    }
  }

  // Strip markers from display text (Matthew sees cleaner output).
  cleanedText = text.replace(SCHEDULE_MARKER_RE, '').trim()

  return { schedules, cleanedText }
}

export function formatScheduleDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    const date = new Date(iso)
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

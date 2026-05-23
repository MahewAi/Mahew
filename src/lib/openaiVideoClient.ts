// Client wrapper untuk Sora 2 video generation.
// Endpoint:
//   POST /api/openai/video/create      → create job
//   GET  /api/openai/video/status?id=  → poll progress
//   GET  /api/openai/video/content?id= → MP4 stream (pakai langsung di <video src=...>)
//
// Async lifecycle: client kirim create → poll status setiap 3-5s sampai completed → render video.

import { AGENT_BRIDGE_ALLOWED } from '@/lib/privacyGuard'

export type OpenAIVideoModel = 'sora-2' | 'sora-2-pro'
export type OpenAIVideoSize = '720x1280' | '1280x720' | '1024x1792' | '1792x1024'
export type OpenAIVideoSeconds = '4' | '8' | '12'
export type OpenAIVideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export interface CreateVideoInput {
  prompt: string
  model?: OpenAIVideoModel
  size?: OpenAIVideoSize
  seconds?: OpenAIVideoSeconds
}

export interface VideoJob {
  id: string
  status: OpenAIVideoStatus
  progress: number
  model: OpenAIVideoModel
  size: string
  seconds: string
  createdAt?: number
  completedAt?: number | null
  expiresAt?: number | null
  error?: unknown
  /** URL ke /api/openai/video/content?id=xxx, siap dipasang ke <video src=...>. Null kalau belum completed. */
  contentUrl: string | null
}

export interface GenerateVideoResult {
  job: VideoJob
  elapsedMs: number
}

export function isVideoBridgeAllowed() {
  return AGENT_BRIDGE_ALLOWED
}

/**
 * Parse user input untuk video-gen command.
 * Triggers (case-insensitive):
 *   /vid <prompt>             → sora-2 (default)
 *   /video <prompt>           → sora-2
 *   /sora <prompt>            → sora-2
 *   /sora-pro <prompt>        → sora-2-pro
 *   /vidpro <prompt>          → sora-2-pro
 * Separator setelah command boleh spasi, ":", atau "-".
 */
export function parseVideoCommand(text: string): { prompt: string; model: OpenAIVideoModel } | null {
  const m = text.match(/^\/(vidpro|sora-pro|sora|video|vid)\s*[:\-]?\s*([\s\S]+)$/i)
  if (!m) return null
  const cmd = m[1].toLowerCase()
  const prompt = m[2].trim()
  if (!prompt || prompt.length < 3) return null
  const model: OpenAIVideoModel = (cmd === 'vidpro' || cmd === 'sora-pro') ? 'sora-2-pro' : 'sora-2'
  return { prompt, model }
}

export async function createVideoJob(input: CreateVideoInput): Promise<VideoJob | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null

  try {
    const response = await fetch('/api/openai/video/create', {
      method: 'POST',
      cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        model: input.model ?? 'sora-2',
        size: input.size ?? '720x1280',
        seconds: input.seconds ?? '4',
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data.ok) return null
    return {
      id: data.id,
      status: data.status,
      progress: data.progress ?? 0,
      model: data.model,
      size: data.size,
      seconds: data.seconds,
      createdAt: data.createdAt,
      contentUrl: data.contentEndpoint ?? null,
    }
  } catch {
    return null
  }
}

export async function fetchVideoStatus(id: string): Promise<VideoJob | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null
  try {
    const response = await fetch(`/api/openai/video/status?id=${encodeURIComponent(id)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data.ok) return null
    return {
      id: data.id,
      status: data.status,
      progress: data.progress ?? 0,
      model: data.model,
      size: data.size,
      seconds: data.seconds,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      expiresAt: data.expiresAt,
      error: data.error,
      contentUrl: data.contentEndpoint,
    }
  } catch {
    return null
  }
}

/**
 * Generate video end-to-end. Create job, poll sampai completed, return final VideoJob.
 * Caller bisa pass onProgress callback untuk update UI per poll.
 * Polling interval 4 detik default (Sora 2 typical 30-60s untuk 4s video).
 * Max wait default 5 menit.
 */
export async function generateVideo(
  input: CreateVideoInput,
  options: {
    onProgress?: (job: VideoJob) => void
    pollIntervalMs?: number
    maxWaitMs?: number
  } = {},
): Promise<GenerateVideoResult | null> {
  const pollMs = options.pollIntervalMs ?? 4000
  const maxMs = options.maxWaitMs ?? 5 * 60 * 1000
  const startedAt = Date.now()

  const job = await createVideoJob(input)
  if (!job) return null

  options.onProgress?.(job)

  if (job.status === 'completed') {
    return { job, elapsedMs: Date.now() - startedAt }
  }
  if (job.status === 'failed') {
    return { job, elapsedMs: Date.now() - startedAt }
  }

  let current = job
  while (Date.now() - startedAt < maxMs) {
    await new Promise((r) => setTimeout(r, pollMs))
    const next = await fetchVideoStatus(job.id)
    if (!next) {
      // Network blip — coba lagi.
      continue
    }
    current = next
    options.onProgress?.(next)
    if (next.status === 'completed' || next.status === 'failed') break
  }

  return { job: current, elapsedMs: Date.now() - startedAt }
}

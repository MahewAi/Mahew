// OpenAI Sora 2 video creation endpoint.
// POST → create video job, return jobId + initial status.
// Client lalu POLL /api/openai/video/status?id=xxx untuk track progress,
// dan GET /api/openai/video/content?id=xxx untuk download MP4 saat completed.
//
// Sora 2: async generation, butuh ~30-60s untuk 4s video.
// Vercel function exit cepat setelah trigger; client yang handle polling loop.

import { isRequestAllowed, consumeRateLimit as sharedConsumeRateLimit } from '../../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.OPENAI_VIDEO_MAX_BYTES ?? 64_000)
const RATE_LIMIT_WINDOW_MS = 60_000
// Video gen lebih mahal daripada image — rate limit lebih ketat default.
const RATE_LIMIT_MAX = Number(process.env.OPENAI_VIDEO_RATE_LIMIT ?? 3)
const recentRequestsByIp = new Map()

const ALLOWED_MODELS = new Set(['sora-2', 'sora-2-pro'])

// Sora 2 supported sizes (per October 2025 launch).
const ALLOWED_SIZES = new Set([
  '720x1280', // portrait (default Sora 2)
  '1280x720', // landscape
  '1024x1792',
  '1792x1024',
])

// Sora 2 seconds: '4', '8', '12' (string per API contract).
const ALLOWED_SECONDS = new Set(['4', '8', '12'])

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getRequestHost(req) {
  return getHeader(req, 'x-forwarded-host') ?? getHeader(req, 'host') ?? ''
}

function getClientIp(req) {
  return (
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  )
}

// isOriginAllowed legacy diganti pakai isRequestAllowed dari _shared.js (strict mode).

function consumeRateLimit(req) {
  const ip = getClientIp(req)
  const now = Date.now()
  const bucket = recentRequestsByIp.get(ip) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS
  }
  bucket.count += 1
  recentRequestsByIp.set(ip, bucket)
  return bucket.count <= RATE_LIMIT_MAX
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        const error = new Error('payload_too_large')
        error.statusCode = 413
        reject(error)
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        error.statusCode = 400
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function clampText(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function resolveModel(input) {
  const m = clampText(input, 40).toLowerCase()
  if (ALLOWED_MODELS.has(m)) return m
  return 'sora-2'
}

function resolveSize(input) {
  const s = clampText(input, 20)
  if (ALLOWED_SIZES.has(s)) return s
  return '720x1280'
}

function resolveSeconds(input) {
  const s = clampText(String(input ?? ''), 5)
  if (ALLOWED_SECONDS.has(s)) return s
  return '4'
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, { ok: false, error: 'openai_key_missing' })
    return
  }
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }
  if (!consumeRateLimit(req)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }

  const contentType = getHeader(req, 'content-type') ?? ''
  if (!contentType.includes('application/json')) {
    sendJson(res, 415, { ok: false, error: 'unsupported_media_type' })
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const prompt = clampText(payload?.prompt, 4_000)
  if (!prompt || prompt.length < 3) {
    sendJson(res, 400, { ok: false, error: 'prompt_required', note: 'Prompt minimum 3 karakter.' })
    return
  }

  const model = resolveModel(payload?.model)
  const size = resolveSize(payload?.size)
  const seconds = resolveSeconds(payload?.seconds)

  try {
    const upstream = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ model, prompt, size, seconds }),
    })

    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }

    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
        modelTried: model,
        note: parsed?.error?.message ?? parsed?.message ?? 'OpenAI Videos request failed.',
      })
      return
    }

    sendJson(res, 200, {
      ok: true,
      provider: 'OpenAI',
      id: parsed.id,
      object: parsed.object,
      status: parsed.status, // 'queued' | 'in_progress' | 'completed' | 'failed'
      progress: parsed.progress ?? 0,
      model: parsed.model ?? model,
      size: parsed.size ?? size,
      seconds: parsed.seconds ?? seconds,
      createdAt: parsed.created_at,
      pollEndpoint: `/api/openai/video/status?id=${encodeURIComponent(parsed.id)}`,
      contentEndpoint: `/api/openai/video/content?id=${encodeURIComponent(parsed.id)}`,
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

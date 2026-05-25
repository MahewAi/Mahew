// OpenAI Sora 2 video — consolidated endpoint.
// Routing via ?action= query param (Vercel Hobby plan max 12 functions, so consolidated).
//
//   POST /api/openai/video?action=create  → create video job
//   GET  /api/openai/video?action=status&id=video_xxx  → poll job progress
//   GET  /api/openai/video?action=content&id=video_xxx → stream MP4 binary
//
// Sora 2: async generation, ~30-60s untuk 4s video.
// Client kirim create → poll status setiap 3-5s sampai completed → render <video src=content_url>.

import { isRequestAllowed, consumeRateLimit, makeSendJsonWithId } from '../_shared.js'

const MAX_BODY_BYTES = Number(process.env.OPENAI_VIDEO_MAX_BYTES ?? 64_000)
const RATE_LIMIT_MAX = Number(process.env.OPENAI_VIDEO_RATE_LIMIT ?? 3)
const recentRequestsByIp = new Map()

const ALLOWED_MODELS = new Set(['sora-2', 'sora-2-pro'])
const ALLOWED_SIZES = new Set(['720x1280', '1280x720', '1024x1792', '1792x1024'])
const ALLOWED_SECONDS = new Set(['4', '8', '12'])

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
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
  return ALLOWED_MODELS.has(m) ? m : 'sora-2'
}
function resolveSize(input) {
  const s = clampText(input, 20)
  return ALLOWED_SIZES.has(s) ? s : '720x1280'
}
function resolveSeconds(input) {
  const s = clampText(String(input ?? ''), 5)
  return ALLOWED_SECONDS.has(s) ? s : '4'
}

// Handler create — wraps original create.js logic.
async function handleCreate(req, res, sendJson) {
  if (req.method !== 'POST') {
    sendJson(405, { ok: false, error: 'method_not_allowed' })
    return
  }
  if (!consumeRateLimit(req, recentRequestsByIp, RATE_LIMIT_MAX)) {
    sendJson(429, { ok: false, error: 'rate_limited' })
    return
  }

  const contentType = getHeader(req, 'content-type') ?? ''
  if (!contentType.includes('application/json')) {
    sendJson(415, { ok: false, error: 'unsupported_media_type' })
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch (error) {
    sendJson(error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const prompt = clampText(payload?.prompt, 4_000)
  if (!prompt || prompt.length < 3) {
    sendJson(400, { ok: false, error: 'prompt_required', note: 'Prompt minimum 3 karakter.' })
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
      sendJson(upstream.status, {
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
        modelTried: model,
        note: parsed?.error?.message ?? parsed?.message ?? 'OpenAI Videos request failed.',
      })
      return
    }

    sendJson(200, {
      ok: true,
      provider: 'OpenAI',
      id: parsed.id,
      object: parsed.object,
      status: parsed.status,
      progress: parsed.progress ?? 0,
      model: parsed.model ?? model,
      size: parsed.size ?? size,
      seconds: parsed.seconds ?? seconds,
      createdAt: parsed.created_at,
      pollEndpoint: `/api/openai/video?action=status&id=${encodeURIComponent(parsed.id)}`,
      contentEndpoint: `/api/openai/video?action=content&id=${encodeURIComponent(parsed.id)}`,
    })
  } catch (error) {
    sendJson(502, {
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

// Handler status — wraps original status.js logic.
async function handleStatus(req, res, sendJson, id) {
  if (req.method && req.method !== 'GET') {
    sendJson(405, { ok: false, error: 'method_not_allowed' })
    return
  }
  if (!/^video_[A-Za-z0-9]{10,80}$/.test(id)) {
    sendJson(400, { ok: false, error: 'invalid_id', note: 'id wajib format video_xxx.' })
    return
  }

  try {
    const upstream = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, {
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        accept: 'application/json',
      },
    })
    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }

    if (!upstream.ok) {
      sendJson(upstream.status, {
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
        note: parsed?.error?.message ?? 'Status fetch failed.',
      })
      return
    }

    sendJson(200, {
      ok: true,
      id: parsed.id,
      status: parsed.status,
      progress: parsed.progress ?? 0,
      model: parsed.model,
      size: parsed.size,
      seconds: parsed.seconds,
      createdAt: parsed.created_at,
      completedAt: parsed.completed_at,
      expiresAt: parsed.expires_at,
      error: parsed.error,
      contentEndpoint: parsed.status === 'completed'
        ? `/api/openai/video?action=content&id=${encodeURIComponent(id)}`
        : null,
    })
  } catch (error) {
    sendJson(502, {
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

// Handler content — wraps original content.js logic. Streams MP4 binary.
async function handleContent(req, res, id) {
  if (req.method && req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
    return
  }
  if (!/^video_[A-Za-z0-9]{10,80}$/.test(id)) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid_id' }))
    return
  }

  try {
    const upstream = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, {
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        accept: 'video/mp4',
      },
    })

    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'openai_error', upstreamStatus: upstream.status }))
      return
    }

    const ct = upstream.headers.get('content-type') ?? 'video/mp4'
    const cl = upstream.headers.get('content-length')

    const headers = {
      'content-type': ct,
      'cache-control': 'private, max-age=3600',
    }
    if (cl) headers['content-length'] = cl

    res.writeHead(200, headers)

    if (upstream.body) {
      const reader = upstream.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }
    }
    res.end()
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    }))
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'openai_key_missing' }))
    return
  }
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'request_not_allowed', reason: auth.reason }))
    return
  }

  const url = new URL(req.url, `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const action = url.searchParams.get('action') ?? ''
  const id = url.searchParams.get('id') ?? ''

  const sendJson = makeSendJsonWithId(req, res)

  if (action === 'create') return handleCreate(req, res, sendJson)
  if (action === 'status') return handleStatus(req, res, sendJson, id)
  if (action === 'content') return handleContent(req, res, id)

  sendJson(400, { ok: false, error: 'invalid_action', note: 'action wajib: create | status | content' })
}

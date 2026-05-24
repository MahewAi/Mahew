// GET /api/openai/video/status?id=video_xxx
// Polls OpenAI untuk status video job. Client poll endpoint ini setiap 3-5s.

import { isRequestAllowed } from '../../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function parseCsv(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

// isOriginAllowed legacy diganti pakai isRequestAllowed dari _shared.js (strict mode).

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
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

  // Parse query
  const url = new URL(req.url, `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const id = url.searchParams.get('id') ?? ''
  if (!/^video_[A-Za-z0-9]{10,80}$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'invalid_id', note: 'id wajib format video_xxx.' })
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
      sendJson(res, upstream.status, {
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
        note: parsed?.error?.message ?? 'Status fetch failed.',
      })
      return
    }

    sendJson(res, 200, {
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
        ? `/api/openai/video/content?id=${encodeURIComponent(id)}`
        : null,
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

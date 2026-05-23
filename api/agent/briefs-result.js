// POST /api/agent/briefs-result
// Webhook callback dari n8n setelah brief lifecycle workflow (#1) selesai.
// Body: { briefId, status: 'completed'|'failed'|'degraded', result: AgentOutputEnvelope }
//
// Auth: bearer N8N_WEBHOOK_TOKEN.
// Side effect: store result di in-memory map (key: briefId).
// Client polling: GET /api/agent/briefs-list?since=<timestamp> akan pick up result.

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.N8N_CALLBACK_MAX_BYTES ?? 512_000) // 500 KB untuk AgentOutputEnvelope yang kompleks
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.N8N_CALLBACK_RATE_LIMIT ?? 30)
const recentRequestsByIp = new Map()

// Shared in-memory store — sama dengan briefs-list.js
const briefStore = globalThis.__geraiBriefStore ?? new Map()
globalThis.__geraiBriefStore = briefStore

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

function isOriginAllowed(req) {
  const origin = getHeader(req, 'origin')
  if (!origin) return true
  try {
    const originUrl = new URL(origin)
    const requestHost = getHeader(req, 'x-forwarded-host') ?? getHeader(req, 'host') ?? ''
    const configuredOrigins = parseCsv(process.env.GERAI_ALLOWED_ORIGINS)
    return originUrl.host === requestHost || configuredOrigins.includes(originUrl.origin)
  } catch {
    return false
  }
}

function isAuthorizedN8n(req) {
  const expected = process.env.N8N_WEBHOOK_TOKEN
  if (!expected) return false
  const auth = getHeader(req, 'authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  return m[1] === expected
}

function getClientIp(req) {
  return (
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  )
}

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

const VALID_STATUSES = new Set(['completed', 'failed', 'degraded', 'partial'])

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
  if (!isOriginAllowed(req)) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' })
    return
  }
  if (!isAuthorizedN8n(req)) {
    sendJson(res, 401, { ok: false, error: 'n8n_token_required' })
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

  const briefId = clampText(payload?.briefId, 80)
  if (!briefId) {
    sendJson(res, 400, { ok: false, error: 'briefId_required' })
    return
  }

  const status = clampText(payload?.status, 30)
  if (!VALID_STATUSES.has(status)) {
    sendJson(res, 400, { ok: false, error: 'invalid_status', allowed: Array.from(VALID_STATUSES) })
    return
  }

  const stored = {
    briefId,
    status,
    result: payload?.result ?? null,
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    source: 'n8n',
  }
  briefStore.set(briefId, stored)

  // Trim store kalau > 200 entries (prevent memory bloat)
  if (briefStore.size > 200) {
    const sorted = Array.from(briefStore.entries()).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    briefStore.clear()
    for (const [k, v] of sorted.slice(0, 100)) briefStore.set(k, v)
  }

  sendJson(res, 202, {
    ok: true,
    accepted: true,
    briefId,
    status,
    storeSize: briefStore.size,
    note: 'Result stored in-memory. Client should poll /api/agent/briefs-list?since=<receivedAt-1> untuk pickup.',
  })
}

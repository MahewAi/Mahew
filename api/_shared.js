// Shared security & request helpers untuk semua endpoint Gerai.
// File prefix _ = Vercel ignore as route (per Vercel docs), tetap importable dari siblings.

export function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export function getRequestHost(req) {
  return getHeader(req, 'x-forwarded-host') ?? getHeader(req, 'host') ?? ''
}

export function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getClientIp(req) {
  return (
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  )
}

// Bearer token check. Token bisa pakai N8N_WEBHOOK_TOKEN (untuk callback dari n8n)
// atau ATMAJA_BRIDGE_TOKEN (untuk admin/server-to-server). Match either.
export function hasValidBearerToken(req) {
  const expectedN8n = process.env.N8N_WEBHOOK_TOKEN
  const expectedBridge = process.env.ATMAJA_BRIDGE_TOKEN
  const header = String(getHeader(req, 'authorization') ?? '')
  if (!header.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length).trim()
  if (!token) return false
  // Constant-time-ish compare: cek both. Either match = allowed.
  if (expectedN8n && token === expectedN8n) return true
  if (expectedBridge && token === expectedBridge) return true
  return false
}

// Hardened origin check + bearer bypass.
// - Bearer token valid = allowed (server-to-server flow, n8n callback, admin curl)
// - Browser with valid Origin header (same-host atau configured allowlist) = allowed
// - Request tanpa Origin DAN tanpa bearer = REJECTED (anti curl abuse)
//
// Return { allowed: boolean, reason: string }
export function isRequestAllowed(req) {
  if (hasValidBearerToken(req)) {
    return { allowed: true, reason: 'bearer_token' }
  }

  const origin = getHeader(req, 'origin')
  if (!origin) {
    return { allowed: false, reason: 'no_origin_no_bearer' }
  }

  try {
    const originUrl = new URL(origin)
    const requestHost = getRequestHost(req)
    if (originUrl.host === requestHost) {
      return { allowed: true, reason: 'origin_same_host' }
    }
    const configuredOrigins = parseCsv(process.env.GERAI_ALLOWED_ORIGINS)
    if (configuredOrigins.includes(originUrl.origin)) {
      return { allowed: true, reason: 'origin_configured' }
    }
    return { allowed: false, reason: 'origin_not_allowed' }
  } catch {
    return { allowed: false, reason: 'origin_invalid' }
  }
}

// Request ID helper untuk correlation ID + debugging.
// Pattern usage di handler:
//   res._requestId = attachRequestId(req)
//   // existing sendJson + console.* otomatis include ID kalau res._requestId set
export function attachRequestId(req) {
  // Honor incoming x-request-id (untuk distributed trace) atau generate baru
  const incoming = String(req.headers?.['x-request-id'] ?? '').trim()
  if (incoming && /^[A-Za-z0-9_-]{6,80}$/.test(incoming)) return incoming
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Wrap sendJson logic dengan request ID injection.
// Caller: const sendJson = makeSendJsonWithId(req, res, baseHeaders)
export function makeSendJsonWithId(req, res, baseHeaders = {}) {
  const requestId = attachRequestId(req)
  res._requestId = requestId
  return function sendJsonWithId(statusCode, payload) {
    res.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': requestId,
      ...baseHeaders,
    })
    res.end(JSON.stringify({ ...payload, requestId }))
    return requestId
  }
}

// Rate limit helper (per-IP, in-memory). Caller provides Map + max.
// Default window 60s.
export function consumeRateLimit(req, bucketMap, max, windowMs = 60_000) {
  const ip = getClientIp(req)
  const now = Date.now()
  const bucket = bucketMap.get(ip) ?? { count: 0, resetAt: now + windowMs }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }
  bucket.count += 1
  bucketMap.set(ip, bucket)
  return bucket.count <= max
}

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
// Modern browsers TIDAK send Origin header untuk same-origin GET requests (Fetch spec).
// Yang RELIABLE untuk verify same-origin:
// 1. Bearer token (server-to-server)
// 2. Sec-Fetch-Site: same-origin (modern browsers always send, Chrome 76+/FF 90+/Safari 16+)
// 3. Origin header same-host (cross-origin atau non-GET requests)
// 4. Referer header same-host (fallback untuk older browsers)
//
// Return { allowed: boolean, reason: string }
export function isRequestAllowed(req) {
  if (hasValidBearerToken(req)) {
    return { allowed: true, reason: 'bearer_token' }
  }

  // Modern fetch metadata header — paling reliable untuk same-origin verification
  const fetchSite = String(getHeader(req, 'sec-fetch-site') ?? '').toLowerCase()
  if (fetchSite === 'same-origin' || fetchSite === 'same-site') {
    return { allowed: true, reason: 'sec_fetch_same_origin' }
  }

  const requestHost = getRequestHost(req)

  // Origin header check (cross-origin atau non-GET dengan Origin set)
  const origin = getHeader(req, 'origin')
  if (origin) {
    try {
      const originUrl = new URL(origin)
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

  // Referer fallback — kalau Sec-Fetch-Site + Origin keduanya absent (older browser atau curl with Referer)
  const referer = getHeader(req, 'referer')
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.host === requestHost) {
        return { allowed: true, reason: 'referer_same_host' }
      }
    } catch {
      // ignore invalid referer
    }
  }

  // sec-fetch-site: 'none' artinya direct navigation (URL bar/bookmark). Allow untuk health endpoint,
  // sisanya tergantung handler-nya yang decide.
  if (fetchSite === 'none') {
    return { allowed: false, reason: 'direct_navigation_no_bearer' }
  }

  return { allowed: false, reason: 'no_auth_signal' }
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

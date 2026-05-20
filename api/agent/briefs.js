const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.ATMAJA_BRIEF_MAX_BYTES ?? 262_144)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.ATMAJA_BRIDGE_RATE_LIMIT ?? 20)
const recentRequestsByIp = new Map()

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

function isOriginAllowed(req) {
  const origin = getHeader(req, 'origin')
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const requestHost = getRequestHost(req)
    const configuredOrigins = parseCsv(process.env.GERAI_ALLOWED_ORIGINS)
    return originUrl.host === requestHost || configuredOrigins.includes(originUrl.origin)
  } catch {
    return false
  }
}

function isWebhookAllowed(webhookUrl) {
  let url
  try {
    url = new URL(webhookUrl)
  } catch {
    return { ok: false, reason: 'invalid_webhook_url' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'webhook_must_use_https' }
  }

  const allowedHosts = parseCsv(process.env.ATMAJA_WEBHOOK_ALLOWED_HOSTS)
  if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname)) {
    return { ok: false, reason: 'webhook_host_not_allowed' }
  }

  return { ok: true, url }
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
        return
      }
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  if (!isOriginAllowed(req)) {
    sendJson(res, 403, { error: 'origin_not_allowed' })
    return
  }

  if (!consumeRateLimit(req)) {
    sendJson(res, 429, { error: 'rate_limited' })
    return
  }

  const contentType = getHeader(req, 'content-type') ?? ''
  if (!contentType.includes('application/json')) {
    sendJson(res, 415, { error: 'unsupported_media_type' })
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, { error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json' })
    return
  }

  const webhookUrl = process.env.ATMAJA_BRIEF_WEBHOOK_URL
  const bridgeToken = process.env.ATMAJA_BRIDGE_TOKEN
  const jobId = `gerai-job-${Date.now()}`

  if (!webhookUrl) {
    res.writeHead(202, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'contract',
        status: 'accepted',
        jobId,
        note: 'ATMAJA_BRIEF_WEBHOOK_URL belum dikonfigurasi. App memakai contract-mode fallback.',
      }),
    )
    return
  }

  if (!bridgeToken) {
    sendJson(res, 428, {
      mode: 'offline',
      status: 'bridge_error',
      jobId,
      error: 'bridge_token_required',
      note: 'ATMAJA_BRIDGE_TOKEN wajib diset sebelum app boleh forward brief ke runtime.',
    })
    return
  }

  const webhookPolicy = isWebhookAllowed(webhookUrl)
  if (!webhookPolicy.ok) {
    sendJson(res, 422, {
      mode: 'offline',
      status: 'bridge_error',
      jobId,
      error: webhookPolicy.reason,
      note: 'Webhook runtime tidak lolos kebijakan keamanan bridge.',
    })
    return
  }

  try {
    const upstream = await fetch(webhookPolicy.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify({
        jobId,
        source: 'gerai-app',
        schema: 'gerai-agent-output-v1',
        payload,
      }),
    })

    const text = await upstream.text()
    let body = {}
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }

    res.writeHead(upstream.ok ? 202 : upstream.status, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'webhook',
        status: upstream.ok ? 'accepted' : 'upstream_error',
        jobId,
        upstreamStatus: upstream.status,
        upstream: body,
      }),
    )
  } catch (error) {
    res.writeHead(502, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'webhook',
        status: 'bridge_error',
        jobId,
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
    )
  }
}

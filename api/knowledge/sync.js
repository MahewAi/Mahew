// POST /api/knowledge/sync
// Endpoint untuk n8n Workflow #4 (Notion Knowledge Sync) push update knowledge
// ke server. Akan dipakai untuk hot-swap persona prompt + brand canon tanpa redeploy.
//
// Body: { kind: 'persona'|'brand'|'sop'|'context', role?: string, content: string }
// Auth: bearer N8N_WEBHOOK_TOKEN.
// Storage: in-memory cache (key: `${kind}:${role||'_global'}`). Reset on cold start.
//
// Untuk MVP, persona prompt server (api/atmaja/chat.js + api/agent/reply.js) BELUM
// baca dari cache ini. Itu Task berikutnya (Task: persona hot-swap). Endpoint ini
// dulu jadi receiver, tested via curl.

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.KNOWLEDGE_SYNC_MAX_BYTES ?? 64_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.KNOWLEDGE_SYNC_RATE_LIMIT ?? 20)
const recentRequestsByIp = new Map()

const VALID_KINDS = new Set(['persona', 'brand', 'sop', 'context'])
const VALID_ROLES = new Set([
  '_global',
  'ceo', 'coo', 'cmo', 'cfo', 'cco',
  'hr_systems', 'production_manager', 'curator',
  'brand_strategist', 'market_researcher', 'sales_strategist', 'innovation_scout',
  'business_designer', 'financial_analyst',
  'document_writer', 'editorial', 'web_researcher',
])

// Shared in-memory knowledge cache
const knowledgeStore = globalThis.__geraiKnowledgeStore ?? new Map()
globalThis.__geraiKnowledgeStore = knowledgeStore

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
  return String(value ?? '').trim().slice(0, limit)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }

  // GET: dump cache state (untuk debug + monitoring)
  if (req.method === 'GET') {
    if (!isAuthorizedN8n(req)) {
      sendJson(res, 401, { ok: false, error: 'n8n_token_required' })
      return
    }
    const entries = Array.from(knowledgeStore.entries()).map(([key, value]) => ({
      key,
      kind: value.kind,
      role: value.role,
      contentLength: value.content?.length ?? 0,
      updatedAt: value.updatedAt,
    }))
    sendJson(res, 200, {
      ok: true,
      cacheSize: knowledgeStore.size,
      storageMode: 'in_memory_ephemeral',
      entries,
    })
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

  const kind = clampText(payload?.kind, 30).toLowerCase()
  if (!VALID_KINDS.has(kind)) {
    sendJson(res, 400, { ok: false, error: 'invalid_kind', allowed: Array.from(VALID_KINDS) })
    return
  }

  const role = clampText(payload?.role, 60).toLowerCase() || '_global'
  if (!VALID_ROLES.has(role)) {
    sendJson(res, 400, { ok: false, error: 'invalid_role', allowed: Array.from(VALID_ROLES) })
    return
  }

  const content = clampText(payload?.content, 60_000)
  if (!content) {
    sendJson(res, 400, { ok: false, error: 'content_required' })
    return
  }

  const key = `${kind}:${role}`
  const stored = {
    kind,
    role,
    content,
    contentLength: content.length,
    updatedAt: Date.now(),
    source: clampText(payload?.source, 80) || 'n8n',
  }
  knowledgeStore.set(key, stored)

  // Trim cache kalau > 100 entries
  if (knowledgeStore.size > 100) {
    const sorted = Array.from(knowledgeStore.entries()).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    knowledgeStore.clear()
    for (const [k, v] of sorted.slice(0, 50)) knowledgeStore.set(k, v)
  }

  sendJson(res, 200, {
    ok: true,
    key,
    cacheSize: knowledgeStore.size,
    storageMode: 'in_memory_ephemeral',
    note: 'Synced ke in-memory cache. Persona prompt server BELUM baca cache ini (Task lanjutan). Untuk debug: GET /api/knowledge/sync (auth required) dump cache state.',
  })
}

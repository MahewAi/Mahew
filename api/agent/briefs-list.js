// GET /api/agent/briefs-list?status=in_progress
// Untuk n8n Daily Digest workflow (#2) pull list brief yang in-progress/active.
//
// Auth: bearer N8N_WEBHOOK_TOKEN (n8n yang trigger ini punya credential).
// Storage: in-memory MVP. Akan migrate ke Vercel KV di Task 2 (persistent storage).
// Sebelum migration, app client adalah source of truth — endpoint ini cuma proxy
// untuk briefs yang server pernah lihat lewat /api/agent/briefs/result callback.

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// === In-memory store (shared across briefs-list + briefs-result via module scope) ===
// Vercel functions cold start akan reset ini. Best-effort untuk MVP.
// TODO: migrate ke Vercel KV di Task 2 supaya persist antar invocation.
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
  // Constant-time-ish compare (Node's tsec_compare bisa kalau perlu strict)
  return m[1] === expected
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }
  if (!isOriginAllowed(req)) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' })
    return
  }
  if (!isAuthorizedN8n(req)) {
    sendJson(res, 401, { ok: false, error: 'n8n_token_required', note: 'Header: Authorization: Bearer <N8N_WEBHOOK_TOKEN>' })
    return
  }

  const url = new URL(req.url, `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const statusFilter = url.searchParams.get('status')
  const since = Number(url.searchParams.get('since') ?? 0)

  // Collect briefs dari in-memory store
  const all = Array.from(briefStore.values())
  const filtered = all
    .filter((b) => !statusFilter || b.status === statusFilter)
    .filter((b) => !since || (b.updatedAt ?? 0) >= since)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 100)

  sendJson(res, 200, {
    ok: true,
    count: filtered.length,
    storeSize: all.length,
    storageMode: 'in_memory_ephemeral',
    note: 'In-memory store. Reset on cold start. Migrate to Vercel KV planned (Task 2).',
    briefs: filtered,
  })
}

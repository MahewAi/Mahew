// Multi-action briefs endpoint (consolidated dari briefs.js + briefs-list + briefs-result).
// Single file karena Vercel Hobby plan limit 12 serverless functions per project.
//
// Actions:
//   POST /api/agent/briefs                  → submit brief (forward ke webhook runtime)
//   POST /api/agent/briefs?action=result    → n8n callback setelah workflow done
//   GET  /api/agent/briefs?action=list      → list briefs (untuk n8n Daily Digest)
//                                             Optional: &status=<filter>&since=<ts>
//
// Auth (post-hardening):
//   POST (submit)         : strict origin OR bearer (anti curl abuse) + rate limit
//   POST (action=result)  : bearer N8N_WEBHOOK_TOKEN (server-to-server n8n callback)
//   GET  (action=list)    : bearer N8N_WEBHOOK_TOKEN

import { isRequestAllowed } from '../_shared.js'
import { readMemory, writeMemory } from '../atmaja/memory.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.ATMAJA_BRIEF_MAX_BYTES ?? 262_144)
const CALLBACK_MAX_BYTES = Number(process.env.N8N_CALLBACK_MAX_BYTES ?? 512_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.ATMAJA_BRIDGE_RATE_LIMIT ?? 20)
const CALLBACK_RATE_LIMIT = Number(process.env.N8N_CALLBACK_RATE_LIMIT ?? 30)
const recentRequestsByIp = new Map()
const recentCallbacksByIp = new Map()

// Shared in-memory brief store. Reset on cold start. Akan migrate ke Vercel KV nanti.
const briefStore = globalThis.__geraiBriefStore ?? new Map()
globalThis.__geraiBriefStore = briefStore

const VALID_STATUSES = new Set(['completed', 'failed', 'degraded', 'partial', 'in_progress', 'queued'])

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

// Note: isOriginAllowed legacy diganti dengan isRequestAllowed dari _shared.js
// (strict: no Origin AND no bearer = reject). Tetap dipakai di handleSubmit.

function isAuthorizedN8n(req) {
  const expected = process.env.N8N_WEBHOOK_TOKEN
  if (!expected) return false
  const auth = getHeader(req, 'authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  return m[1] === expected
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

function consumeRateLimit(req, bucket, max) {
  const ip = getClientIp(req)
  const now = Date.now()
  const entry = bucket.get(ip) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
  if (entry.resetAt <= now) {
    entry.count = 0
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS
  }
  entry.count += 1
  bucket.set(ip, entry)
  return entry.count <= max
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw) > maxBytes) {
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

// === ACTION: list briefs (GET, requires n8n auth) ===
// Estimate brief processing step berdasarkan elapsed time (W1 typical durations).
// Used by handleList untuk give Matthew approximate progress di in-progress briefs.
function estimateProgressStep(elapsedMs) {
  // W1 timing: validate ~1s, C-Suite paralel ~10-20s, Synth ~15-30s, Callback ~1s = ~30-60s total
  if (elapsedMs < 3000) return { step: 'validating', stepNum: 1, of: 5, progressPct: 10 }
  if (elapsedMs < 8000) return { step: 'c-suite-dispatching', stepNum: 2, of: 5, progressPct: 25 }
  if (elapsedMs < 25_000) return { step: 'c-suite-processing', stepNum: 3, of: 5, progressPct: 50 }
  if (elapsedMs < 50_000) return { step: 'atmaja-synthesizing', stepNum: 4, of: 5, progressPct: 80 }
  return { step: 'finalizing', stepNum: 5, of: 5, progressPct: 95 }
}

async function handleList(req, res, url) {
  if (!isAuthorizedN8n(req)) {
    sendJson(res, 401, { ok: false, error: 'n8n_token_required', note: 'Header: Authorization: Bearer <N8N_WEBHOOK_TOKEN>' })
    return
  }
  const statusFilter = url.searchParams.get('status')
  const since = Number(url.searchParams.get('since') ?? 0)
  const now = Date.now()
  const all = Array.from(briefStore.values())
  const filtered = all
    .filter((b) => !statusFilter || b.status === statusFilter)
    .filter((b) => !since || (b.updatedAt ?? 0) >= since)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 100)
    // ITEM #5: enrich in-progress briefs dengan estimated step + elapsed time
    .map((b) => {
      if (b.status === 'in_progress') {
        const elapsedMs = now - (b.result?.submittedAt ?? b.receivedAt ?? now)
        return {
          ...b,
          elapsedMs,
          progress: estimateProgressStep(elapsedMs),
        }
      }
      return b
    })

  sendJson(res, 200, {
    ok: true,
    action: 'list',
    count: filtered.length,
    storeSize: all.length,
    storageMode: 'in_memory_ephemeral',
    note: 'In-memory store, reset on cold start. Migrate Vercel KV planned.',
    briefs: filtered,
  })
}

// === ACTION: result (POST, requires n8n auth) ===
async function handleResult(req, res) {
  if (!isAuthorizedN8n(req)) {
    sendJson(res, 401, { ok: false, error: 'n8n_token_required' })
    return
  }
  if (!consumeRateLimit(req, recentCallbacksByIp, CALLBACK_RATE_LIMIT)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }
  let payload
  try {
    payload = await readBody(req, CALLBACK_MAX_BYTES)
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
  // Trim store kalau > 200 entries
  if (briefStore.size > 200) {
    const sorted = Array.from(briefStore.entries()).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
    briefStore.clear()
    for (const [k, v] of sorted.slice(0, 100)) briefStore.set(k, v)
  }

  // ITEM #3 INTEGRATION: append brief summary ke memory file section "Briefs Aktif"
  // supaya Atmaja chat next turn aware of brief result. Best-effort, jangan block 202.
  if (status === 'completed' || status === 'partial') {
    try {
      const memory = await readMemory()
      const briefTitle = String(payload?.result?.title ?? briefId).slice(0, 120)
      const briefSummary = String(payload?.result?.summary ?? '').slice(0, 400)
      const witaDate = new Date(Date.now() + 8 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const briefBullet = `- [Brief ${witaDate}] ${briefTitle} ${briefSummary ? ': ' + briefSummary.replace(/\n/g, ' ') : ''}`.slice(0, 500)
      let updatedMemory = memory
      if (memory.includes('## Briefs Aktif')) {
        updatedMemory = memory.replace(
          '## Briefs Aktif\n',
          `## Briefs Aktif\n${briefBullet}\n`,
        )
      } else {
        updatedMemory = memory + `\n\n## Briefs Aktif\n${briefBullet}\n`
      }
      await writeMemory(updatedMemory)
    } catch (memErr) {
      console.error('[briefs-result] memory append failed:', memErr?.message ?? memErr)
    }
  }

  sendJson(res, 202, {
    ok: true,
    action: 'result',
    accepted: true,
    briefId,
    status,
    storeSize: briefStore.size,
    note: 'Client should poll GET /api/agent/briefs?action=list&since=<receivedAt-1>',
  })
}

// === ACTION: submit (POST default, app-originated brief submit ke webhook runtime) ===
async function handleSubmit(req, res) {
  if (!consumeRateLimit(req, recentRequestsByIp, RATE_LIMIT_MAX)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }
  let payload
  try {
    payload = await readBody(req, MAX_BODY_BYTES)
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const webhookUrl = process.env.ATMAJA_BRIEF_WEBHOOK_URL
  const bridgeToken = process.env.ATMAJA_BRIDGE_TOKEN
  const jobId = `gerai-job-${Date.now()}`

  if (!webhookUrl) {
    res.writeHead(202, jsonHeaders)
    res.end(JSON.stringify({
      mode: 'contract',
      status: 'accepted',
      jobId,
      note: 'ATMAJA_BRIEF_WEBHOOK_URL belum dikonfigurasi. App memakai contract-mode fallback.',
    }))
    return
  }
  if (!bridgeToken) {
    sendJson(res, 428, {
      mode: 'offline',
      status: 'bridge_error',
      jobId,
      error: 'bridge_token_required',
    })
    return
  }
  const webhookPolicy = isWebhookAllowed(webhookUrl)
  if (!webhookPolicy.ok) {
    sendJson(res, 422, { mode: 'offline', status: 'bridge_error', jobId, error: webhookPolicy.reason })
    return
  }
  // ITEM #5: Pre-populate briefStore dengan status 'in_progress' supaya brief
  // visible di Inbox saat masih running n8n workflow (sebelum callback)
  const briefTitle = String(payload?.title ?? payload?.payload?.title ?? '').slice(0, 200)
  const briefSummary = String(payload?.summary ?? payload?.payload?.summary ?? '').slice(0, 1000)
  briefStore.set(jobId, {
    briefId: jobId,
    status: 'in_progress',
    result: {
      title: briefTitle || 'Brief processing...',
      summary: briefSummary,
      submittedAt: Date.now(),
    },
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    source: payload?.source ?? 'gerai-app',
  })

  try {
    const upstream = await fetch(webhookPolicy.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify({ jobId, source: 'gerai-app', schema: 'gerai-agent-output-v1', payload }),
    })
    const text = await upstream.text()
    let body = {}
    try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
    res.writeHead(upstream.ok ? 202 : upstream.status, jsonHeaders)
    res.end(JSON.stringify({
      mode: 'webhook',
      status: upstream.ok ? 'accepted' : 'upstream_error',
      jobId,
      upstreamStatus: upstream.status,
      upstream: body,
    }))
  } catch (error) {
    res.writeHead(502, jsonHeaders)
    res.end(JSON.stringify({
      mode: 'webhook',
      status: 'bridge_error',
      jobId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }))
  }
}

// === MAIN HANDLER: route by method + action query ===
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }

  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }

  const url = new URL(req.url, `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const action = (url.searchParams.get('action') ?? '').toLowerCase()

  if (req.method === 'GET') {
    if (action === 'list' || action === '') {
      return handleList(req, res, url)
    }
    if (action === 'digest') {
      return handleDigestRead(req, res, url)
    }
    sendJson(res, 400, { ok: false, error: 'unknown_action', note: 'GET support ?action=list | ?action=digest' })
    return
  }

  if (req.method === 'POST') {
    const contentType = getHeader(req, 'content-type') ?? ''
    if (!contentType.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'unsupported_media_type' })
      return
    }
    if (action === 'result') {
      return handleResult(req, res)
    }
    if (action === 'digest-save') {
      return handleDigestSave(req, res)
    }
    // Default POST = submit brief (backward compat)
    return handleSubmit(req, res)
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

// ============================================================================
// DIGEST OPERATIONS — channel output untuk n8n Workflow #2 Daily Digest
// ============================================================================
// Pattern: n8n Daily Digest cron 07:00 WITA → call Atmaja sintesa →
// POST hasil ke /api/agent/briefs?action=digest-save dengan bearer.
// Matthew lihat di PWA via GET ?action=digest (bisa same-origin atau bearer).
//
// Storage: in-memory globalThis (sama dengan briefStore) + Vercel KV persistent
// untuk cross-instance + history.

const DIGEST_LATEST_KEY = 'atmaja:digest:matthew:latest'
const DIGEST_HISTORY_KEY = 'atmaja:digest:matthew:history'
const DIGEST_MAX_HISTORY = 14
const DIGEST_MAX_BYTES = 100_000

async function handleDigestSave(req, res) {
  if (!isAuthorizedN8n(req)) {
    sendJson(res, 401, { ok: false, error: 'n8n_token_required', note: 'Header: Authorization: Bearer <N8N_WEBHOOK_TOKEN>' })
    return
  }

  let payload
  try {
    payload = await readBody(req, DIGEST_MAX_BYTES)
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const digest = {
    date: String(payload?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 50),
    digest: String(payload?.digest ?? '').slice(0, 20_000),
    model: String(payload?.model ?? 'unknown').slice(0, 100),
    briefCount: Number.isFinite(Number(payload?.briefCount)) ? Number(payload.briefCount) : 0,
    completedAt: new Date().toISOString(),
    note: String(payload?.note ?? '').slice(0, 500),
  }

  if (!digest.digest || digest.digest.length < 20) {
    sendJson(res, 400, { ok: false, error: 'digest_text_required_min_20chars' })
    return
  }

  // Best-effort save to Vercel KV. Fallback to in-memory globalThis kalau KV unavailable.
  try {
    const kvModule = await import('@vercel/kv').catch(() => null)
    if (kvModule?.kv) {
      await kvModule.kv.set(DIGEST_LATEST_KEY, digest)
      // History: prepend baru, keep last N
      const stored = await kvModule.kv.get(DIGEST_HISTORY_KEY)
      const history = Array.isArray(stored) ? stored : []
      // Dedup by date — replace kalau date sama, else prepend
      const filtered = history.filter((d) => d.date !== digest.date)
      const newHistory = [digest, ...filtered].slice(0, DIGEST_MAX_HISTORY)
      await kvModule.kv.set(DIGEST_HISTORY_KEY, newHistory)
    } else {
      // Fallback in-memory
      globalThis.__geraiDigestLatest = digest
    }
  } catch (error) {
    console.error('[briefs-digest] save error (fallback to memory):', error?.message ?? error)
    globalThis.__geraiDigestLatest = digest
  }

  sendJson(res, 200, { ok: true, digest, storedAt: new Date().toISOString() })
}

async function handleDigestRead(req, res, url) {
  const includeHistory = url.searchParams.get('history') === '1'
  let latest = null
  let history = []

  try {
    const kvModule = await import('@vercel/kv').catch(() => null)
    if (kvModule?.kv) {
      latest = await kvModule.kv.get(DIGEST_LATEST_KEY)
      if (includeHistory) {
        const stored = await kvModule.kv.get(DIGEST_HISTORY_KEY)
        history = Array.isArray(stored) ? stored : []
      }
    } else {
      latest = globalThis.__geraiDigestLatest ?? null
    }
  } catch (error) {
    console.error('[briefs-digest] read error:', error?.message ?? error)
    latest = globalThis.__geraiDigestLatest ?? null
  }

  sendJson(res, 200, {
    ok: true,
    latest,
    history: includeHistory ? history : undefined,
    note: latest ? null : 'Belum ada digest. Daily digest workflow akan generate setiap 07:00 WITA.',
  })
}

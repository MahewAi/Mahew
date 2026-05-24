// Atmaja long-term memory file (Lapis 2 dari sistem memory).
// Disimpan di Vercel KV (Upstash Redis) sebagai 1 markdown file global per user (solo: Matthew).
// Auto-update tiap turn via Sonnet 4.6 yang extract key info dari percakapan.

import { kv } from '@vercel/kv'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MEMORY_KEY = 'atmaja:memory:matthew'
const MEMORY_VERSION_KEY = 'atmaja:memory:matthew:version'
const MEMORY_TURNS_KEY = 'atmaja:memory:matthew:turns'
const MAX_MEMORY_CHARS = 50_000

const DEFAULT_MEMORY = `# Atmaja Memory — Gerai 1000 Pintu

> Memory file ini auto-maintained oleh Atmaja. Disimpan permanent di Vercel KV.
> Atmaja baca file ini tiap turn untuk konteks long-term Gerai. Setiap percakapan
> auto-extract info penting dan append ke section yang tepat.

## Strategi & Keputusan
(belum ada catatan)

## Brand Canon
(belum ada catatan)

## Operations & Vendor
(belum ada catatan)

## Tim & People
(belum ada catatan)

## Briefs Aktif
(belum ada catatan)

## TODO / Pending
(belum ada catatan)

## Misc / Konteks Personal
(belum ada catatan)
`

export async function readMemory() {
  try {
    const stored = await kv.get(MEMORY_KEY)
    if (typeof stored === 'string' && stored.trim()) {
      return stored
    }
    return DEFAULT_MEMORY
  } catch (error) {
    console.error('[atmaja-memory] readMemory error:', error?.message ?? error)
    return DEFAULT_MEMORY
  }
}

export async function writeMemory(content) {
  const clamped = String(content ?? '').slice(0, MAX_MEMORY_CHARS)
  if (!clamped.trim()) {
    throw new Error('memory_content_empty')
  }
  await kv.set(MEMORY_KEY, clamped)
  // Increment version + turn counter (best-effort, no fail).
  try {
    await kv.incr(MEMORY_VERSION_KEY)
  } catch (error) {
    console.error('[atmaja-memory] incr version error:', error?.message ?? error)
  }
  return clamped
}

export async function incrementTurnCounter() {
  try {
    return await kv.incr(MEMORY_TURNS_KEY)
  } catch (error) {
    console.error('[atmaja-memory] incr turns error:', error?.message ?? error)
    return null
  }
}

export async function getMemoryStats() {
  try {
    const [version, turns] = await Promise.all([
      kv.get(MEMORY_VERSION_KEY),
      kv.get(MEMORY_TURNS_KEY),
    ])
    return {
      version: typeof version === 'number' ? version : 0,
      turns: typeof turns === 'number' ? turns : 0,
    }
  } catch (error) {
    console.error('[atmaja-memory] stats error:', error?.message ?? error)
    return { version: 0, turns: 0 }
  }
}

async function readBody(req, maxBytes) {
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

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

function isAuthorized(req) {
  // Same token sebagai bridge — Matthew's app already provides it.
  const expected = process.env.N8N_WEBHOOK_TOKEN ?? process.env.ATMAJA_BRIDGE_TOKEN
  if (!expected) return false
  const header = String(getHeader(req, 'authorization') ?? '')
  return header === `Bearer ${expected}`
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }

  // Auth required for all methods (write + read both sensitive).
  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: 'unauthorized', note: 'Header: Authorization: Bearer <N8N_WEBHOOK_TOKEN>' })
    return
  }

  if (req.method === 'GET') {
    const memory = await readMemory()
    const stats = await getMemoryStats()
    sendJson(res, 200, {
      ok: true,
      memory,
      stats,
      charCount: memory.length,
      maxChars: MAX_MEMORY_CHARS,
    })
    return
  }

  if (req.method === 'PUT') {
    let payload
    try {
      payload = await readBody(req, MAX_MEMORY_CHARS + 10_000)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }
    const newContent = String(payload?.memory ?? '')
    if (!newContent.trim()) {
      sendJson(res, 400, { ok: false, error: 'memory_required' })
      return
    }
    try {
      const written = await writeMemory(newContent)
      const stats = await getMemoryStats()
      sendJson(res, 200, { ok: true, memory: written, stats, charCount: written.length })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: 'write_failed', note: error?.message ?? 'unknown' })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      await kv.del(MEMORY_KEY)
      sendJson(res, 200, { ok: true, note: 'memory_reset' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: 'delete_failed', note: error?.message ?? 'unknown' })
    }
    return
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

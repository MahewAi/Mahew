// Atmaja state endpoint — konsolidasi memory file (Lapis 2) + file library (Lapis 3).
// Dikonsolidasi jadi 1 file karena Vercel Hobby plan limit 12 serverless functions per deployment.
// Route via query parameter ?type=files untuk file operations, default ke memory.
//
// MEMORY OPERATIONS (no ?type or ?type=memory):
//   GET    /api/atmaja/memory                  → read memory file + stats
//   PUT    /api/atmaja/memory                  → overwrite memory (admin curation)
//   DELETE /api/atmaja/memory                  → reset memory ke default
//
// FILES OPERATIONS (?type=files):
//   POST   /api/atmaja/memory?type=files       → upload PDF base64, simpan Blob
//   GET    /api/atmaja/memory?type=files       → list all files + storage stats
//   GET    /api/atmaja/memory?type=files&id=X  → get single file metadata
//   DELETE /api/atmaja/memory?type=files&id=X  → remove from Blob + index + memory

import { kv } from '@vercel/kv'
import { put, del } from '@vercel/blob'
import { isRequestAllowed, getHeader } from '../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// === MEMORY CONSTANTS ===
const MEMORY_KEY = 'atmaja:memory:matthew'
const MEMORY_VERSION_KEY = 'atmaja:memory:matthew:version'
const MEMORY_TURNS_KEY = 'atmaja:memory:matthew:turns'
const MAX_MEMORY_CHARS = 50_000

// === FILES CONSTANTS ===
const FILES_INDEX_KEY = 'atmaja:files:matthew:index'
const MAX_FILE_BASE64_BYTES = 3_500_000
const MAX_FILES_TOTAL = 50
const MAX_FILE_BODY_BYTES = MAX_FILE_BASE64_BYTES + 50_000
const ALLOWED_FILE_MIME = new Set(['application/pdf'])

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

## Files / Dokumen
(belum ada file)
`

// ============================================================================
// MEMORY OPERATIONS
// ============================================================================

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

// ============================================================================
// FILES OPERATIONS
// ============================================================================

function generateFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function estimatePageCount(buffer) {
  try {
    const str = buffer.toString('latin1')
    const countMatch = str.match(/\/Type\s*\/Pages[\s\S]{0,500}?\/Count\s+(\d+)/)
    if (countMatch) {
      const n = parseInt(countMatch[1], 10)
      if (n > 0 && n < 10_000) return n
    }
    const pageMatches = str.match(/\/Type\s*\/Page[^s]/g)
    if (pageMatches && pageMatches.length > 0) return pageMatches.length
    return null
  } catch {
    return null
  }
}

export async function readFilesIndex() {
  try {
    const stored = await kv.get(FILES_INDEX_KEY)
    if (Array.isArray(stored)) return stored
    return []
  } catch (error) {
    console.error('[atmaja-files] readFilesIndex error:', error?.message ?? error)
    return []
  }
}

export async function writeFilesIndex(arr) {
  await kv.set(FILES_INDEX_KEY, arr)
}

export async function getFileById(id) {
  const index = await readFilesIndex()
  return index.find((f) => f.id === id) ?? null
}

export async function fetchFileBase64(file) {
  if (!file?.blobUrl) return null
  try {
    const response = await fetch(file.blobUrl)
    if (!response.ok) {
      console.error('[atmaja-files] blob fetch failed:', response.status)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error) {
    console.error('[atmaja-files] fetchFileBase64 error:', error?.message ?? error)
    return null
  }
}

async function appendFileToMemory(file) {
  try {
    const memory = await readMemory()
    const pageInfo = file.pageCount ? `, ${file.pageCount} hal` : ''
    const bullet = `- ${file.name} (${(file.size / 1024).toFixed(1)} KB${pageInfo}, uploaded ${file.uploadedAt}) — ID: ${file.id}${file.description ? ' — ' + file.description : ''}`
    const sectionHeader = '## Files / Dokumen'

    let updated = memory
    if (memory.includes(sectionHeader)) {
      const sectionStart = memory.indexOf(sectionHeader)
      const nextSectionStart = memory.indexOf('\n## ', sectionStart + sectionHeader.length)
      const sectionEnd = nextSectionStart === -1 ? memory.length : nextSectionStart
      let sectionBlock = memory.slice(sectionStart, sectionEnd)
      sectionBlock = sectionBlock.replace(/^\(belum ada file\)\s*$/m, '')
      if (!sectionBlock.includes(file.id)) {
        sectionBlock = sectionBlock.trimEnd() + '\n' + bullet
      }
      sectionBlock = sectionBlock.trimEnd() + '\n\n'
      updated = memory.slice(0, sectionStart) + sectionBlock + memory.slice(sectionEnd).replace(/^\n+/, '')
    } else {
      const stub = `\n## Files / Dokumen\n${bullet}\n`
      updated = memory.trimEnd() + '\n' + stub
    }

    await writeMemory(updated)
  } catch (error) {
    console.error('[atmaja-files] appendFileToMemory error:', error?.message ?? error)
  }
}

async function removeFileFromMemory(fileId) {
  try {
    const memory = await readMemory()
    if (!memory.includes(fileId)) return
    const lines = memory.split('\n').filter((line) => !line.includes(fileId))
    await writeMemory(lines.join('\n'))
  } catch (error) {
    console.error('[atmaja-files] removeFileFromMemory error:', error?.message ?? error)
  }
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

// ============================================================================
// FILES HANDLER
// ============================================================================

async function handleFiles(req, res) {
  // GET: list all files atau single file by id
  if (req.method === 'GET') {
    const url = new URL(req.url ?? '/', `http://${getHeader(req, 'host') ?? 'localhost'}`)
    const id = url.searchParams.get('id')
    const index = await readFilesIndex()
    if (id) {
      const file = index.find((f) => f.id === id)
      if (!file) {
        sendJson(res, 404, { ok: false, error: 'file_not_found' })
        return
      }
      sendJson(res, 200, { ok: true, file })
      return
    }
    const totalBytes = index.reduce((sum, f) => sum + (Number(f.size) || 0), 0)
    sendJson(res, 200, {
      ok: true,
      files: index,
      count: index.length,
      max: MAX_FILES_TOTAL,
      totalBytes,
      totalMegabytes: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    })
    return
  }

  // POST: upload file
  if (req.method === 'POST') {
    let payload
    try {
      payload = await readBody(req, MAX_FILE_BODY_BYTES)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }

    const name = String(payload?.name ?? '').trim().slice(0, 200)
    const contentType = String(payload?.contentType ?? '').trim().toLowerCase()
    const dataBase64 = String(payload?.dataBase64 ?? '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
    const description = String(payload?.description ?? '').trim().slice(0, 500) || null

    if (!name) {
      sendJson(res, 400, { ok: false, error: 'name_required' })
      return
    }
    if (!ALLOWED_FILE_MIME.has(contentType)) {
      sendJson(res, 400, { ok: false, error: 'unsupported_content_type', supported: Array.from(ALLOWED_FILE_MIME) })
      return
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(dataBase64) || dataBase64.length === 0) {
      sendJson(res, 400, { ok: false, error: 'invalid_base64' })
      return
    }
    if (dataBase64.length > MAX_FILE_BASE64_BYTES) {
      sendJson(res, 413, {
        ok: false,
        error: 'file_too_large',
        maxBase64Bytes: MAX_FILE_BASE64_BYTES,
        note: 'Cap ~2.6 MB raw PDF. Pecah file atau extract section utama dulu.',
      })
      return
    }

    const index = await readFilesIndex()
    if (index.length >= MAX_FILES_TOTAL) {
      sendJson(res, 413, {
        ok: false,
        error: 'files_quota_exceeded',
        currentCount: index.length,
        max: MAX_FILES_TOTAL,
        note: 'Delete file lama dulu via DELETE.',
      })
      return
    }

    const buffer = Buffer.from(dataBase64, 'base64')
    const existing = index.find((f) => f.name === name && f.size === buffer.length)
    if (existing) {
      sendJson(res, 200, { ok: true, file: existing, note: 'file_already_exists' })
      return
    }

    const id = generateFileId()
    const blobPath = `atmaja/${id}-${encodeURIComponent(name)}`
    const pageCount = estimatePageCount(buffer)

    try {
      const blob = await put(blobPath, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      })

      const fileEntry = {
        id,
        name,
        size: buffer.length,
        contentType,
        blobUrl: blob.url,
        uploadedAt: new Date().toISOString(),
        description,
        pageCount,
      }

      const newIndex = [...index, fileEntry]
      await writeFilesIndex(newIndex)
      await appendFileToMemory(fileEntry)

      sendJson(res, 200, { ok: true, file: fileEntry })
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: 'blob_upload_failed',
        note: error?.message ?? 'unknown',
      })
    }
    return
  }

  // DELETE: remove file
  if (req.method === 'DELETE') {
    const url = new URL(req.url ?? '/', `http://${getHeader(req, 'host') ?? 'localhost'}`)
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }

    const index = await readFilesIndex()
    const file = index.find((f) => f.id === id)
    if (!file) {
      sendJson(res, 404, { ok: false, error: 'file_not_found' })
      return
    }

    try {
      await del(file.blobUrl)
    } catch (error) {
      console.error('[atmaja-files] blob delete error (continuing):', error?.message ?? error)
    }

    const newIndex = index.filter((f) => f.id !== id)
    await writeFilesIndex(newIndex)
    await removeFileFromMemory(id)

    sendJson(res, 200, { ok: true, note: 'file_removed', remainingCount: newIndex.length })
    return
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

// ============================================================================
// MEMORY HANDLER
// ============================================================================

async function handleMemory(req, res) {
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

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }

  // Unified auth: bearer (admin/server-to-server) OR same-origin browser (PWA).
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }

  // Route by ?type=files atau default ke memory.
  const url = new URL(req.url ?? '/', `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const type = url.searchParams.get('type')

  if (type === 'files') {
    await handleFiles(req, res)
    return
  }

  await handleMemory(req, res)
}

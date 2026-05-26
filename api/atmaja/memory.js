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
import { put, del, get as blobGet, list as blobList } from '@vercel/blob'
import { isRequestAllowed, getHeader, attachRequestId } from '../_shared.js'

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
// SKILL PROPOSAL OPERATIONS (foundation Self-Evolving Atmaja)
// ============================================================================
// Pattern: Atmaja propose new specialist/workflow/skill/integration berdasarkan
// pattern percakapan + gap detection. Matthew review + approve/reject di PWA.
// Approved proposals → trigger implementation pipeline (manual atau auto).

const PROPOSALS_KEY = 'atmaja:proposals:matthew'
const PROPOSALS_MAX_ACTIVE = 50
const VALID_PROPOSAL_TYPES = new Set(['specialist', 'workflow', 'skill', 'prompt-refinement', 'integration', 'feature'])
const VALID_PROPOSAL_STATUS = new Set(['pending', 'approved', 'rejected', 'implemented'])

function generateProposalId() {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function listProposals(filter = null) {
  try {
    const stored = await kv.get(PROPOSALS_KEY)
    const arr = Array.isArray(stored) ? stored : []
    if (filter && VALID_PROPOSAL_STATUS.has(filter)) {
      return arr.filter((p) => p.status === filter)
    }
    return arr
  } catch (error) {
    console.error('[atmaja-proposals] list error:', error?.message ?? error)
    return []
  }
}

export async function createProposal(input) {
  const proposalType = String(input?.type ?? '').trim()
  if (!VALID_PROPOSAL_TYPES.has(proposalType)) {
    return { ok: false, error: 'invalid_type', valid: Array.from(VALID_PROPOSAL_TYPES) }
  }
  const title = String(input?.title ?? '').trim().slice(0, 200)
  const description = String(input?.description ?? '').trim().slice(0, 2000)
  if (!title || !description) {
    return { ok: false, error: 'title_and_description_required' }
  }

  const proposal = {
    id: generateProposalId(),
    type: proposalType,
    title,
    description,
    rationale: String(input?.rationale ?? '').trim().slice(0, 2000),
    examples: Array.isArray(input?.examples) ? input.examples.slice(0, 5).map((e) => String(e).slice(0, 500)) : [],
    estimatedEffort: String(input?.estimatedEffort ?? '').trim().slice(0, 100),
    estimatedCost: String(input?.estimatedCost ?? '').trim().slice(0, 100),
    proposedBy: String(input?.proposedBy ?? 'atmaja').trim().slice(0, 50),
    // Skill-specific fields (only relevant kalau type='skill'):
    promptTemplate: String(input?.promptTemplate ?? '').trim().slice(0, 5000) || null,
    triggers: Array.isArray(input?.triggers)
      ? input.triggers.slice(0, 10).map((t) => String(t).trim().toLowerCase().slice(0, 80)).filter(Boolean)
      : [],
    sandboxCode: String(input?.sandboxCode ?? '').trim().slice(0, 8000) || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    approvedAt: null,
    rejectedReason: null,
    implementedAt: null,
    implementedCommit: null,
  }

  try {
    const existing = await listProposals()

    // Dedup: skip kalau ada proposal pending dengan title 90%+ mirip (basic similarity)
    const titleLower = title.toLowerCase()
    const dup = existing.find((p) =>
      p.status === 'pending' && String(p.title ?? '').toLowerCase() === titleLower
    )
    if (dup) {
      return { ok: true, proposal: dup, note: 'duplicate_pending_proposal_returned' }
    }

    if (existing.filter((p) => p.status === 'pending').length >= PROPOSALS_MAX_ACTIVE) {
      return { ok: false, error: 'pending_quota_exceeded', max: PROPOSALS_MAX_ACTIVE }
    }

    const updated = [...existing, proposal]
    await kv.set(PROPOSALS_KEY, updated)
    return { ok: true, proposal }
  } catch (error) {
    console.error('[atmaja-proposals] create error:', error?.message ?? error)
    return { ok: false, error: error?.message ?? 'unknown' }
  }
}

export async function updateProposalStatus(id, status, extra = {}) {
  if (!VALID_PROPOSAL_STATUS.has(status)) {
    return { ok: false, error: 'invalid_status', valid: Array.from(VALID_PROPOSAL_STATUS) }
  }
  try {
    const existing = await listProposals()
    const idx = existing.findIndex((p) => p.id === id)
    if (idx === -1) {
      return { ok: false, error: 'proposal_not_found' }
    }
    const updated = { ...existing[idx], status }
    const ts = new Date().toISOString()
    if (status === 'approved') updated.approvedAt = ts
    if (status === 'rejected') updated.rejectedReason = String(extra?.reason ?? '').slice(0, 500)
    if (status === 'implemented') {
      updated.implementedAt = ts
      updated.implementedCommit = String(extra?.commit ?? '').slice(0, 60)
    }
    existing[idx] = updated
    await kv.set(PROPOSALS_KEY, existing)
    return { ok: true, proposal: updated }
  } catch (error) {
    console.error('[atmaja-proposals] update error:', error?.message ?? error)
    return { ok: false, error: error?.message ?? 'unknown' }
  }
}

export async function clearProposals(statusFilter = null) {
  try {
    if (!statusFilter) {
      await kv.del(PROPOSALS_KEY)
      return { ok: true, cleared: 'all' }
    }
    const existing = await listProposals()
    const remaining = existing.filter((p) => p.status !== statusFilter)
    await kv.set(PROPOSALS_KEY, remaining)
    return { ok: true, removed: existing.length - remaining.length, remaining: remaining.length }
  } catch (error) {
    return { ok: false, error: error?.message ?? 'unknown' }
  }
}

// ============================================================================
// BACKUP OPERATIONS (Lapis 2 defensive — daily snapshot ke Blob, rolling 30 hari)
// ============================================================================

const BACKUP_PREFIX = 'atmaja/backups/memory-'
const BACKUP_MAX_KEEP = 30

function formatBackupDate(d = new Date()) {
  // Pakai WITA (UTC+8) untuk daily resolution
  const wita = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return wita.toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function createMemorySnapshot() {
  const memory = await readMemory()
  if (!memory || memory.length < 100) {
    return { ok: false, reason: 'memory_empty_or_minimal' }
  }
  const dateStr = formatBackupDate()
  const blobPath = `${BACKUP_PREFIX}${dateStr}.md`
  const buffer = Buffer.from(memory, 'utf-8')
  try {
    const blob = await put(blobPath, buffer, {
      access: 'private',
      contentType: 'text/markdown; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true, // overwrite same-day snapshot kalau backup di-trigger >1x sehari
    })
    return {
      ok: true,
      date: dateStr,
      blobUrl: blob.url,
      size: buffer.length,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[atmaja-backup] snapshot error:', error?.message ?? error)
    return { ok: false, error: error?.message ?? 'unknown' }
  }
}

export async function listMemorySnapshots() {
  try {
    const result = await blobList({ prefix: BACKUP_PREFIX })
    const snapshots = (result.blobs ?? [])
      .map((b) => ({
        date: b.pathname.replace(BACKUP_PREFIX, '').replace('.md', ''),
        pathname: b.pathname,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)) // newest first
    return snapshots
  } catch (error) {
    console.error('[atmaja-backup] list error:', error?.message ?? error)
    return []
  }
}

export async function restoreMemoryFromSnapshot(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: 'invalid_date_format', expected: 'YYYY-MM-DD' }
  }
  try {
    const snapshots = await listMemorySnapshots()
    const target = snapshots.find((s) => s.date === dateStr)
    if (!target) {
      return { ok: false, error: 'snapshot_not_found', date: dateStr }
    }
    const result = await blobGet(target.url, { access: 'private' })
    if (!result?.stream) {
      return { ok: false, error: 'snapshot_unreadable' }
    }
    const chunks = []
    const reader = result.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const content = buffer.toString('utf-8')
    if (!content || content.length < 100) {
      return { ok: false, error: 'snapshot_empty' }
    }
    await writeMemory(content)
    return { ok: true, restored: true, date: dateStr, charCount: content.length }
  } catch (error) {
    console.error('[atmaja-backup] restore error:', error?.message ?? error)
    return { ok: false, error: error?.message ?? 'unknown' }
  }
}

export async function cleanOldSnapshots(keepLatest = BACKUP_MAX_KEEP) {
  try {
    const snapshots = await listMemorySnapshots()
    if (snapshots.length <= keepLatest) {
      return { ok: true, cleaned: 0, remaining: snapshots.length }
    }
    const toDelete = snapshots.slice(keepLatest)
    let cleaned = 0
    for (const snap of toDelete) {
      try {
        await del(snap.url)
        cleaned += 1
      } catch (error) {
        console.error('[atmaja-backup] delete error:', error?.message ?? error)
      }
    }
    return { ok: true, cleaned, remaining: snapshots.length - cleaned }
  } catch (error) {
    return { ok: false, error: error?.message ?? 'unknown' }
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
    // PDF biasanya ASCII di metadata, binary di content stream. Latin1 encoding preserve byte.
    const str = buffer.toString('latin1')

    // Method 1: cari /Type /Pages root dengan /Count N (most accurate untuk standard PDF)
    const countMatch = str.match(/\/Type\s*\/Pages[\s\S]{0,500}?\/Count\s+(\d+)/)
    if (countMatch) {
      const n = parseInt(countMatch[1], 10)
      if (n > 0 && n < 10_000) return n
    }

    // Method 2: cari semua /Count integer di file (fallback kalau Method 1 miss karena format)
    // Ambil Count terbesar yang ditemukan (root pages biasanya yang paling besar)
    const allCounts = str.match(/\/Count\s+(\d+)/g)
    if (allCounts && allCounts.length > 0) {
      const counts = allCounts
        .map((m) => parseInt(m.replace(/\/Count\s+/, ''), 10))
        .filter((n) => n > 0 && n < 10_000)
      if (counts.length > 0) {
        return Math.max(...counts)
      }
    }

    // Method 3: count /Type /Page occurrences (per-page object)
    const pageMatches = str.match(/\/Type\s*\/Page[^s]/g)
    if (pageMatches && pageMatches.length > 0) return pageMatches.length

    // Method 4: count "endobj" with "/Type /Page" nearby (looser pattern untuk PDF dengan whitespace beda)
    const endobjMatches = str.match(/\/Page\s*\/Parent/g)
    if (endobjMatches && endobjMatches.length > 0) return endobjMatches.length

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
    // Private store — pakai SDK get() bukan plain fetch.
    // SDK auto-pakai BLOB_READ_WRITE_TOKEN dari env.
    const result = await blobGet(file.blobUrl, { access: 'private' })
    if (!result?.stream) {
      console.error('[atmaja-files] blob get returned no stream')
      return null
    }
    // Convert ReadableStream ke Buffer.
    const chunks = []
    const reader = result.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
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
  const requestId = res._requestId
  const headers = requestId
    ? { ...jsonHeaders, 'x-request-id': requestId }
    : jsonHeaders
  const body = requestId
    ? { ...payload, requestId }
    : payload
  res.writeHead(statusCode, headers)
  res.end(JSON.stringify(body))
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
      // Private store (lebih aman — Blob URL tidak public-accessible tanpa SDK auth).
      // PDF Matthew = data bisnis sensitif, jadi private store paling cocok.
      const blob = await put(blobPath, buffer, {
        access: 'private',
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
  // Correlation ID — set EARLY supaya sendJson otomatis include.
  res._requestId = attachRequestId(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...jsonHeaders, 'x-request-id': res._requestId })
    res.end()
    return
  }

  // Unified auth: bearer (admin/server-to-server) OR same-origin browser (PWA).
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }

  // Route by ?type query parameter atau default ke memory.
  const url = new URL(req.url ?? '/', `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const type = url.searchParams.get('type')

  if (type === 'files') {
    await handleFiles(req, res)
    return
  }

  if (type === 'backup') {
    await handleBackup(req, res, url)
    return
  }

  if (type === 'proposals') {
    await handleProposals(req, res, url)
    return
  }

  if (type === 'schedule' || type === 'schedules') {
    await handleSchedule(req, res, url)
    return
  }

  if (type === 'trace') {
    await handleTrace(req, res)
    return
  }

  if (type === 'payments') {
    await handlePayments(req, res, url)
    return
  }

  await handleMemory(req, res)
}

// ============================================================================
// PAYMENTS HANDLER — track semua deposit ke provider (Anthropic, OpenRouter, OpenAI, Vercel, n8n)
// KV key: atmaja:payments:matthew (array of payment records, latest first)
// ============================================================================

const PAYMENTS_KEY = 'atmaja:payments:matthew'
const PAYMENTS_MAX = 200

async function handlePayments(req, res, url) {
  // GET ?type=payments → list all payments + summary per provider
  if (req.method === 'GET') {
    try {
      const list = (await kv.get(PAYMENTS_KEY)) ?? []
      const items = Array.isArray(list) ? list : []

      // Aggregate per provider untuk summary
      const summary = {}
      let totalDeposited = 0
      for (const p of items) {
        if (p.type === 'deposit') {
          const provider = p.provider || 'unknown'
          if (!summary[provider]) {
            summary[provider] = { totalDeposited: 0, depositCount: 0, lastDeposit: null }
          }
          summary[provider].totalDeposited += Number(p.amount) || 0
          summary[provider].depositCount += 1
          if (!summary[provider].lastDeposit || p.date > summary[provider].lastDeposit) {
            summary[provider].lastDeposit = p.date
          }
          totalDeposited += Number(p.amount) || 0
        }
      }

      sendJson(res, 200, {
        ok: true,
        payments: items,
        count: items.length,
        summary,
        totalDepositedUsd: totalDeposited,
      })
    } catch (error) {
      console.error('[payments] list error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'payments_list_failed' })
    }
    return
  }

  // POST ?type=payments → log new payment
  if (req.method === 'POST') {
    const contentType = getHeader(req, 'content-type') ?? ''
    if (!contentType.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'unsupported_media_type' })
      return
    }
    let payload
    try {
      payload = await readJsonBody(req, 8_000)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }

    const provider = String(payload?.provider ?? '').trim().slice(0, 60)
    const amount = Number(payload?.amount)
    const currency = String(payload?.currency ?? 'USD').trim().slice(0, 10).toUpperCase()
    const paymentType = String(payload?.type ?? 'deposit').trim().slice(0, 20) // deposit | charge | refund
    const date = String(payload?.date ?? new Date().toISOString().split('T')[0]).slice(0, 30)
    const note = String(payload?.note ?? '').trim().slice(0, 400)
    const method = String(payload?.method ?? '').trim().slice(0, 60) // credit_card, bank_transfer, etc

    if (!provider) {
      sendJson(res, 400, { ok: false, error: 'provider_required' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      sendJson(res, 400, { ok: false, error: 'amount_invalid', note: 'amount must be positive number' })
      return
    }

    try {
      const list = (await kv.get(PAYMENTS_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const record = {
        id,
        provider,
        type: paymentType,
        amount,
        currency,
        date,
        method,
        note,
        loggedAt: new Date().toISOString(),
      }
      items.unshift(record)
      const trimmed = items.slice(0, PAYMENTS_MAX)
      await kv.set(PAYMENTS_KEY, trimmed)
      sendJson(res, 201, { ok: true, payment: record, total: trimmed.length })
    } catch (error) {
      console.error('[payments] create error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'payments_create_failed' })
    }
    return
  }

  // DELETE ?type=payments&id=X → remove payment record
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }
    try {
      const list = (await kv.get(PAYMENTS_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const filtered = items.filter((p) => p.id !== id)
      await kv.set(PAYMENTS_KEY, filtered)
      sendJson(res, 200, { ok: true, deleted: id })
    } catch (error) {
      console.error('[payments] delete error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'payments_delete_failed' })
    }
    return
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

// ============================================================================
// TRACE HANDLER — Live execution trace (n8n-style workflow viewer)
// Returns current session (running/completed terakhir) + history N session terbaru
// ============================================================================

const TRACE_CURRENT_KEY = 'atmaja:trace:matthew:current'
const TRACE_HISTORY_KEY = 'atmaja:trace:matthew:history'

async function handleTrace(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }
  try {
    const [current, history] = await Promise.all([
      kv.get(TRACE_CURRENT_KEY).catch(() => null),
      kv.get(TRACE_HISTORY_KEY).catch(() => null),
    ])
    sendJson(res, 200, {
      ok: true,
      current: current ?? null,
      history: Array.isArray(history) ? history : [],
    })
  } catch (error) {
    console.error('[trace] handleTrace error:', error?.message ?? error)
    sendJson(res, 500, { ok: false, error: 'trace_read_failed' })
  }
}

// ============================================================================
// SCHEDULE HANDLER — NL Scheduler (Hermes-inspired automation)
// Atmaja parse intent "ingatkan saya X setiap Y" → simpan KV → display di UI.
// Actual execution via n8n Daily Digest yang check schedules table tiap hari.
// ============================================================================

const SCHEDULES_KEY = 'atmaja:schedules:matthew'
const MAX_SCHEDULES = 50
const MAX_SCHEDULE_TASK_CHARS = 600

// === Cron parser sederhana untuk cronHuman → match day-of-week ===
// Schedule disimpan dengan cronHuman bahasa natural ("setiap Senin pukul 9 pagi").
// Function ini extract day-of-week + match dengan hari ini (WITA).
const DAY_KEYWORDS = {
  senin: 1, monday: 1,
  selasa: 2, tuesday: 2,
  rabu: 3, wednesday: 3,
  kamis: 4, thursday: 4,
  jumat: 5, friday: 5, jumaat: 5,
  sabtu: 6, saturday: 6,
  minggu: 0, sunday: 0, ahad: 0,
}

// Detect cronHuman matches today (di timezone WITA = UTC+8)
function scheduleMatchesToday(cronHuman, nowDate) {
  if (!cronHuman) return false
  const lower = String(cronHuman).toLowerCase()
  const now = nowDate || new Date()
  // WITA = UTC+8
  const witaDow = (now.getUTCDay() + (now.getUTCHours() + 8 >= 24 ? 1 : 0)) % 7
  const todayDow = witaDow

  // "setiap hari" / "tiap hari" / "every day" / "harian" / "daily"
  if (/\b(setiap|tiap|every)\s+hari\b/i.test(lower)) return true
  if (/\b(harian|daily|setiap pagi|tiap pagi)\b/i.test(lower)) return true

  // Day-of-week match
  for (const [keyword, dow] of Object.entries(DAY_KEYWORDS)) {
    if (lower.includes(keyword) && todayDow === dow) return true
  }

  // "weekly" or "mingguan" tanpa hari specific → default Senin
  if (/\b(mingguan|weekly)\b/i.test(lower) && todayDow === 1) return true

  // "monthly" / "bulanan" → fire kalau tanggal 1
  if (/\b(bulanan|monthly)\b/i.test(lower) && now.getUTCDate() === 1) return true

  return false
}

async function handleSchedule(req, res, url) {
  const action = url.searchParams.get('action')

  // GET ?type=schedule&action=due → schedules yang fire hari ini (untuk n8n cron job)
  if (req.method === 'GET' && action === 'due') {
    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const now = new Date()
      const dueItems = items.filter(
        (s) => s.status === 'active' && scheduleMatchesToday(s.cronHuman, now),
      )
      sendJson(res, 200, {
        ok: true,
        due: dueItems,
        count: dueItems.length,
        checkedAt: now.toISOString(),
        witaDate: new Date(now.getTime() + 8 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      })
    } catch (error) {
      console.error('[atmaja-schedule] due error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_due_failed' })
    }
    return
  }

  // GET ?type=schedule → list semua schedule aktif
  if (req.method === 'GET') {
    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      // Filter status default (sembunyikan yang deleted)
      const filtered = items.filter((s) => s.status !== 'deleted')
      sendJson(res, 200, {
        ok: true,
        schedules: filtered,
        count: filtered.length,
        max: MAX_SCHEDULES,
      })
    } catch (error) {
      console.error('[atmaja-schedule] list error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_list_failed' })
    }
    return
  }

  // POST ?type=schedule&action=fire&id=X → mark schedule as fired (lastRunAt = now)
  // PLUS append reminder ke memory file section "Reminder Hari Ini" supaya Atmaja
  // chat next turn aware reminder yang due hari ini.
  if (req.method === 'POST' && action === 'fire') {
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }
    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const idx = items.findIndex((s) => s.id === id)
      if (idx < 0) {
        sendJson(res, 404, { ok: false, error: 'schedule_not_found' })
        return
      }
      const sched = items[idx]
      const nowIso = new Date().toISOString()
      items[idx].lastRunAt = nowIso
      await kv.set(SCHEDULES_KEY, items)

      // Append ke memory file section "Briefs Aktif" supaya Atmaja next turn surface
      // reminder ini sebagai catatan due today
      try {
        const memory = await readMemory()
        const witaDate = new Date(Date.now() + 8 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
        const reminderBullet = `- [Reminder ${witaDate}] ${sched.task} (jadwal: ${sched.cronHuman})`
        let updatedMemory = memory
        if (memory.includes('## Briefs Aktif')) {
          // Insert sebelum section selanjutnya
          updatedMemory = memory.replace(
            '## Briefs Aktif\n',
            `## Briefs Aktif\n${reminderBullet}\n`,
          )
        } else {
          updatedMemory = memory + `\n\n## Briefs Aktif\n${reminderBullet}\n`
        }
        await writeMemory(updatedMemory)
      } catch (memErr) {
        console.error('[atmaja-schedule] memory append on fire failed:', memErr?.message ?? memErr)
      }

      sendJson(res, 200, {
        ok: true,
        fired: { id: sched.id, task: sched.task, lastRunAt: nowIso },
        appendedToMemory: true,
      })
    } catch (error) {
      console.error('[atmaja-schedule] fire error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_fire_failed' })
    }
    return
  }

  // POST ?type=schedule → create schedule
  if (req.method === 'POST') {
    const contentType = getHeader(req, 'content-type') ?? ''
    if (!contentType.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'unsupported_media_type' })
      return
    }
    let payload
    try {
      payload = await readJsonBody(req, 32_000)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }
    const task = String(payload?.task ?? '').trim().slice(0, MAX_SCHEDULE_TASK_CHARS)
    const cron = String(payload?.cron ?? '').trim().slice(0, 80)
    const cronHuman = String(payload?.cronHuman ?? '').trim().slice(0, 200)
    if (!task || task.length < 3) {
      sendJson(res, 400, { ok: false, error: 'task_required', note: 'task min 3 char.' })
      return
    }
    if (!cronHuman) {
      sendJson(res, 400, { ok: false, error: 'cronHuman_required', note: 'cronHuman wajib (text human-readable).' })
      return
    }

    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const activeCount = items.filter((s) => s.status === 'active').length
      if (activeCount >= MAX_SCHEDULES) {
        sendJson(res, 429, {
          ok: false,
          error: 'max_schedules_reached',
          note: `Maksimal ${MAX_SCHEDULES} schedule aktif. Hapus yang lama dulu.`,
        })
        return
      }
      const id = `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newSchedule = {
        id,
        task,
        cron: cron || null,
        cronHuman,
        status: 'active',
        createdAt: new Date().toISOString(),
        nextRunAt: payload?.nextRunAt ? String(payload.nextRunAt).slice(0, 40) : null,
        lastRunAt: null,
        source: String(payload?.source ?? 'atmaja_chat').slice(0, 40),
      }
      items.unshift(newSchedule)
      await kv.set(SCHEDULES_KEY, items)
      sendJson(res, 201, { ok: true, schedule: newSchedule, count: items.length })
    } catch (error) {
      console.error('[atmaja-schedule] create error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_create_failed' })
    }
    return
  }

  // PUT ?type=schedule&id=X&action=pause|resume → toggle status
  // PUT ?type=schedule&id=X (with body) → update task/cron
  if (req.method === 'PUT') {
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }
    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const idx = items.findIndex((s) => s.id === id)
      if (idx < 0) {
        sendJson(res, 404, { ok: false, error: 'schedule_not_found' })
        return
      }
      if (action === 'pause') {
        items[idx].status = 'paused'
      } else if (action === 'resume') {
        items[idx].status = 'active'
      } else if (action === 'markRun') {
        items[idx].lastRunAt = new Date().toISOString()
      }
      await kv.set(SCHEDULES_KEY, items)
      sendJson(res, 200, { ok: true, schedule: items[idx] })
    } catch (error) {
      console.error('[atmaja-schedule] update error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_update_failed' })
    }
    return
  }

  // DELETE ?type=schedule&id=X → soft-delete (status=deleted)
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }
    try {
      const list = (await kv.get(SCHEDULES_KEY)) ?? []
      const items = Array.isArray(list) ? list : []
      const filtered = items.filter((s) => s.id !== id) // hard delete
      await kv.set(SCHEDULES_KEY, filtered)
      sendJson(res, 200, { ok: true, deleted: id })
    } catch (error) {
      console.error('[atmaja-schedule] delete error:', error?.message ?? error)
      sendJson(res, 500, { ok: false, error: 'schedule_delete_failed' })
    }
    return
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

// Helper: read JSON body (mirror dari pattern existing handlers, simple cap).
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw) > maxBytes) {
        reject(Object.assign(new Error('payload_too_large'), { statusCode: 413 }))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(Object.assign(error, { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}

// ============================================================================
// PROPOSALS HANDLER (Self-Evolving Atmaja foundation)
// ============================================================================

async function handleProposals(req, res, url) {
  const action = url.searchParams.get('action')

  // GET ?type=proposals[&status=pending|approved|rejected|implemented]
  if (req.method === 'GET') {
    const filter = url.searchParams.get('status')
    const proposals = await listProposals(filter)
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      implemented: 0,
    }
    for (const p of proposals) {
      if (counts[p.status] != null) counts[p.status] += 1
    }
    sendJson(res, 200, {
      ok: true,
      proposals,
      count: proposals.length,
      counts,
      filter: filter || null,
    })
    return
  }

  // POST ?type=proposals&action=create body {type, title, description, rationale, examples, ...}
  if (req.method === 'POST' && action === 'create') {
    let payload
    try {
      payload = await readBody(req, 20_000)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }
    const result = await createProposal(payload)
    sendJson(res, result.ok ? 200 : 400, result)
    return
  }

  // PUT ?type=proposals&action=approve&id=X body {note?}
  if (req.method === 'PUT' && (action === 'approve' || action === 'reject' || action === 'implemented')) {
    const id = url.searchParams.get('id')
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id_required' })
      return
    }
    let payload = {}
    try {
      payload = await readBody(req, 5_000)
    } catch (error) {
      // body opsional
    }
    const statusMap = { approve: 'approved', reject: 'rejected', implemented: 'implemented' }
    const result = await updateProposalStatus(id, statusMap[action], payload || {})
    sendJson(res, result.ok ? 200 : 404, result)
    return
  }

  // DELETE ?type=proposals[&status=X] → clear all atau filter by status
  if (req.method === 'DELETE') {
    const statusFilter = url.searchParams.get('status')
    const result = await clearProposals(statusFilter)
    sendJson(res, 200, result)
    return
  }

  sendJson(res, 405, {
    ok: false,
    error: 'method_or_action_not_allowed',
    note: 'GET (list) | POST ?action=create | PUT ?action=approve|reject|implemented&id=X | DELETE',
  })
}

// ============================================================================
// BACKUP HANDLER
// ============================================================================

async function handleBackup(req, res, url) {
  const action = url.searchParams.get('action') || 'list'

  // POST ?type=backup&action=create → create snapshot today
  if (req.method === 'POST' && action === 'create') {
    const result = await createMemorySnapshot()
    if (!result.ok) {
      sendJson(res, 500, result)
      return
    }
    // Auto-cleanup old snapshots beyond rolling window
    const cleanResult = await cleanOldSnapshots(BACKUP_MAX_KEEP)
    sendJson(res, 200, { ...result, cleanup: cleanResult })
    return
  }

  // POST ?type=backup&action=restore body {date: 'YYYY-MM-DD'}
  if (req.method === 'POST' && action === 'restore') {
    let payload
    try {
      payload = await readBody(req, 10_000)
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, {
        ok: false,
        error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
      })
      return
    }
    const dateStr = String(payload?.date ?? '').trim()
    if (!dateStr) {
      sendJson(res, 400, { ok: false, error: 'date_required', expected: 'YYYY-MM-DD' })
      return
    }
    const result = await restoreMemoryFromSnapshot(dateStr)
    sendJson(res, result.ok ? 200 : 404, result)
    return
  }

  // GET ?type=backup (default action=list) → list snapshots
  if (req.method === 'GET') {
    const snapshots = await listMemorySnapshots()
    sendJson(res, 200, {
      ok: true,
      snapshots,
      count: snapshots.length,
      maxKeep: BACKUP_MAX_KEEP,
    })
    return
  }

  // DELETE ?type=backup&action=clean → manual cleanup
  if (req.method === 'DELETE' && action === 'clean') {
    const result = await cleanOldSnapshots(BACKUP_MAX_KEEP)
    sendJson(res, 200, result)
    return
  }

  sendJson(res, 405, {
    ok: false,
    error: 'method_or_action_not_allowed',
    note: 'POST ?action=create | POST ?action=restore body {date} | GET (list) | DELETE ?action=clean',
  })
}

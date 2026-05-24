// Atmaja file library — Lapis 3 dari sistem memory.
// PDF di-upload sekali, simpan di Vercel Blob (object storage), accessible by file ID
// untuk semua turn berikutnya. Tidak perlu re-upload tiap kali buka chat.
//
// Endpoints:
//   POST   /api/atmaja/files          → upload PDF base64, simpan Blob, append ke index + memory
//   GET    /api/atmaja/files          → list semua files
//   DELETE /api/atmaja/files?id=xxx   → remove from Blob + index + memory
//
// Auth: bearer (sama dengan memory endpoint — admin only sementara, kalau dipakai PWA
// frontend akan pakai isRequestAllowed dari shared module).

import { put, del } from '@vercel/blob'
import { kv } from '@vercel/kv'
import { isRequestAllowed, getHeader } from '../_shared.js'
import { readMemory, writeMemory } from './memory.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const FILES_INDEX_KEY = 'atmaja:files:matthew:index'
const MAX_FILE_BASE64_BYTES = 3_500_000 // ~2.6 MB raw PDF, fits within Vercel body cap
const MAX_FILES_TOTAL = 50
const MAX_BODY_BYTES = MAX_FILE_BASE64_BYTES + 50_000
const ALLOWED_MIME = new Set(['application/pdf'])

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
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

function generateFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
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

// Fetch raw bytes dari Blob URL + return base64 (untuk attach ke OpenRouter call).
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

// Append entry baru ke "## Files / Dokumen" section di memory file Atmaja.
async function appendFileToMemory(file) {
  try {
    const memory = await readMemory()
    const bullet = `- ${file.name} (${(file.size / 1024).toFixed(1)} KB, uploaded ${file.uploadedAt}) — ID: ${file.id}${file.description ? ' — ' + file.description : ''}`
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
      // Section belum ada (memory pre-Lapis-3). Tambah di bawah Misc.
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

  // === GET: list all files ===
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
    sendJson(res, 200, {
      ok: true,
      files: index,
      count: index.length,
      max: MAX_FILES_TOTAL,
    })
    return
  }

  // === POST: upload file ===
  if (req.method === 'POST') {
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

    const name = String(payload?.name ?? '').trim().slice(0, 200)
    const contentType = String(payload?.contentType ?? '').trim().toLowerCase()
    const dataBase64 = String(payload?.dataBase64 ?? '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
    const description = String(payload?.description ?? '').trim().slice(0, 500) || null

    if (!name) {
      sendJson(res, 400, { ok: false, error: 'name_required' })
      return
    }
    if (!ALLOWED_MIME.has(contentType)) {
      sendJson(res, 400, { ok: false, error: 'unsupported_content_type', supported: Array.from(ALLOWED_MIME) })
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
        note: `Cap ~2.6 MB raw PDF. Pecah file atau extract section utama dulu.`,
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
        note: 'Delete file lama via DELETE /api/atmaja/files?id=xxx dulu.',
      })
      return
    }

    // Cek apakah ada file dengan nama + size sama (dedup simple).
    const buffer = Buffer.from(dataBase64, 'base64')
    const existing = index.find((f) => f.name === name && f.size === buffer.length)
    if (existing) {
      sendJson(res, 200, {
        ok: true,
        file: existing,
        note: 'file_already_exists',
      })
      return
    }

    const id = generateFileId()
    const blobPath = `atmaja/${id}-${encodeURIComponent(name)}`

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

  // === DELETE: remove file ===
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

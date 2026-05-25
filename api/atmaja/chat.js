import { readMemory, writeMemory, incrementTurnCounter, getFileById, fetchFileBase64 } from './memory.js'
import { isRequestAllowed, getHeader, getRequestHost, parseCsv, getClientIp, consumeRateLimit as sharedConsumeRateLimit, attachRequestId } from '../_shared.js'
import { kv } from '@vercel/kv'

// ============================================================================
// LIVE EXECUTION TRACE (n8n-style workflow tracker)
// Setiap step major (intake → memory → atmaja_thinking → output) ditulis ke KV.
// Frontend AI Dept tab poll endpoint /api/atmaja/memory?type=trace untuk live view.
// ============================================================================

const TRACE_CURRENT_KEY = 'atmaja:trace:matthew:current'
const TRACE_HISTORY_KEY = 'atmaja:trace:matthew:history'
const TRACE_HISTORY_MAX = 8

// Define semua possible steps + node mapping ke LiveDepartmentMap nodes.
// Status: 'pending' (belum), 'running' (sedang), 'done' (selesai), 'skipped' (di-skip)
const TRACE_STEPS_TEMPLATE = [
  { id: 'intake', label: 'Brief diterima', node: 'intake', status: 'pending' },
  { id: 'memory_loaded', label: 'Memory dimuat', node: 'memory', status: 'pending' },
  { id: 'files_loaded', label: 'File library dimuat', node: 'memory', status: 'pending' },
  { id: 'atmaja_thinking', label: 'Atmaja menyusun jawaban', node: 'atmaja', status: 'pending' },
  { id: 'response_received', label: 'Jawaban tersusun', node: 'contract', status: 'pending' },
  { id: 'output_sent', label: 'Output dikirim ke Matthew', node: 'contract', status: 'pending' },
  { id: 'memory_updating', label: 'Memory di-update', node: 'memory', status: 'pending' },
]

function makeNewTrace({ sessionId, requestId, userMessagePreview }) {
  return {
    sessionId,
    requestId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    userMessagePreview: String(userMessagePreview || '').slice(0, 120),
    currentStep: null,
    steps: TRACE_STEPS_TEMPLATE.map((s) => ({ ...s })),
    responsePreview: null,
    totalDurationMs: null,
    model: null,
    error: null,
  }
}

// Write trace ke KV. Best-effort, jangan throw kalau gagal (chat lebih penting).
async function writeTrace(trace) {
  try {
    await kv.set(TRACE_CURRENT_KEY, trace)
  } catch (error) {
    console.error('[trace] write failed:', error?.message ?? error)
  }
}

// Update step status + auto-write. Called at each checkpoint.
async function traceStep(trace, stepId, status, extra = {}) {
  if (!trace) return
  const idx = trace.steps.findIndex((s) => s.id === stepId)
  if (idx < 0) return
  trace.steps[idx] = {
    ...trace.steps[idx],
    status,
    at: new Date().toISOString(),
    ...extra,
  }
  if (status === 'running') trace.currentStep = stepId
  await writeTrace(trace)
}

// Finalize trace + push to history. Called at end of handler.
async function finalizeTrace(trace, { status, responsePreview, model, error }) {
  if (!trace) return
  trace.status = status || 'completed'
  trace.completedAt = new Date().toISOString()
  trace.totalDurationMs = new Date(trace.completedAt).getTime() - new Date(trace.startedAt).getTime()
  if (responsePreview) trace.responsePreview = String(responsePreview).slice(0, 240)
  if (model) trace.model = model
  if (error) trace.error = String(error).slice(0, 200)
  trace.currentStep = null
  // Mark all 'running' or 'pending' as either 'done' or 'skipped' depending on context
  for (const step of trace.steps) {
    if (step.status === 'running') step.status = 'done'
    if (step.status === 'pending') step.status = 'skipped'
  }
  await writeTrace(trace)
  // Push to history (keep last N)
  try {
    const existing = (await kv.get(TRACE_HISTORY_KEY)) ?? []
    const arr = Array.isArray(existing) ? existing : []
    arr.unshift(trace)
    const trimmed = arr.slice(0, TRACE_HISTORY_MAX)
    await kv.set(TRACE_HISTORY_KEY, trimmed)
  } catch (error) {
    console.error('[trace] history push failed:', error?.message ?? error)
  }
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// Body cap dinaikkan untuk dukung image inline (base64). Vercel default 4.5 MB → kita pakai 4.3 MB.
const MAX_BODY_BYTES = Number(process.env.ATMAJA_CHAT_MAX_BYTES ?? 4_300_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.ATMAJA_CHAT_RATE_LIMIT ?? 12)
const recentRequestsByIp = new Map()

// === VISION CAPS ===
// Per image: 1.5 MB raw → ~2 MB base64. Max 2 image per turn.
// Anthropic vision support: jpg, png, gif, webp.
const IMAGE_MAX_BASE64_BYTES = 2_100_000
const MAX_IMAGES_PER_TURN = 2
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
const TEXT_PREVIEW_MAX_CHARS = 30_000

// === PDF CAPS ===
// Per PDF: ~2.5 MB raw → ~3.4 MB base64. Max 1 PDF per turn.
// Claude (Opus/Sonnet 4.x) native PDF reading via OpenRouter file content block.
const PDF_MAX_BASE64_BYTES = 3_500_000
const MAX_PDFS_PER_TURN = 1
const ALLOWED_PDF_MIME = new Set(['application/pdf'])

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

function consumeRateLimit(req) {
  return sharedConsumeRateLimit(req, recentRequestsByIp, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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

function clampText(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

// History caps untuk working memory Atmaja.
// Opus 4.7 context window 200K token (~500K char). 100 pesan * 15K char = 1.5M char worst case,
// realistic biasanya jauh di bawah. Room masif untuk konteks multi-hari kerja.
const HISTORY_MAX_MESSAGES = 100
const HISTORY_PER_MESSAGE_CHARS = 15_000

// clampText untuk history menjaga newline (penting buat preserve struktur analisa Atmaja yang panjang).
function clampHistoryText(value, limit) {
  return String(value ?? '').trim().slice(0, limit)
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []

  return history
    .slice(-HISTORY_MAX_MESSAGES)
    .map((message) => {
      const author = message?.author === 'matthew' ? 'user' : 'assistant'
      const content = clampHistoryText(message?.text, HISTORY_PER_MESSAGE_CHARS)
      return content ? { role: author, content } : null
    })
    .filter(Boolean)
}

function sanitizeBase64(value) {
  // Strip data URI prefix kalau client kirim dengan prefix, return raw base64 saja.
  // Tolak kalau ada karakter non-base64 (anti-injection di header data URI).
  if (typeof value !== 'string') return null
  const stripped = value.replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]+$/.test(stripped)) return null
  if (stripped.length === 0) return null
  return stripped
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return []

  let imageCount = 0
  let pdfCount = 0
  return attachments.slice(0, 5).map((attachment) => {
    const type = clampText(attachment?.type, 80)
    const kind = clampText(attachment?.kind, 40)
    const name = clampText(attachment?.name, 160)
    const normalized = {
      name,
      type,
      kind,
      size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
      note: clampText(attachment?.note, 220),
      previewText: clampText(attachment?.previewText, TEXT_PREVIEW_MAX_CHARS),
    }

    // Hanya proses image base64 untuk kind=image + MIME whitelisted + di bawah cap + masih ada slot.
    const isImage = kind === 'image' && ALLOWED_IMAGE_MIME.has(type.toLowerCase())
    if (isImage && imageCount < MAX_IMAGES_PER_TURN) {
      const base64 = sanitizeBase64(attachment?.dataBase64)
      if (base64 && base64.length <= IMAGE_MAX_BASE64_BYTES) {
        normalized.dataBase64 = base64
        normalized.mime = type.toLowerCase()
        normalized.documentKind = 'image'
        imageCount += 1
      }
    }

    // PDF: kind=document + MIME application/pdf atau ekstensi .pdf + di bawah cap + masih ada slot.
    const lowerName = name.toLowerCase()
    const isPdf = kind === 'document' && (ALLOWED_PDF_MIME.has(type.toLowerCase()) || lowerName.endsWith('.pdf'))
    if (isPdf && pdfCount < MAX_PDFS_PER_TURN) {
      const base64 = sanitizeBase64(attachment?.dataBase64)
      if (base64 && base64.length <= PDF_MAX_BASE64_BYTES) {
        normalized.dataBase64 = base64
        normalized.mime = 'application/pdf'
        normalized.documentKind = 'pdf'
        pdfCount += 1
      }
    }

    return normalized
  })
}

function buildSystemPrompt(memory) {
  const baseLines = [
    'Anda adalah Atmaja, CEO AI Department untuk Gerai 1000 Pintu milik Matthew.',
    'Jawab dalam Bahasa Indonesia yang ringkas, langsung, dan membantu mengambil keputusan.',
    'Kalau Matthew meminta pilihan, warna, foto, opsi, atau preferensi, jawab pilihannya dulu sebelum alasan.',
    'Jangan membantah arah pertanyaan Matthew. Jika konteks kurang, beri asumsi kerja dan tetap berikan langkah berikutnya.',
    'Kalau Matthew melampirkan gambar (jpg/png/webp/gif), kamu BISA melihat gambar itu langsung (vision aktif). Analisis konten gambar dan jawab konkrit.',
    'Kalau Matthew melampirkan PDF, kamu BISA baca isi PDF itu langsung (native PDF reading aktif via Claude Opus/Sonnet 4.x). Baca dan analisis isi PDF, kutip bagian relevan, jawab spesifik.',
    'Untuk file teks/kode/markdown yang sudah diekstrak preview-nya, baca cuplikan yang dikirim dan jawab berdasar isi.',
    'Untuk file docx/xlsx/zip yang hanya kirim metadata, jelaskan jujur kamu belum lihat isi dan tawarkan jalan (ekstrak ke teks, paste isi, atau export ke PDF dulu).',
    'Jaga output agar tidak menyuruh Matthew memindahkan rahasia ke chat. Untuk kredensial, minta disimpan sebagai server environment variable.',
    'BRAND CANON GERAI 1000 PINTU: tone calm refined premium curated retail. JANGAN PAKAI em-dash (—), pakai koma/titik/dash biasa. Pakai "tempat" bukan "rumah". Sebut nama lengkap "Gerai 1000 Pintu", jangan disingkat.',
    'PROACTIVE CAPABILITY GAP DETECTION: Kalau dalam pembicaraan kamu sadar ada gap kapabilitas yang Matthew butuh tapi belum ada di sistem (misal: specialist baru yang dia butuh berulang, workflow otomasi yang bisa hemat waktu dia, fitur app yang missing), kamu BOLEH tambahkan di akhir respons:\n\n[ATMAJA_INSIGHT]\nSaya rasa ada gap: <satu kalimat>. Mau saya formulasikan jadi proposal untuk minggu depan? (Atau saya simpan sebagai catatan saja untuk Weekly Self-Review Senin pagi.)\n[/ATMAJA_INSIGHT]\n\nRules:\n- Max 1 insight per response\n- Hanya kalau ada signal kuat, JANGAN tiap turn\n- Insight harus konkret, bukan generic improvement',
    'NL SCHEDULER (capability baru): Kalau Matthew minta reminder, jadwal, atau recurring task (contoh: "ingatkan saya X tiap Senin", "jadwalkan review brief mingguan", "tiap pagi cek stok"), kamu boleh emit marker schedule yang frontend akan parse + simpan otomatis. Format:\n\n[ATMAJA_SCHEDULE_CREATE]\ntask: <deskripsi singkat tugas yang Matthew minta>\ncronHuman: <kapan, dalam bahasa natural Indonesia, contoh: "setiap Senin pukul 9 pagi" atau "setiap hari pukul 7 pagi">\n[/ATMAJA_SCHEDULE_CREATE]\n\nRules:\n- Hanya kalau Matthew explicit minta reminder/schedule/jadwal. Bukan tiap turn.\n- Konfirmasi dulu di body response sebelum emit marker ("Saya catat jadwal: cek inventory setiap Senin pagi.").\n- Marker harus akurat parse intent Matthew, jangan ganti kata-kata dia.',
    'BROWSE COMMAND (capability baru): Matthew bisa pakai `/browse <url>` untuk fetch + analisis halaman web. Frontend yang execute fetch, kamu terima text content sebagai user message dengan prefix "[BROWSE_RESULT url=...]". Analisis isinya, kasih insight relevan untuk Gerai 1000 Pintu.',
    'RESEARCH MULTI (capability baru): Kalau Matthew minta research mendalam multi-aspek (misal "research kompetitor X dari berbagai angle"), pecah jadi 2-3 sub-question, jawab masing-masing concise, lalu synthesis. Format response: pakai heading per aspek, ringkas, actionable.',
  ]

  // Inject memory file kalau ada dan non-default. Memory auto-maintained oleh sistem,
  // Atmaja BACA tapi TIDAK eksplisit ngutip "berdasarkan memory" ke user (smooth UX).
  if (memory && typeof memory === 'string' && memory.trim()) {
    baseLines.push('')
    baseLines.push('=== MEMORY ATMAJA TENTANG GERAI (long-term, auto-maintained) ===')
    baseLines.push('Berikut adalah catatan persisten tentang Gerai 1000 Pintu yang Atmaja kumpulkan dari percakapan sebelumnya.')
    baseLines.push('Pakai info ini sebagai konteks tanpa perlu eksplisit menyebut "berdasarkan memory" — anggap Anda memang ingat secara alami.')
    baseLines.push('Kalau ada info baru di percakapan ini, sistem akan auto-update memory di background.')
    baseLines.push('')
    baseLines.push(memory.trim())
    baseLines.push('')
    baseLines.push('=== END MEMORY ===')
  }

  return baseLines.join('\n')
}

function buildUserContent(message, attachments) {
  // Pisahkan attachment per documentKind.
  const imageAttachments = attachments.filter((a) => a.dataBase64 && a.documentKind === 'image')
  const pdfAttachments = attachments.filter((a) => a.dataBase64 && a.documentKind === 'pdf')
  const textAttachments = attachments.filter((a) => !a.dataBase64 && a.previewText)
  const metadataOnly = attachments.filter((a) => !a.dataBase64 && !a.previewText)
  const hasInlineBinary = imageAttachments.length > 0 || pdfAttachments.length > 0

  // Kalau tidak ada inline binary → tetap pakai string biasa.
  if (!hasInlineBinary) {
    if (attachments.length === 0) return message
    const lines = []
    if (textAttachments.length > 0) {
      lines.push('[Cuplikan isi file teks - dibaca client lalu dikirim ke server]')
      for (const att of textAttachments) {
        lines.push(`- ${att.name || 'file'} (${att.type || 'text'}):`)
        lines.push(att.previewText)
      }
    }
    if (metadataOnly.length > 0) {
      lines.push('[Lampiran metadata saja - isi belum diekstrak]')
      for (const att of metadataOnly) {
        const sizeKb = Math.round((att.size / 1024) * 10) / 10
        lines.push(`- ${att.name || 'file'} (${att.kind || 'file'}, ${att.type || 'unknown'}, ${sizeKb} KB): ${att.note || 'metadata only'}`)
      }
    }
    return `${message}\n\n${lines.join('\n')}`
  }

  // Ada inline binary → kirim sebagai content block array.
  const blocks = []
  let textPart = message
  if (textAttachments.length > 0) {
    const lines = ['', '[Cuplikan isi file teks]']
    for (const att of textAttachments) {
      lines.push(`- ${att.name || 'file'} (${att.type || 'text'}):`)
      lines.push(att.previewText)
    }
    textPart += `\n${lines.join('\n')}`
  }
  if (metadataOnly.length > 0) {
    const lines = ['', '[Lampiran metadata saja - isi belum diekstrak]']
    for (const att of metadataOnly) {
      const sizeKb = Math.round((att.size / 1024) * 10) / 10
      lines.push(`- ${att.name || 'file'} (${att.type || 'unknown'}, ${sizeKb} KB)`)
    }
    textPart += `\n${lines.join('\n')}`
  }

  blocks.push({ type: 'text', text: textPart })
  for (const att of imageAttachments) {
    blocks.push({
      type: 'image_url',
      image_url: { url: `data:${att.mime};base64,${att.dataBase64}` },
    })
  }
  // PDF dikirim sebagai file content block (OpenRouter compatible, native PDF reading di Claude 3.5+/4.x).
  for (const att of pdfAttachments) {
    blocks.push({
      type: 'file',
      file: {
        filename: att.name || 'document.pdf',
        file_data: `data:${att.mime};base64,${att.dataBase64}`,
      },
    })
  }
  return blocks
}

export default async function handler(req, res) {
  // Correlation ID — set EARLY supaya sendJson dan log otomatis include.
  res._requestId = attachRequestId(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...jsonHeaders, 'x-request-id': res._requestId })
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  if (process.env.ATMAJA_OPENROUTER_ENABLED !== 'true') {
    sendJson(res, 503, {
      ok: false,
      error: 'atmaja_openrouter_disabled',
      note: 'Set ATMAJA_OPENROUTER_ENABLED=true di server untuk mengaktifkan chat OpenRouter.',
    })
    return
  }

  if (!process.env.OPENROUTER_API_KEY) {
    sendJson(res, 503, {
      ok: false,
      error: 'openrouter_key_missing',
      note: 'OPENROUTER_API_KEY belum diset di server. Jangan taruh key di frontend.',
    })
    return
  }

  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
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

  const userMessage = clampText(payload?.userMessage, 6_000)
  if (!userMessage) {
    sendJson(res, 400, { ok: false, error: 'message_required' })
    return
  }

  // === TRACE: Initialize session + intake ===
  const sessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const trace = makeNewTrace({
    sessionId,
    requestId: res._requestId,
    userMessagePreview: userMessage,
  })
  await traceStep(trace, 'intake', 'done', { detail: `${userMessage.length} char prompt diterima` })

  const attachments = normalizeAttachments(payload?.attachments)

  // Lapis 3: resolve attachedFileIds → fetch dari Vercel Blob → tambahkan sebagai
  // synthetic PDF attachment (re-use existing pdf_native pipeline).
  const attachedFileIds = Array.isArray(payload?.attachedFileIds)
    ? payload.attachedFileIds.filter((id) => typeof id === 'string').slice(0, 3)
    : []
  const fileAttachments = []
  if (attachedFileIds.length > 0) {
    await traceStep(trace, 'files_loaded', 'running')
  }
  for (const fileId of attachedFileIds) {
    try {
      const file = await getFileById(fileId)
      if (!file) continue
      const base64 = await fetchFileBase64(file)
      if (!base64) continue
      fileAttachments.push({
        name: file.name,
        type: file.contentType,
        kind: 'document',
        size: file.size,
        dataBase64: base64,
        mime: file.contentType,
        documentKind: 'pdf',
        note: `Loaded from library (ID: ${file.id})`,
      })
    } catch (error) {
      console.error('[atmaja-chat] file attachment error:', error?.message ?? error)
    }
  }
  if (attachedFileIds.length > 0) {
    await traceStep(trace, 'files_loaded', 'done', { detail: `${fileAttachments.length} file PDF dimuat` })
  } else {
    await traceStep(trace, 'files_loaded', 'skipped', { detail: 'Tidak ada file dilampirkan' })
  }

  // Combine inline attachments (current turn upload) + library file attachments (reference).
  const combinedAttachments = [...attachments, ...fileAttachments]

  // Atmaja /atmaja chat = CEO sintesis = CONTENT tier (per preferensi Matthew).
  // Premium content -> Opus 4.7. Sonnet 4.6 untuk fallback dan untuk orchestration C-suite.
  // openrouter/auto sebelumnya menghasilkan model lemah yang mengembalikan teks kosong.
  const CONTENT_PRIMARY_MODEL = 'anthropic/claude-opus-4.7'
  const STABLE_FALLBACK_MODEL = 'anthropic/claude-sonnet-4.6'

  // === FLOOR ENFORCEMENT ===
  // Minimum model: Sonnet 4.6. Tidak boleh di bawah (per arahan Matthew).
  // Whitelist Opus 4.x variants + Sonnet 4.6. Apapun di luar -> fallback ke CONTENT_PRIMARY_MODEL.
  const ALLOWED_MODELS = new Set([
    'anthropic/claude-opus-4.7',
    'anthropic/claude-opus-4.7-fast',
    'anthropic/claude-opus-4.6',
    'anthropic/claude-opus-4.6-fast',
    'anthropic/claude-opus-4.5',
    'anthropic/claude-opus-4.1',
    'anthropic/claude-opus-4',
    'anthropic/claude-sonnet-4.6',
  ])

  const payloadModel = clampText(payload?.model, 200)
  const envModel = process.env.ATMAJA_OPENROUTER_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? ''
  function pickModel(candidate) {
    return candidate && ALLOWED_MODELS.has(candidate) ? candidate : null
  }
  const primaryModel = pickModel(payloadModel) ?? pickModel(envModel) ?? CONTENT_PRIMARY_MODEL

  const referer = process.env.ATMAJA_OPENROUTER_REFERER ?? process.env.PUBLIC_APP_URL ?? 'https://gerai.mahewwork.com'

  // Lapis 2: read long-term memory dari Vercel KV (Upstash Redis).
  // Best-effort — kalau KV down atau env missing, tetap lanjut dengan empty memory.
  await traceStep(trace, 'memory_loaded', 'running')
  let memoryContent = ''
  try {
    memoryContent = await readMemory()
  } catch (error) {
    console.error('[atmaja-chat] readMemory failed:', error?.message ?? error)
    memoryContent = ''
  }
  await traceStep(trace, 'memory_loaded', 'done', {
    detail: `${memoryContent.length} char dari Business Memory`,
  })

  const messages = [
    { role: 'system', content: buildSystemPrompt(memoryContent) },
    ...normalizeHistory(payload?.history),
    { role: 'user', content: buildUserContent(userMessage, combinedAttachments) },
  ]

  // Max output per single call. Opus 4.7 via OpenRouter support up to 8192 standard.
  const MAX_TOKENS_PER_CALL = 8192
  // Max auto-continuation kalau response masih kepotong (1 initial + N continuations).
  // Total worst case output: 8192 * 3 = 24,576 token = ~18K kata. Sangat jarang full.
  const MAX_CONTINUATIONS = 2
  // Cap total accumulated reply (safety net, hindari runaway response).
  const MAX_TOTAL_REPLY_CHARS = 60_000

  async function callOpenRouter(modelId, messagesArg) {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'http-referer': referer,
        'x-openrouter-title': 'Gerai 1000 Pintu Atmaja',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messagesArg,
        temperature: 0.45,
        max_tokens: MAX_TOKENS_PER_CALL,
      }),
    })

    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }

    return { upstream, body: parsed }
  }

  function extractFinishReason(body) {
    return body?.choices?.[0]?.finish_reason ?? body?.choices?.[0]?.native_finish_reason ?? null
  }

  function isTruncated(reason) {
    return reason === 'length' || reason === 'max_tokens'
  }

  function sumUsage(target, src) {
    if (!src || typeof src !== 'object') return target
    return {
      prompt_tokens: (target.prompt_tokens ?? 0) + (Number(src.prompt_tokens) || 0),
      completion_tokens: (target.completion_tokens ?? 0) + (Number(src.completion_tokens) || 0),
      total_tokens: (target.total_tokens ?? 0) + (Number(src.total_tokens) || 0),
    }
  }

  async function callWithAutoContinuation(modelId, initialMessages) {
    let conversation = [...initialMessages]
    let accumulatedText = ''
    let lastUpstream = null
    let lastBody = null
    let lastFinishReason = null
    let continuations = 0
    let aggregatedUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
      const result = await callOpenRouter(modelId, conversation)
      lastUpstream = result.upstream
      lastBody = result.body
      aggregatedUsage = sumUsage(aggregatedUsage, result.body?.usage)

      if (!result.upstream.ok) break

      const partial = result.body?.choices?.[0]?.message?.content
      if (typeof partial !== 'string' || !partial.trim()) break

      accumulatedText += (accumulatedText ? '' : '') + partial
      lastFinishReason = extractFinishReason(result.body)

      // Hard safety cap kalau response runaway (mestinya tidak terjadi karena MAX_CONTINUATIONS).
      if (accumulatedText.length >= MAX_TOTAL_REPLY_CHARS) break

      // Selesai natural — stop loop.
      if (!isTruncated(lastFinishReason)) break

      // Truncated — tambah continuation prompt + loop lagi.
      if (attempt >= MAX_CONTINUATIONS) break
      continuations += 1
      conversation = [
        ...conversation,
        { role: 'assistant', content: partial },
        {
          role: 'user',
          content: 'Lanjutkan persis dari titik kamu berhenti barusan. Jangan ulang yang sudah ditulis, jangan ulang heading yang sudah ada. Selesaikan tuntas sampai poin terakhir.',
        },
      ]
    }

    return {
      upstream: lastUpstream,
      body: lastBody,
      accumulatedText,
      lastFinishReason,
      continuations,
      aggregatedUsage,
    }
  }

  // === MEMORY AUTO-UPDATE (Lapis 2) ===
  // Setelah Atmaja jawab, call Sonnet 4.6 untuk extract delta (info baru) dari turn ini,
  // lalu append ke memory file. Format delta: section markers + bullets.
  // Trivial turns (< 30 char user OR < 200 char Atmaja reply) di-skip untuk hemat cost.
  async function updateMemoryFromTurn({ userMsg, atmajaReply, currentMemory }) {
    try {
      const trimmedUser = String(userMsg ?? '').trim()
      const trimmedReply = String(atmajaReply ?? '').trim()
      if (trimmedUser.length < 30 || trimmedReply.length < 200) {
        return { skipped: true, reason: 'turn_too_short' }
      }

      const extractorPrompt = [
        'Anda adalah memory editor untuk Atmaja, CEO AI Gerai 1000 Pintu milik Matthew.',
        '',
        'Tugas: ekstrak HANYA info BARU yang penting disimpan ke memory long-term dari turn percakapan berikut.',
        '',
        'MEMORY SAAT INI:',
        '```',
        String(currentMemory || '').slice(0, 30_000),
        '```',
        '',
        'TURN BARU:',
        '',
        'Matthew bilang:',
        trimmedUser.slice(0, 4_000),
        '',
        'Atmaja jawab:',
        trimmedReply.slice(0, 4_000),
        '',
        'OUTPUT format (strict):',
        '- Kalau ada info baru worth disimpan, output bullets per section dengan header ## SECTION_NAME:',
        '  ## Strategi & Keputusan',
        '  - bullet baru 1 (max 200 char, fakta konkrit, no filler)',
        '  - bullet baru 2',
        '  ## Brand Canon',
        '  - bullet baru',
        '- Section yang valid: Strategi & Keputusan, Brand Canon, Operations & Vendor, Tim & People, Briefs Aktif, TODO / Pending, Misc / Konteks Personal',
        '- JANGAN duplikasi info yang sudah ada di memory.',
        '- JANGAN tambah bullet untuk pertanyaan biasa atau jawaban filler.',
        '- Kalau TIDAK ada info baru worth disimpan, output PERSIS: NONE',
        '',
        'OUTPUT (hanya markdown bullets atau NONE, jangan tulis explanation lain):',
      ].join('\n')

      const extractorResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'http-referer': referer,
          'x-openrouter-title': 'Gerai 1000 Pintu Atmaja Memory Extractor',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4.6',
          messages: [{ role: 'user', content: extractorPrompt }],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      })

      if (!extractorResponse.ok) {
        return { skipped: true, reason: 'extractor_http_error', status: extractorResponse.status }
      }

      const extractorBody = await extractorResponse.json()
      const deltaRaw = String(extractorBody?.choices?.[0]?.message?.content ?? '').trim()

      if (!deltaRaw || deltaRaw === 'NONE' || deltaRaw.toUpperCase() === 'NONE') {
        return { skipped: true, reason: 'no_new_info' }
      }

      // Parse delta sections + merge ke current memory.
      const validSections = [
        'Strategi & Keputusan',
        'Brand Canon',
        'Operations & Vendor',
        'Tim & People',
        'Briefs Aktif',
        'TODO / Pending',
        'Misc / Konteks Personal',
      ]
      const sectionDeltas = {}
      let currentSection = null
      for (const rawLine of deltaRaw.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue
        const sectionMatch = line.match(/^##\s+(.+)$/)
        if (sectionMatch) {
          const candidate = sectionMatch[1].trim()
          currentSection = validSections.find((s) => s.toLowerCase() === candidate.toLowerCase()) ?? null
          if (currentSection && !sectionDeltas[currentSection]) {
            sectionDeltas[currentSection] = []
          }
          continue
        }
        if (currentSection && line.startsWith('-')) {
          sectionDeltas[currentSection].push(line)
        }
      }

      if (Object.keys(sectionDeltas).length === 0) {
        return { skipped: true, reason: 'parse_no_sections' }
      }

      // Merge deltas ke current memory. Untuk tiap section di delta, append bullet
      // ke bagian section yang sesuai di current memory. Replace "(belum ada catatan)" stub.
      let merged = String(currentMemory || '')
      for (const [section, bullets] of Object.entries(sectionDeltas)) {
        const sectionHeader = `## ${section}`
        const sectionStart = merged.indexOf(sectionHeader)
        if (sectionStart === -1) continue

        const nextSectionStart = merged.indexOf('\n## ', sectionStart + sectionHeader.length)
        const sectionEnd = nextSectionStart === -1 ? merged.length : nextSectionStart
        let sectionBlock = merged.slice(sectionStart, sectionEnd)

        // Hapus stub "(belum ada catatan)" kalau ada.
        sectionBlock = sectionBlock.replace(/^\(belum ada catatan\)\s*$/m, '')

        // Append bullets (deduplikasi sederhana — skip kalau bullet text persis sama).
        for (const bullet of bullets) {
          if (!sectionBlock.includes(bullet)) {
            sectionBlock = sectionBlock.trimEnd() + '\n' + bullet
          }
        }
        sectionBlock = sectionBlock.trimEnd() + '\n\n'

        merged = merged.slice(0, sectionStart) + sectionBlock + merged.slice(sectionEnd).replace(/^\n+/, '')
      }

      // Update timestamp di header (line "Last updated: ..." kalau ada).
      const timestamp = new Date().toISOString()
      if (merged.includes('Last updated:')) {
        merged = merged.replace(/Last updated:.*$/m, `Last updated: ${timestamp}`)
      }

      await writeMemory(merged)
      await incrementTurnCounter()
      const bulletsAdded = Object.values(sectionDeltas).reduce((sum, arr) => sum + arr.length, 0)
      return { skipped: false, bulletsAdded, sectionsUpdated: Object.keys(sectionDeltas) }
    } catch (error) {
      console.error('[atmaja-chat] updateMemoryFromTurn error:', error?.message ?? error)
      return { skipped: true, reason: 'exception', error: error?.message ?? 'unknown' }
    }
  }

  try {
    await traceStep(trace, 'atmaja_thinking', 'running', { detail: `Model: ${primaryModel}` })
    let { upstream, body, accumulatedText, lastFinishReason, continuations, aggregatedUsage } =
      await callWithAutoContinuation(primaryModel, messages)
    let usedModel = primaryModel
    let fallbackTried = false

    if (!upstream.ok) {
      await finalizeTrace(trace, {
        status: 'error',
        error: `OpenRouter HTTP ${upstream.status}: ${body?.error?.message ?? 'failed'}`,
      })
      sendJson(res, upstream.status, {
        ok: false,
        error: 'openrouter_error',
        upstreamStatus: upstream.status,
        modelTried: primaryModel,
        note: body?.error?.message ?? body?.message ?? 'OpenRouter request failed.',
      })
      return
    }

    let replyText = accumulatedText

    // Retry with stable model jika upstream balikan kosong (kasus openrouter/auto)
    if ((typeof replyText !== 'string' || !replyText.trim()) && primaryModel !== STABLE_FALLBACK_MODEL) {
      fallbackTried = true
      const retry = await callWithAutoContinuation(STABLE_FALLBACK_MODEL, messages)
      upstream = retry.upstream
      body = retry.body
      usedModel = STABLE_FALLBACK_MODEL
      replyText = retry.accumulatedText
      lastFinishReason = retry.lastFinishReason
      continuations = retry.continuations
      aggregatedUsage = retry.aggregatedUsage
    }

    await traceStep(trace, 'atmaja_thinking', 'done', {
      detail: `Selesai (${continuations} continuation, ${aggregatedUsage?.completion_tokens ?? 0} token jawaban)`,
    })

    if (typeof replyText !== 'string' || !replyText.trim()) {
      await finalizeTrace(trace, {
        status: 'error',
        error: 'OpenRouter response kosong setelah retry',
      })
      sendJson(res, 502, {
        ok: false,
        error: 'empty_openrouter_reply',
        modelTried: usedModel,
        fallbackTried,
        note: 'OpenRouter tidak mengembalikan teks jawaban setelah retry.',
      })
      return
    }

    await traceStep(trace, 'response_received', 'done', {
      detail: `${replyText.length} char dari ${usedModel}`,
    })

    // Truncation indicator: muncul HANYA kalau sudah max continuation tapi masih kepotong.
    const finalTruncated = isTruncated(lastFinishReason)
    if (finalTruncated) {
      replyText = replyText.trim() + '\n\n---\n_[Jawaban masih panjang. Balas "lanjutkan" supaya saya teruskan dari titik berhenti.]_'
    }

    // Hitung policy actual berdasarkan apa yang BENERAN dikirim.
    const imagesSent = combinedAttachments.filter((a) => a.dataBase64 && a.documentKind === 'image').length
    const pdfsSent = combinedAttachments.filter((a) => a.dataBase64 && a.documentKind === 'pdf').length
    const libraryPdfsSent = fileAttachments.length
    const textsSent = combinedAttachments.filter((a) => !a.dataBase64 && a.previewText).length
    const metadataOnlyCount = combinedAttachments.filter((a) => !a.dataBase64 && !a.previewText).length
    const policy =
      imagesSent > 0 && pdfsSent > 0
        ? 'multimodal_image_and_pdf'
        : imagesSent > 0
          ? 'vision_inline'
          : pdfsSent > 0
            ? 'pdf_native'
            : textsSent > 0
              ? 'text_preview_inline'
              : metadataOnlyCount > 0
                ? 'metadata_only'
                : 'none'

    // Lapis 2 — auto-update long-term memory (Vercel KV). Synchronous: kasih konfirmasi
    // ke client memory ke-update atau di-skip. Tambah ~1-3s latency tapi lebih reliable
    // daripada fire-and-forget (Vercel function bisa kill task setelah sendJson).
    await traceStep(trace, 'memory_updating', 'running')
    const memoryUpdate = await updateMemoryFromTurn({
      userMsg: userMessage,
      atmajaReply: replyText,
      currentMemory: memoryContent,
    })
    if (memoryUpdate?.skipped) {
      await traceStep(trace, 'memory_updating', 'skipped', {
        detail: `Skipped: ${memoryUpdate.reason}`,
      })
    } else {
      await traceStep(trace, 'memory_updating', 'done', {
        detail: `${memoryUpdate?.bulletsAdded ?? 0} catatan baru ditambahkan`,
      })
    }

    await traceStep(trace, 'output_sent', 'done', {
      detail: `${replyText.trim().length} char dikirim ke Matthew`,
    })
    await finalizeTrace(trace, {
      status: 'completed',
      responsePreview: replyText.trim().slice(0, 240),
      model: usedModel,
    })

    sendJson(res, 200, {
      ok: true,
      provider: 'OpenRouter',
      model: (body?.model ?? usedModel) || null,
      requestedModel: primaryModel,
      fallbackUsed: fallbackTried,
      truncated: finalTruncated,
      finishReason: lastFinishReason,
      continuations,
      text: replyText.trim(),
      usage: aggregatedUsage,
      attachmentsPolicy: policy,
      attachmentsSummary: {
        imagesSent,
        pdfsSent,
        libraryPdfsSent,
        textsSent,
        metadataOnly: metadataOnlyCount,
      },
      memoryUpdate,
      sessionId,
    })
  } catch (error) {
    await finalizeTrace(trace, {
      status: 'error',
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    sendJson(res, 502, {
      ok: false,
      error: 'openrouter_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

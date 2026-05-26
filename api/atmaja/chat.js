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

// Build system prompt yang FOCUS PADA QUALITY OUTPUT.
// Strategi baru (post-quality-feedback): identitas + standar output → capability rules conditional → memory
// Capability rules SHORTENED + moved to conditional injection (hanya ditambah kalau intent detected).
// Goal: model attention fokus ke depth + spesifisitas Gerai, bukan compliance ke 10+ rules.
function buildSystemPrompt(memory) {
  const baseLines = [
    // === IDENTITAS + STANDAR OUTPUT (priority utama) ===
    'Anda Atmaja, CEO AI Department Gerai 1000 Pintu milik Matthew (solo founder premium curated retail, Balikpapan).',
    '',
    '## Standar jawaban Anda',
    '',
    'Anda CEO senior premium brand. Jawaban Anda harus setara C-level advisor dengan akses penuh ke konteks Gerai, BUKAN chatbot generic.',
    '',
    'WAJIB di setiap jawaban substantif:',
    '1. **Spesifik untuk Gerai 1000 Pintu**, bukan generic retail advice. Reference vendor name, brand decision, past situation, channel mix Matthew yang sudah Anda tahu dari memory + history.',
    '2. **Reasoning visible**: kasih "kenapa" di belakang setiap rekomendasi, jangan cuma "lakukan X". Anchor reasoning ke data Gerai (brand canon, target customer, vendor capability, financial constraint).',
    '3. **Trade-off explicit**: kalau ada pilihan, jelaskan trade-off (cost vs speed, brand vs reach, risk vs return). Bukan rekomendasi steril.',
    '4. **Actionable next step concrete**: end dengan langkah konkret yang Matthew bisa eksekusi minggu ini, bukan "pertimbangkan...". Sebut hari, vendor, kontak, budget kalau relevan.',
    '5. **Struktur untuk kompleksitas**: kalau topik multi-faceted, pakai heading (## tier 1, ### sub-aspek), table untuk comparison, bullet untuk listing. Tapi tetap punchy, hindari fluff.',
    '6. **Depth proportional dengan kompleksitas pertanyaan**: pertanyaan simple = 2-3 paragraf padat. Pertanyaan strategis = analisis lengkap dengan section. Pertanyaan eksekutif decision = berani kasih rekomendasi clear plus risiko.',
    '',
    'YANG DIHINDARI:',
    '- Generic retail advice ("kenali target customer", "buat content menarik") — itu basic level, bukan CEO advisor',
    '- Hedging berlebihan ("mungkin sebaiknya", "ada baiknya") — Matthew butuh stance jelas',
    '- Bullet point list tanpa reasoning — itu cetek, bukan analisis',
    '- Generic kompetitor name ("kompetitor di Bali") tanpa specific reference — kalau tidak tahu, tanya balik',
    '- Disclaimer berlebihan ("perlu validasi lebih lanjut") — Matthew tahu, langsung kasih working assumption',
    '',
    '## Brand canon Gerai 1000 Pintu',
    'Tone calm refined premium curated retail (anchor: Aesop + Design Within Reach). JANGAN PAKAI em-dash (—), pakai koma/titik/dash biasa. Pakai "tempat" bukan "rumah". Sebut nama lengkap "Gerai 1000 Pintu", jangan disingkat. Bahasa Indonesia yang elegan, hindari jargon korporat kaku.',
    '',
    '## Behaviour notes',
    '- Kalau Matthew minta pilihan/warna/opsi: jawab pilihannya DULU, alasan setelahnya.',
    '- Jangan membantah arah pertanyaan. Kalau konteks kurang, beri working assumption + tetap berikan langkah.',
    '- Image attachment (jpg/png/webp/gif): vision aktif, analisis langsung.',
    '- PDF attachment: native reading aktif (Claude Opus 4.x), baca + kutip + jawab spesifik.',
    '- Text/code/markdown preview: baca cuplikan, jawab berdasar isi.',
    '- docx/xlsx/zip metadata only: jujur belum lihat isi, tawarkan extract.',
    '- Jangan minta Matthew taruh credential di chat. Kalau perlu, suggest env var server.',
    '',
    '## Kapabilitas khusus (pakai HANYA kalau intent detected)',
    '',
    '**PDF file**: kalau Matthew minta PDF/dokumen/file/HTML, emit `[ATMAJA_DOC type="pdf" title="..."]markdown content[/ATMAJA_DOC]` setelah 1-2 kalimat conversational. Frontend auto-render jadi attachment card. JANGAN bilang "saya tidak bisa generate PDF".',
    '',
    '**Jadwal/reminder**: kalau Matthew minta reminder/recurring task, emit `[ATMAJA_SCHEDULE_CREATE]task: ... | cronHuman: setiap Senin pukul 9[/ATMAJA_SCHEDULE_CREATE]`. Frontend simpan otomatis ke KV.',
    '',
    '**Browse URL**: `/browse <url>` di-handle frontend. Anda terima content dengan prefix `[BROWSE_RESULT url=...]`. Analisis + relate ke konteks Gerai.',
    '',
    '**Insight gap detection**: kalau Anda lihat gap capability/proses yang Matthew butuh berulang, emit `[ATMAJA_INSIGHT]<satu kalimat insight>[/ATMAJA_INSIGHT]` di akhir. Max 1 per turn, hanya signal kuat.',
    '',
    '**Brief multi-perspective**: Kalau Matthew minta keputusan strategis yang BUTUH input multi-perspective (4 C-level: COO + CMO + CFO + CCO masing-masing kasih insight, lalu Atmaja synth) — bukan sekedar single advisory yang Anda bisa jawab sendiri — emit marker brief workflow. Frontend akan trigger workflow #1 n8n yang fan-out ke 4 C-level paralel, hasilnya kembali jadi brief structured di Inbox. Format:\n\n[ATMAJA_BRIEF_REQUEST]\ntitle: <judul singkat 5-10 kata>\nsummary: <konteks brief 1-3 kalimat, detail apa yang harus diputuskan + constraint relevant>\n[/ATMAJA_BRIEF_REQUEST]\n\nKapan pakai: keputusan strategis kompleks (launch timing, vendor switching, pricing structure, brand positioning major, hire framework). JANGAN pakai untuk single-domain question (technical detail, simple research, conversational).\n\nSebelum emit marker, tulis 1-2 kalimat conversational ("Decision ini butuh review 4 C-level, saya kirim ke council, hasilnya akan landed di Brief Inbox dalam 1-2 menit.").',
    '',
    '## PLAN-EXECUTE-SYNTHESIZE pattern (untuk task kompleks multi-step)',
    '',
    'Kalau Matthew minta task yang KOMPLEKS multi-step (misal: "buat reverse calendar dari launch", "susun financial model unit economics", "rancang kompetisi audit 4-tier kompetitor"), JANGAN langsung jawab dengan list outline. Pakai pattern PLAN-EXECUTE-SYNTHESIZE:',
    '',
    '### Format output WAJIB untuk task multi-step:',
    '',
    '```',
    '# [Judul Task]',
    '',
    '## Plan (apa yang saya kerjakan)',
    'Saya akan kerjakan 4 sub-task ini berurutan: (1) X, (2) Y, (3) Z, (4) synthesis final.',
    '',
    '## Sub-task 1: [Nama sub-task]',
    '**Tujuan sub-task ini:** kenapa ini matter.',
    '**Approach:** bagaimana saya menyelesaikan ini.',
    '**Output:** ...isi detail substantif dengan data Gerai...',
    '**Reasoning:** kenapa kesimpulan ini valid + edge case yang dipertimbangkan.',
    '',
    '## Sub-task 2: [Nama sub-task]',
    '... (struktur sama)',
    '',
    '## Sub-task 3: [Nama sub-task]',
    '... (struktur sama)',
    '',
    '## Sub-task 4: Synthesis & Rekomendasi Final',
    '**Cross-cutting insights:** insight yang muncul saat saya kerjakan 3 sub-task sebelumnya.',
    '**Rekomendasi:** keputusan/aksi konkret untuk Matthew.',
    '**Risiko terbesar:** satu hal yang harus Matthew tahu kalau jalankan rekomendasi ini.',
    '**Next action minggu ini:** apa yang Matthew lakukan hari Senin sampai Jumat.',
    '```',
    '',
    'Kapan pakai pattern ini:',
    '- Task butuh > 1500 kata untuk dijawab dengan kualitas',
    '- Task multi-faceted (financial + brand + operations + market)',
    '- Task butuh reasoning chain yang bisa di-audit step-by-step',
    '- Task strategic yang Matthew akan re-baca nanti',
    '',
    'JANGAN pakai pattern ini untuk:',
    '- Pertanyaan simple yang bisa dijawab dengan 1-2 paragraf',
    '- Conversational chitchat',
    '- Quick fact-check',
    '',
    'Tujuan: response Anda terbaca sebagai PROSES BERPIKIR, bukan answer dump. Matthew bisa audit reasoning di tiap step, percaya keputusannya.',
  ]

  // Inject memory file kalau ada dan non-default. Memory auto-maintained oleh sistem.
  // Atmaja BACA + PAKAI secara natural, tanpa eksplisit menyebut "berdasarkan memory".
  if (memory && typeof memory === 'string' && memory.trim()) {
    baseLines.push('')
    baseLines.push('## Memory Gerai 1000 Pintu (konteks lengkap yang Anda sudah ingat)')
    baseLines.push('')
    baseLines.push(
      'Berikut catatan persisten tentang Gerai 1000 Pintu. PAKAI SECARA NATURAL sebagai konteks dalam jawaban (jangan eksplisit menyebut "berdasarkan memory" — anggap Anda memang ingat). Reference vendor, brand decision, financial constraint, channel mix, target customer dari memory ini untuk membuat jawaban spesifik dan tajam.',
    )
    baseLines.push('')
    baseLines.push(memory.trim())
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

  // === PDF INTENT DETECTION ===
  // Kalau Matthew minta PDF/dokumen di turn ini, inject system reinforcement
  // supaya Atmaja PASTI emit [ATMAJA_DOC] marker, tidak nolak.
  const PDF_INTENT_RE =
    /\b(buat(kan)?( saya)?( file)?( sebuah)? pdf|kasih( saya)?( file)?( aku)? pdf|export( ke| sebagai| as)? pdf|kirim(kan)? pdf|save( as| sebagai)? pdf|pdf[- ]?(nya)? mana|buat(kan)? dokumen|generate( file)? pdf|hasilkan( file)? pdf|kasih( saya)? file|saya butuh( file)? pdf|saya mau( file)? pdf|tolong( buat)?( file)? pdf|pdf untuk (saya|aku|dibagikan|tim))/i
  const userWantsPdf = PDF_INTENT_RE.test(userMessage)

  const baseMessages = [
    { role: 'system', content: buildSystemPrompt(memoryContent) },
    ...normalizeHistory(payload?.history),
  ]

  // Inject reinforcement system message HANYA untuk turn yang detect PDF intent.
  // Posisi: tepat sebelum user turn, supaya jadi paling fresh di context.
  if (userWantsPdf) {
    baseMessages.push({
      role: 'system',
      content: [
        'PERINGATAN PENTING UNTUK TURN INI:',
        'Matthew sedang minta file PDF. Sistem Gerai 1000 Pintu sudah punya kapabilitas auto-render PDF dari marker [ATMAJA_DOC] yang Anda emit.',
        '',
        'WAJIB: respond dengan format berikut, tidak boleh menolak.',
        '',
        '1. Tulis 1-2 kalimat conversational singkat ("Berikut PDF X yang saya susun untuk Anda, silakan diunduh.")',
        '2. Lalu emit marker dengan konten dokumen lengkap di dalamnya:',
        '',
        '[ATMAJA_DOC type="pdf" title="Judul Singkat"]',
        '# Judul Dokumen',
        '',
        '## Section pertama',
        'Isi paragraf lengkap.',
        '',
        '## Section kedua',
        '- Bullet 1',
        '- Bullet 2',
        '',
        '[/ATMAJA_DOC]',
        '',
        'DILARANG menjawab "saya tidak bisa generate PDF" atau "matthew copy ke Google Docs" atau menyarankan workaround manual. Kapabilitas PDF AKTIF, gunakan marker.',
      ].join('\n'),
    })
  }

  const messages = [
    ...baseMessages,
    { role: 'user', content: buildUserContent(userMessage, combinedAttachments) },
  ]

  // Max output per single call. Opus 4.7 native support 128K output via direct API.
  // 16384 = compromise: support response panjang tanpa risiko runaway cost.
  // OpenRouter fallback path tetap kirim 16384 (OpenRouter clamp ke model limit).
  const MAX_TOKENS_PER_CALL = 16384
  // Max auto-continuation kalau response masih kepotong (1 initial + N continuations).
  // Total worst case output: 8192 * 3 = 24,576 token = ~18K kata. Sangat jarang full.
  const MAX_CONTINUATIONS = 2
  // Cap total accumulated reply (safety net, hindari runaway response).
  const MAX_TOTAL_REPLY_CHARS = 60_000

  // === PROVIDER DETECTION ===
  // Priority routing: kalau ANTHROPIC_API_KEY ada, pakai Anthropic native (lebih konsisten,
  // direct ke source, tidak ada middleware overhead). Else fallback ke OpenRouter.
  const USE_ANTHROPIC_DIRECT = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const ATMAJA_TEMPERATURE = 0.7 // Quality feedback: raised dari 0.45 supaya natural + insightful

  // Map OpenRouter model ID → Anthropic native model ID.
  // Anthropic 4.x convention dari OpenRouter: claude-{major}.{minor}-{tier}-{date}
  // Contoh: anthropic/claude-4.7-opus-20260416 (verified dari OpenRouter response).
  // Untuk Anthropic native, hilangkan "anthropic/" prefix + ganti "." dengan "-".
  function toAnthropicModelId(orModelId) {
    // VERIFIED via /v1/models endpoint (26 Mei 2026): Anthropic pakai alias form
    // tanpa date suffix untuk model utama. Example: claude-opus-4-7 → Claude Opus 4.7
    // GET https://api.anthropic.com/v1/models confirmed model IDs:
    //   - claude-opus-4-7    (Opus 4.7, max_input 1M, max_output 128K)
    //   - claude-opus-4-6
    //   - claude-opus-4-5-20251101 (4.5 needs date suffix)
    //   - claude-sonnet-4-6
    const map = {
      'anthropic/claude-opus-4.7': 'claude-opus-4-7',
      'anthropic/claude-opus-4.7-fast': 'claude-opus-4-7',
      'anthropic/claude-opus-4.6': 'claude-opus-4-6',
      'anthropic/claude-opus-4.6-fast': 'claude-opus-4-6',
      'anthropic/claude-opus-4.5': 'claude-opus-4-5-20251101',
      'anthropic/claude-opus-4.1': 'claude-opus-4-1',
      'anthropic/claude-opus-4': 'claude-opus-4',
      'anthropic/claude-sonnet-4.6': 'claude-sonnet-4-6',
    }
    return map[orModelId] ?? orModelId.replace('anthropic/', '').replace(/\./g, '-')
  }

  // Anthropic native menggunakan separate 'system' field, bukan messages[0].
  // Extract system content + remaining messages dari format OpenAI-style.
  function splitSystemFromMessages(msgs) {
    const systemParts = []
    const remaining = []
    for (const m of msgs) {
      if (m.role === 'system') {
        if (typeof m.content === 'string') systemParts.push(m.content)
      } else {
        remaining.push(m)
      }
    }
    return { system: systemParts.join('\n\n'), messages: remaining }
  }

  // Adapt content blocks dari OpenAI-format ke Anthropic-format
  // - image_url block: { type:'image_url', image_url:{ url:'data:...;base64,...' } }
  //   → { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:'<b64>' } }
  // - file (PDF) block: { type:'file', file:{ filename, file_data:'data:...;base64,...' } }
  //   → { type:'document', source:{ type:'base64', media_type:'application/pdf', data:'<b64>' } }
  // - text block: passed through
  function adaptContentBlocksForAnthropic(content) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return content
    return content.map((block) => {
      if (!block || typeof block !== 'object') return block

      // OpenAI image_url → Anthropic image source/base64
      if (block.type === 'image_url' && block.image_url?.url) {
        const url = String(block.image_url.url)
        const match = url.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: match[1],
              data: match[2],
            },
          }
        }
        // Non-data URL: pakai url source (Anthropic support)
        return {
          type: 'image',
          source: { type: 'url', url },
        }
      }

      // OpenAI file (PDF) → Anthropic document source/base64
      if (block.type === 'file' && block.file?.file_data) {
        const fileData = String(block.file.file_data)
        const match = fileData.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          return {
            type: 'document',
            source: {
              type: 'base64',
              media_type: match[1] || 'application/pdf',
              data: match[2],
            },
          }
        }
      }

      // text block + lainnya passed through
      return block
    })
  }

  function adaptMessagesForAnthropic(messages) {
    return messages.map((m) => ({
      role: m.role,
      content: adaptContentBlocksForAnthropic(m.content),
    }))
  }

  // Direct call ke Anthropic native API
  async function callAnthropicDirect(modelId, messagesArg) {
    const anthropicModelId = toAnthropicModelId(modelId)
    const { system, messages: nonSystemMessages } = splitSystemFromMessages(messagesArg)
    // Adapt content blocks: OpenAI image_url → Anthropic image, file → document
    const anthropicMessages = adaptMessagesForAnthropic(nonSystemMessages)

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        model: anthropicModelId,
        max_tokens: MAX_TOKENS_PER_CALL,
        temperature: ATMAJA_TEMPERATURE,
        system,
        messages: anthropicMessages,
      }),
    })

    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }

    // Adapt Anthropic response → OpenAI-compatible shape supaya code downstream tidak perlu rubah
    // Anthropic: { content: [{type:'text', text:'...'}], stop_reason: 'end_turn|max_tokens|...', usage: {...} }
    // OpenAI:    { choices: [{message:{content:'...'}, finish_reason}], usage: {...} }
    if (upstream.ok && parsed) {
      const textParts = Array.isArray(parsed.content)
        ? parsed.content
            .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text)
            .join('')
        : ''
      const stopReason = parsed.stop_reason
      const finishReason = stopReason === 'max_tokens' ? 'length' : stopReason === 'end_turn' ? 'stop' : stopReason
      const usage = parsed.usage
        ? {
            prompt_tokens: usage_n(parsed.usage.input_tokens),
            completion_tokens: usage_n(parsed.usage.output_tokens),
            total_tokens: usage_n(parsed.usage.input_tokens) + usage_n(parsed.usage.output_tokens),
          }
        : undefined
      const adapted = {
        choices: [
          {
            message: { role: 'assistant', content: textParts },
            finish_reason: finishReason,
          },
        ],
        model: parsed.model ?? anthropicModelId,
        usage,
      }
      return { upstream, body: adapted }
    }

    // Error path: pass body as-is
    return { upstream, body: parsed }
  }
  function usage_n(v) { return Number.isFinite(Number(v)) ? Number(v) : 0 }

  // Single dispatch function — route ke Anthropic atau OpenRouter
  async function callLLM(modelId, messagesArg) {
    if (USE_ANTHROPIC_DIRECT) {
      return callAnthropicDirect(modelId, messagesArg)
    }
    return callOpenRouter(modelId, messagesArg)
  }

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
        temperature: ATMAJA_TEMPERATURE,
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
      const result = await callLLM(modelId, conversation)
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

      // Extractor pakai callLLM yang auto-route ke Anthropic direct (kalau key ada) atau OpenRouter
      const extractorResult = await callLLM('anthropic/claude-sonnet-4.6', [
        { role: 'user', content: extractorPrompt },
      ])

      if (!extractorResult.upstream.ok) {
        return {
          skipped: true,
          reason: 'extractor_http_error',
          status: extractorResult.upstream.status,
        }
      }

      const deltaRaw = String(extractorResult.body?.choices?.[0]?.message?.content ?? '').trim()

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
    await traceStep(trace, 'atmaja_thinking', 'running', {
      detail: `Model: ${primaryModel} (provider: ${USE_ANTHROPIC_DIRECT ? 'Anthropic direct' : 'OpenRouter'})`,
    })
    let { upstream, body, accumulatedText, lastFinishReason, continuations, aggregatedUsage } =
      await callWithAutoContinuation(primaryModel, messages)
    let usedModel = primaryModel
    let fallbackTried = false
    let usedProvider = USE_ANTHROPIC_DIRECT ? 'Anthropic (direct)' : 'OpenRouter'

    // === AUTO-FALLBACK: Kalau Anthropic direct gagal (404 model invalid, dll),
    // automatic retry via OpenRouter (kalau key tersedia). Ini critical supaya
    // user tidak stuck error 404 saat Anthropic native model ID berubah/deprecated.
    if (!upstream.ok && USE_ANTHROPIC_DIRECT && process.env.OPENROUTER_API_KEY) {
      console.warn('[atmaja-chat] Anthropic direct failed, fallback to OpenRouter:', upstream.status)
      const orResult = await (async () => {
        const retry = await callOpenRouter(primaryModel, messages)
        return retry
      })()
      if (orResult.upstream.ok) {
        upstream = orResult.upstream
        body = orResult.body
        accumulatedText = body?.choices?.[0]?.message?.content ?? ''
        lastFinishReason = extractFinishReason(body)
        aggregatedUsage = sumUsage(aggregatedUsage, body?.usage)
        usedProvider = 'OpenRouter (Anthropic fallback)'
        fallbackTried = true
      }
    }

    if (!upstream.ok) {
      const providerLabel = USE_ANTHROPIC_DIRECT ? 'Anthropic' : 'OpenRouter'
      const errorLabel = USE_ANTHROPIC_DIRECT ? 'anthropic_error' : 'openrouter_error'
      const errorNote =
        body?.error?.message ??
        body?.message ??
        (typeof body?.error === 'string' ? body.error : null) ??
        `${providerLabel} request failed.`
      await finalizeTrace(trace, {
        status: 'error',
        error: `${providerLabel} HTTP ${upstream.status}: ${errorNote}`,
      })
      sendJson(res, upstream.status, {
        ok: false,
        error: errorLabel,
        upstreamStatus: upstream.status,
        modelTried: primaryModel,
        provider: providerLabel,
        note: errorNote,
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

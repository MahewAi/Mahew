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

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []

  return history
    .slice(-10)
    .map((message) => {
      const author = message?.author === 'matthew' ? 'user' : 'assistant'
      const content = clampText(message?.text, 2_000)
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
  return attachments.slice(0, 5).map((attachment) => {
    const type = clampText(attachment?.type, 80)
    const kind = clampText(attachment?.kind, 40)
    const normalized = {
      name: clampText(attachment?.name, 160),
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
        imageCount += 1
      }
    }

    return normalized
  })
}

function buildSystemPrompt() {
  return [
    'Anda adalah Atmaja, CEO AI Department untuk Gerai 1000 Pintu milik Matthew.',
    'Jawab dalam Bahasa Indonesia yang ringkas, langsung, dan membantu mengambil keputusan.',
    'Kalau Matthew meminta pilihan, warna, foto, opsi, atau preferensi, jawab pilihannya dulu sebelum alasan.',
    'Jangan membantah arah pertanyaan Matthew. Jika konteks kurang, beri asumsi kerja dan tetap berikan langkah berikutnya.',
    'Kalau Matthew melampirkan gambar, kamu BISA melihat gambar itu langsung (vision aktif). Analisis konten gambar dan jawab konkrit.',
    'Untuk file teks/kode/markdown yang sudah diekstrak preview-nya, baca cuplikan yang dikirim dan jawab berdasar isi.',
    'Untuk PDF/zip/docx yang hanya kirim metadata, jelaskan jujur kamu belum lihat isi dan tawarkan jalan (ekstrak, paste, atau kirim image kecil).',
    'Jaga output agar tidak menyuruh Matthew memindahkan rahasia ke chat. Untuk kredensial, minta disimpan sebagai server environment variable.',
  ].join('\n')
}

function buildUserContent(message, attachments) {
  // Pisahkan attachment yang punya bytes vs yang metadata only.
  const imageAttachments = attachments.filter((a) => a.dataBase64 && a.mime)
  const textAttachments = attachments.filter((a) => !a.dataBase64 && a.previewText)
  const metadataOnly = attachments.filter((a) => !a.dataBase64 && !a.previewText)

  // Kalau tidak ada image inline → tetap pakai string biasa.
  if (imageAttachments.length === 0) {
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

  // Ada image → kirim sebagai content block array (vision payload).
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
  return blocks
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
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

  if (!isOriginAllowed(req)) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' })
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

  const attachments = normalizeAttachments(payload?.attachments)
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
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...normalizeHistory(payload?.history),
    { role: 'user', content: buildUserContent(userMessage, attachments) },
  ]

  async function callOpenRouter(modelId) {
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
        messages,
        temperature: 0.45,
        max_tokens: 900,
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

  try {
    let { upstream, body } = await callOpenRouter(primaryModel)
    let usedModel = primaryModel
    let fallbackTried = false

    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        ok: false,
        error: 'openrouter_error',
        upstreamStatus: upstream.status,
        modelTried: primaryModel,
        note: body?.error?.message ?? body?.message ?? 'OpenRouter request failed.',
      })
      return
    }

    let replyText = body?.choices?.[0]?.message?.content

    // Retry with stable model jika upstream balikan kosong (kasus openrouter/auto)
    if ((typeof replyText !== 'string' || !replyText.trim()) && primaryModel !== STABLE_FALLBACK_MODEL) {
      fallbackTried = true
      const retry = await callOpenRouter(STABLE_FALLBACK_MODEL)
      upstream = retry.upstream
      body = retry.body
      usedModel = STABLE_FALLBACK_MODEL
      replyText = body?.choices?.[0]?.message?.content
    }

    if (typeof replyText !== 'string' || !replyText.trim()) {
      sendJson(res, 502, {
        ok: false,
        error: 'empty_openrouter_reply',
        modelTried: usedModel,
        fallbackTried,
        note: 'OpenRouter tidak mengembalikan teks jawaban setelah retry.',
      })
      return
    }

    // Hitung policy actual berdasarkan apa yang BENERAN dikirim.
    const imagesSent = attachments.filter((a) => a.dataBase64 && a.mime).length
    const textsSent = attachments.filter((a) => !a.dataBase64 && a.previewText).length
    const metadataOnlyCount = attachments.filter((a) => !a.dataBase64 && !a.previewText).length
    const policy =
      imagesSent > 0
        ? 'vision_inline'
        : textsSent > 0
          ? 'text_preview_inline'
          : metadataOnlyCount > 0
            ? 'metadata_only'
            : 'none'

    sendJson(res, 200, {
      ok: true,
      provider: 'OpenRouter',
      model: (body?.model ?? usedModel) || null,
      requestedModel: primaryModel,
      fallbackUsed: fallbackTried,
      text: replyText.trim(),
      usage: body?.usage ?? null,
      attachmentsPolicy: policy,
      attachmentsSummary: {
        imagesSent,
        textsSent,
        metadataOnly: metadataOnlyCount,
      },
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openrouter_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

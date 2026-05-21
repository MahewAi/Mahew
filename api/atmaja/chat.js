const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.ATMAJA_CHAT_MAX_BYTES ?? 32_768)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.ATMAJA_CHAT_RATE_LIMIT ?? 12)
const recentRequestsByIp = new Map()

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

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return []

  return attachments.slice(0, 5).map((attachment) => ({
    name: clampText(attachment?.name, 160),
    type: clampText(attachment?.type, 80),
    kind: clampText(attachment?.kind, 40),
    size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
    note: clampText(attachment?.note, 220),
  }))
}

function buildSystemPrompt() {
  return [
    'Anda adalah Atmaja, CEO AI Department untuk Gerai 1000 Pintu milik Matthew.',
    'Jawab dalam Bahasa Indonesia yang ringkas, langsung, dan membantu mengambil keputusan.',
    'Kalau Matthew meminta pilihan, warna, foto, opsi, atau preferensi, jawab pilihannya dulu sebelum alasan.',
    'Jangan membantah arah pertanyaan Matthew. Jika konteks kurang, beri asumsi kerja dan tetap berikan langkah berikutnya.',
    'Kalau Matthew meminta gambar, visual, canvas, mapping, moodboard, atau rancangan, tawarkan output visual dan jelaskan komponen visualnya dengan format yang bisa dirender app.',
    'Data policy: jangan mengklaim membaca file mentah jika hanya ada metadata lampiran. File preview sengaja tidak dikirim ke provider remote kecuali sistem diubah eksplisit.',
    'Jaga output agar tidak menyuruh Matthew memindahkan rahasia ke chat. Untuk kredensial, minta disimpan sebagai server environment variable.',
  ].join('\n')
}

function buildUserContent(message, attachments) {
  if (attachments.length === 0) return message

  const attachmentLines = attachments
    .map((attachment) => {
      const sizeKb = Math.round((attachment.size / 1024) * 10) / 10
      return `- ${attachment.name || 'file'} (${attachment.kind || 'file'}, ${attachment.type || 'unknown'}, ${sizeKb} KB): ${attachment.note || 'metadata only'}`
    })
    .join('\n')

  return `${message}\n\n[Lampiran metadata saja - isi file tidak dikirim ke OpenRouter]\n${attachmentLines}`
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

  const payloadModel = clampText(payload?.model, 200)
  const envModel = process.env.ATMAJA_OPENROUTER_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? ''
  const primaryModel = payloadModel || envModel || CONTENT_PRIMARY_MODEL

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

    sendJson(res, 200, {
      ok: true,
      provider: 'OpenRouter',
      model: (body?.model ?? usedModel) || null,
      requestedModel: primaryModel,
      fallbackUsed: fallbackTried,
      text: replyText.trim(),
      usage: body?.usage ?? null,
      attachmentsPolicy: 'metadata_only',
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openrouter_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

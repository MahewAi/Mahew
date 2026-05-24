// Generic agent reply endpoint — handles C-suite + specialist + Atmaja chat surfaces.
// Tier-aware model selection dengan minimum floor Sonnet 4.6 (per preferensi Matthew).

import { isRequestAllowed, getHeader, consumeRateLimit as sharedConsumeRateLimit } from '../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

// Body cap dinaikkan untuk dukung image inline (base64). Vercel default 4.5 MB → kita pakai 4.3 MB.
const MAX_BODY_BYTES = Number(process.env.AGENT_REPLY_MAX_BYTES ?? 4_300_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.AGENT_REPLY_RATE_LIMIT ?? 24)
const recentRequestsByIp = new Map()

// === VISION CAPS === (sama dengan atmaja/chat.js)
const IMAGE_MAX_BASE64_BYTES = 2_100_000
const MAX_IMAGES_PER_TURN = 2
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
const TEXT_PREVIEW_MAX_CHARS = 30_000

// === MODEL FLOOR ENFORCEMENT ===
// Minimum: Sonnet 4.6. Tidak boleh di bawah.
// Opus tier untuk content (CEO synthesis, brief analysis penuh).
// Sonnet 4.6 untuk orchestration middle-layer (C-suite + specialist routing/replies).
const CONTENT_MODEL = 'anthropic/claude-opus-4.7'
const ORCHESTRATION_MODEL = 'anthropic/claude-sonnet-4.6'
const FLOOR_MODEL = 'anthropic/claude-sonnet-4.6'

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

function resolveModel(payloadModel, envModel, tier) {
  // Precedence: payload (validated) > env (validated) > tier default.
  // Anything below floor (e.g. Sonnet 4.5, Haiku, 3.5-sonnet, mistral) di-replace dengan FLOOR_MODEL.
  if (payloadModel && ALLOWED_MODELS.has(payloadModel)) return payloadModel
  if (envModel && ALLOWED_MODELS.has(envModel)) return envModel
  if (tier === 'content') return CONTENT_MODEL
  return ORCHESTRATION_MODEL
}

// === ROLE PERSONAS ===
const ROLE_PERSONAS = {
  ceo: 'Anda adalah Atmaja, CEO orkestrator AI Department Gerai 1000 Pintu milik Matthew. Sintesa final, langsung, ringkas. Jawab pilihan dulu sebelum alasan.',
  coo: 'Anda Operations lead Gerai 1000 Pintu. Fokus: SOP, vendor, supply chain, dependency map, kapasitas tim. Tone ringkas, taktis, operasional.',
  cmo: 'Anda Marketing/Brand strategist Gerai 1000 Pintu. Fokus: akuisisi, segmen, positioning, funnel, brand growth. Tone ringkas, market-savvy.',
  cfo: 'Anda Finance lead Gerai 1000 Pintu. Fokus: ROI, margin, capex, runway, sensitivity analysis. Tone ringkas, angka-jelas.',
  cco: 'Anda Creative & Communication lead Gerai 1000 Pintu. Fokus: visual identity, asset, copy, brand canon, mapping/canvas/visual brief. Tone ringkas, visual-first.',
  hr_systems: 'Anda HR & Systems specialist di tim COO Gerai 1000 Pintu. Fokus: SOP, struktur tim, prosedur kerja, hiring framework.',
  production_manager: 'Anda Production Manager di tim COO Gerai 1000 Pintu. Fokus: supply chain, vendor lead time, kapasitas produksi, fulfillment.',
  curator: 'Anda Curator katalog di tim COO Gerai 1000 Pintu. Fokus: seleksi SKU, supplier vetting, kurasi logic premium curated.',
  brand_strategist: 'Anda Brand Strategist di tim CMO Gerai 1000 Pintu. Fokus: positioning, narrative, identity DNA, brand architecture.',
  market_researcher: 'Anda Market Researcher di tim CMO Gerai 1000 Pintu. Fokus: riset market, kompetitor, segmen, trend, data konsumen.',
  sales_strategist: 'Anda Sales Strategist di tim CMO Gerai 1000 Pintu. Fokus: funnel customer, channel strategy, conversion.',
  innovation_scout: 'Anda Innovation Scout di tim CMO Gerai 1000 Pintu. Fokus: trend scouting, ide produk, eksplorasi cross-industry.',
  business_designer: 'Anda Business Designer di tim CFO Gerai 1000 Pintu. Fokus: model bisnis, revenue stream, struktur operasi.',
  financial_analyst: 'Anda Financial Analyst di tim CFO Gerai 1000 Pintu. Fokus: analisis ROI, pricing, forecast, budget, sensitivity.',
  document_writer: 'Anda Document Writer di tim CCO Gerai 1000 Pintu. Fokus: business plan, technical doc, memo internal, dokumentasi proses.',
  editorial: 'Anda Editorial di tim CCO Gerai 1000 Pintu. Fokus: copywriting, content, brand voice consistency, narrative editing.',
  web_researcher: 'Anda Web Researcher di tim CCO Gerai 1000 Pintu. Fokus: riset web, source gathering, fact-checking.',
}

const SHARED_INSTRUCTIONS = [
  'Bahasa Indonesia ringkas, langsung, membantu pengambilan keputusan.',
  'Jangan membantah arah pertanyaan Matthew. Jika konteks kurang, buat asumsi kerja dan tetap berikan langkah berikutnya.',
  'Kalau Matthew minta pilihan/warna/foto/opsi, jawab pilihannya dulu sebelum alasan.',
  'Kalau Matthew minta visual/canvas/mapping/moodboard, tawarkan output visual dengan format yang bisa dirender app.',
  'Brand canon: NO em-dash, "tempat" bukan "rumah", "Gerai 1000 Pintu" lengkap, premium curated retail tone calm refined.',
  'Kalau Matthew melampirkan gambar, kamu BISA lihat gambar (vision aktif via Anthropic). Analisis konkret isi gambar.',
  'Kalau yang dilampirkan hanya metadata (PDF/zip/docx), bilang jujur belum lihat isi dan tawarkan: ekstrak, paste, atau kirim image kecil.',
  'Untuk kredensial, minta disimpan sebagai server env var, jangan paste ke chat.',
]

function buildSystemPrompt(role, briefContext) {
  const persona = ROLE_PERSONAS[role] || ROLE_PERSONAS.ceo
  const lines = [persona, '', ...SHARED_INSTRUCTIONS]
  if (briefContext) {
    lines.push('', `Konteks brief yang sedang dibahas: ${briefContext}`)
  }
  return lines.join('\n')
}

// === HELPERS — pakai shared module untuk konsistensi security check antar endpoint ===
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
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

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .slice(-10)
    .map((m) => {
      const author = m?.author === 'matthew' ? 'user' : 'assistant'
      const content = clampText(m?.text, 2_000)
      return content ? { role: author, content } : null
    })
    .filter(Boolean)
}

function sanitizeBase64(value) {
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

function buildUserContent(message, attachments) {
  const imageAttachments = attachments.filter((a) => a.dataBase64 && a.mime)
  const textAttachments = attachments.filter((a) => !a.dataBase64 && a.previewText)
  const metadataOnly = attachments.filter((a) => !a.dataBase64 && !a.previewText)

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
    sendJson(res, 503, { ok: false, error: 'openrouter_disabled' })
    return
  }
  if (!process.env.OPENROUTER_API_KEY) {
    sendJson(res, 503, { ok: false, error: 'openrouter_key_missing' })
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

  const role = clampText(payload?.role, 60) || 'ceo'
  const tier = payload?.tier === 'content' ? 'content' : 'orchestration'
  const briefContext = clampText(payload?.briefContext, 1_500)
  const attachments = normalizeAttachments(payload?.attachments)

  const payloadModel = clampText(payload?.model, 200)
  const envModel = process.env.AGENT_REPLY_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? ''
  const primaryModel = resolveModel(payloadModel, envModel, tier)

  const referer = process.env.AGENT_REPLY_REFERER ?? process.env.PUBLIC_APP_URL ?? 'https://gerai.mahewwork.com'
  const messages = [
    { role: 'system', content: buildSystemPrompt(role, briefContext) },
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
        'x-openrouter-title': `Gerai Agent ${role}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.4,
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

    if ((typeof replyText !== 'string' || !replyText.trim()) && primaryModel !== FLOOR_MODEL) {
      fallbackTried = true
      const retry = await callOpenRouter(FLOOR_MODEL)
      upstream = retry.upstream
      body = retry.body
      usedModel = FLOOR_MODEL
      replyText = body?.choices?.[0]?.message?.content
    }

    if (typeof replyText !== 'string' || !replyText.trim()) {
      sendJson(res, 502, {
        ok: false,
        error: 'empty_openrouter_reply',
        modelTried: usedModel,
        fallbackTried,
      })
      return
    }

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
      role,
      tier,
      model: (body?.model ?? usedModel) || null,
      requestedModel: primaryModel,
      fallbackUsed: fallbackTried,
      text: replyText.trim(),
      usage: body?.usage ?? null,
      attachmentsPolicy: policy,
      attachmentsSummary: { imagesSent, textsSent, metadataOnly: metadataOnlyCount },
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openrouter_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

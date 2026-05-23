// OpenAI Images API bridge — supports gpt-image-1 + dall-e-3.
// Server-side panggil OpenAI, return base64 data URI ke client.
// Untuk DALL-E 3 (yang return URL), server fetch dulu lalu inline jadi base64
// supaya client tidak depend ke URL ephemeral yang expire 1 jam.

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.OPENAI_IMAGE_MAX_BYTES ?? 64_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.OPENAI_IMAGE_RATE_LIMIT ?? 6)
const recentRequestsByIp = new Map()

// === MODEL WHITELIST ===
// Hanya 2 model image yang diizinkan saat ini.
const ALLOWED_MODELS = new Set(['gpt-image-1', 'dall-e-3'])

// Size whitelist per model (mencegah typo/abuse).
const DALL_E_3_SIZES = new Set(['1024x1024', '1024x1792', '1792x1024'])
const GPT_IMAGE_SIZES = new Set([
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  'auto',
])

// Quality whitelist per model (sebut explicit untuk audit).
const DALL_E_3_QUALITIES = new Set(['standard', 'hd'])
const GPT_IMAGE_QUALITIES = new Set(['low', 'medium', 'high', 'auto'])

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

function resolveModel(input) {
  const m = clampText(input, 40).toLowerCase()
  if (ALLOWED_MODELS.has(m)) return m
  // Default ke gpt-image-1 (kualitas terbaru per 2026).
  return 'gpt-image-1'
}

function resolveSize(model, input) {
  const s = clampText(input, 20)
  const allowed = model === 'dall-e-3' ? DALL_E_3_SIZES : GPT_IMAGE_SIZES
  if (allowed.has(s)) return s
  return '1024x1024'
}

function resolveQuality(model, input) {
  const q = clampText(input, 20).toLowerCase()
  const allowed = model === 'dall-e-3' ? DALL_E_3_QUALITIES : GPT_IMAGE_QUALITIES
  if (allowed.has(q)) return q
  return model === 'dall-e-3' ? 'hd' : 'high'
}

async function fetchUrlAsBase64(url) {
  // Hanya untuk DALL-E 3 yang return URL ephemeral.
  // Server-side download → base64 → return ke client supaya tidak tergantung URL expire.
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`fetch_url_failed_${resp.status}`)
  const buffer = await resp.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
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
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, {
      ok: false,
      error: 'openai_key_missing',
      note: 'OPENAI_API_KEY belum diset di server. Jangan taruh key di frontend.',
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

  const prompt = clampText(payload?.prompt, 4_000)
  if (!prompt || prompt.length < 3) {
    sendJson(res, 400, { ok: false, error: 'prompt_required', note: 'Prompt minimum 3 karakter.' })
    return
  }

  const model = resolveModel(payload?.model)
  const size = resolveSize(model, payload?.size)
  const quality = resolveQuality(model, payload?.quality)

  // Build request body sesuai schema OpenAI Images API per model.
  // gpt-image-1: pakai 'quality' (low|medium|high|auto), default response_format = b64_json
  // dall-e-3: pakai 'quality' (standard|hd), default response_format = url
  const openaiBody = {
    model,
    prompt,
    n: 1,
    size,
  }
  if (model === 'dall-e-3') {
    openaiBody.quality = quality
    openaiBody.response_format = 'b64_json' // minta langsung base64 supaya konsisten
    openaiBody.style = clampText(payload?.style, 20) === 'natural' ? 'natural' : 'vivid'
  } else {
    // gpt-image-1
    openaiBody.quality = quality
    // gpt-image-1 SELALU return b64_json, response_format param tidak diperlukan dan akan error kalau dikirim
  }

  const startedAt = Date.now()

  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(openaiBody),
    })

    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }

    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
        modelTried: model,
        note: parsed?.error?.message ?? parsed?.message ?? 'OpenAI Images request failed.',
      })
      return
    }

    const item = parsed?.data?.[0]
    if (!item) {
      sendJson(res, 502, {
        ok: false,
        error: 'empty_openai_reply',
        modelTried: model,
      })
      return
    }

    // gpt-image-1: item.b64_json langsung.
    // dall-e-3 (kita minta b64_json juga): item.b64_json. Fallback ke URL kalau b64 tidak ada.
    let b64 = item.b64_json
    if (!b64 && item.url) {
      try {
        b64 = await fetchUrlAsBase64(item.url)
      } catch (error) {
        sendJson(res, 502, {
          ok: false,
          error: 'image_fetch_failed',
          modelTried: model,
          note: error instanceof Error ? error.message : 'unknown_fetch_error',
        })
        return
      }
    }

    if (!b64) {
      sendJson(res, 502, {
        ok: false,
        error: 'no_image_data',
        modelTried: model,
      })
      return
    }

    const elapsedMs = Date.now() - startedAt
    sendJson(res, 200, {
      ok: true,
      provider: 'OpenAI',
      model,
      requestedSize: size,
      requestedQuality: quality,
      revisedPrompt: item.revised_prompt ?? null, // DALL-E 3 sering kasih revised prompt
      imageBase64: b64, // raw base64, client wrap jadi data URI
      mime: 'image/png',
      elapsedMs,
      usage: parsed?.usage ?? null,
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

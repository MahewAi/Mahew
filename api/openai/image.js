// OpenAI Images API bridge — supports gpt-image-1 + dall-e-3.
// Server-side panggil OpenAI, return base64 data URI ke client.
// Untuk DALL-E 3 (yang return URL), server fetch dulu lalu inline jadi base64
// supaya client tidak depend ke URL ephemeral yang expire 1 jam.

import { isRequestAllowed, consumeRateLimit as sharedConsumeRateLimit } from '../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_BODY_BYTES = Number(process.env.OPENAI_IMAGE_MAX_BYTES ?? 64_000)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.OPENAI_IMAGE_RATE_LIMIT ?? 6)
const recentRequestsByIp = new Map()

// === MODEL WHITELIST ===
// gpt-image family adalah pengganti DALL-E (yang sudah pension untuk akun baru di 2026).
// gpt-image-2 = kualitas tertinggi (April 2026 release).
// gpt-image-1.5 = mid-tier.
// gpt-image-1 = balance speed + kualitas (default).
// gpt-image-1-mini = paling cepat + murah.
// chatgpt-image-latest = alias auto-update.
// dall-e-3 di-keep sebagai legacy fallback (akan return error kalau akun tidak ada akses).
const ALLOWED_MODELS = new Set([
  'gpt-image-1',
  'gpt-image-1-mini',
  'gpt-image-1.5',
  'gpt-image-2',
  'gpt-image-2-2026-04-21',
  'chatgpt-image-latest',
  'dall-e-3',
])

// Size whitelist per family.
const DALL_E_3_SIZES = new Set(['1024x1024', '1024x1792', '1792x1024'])
const GPT_IMAGE_SIZES = new Set([
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  'auto',
])

// Quality whitelist per family.
const DALL_E_3_QUALITIES = new Set(['standard', 'hd'])
const GPT_IMAGE_QUALITIES = new Set(['low', 'medium', 'high', 'auto'])

function isGptImageFamily(model) {
  return model.startsWith('gpt-image') || model === 'chatgpt-image-latest'
}

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

function resolveModel(input) {
  const m = clampText(input, 40)
  // Allow exact match (case-sensitive) untuk model names yang punya dot (gpt-image-1.5)
  if (ALLOWED_MODELS.has(m)) return m
  // Lalu coba lowercase
  const ml = m.toLowerCase()
  if (ALLOWED_MODELS.has(ml)) return ml
  // Default ke gpt-image-1 (balance speed + quality).
  return 'gpt-image-1'
}

function resolveSize(model, input) {
  const s = clampText(input, 20)
  const allowed = isGptImageFamily(model) ? GPT_IMAGE_SIZES : DALL_E_3_SIZES
  if (allowed.has(s)) return s
  return '1024x1024'
}

function resolveQuality(model, input) {
  const q = clampText(input, 20).toLowerCase()
  const allowed = isGptImageFamily(model) ? GPT_IMAGE_QUALITIES : DALL_E_3_QUALITIES
  if (allowed.has(q)) return q
  return isGptImageFamily(model) ? 'high' : 'hd'
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

  const prompt = clampText(payload?.prompt, 4_000)
  if (!prompt || prompt.length < 3) {
    sendJson(res, 400, { ok: false, error: 'prompt_required', note: 'Prompt minimum 3 karakter.' })
    return
  }

  const model = resolveModel(payload?.model)
  const size = resolveSize(model, payload?.size)
  const quality = resolveQuality(model, payload?.quality)

  // Build request body sesuai schema OpenAI Images API per family.
  // gpt-image-* family: 'quality' (low|medium|high|auto), SELALU return b64_json (jangan kirim response_format).
  // dall-e-3: 'quality' (standard|hd), pakai response_format=b64_json supaya konsisten, plus optional style.
  const openaiBody = {
    model,
    prompt,
    n: 1,
    size,
    quality,
  }
  if (model === 'dall-e-3') {
    openaiBody.response_format = 'b64_json'
    openaiBody.style = clampText(payload?.style, 20) === 'natural' ? 'natural' : 'vivid'
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

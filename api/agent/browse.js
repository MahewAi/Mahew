// Browser automation MVP — Vercel serverless function untuk fetch + parse URL.
// POST /api/agent/browse  body: { url: string, mode?: 'text' | 'summary' }
//
// Use case Matthew: research kompetitor, monitor harga, baca artikel cepat tanpa buka browser.
// MVP: simple HTML fetch + text extraction (no JS rendering). Untuk JS-rendered pages, future
// upgrade ke Browserless atau Playwright.
//
// Security:
// - same-origin check via isRequestAllowed
// - URL whitelist: hanya http/https
// - Block private IP ranges (RFC 1918) to prevent SSRF attacks
// - Timeout 8s to prevent slow fetches blocking function

import { isRequestAllowed, consumeRateLimit, makeSendJsonWithId } from '../_shared.js'
import * as cheerio from 'cheerio'

const RATE_LIMIT_MAX = Number(process.env.AGENT_BROWSE_RATE_LIMIT ?? 10)
const RATE_LIMIT_WINDOW_MS = 60_000
const recentRequestsByIp = new Map()

const FETCH_TIMEOUT_MS = 8_000
const MAX_HTML_BYTES = 2_500_000 // 2.5 MB cap pre-parse
const MAX_TEXT_OUTPUT_CHARS = 25_000 // ~6000 token. Cukup untuk artikel medium.

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw) > 32_000) {
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

// Validate URL: only http/https + not private IP range (prevent SSRF).
function validateUrl(input) {
  let url
  try {
    url = new URL(String(input ?? ''))
  } catch {
    return { ok: false, error: 'url_invalid' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'url_protocol_not_allowed' }
  }
  const hostname = url.hostname.toLowerCase()
  // Block private/local addresses (basic SSRF prevention).
  // For production, do DNS resolution + check IP. For MVP, hostname pattern is sufficient.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^0\./.test(hostname) ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd')
  ) {
    return { ok: false, error: 'url_private_address_blocked' }
  }
  return { ok: true, url }
}

// Extract title + readable text dari HTML.
// Simple regex-based parser. Untuk content site (blog, news, e-commerce) cukup baik.
function extractReadable(html) {
  // Strip scripts, styles, noscript, iframe, svg
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, (m) => {
      // Keep title from head
      const titleMatch = m.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      return titleMatch ? `<title>${titleMatch[1]}</title>` : ' '
    })

  // Extract title.
  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''

  // Extract meta description.
  const descMatch = cleaned.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
  const description = descMatch ? decodeHtmlEntities(descMatch[1]).trim() : ''

  // Extract main content: prefer <main>, <article>, then body.
  let bodyMatch = cleaned.match(/<main[\s\S]*?<\/main>/i)
  if (!bodyMatch) bodyMatch = cleaned.match(/<article[\s\S]*?<\/article>/i)
  if (!bodyMatch) bodyMatch = cleaned.match(/<body[\s\S]*?<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[0] : cleaned

  // Strip remaining tags, keep text.
  const text = bodyHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title,
    description,
    text: decodeHtmlEntities(text).slice(0, MAX_TEXT_OUTPUT_CHARS),
  }
}

function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

// === STRUCTURED EXTRACTION via Cheerio ===
// Atmaja kasih schema, return structured JSON. Use case: competitor scrape, price monitor.
// Schema bentuk:
//   {
//     "title": "h1.product-name",         // field tunggal, ambil text content
//     "price": ".price",
//     "image": "img.hero@src",             // @attr syntax untuk ambil attribute
//     "items": {                            // nested list dari multiple elements
//       "selector": ".product-card",
//       "fields": {
//         "name": ".name",
//         "price": ".price",
//         "link": "a@href"
//       }
//     }
//   }
function extractSelector($, selector) {
  if (!selector || typeof selector !== 'string') return null
  // Support "selector@attr" syntax untuk ambil attribute
  const attrMatch = selector.match(/^(.+?)@([\w-]+)$/)
  if (attrMatch) {
    const [, sel, attr] = attrMatch
    const el = $(sel.trim()).first()
    return el.attr(attr) ?? null
  }
  const el = $(selector).first()
  if (!el.length) return null
  return el.text().trim().replace(/\s+/g, ' ').slice(0, 500)
}

function extractList($, listConfig) {
  if (!listConfig || typeof listConfig !== 'object') return []
  const { selector, fields, max = 50 } = listConfig
  if (!selector || !fields || typeof fields !== 'object') return []
  const items = []
  $(selector).slice(0, max).each((_, el) => {
    const $el = $(el)
    const item = {}
    for (const [fieldName, fieldSel] of Object.entries(fields)) {
      if (typeof fieldSel !== 'string') continue
      const attrMatch = fieldSel.match(/^(.+?)@([\w-]+)$/)
      if (attrMatch) {
        const [, sel, attr] = attrMatch
        item[fieldName] = $el.find(sel.trim()).first().attr(attr) ?? null
      } else {
        const child = $el.find(fieldSel).first()
        item[fieldName] = child.length
          ? child.text().trim().replace(/\s+/g, ' ').slice(0, 500)
          : null
      }
    }
    items.push(item)
  })
  return items
}

function extractStructured(html, schema) {
  const $ = cheerio.load(html)
  const result = {}
  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'string') {
      // Simple selector
      result[key] = extractSelector($, value)
    } else if (value && typeof value === 'object' && value.selector && value.fields) {
      // Nested list extraction
      result[key] = extractList($, value)
    }
  }
  return result
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // Polite user-agent, identifies Atmaja so site owners can recognize.
        'user-agent':
          'Mozilla/5.0 (compatible; AtmajaBot/1.0; +https://gerai.mahewwork.com) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    return response
  } finally {
    clearTimeout(t)
  }
}

export default async function handler(req, res) {
  const sendJson = makeSendJsonWithId(req, res)

  if (req.method !== 'POST') {
    sendJson(405, { ok: false, error: 'method_not_allowed' })
    return
  }
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }
  if (!consumeRateLimit(req, recentRequestsByIp, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    sendJson(429, { ok: false, error: 'rate_limited' })
    return
  }

  const contentType = getHeader(req, 'content-type') ?? ''
  if (!contentType.includes('application/json')) {
    sendJson(415, { ok: false, error: 'unsupported_media_type' })
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch (error) {
    sendJson(error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const validation = validateUrl(payload?.url)
  if (!validation.ok) {
    sendJson(400, { ok: false, error: validation.error, note: 'URL harus http/https public.' })
    return
  }
  const { url } = validation

  try {
    const upstream = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    if (!upstream.ok) {
      sendJson(upstream.status === 404 ? 404 : 502, {
        ok: false,
        error: 'upstream_error',
        upstreamStatus: upstream.status,
        url: url.toString(),
      })
      return
    }

    const ct = upstream.headers.get('content-type') ?? ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      sendJson(415, {
        ok: false,
        error: 'unsupported_content_type',
        contentType: ct,
        note: 'Hanya HTML pages yang didukung di MVP. PDF/JSON/binary tidak.',
      })
      return
    }

    // Stream read with byte cap.
    const reader = upstream.body?.getReader()
    if (!reader) {
      sendJson(502, { ok: false, error: 'upstream_no_body' })
      return
    }
    let totalBytes = 0
    const chunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_HTML_BYTES) {
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        sendJson(413, {
          ok: false,
          error: 'response_too_large',
          note: `HTML > ${MAX_HTML_BYTES} bytes.`,
        })
        return
      }
      chunks.push(value)
    }
    const html = Buffer.concat(chunks).toString('utf-8')

    const extracted = extractReadable(html)
    const wordCount = (extracted.text.match(/\S+/g) ?? []).length

    // STRUCTURED EXTRACTION: kalau payload bawa schema, jalankan Cheerio extraction
    let structured = null
    let structuredError = null
    if (payload?.schema && typeof payload.schema === 'object') {
      try {
        structured = extractStructured(html, payload.schema)
      } catch (error) {
        structuredError = error?.message ?? 'cheerio_extract_failed'
        console.error('[agent-browse] structured extract failed:', structuredError)
      }
    }

    sendJson(200, {
      ok: true,
      url: url.toString(),
      title: extracted.title,
      description: extracted.description,
      text: extracted.text,
      structured,
      structuredError,
      wordCount,
      bytes: totalBytes,
      fetchedAt: new Date().toISOString(),
      note:
        extracted.text.length >= MAX_TEXT_OUTPUT_CHARS
          ? 'Text truncated at cap. Halaman lebih panjang.'
          : undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      sendJson(504, { ok: false, error: 'upstream_timeout', note: `Timeout setelah ${FETCH_TIMEOUT_MS}ms.` })
      return
    }
    sendJson(502, {
      ok: false,
      error: 'fetch_failed',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

// Generic agent reply endpoint — handles C-suite + specialist + Atmaja chat surfaces.
// Tier-aware model selection dengan minimum floor Sonnet 4.6 (per preferensi Matthew).
//
// FULL C-SUITE SPECIALIZATION (Item #1 dari rework AI Department):
// - Setiap C-level punya persona deep + output standards specific role
// - Memory disliced per role (COO ambil Operations+Vendor+Briefs, CMO ambil Brand+Marketing, dst)
// - Output template per role (action plan vs positioning brief vs numbers vs visual direction)
// - max_tokens raised 900 → 2500 supaya substantive

import { isRequestAllowed, getHeader, consumeRateLimit as sharedConsumeRateLimit } from '../_shared.js'
// Phase C: provider abstraction. callLLM dispatch ke Anthropic / Google / OpenAI via registry.
import { callLLM as callLLMFromProvider } from '../_providers/index.js'
import { readMemory } from '../atmaja/memory.js'
// Persona registry = SINGLE SOURCE OF TRUTH (sama dengan yang dipakai _mcp_handler.js).
import { AGENTS, buildSystemPromptFromAgent } from '../_agents.js'

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

// === ANTHROPIC DIRECT (sama pattern dengan api/atmaja/chat.js) ===
// Active kalau ANTHROPIC_API_KEY tersedia. Auto-fallback ke OpenRouter kalau gagal.
function toAnthropicModelId(orModelId) {
  // Verified via /v1/models endpoint 2026-05-26.
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

function adaptContentBlocksForAnthropic(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return content
  return content.map((block) => {
    if (!block || typeof block !== 'object') return block
    if (block.type === 'image_url' && block.image_url?.url) {
      const url = String(block.image_url.url)
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
      }
      return { type: 'image', source: { type: 'url', url } }
    }
    if (block.type === 'file' && block.file?.file_data) {
      const fileData = String(block.file.file_data)
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        return {
          type: 'document',
          source: { type: 'base64', media_type: match[1] || 'application/pdf', data: match[2] },
        }
      }
    }
    return block
  })
}

function adaptMessagesForAnthropic(messages) {
  return messages.map((m) => ({ role: m.role, content: adaptContentBlocksForAnthropic(m.content) }))
}

function resolveModel(payloadModel, envModel, tier) {
  // Precedence: payload (validated) > env (validated) > tier default.
  // Anything below floor (e.g. Sonnet 4.5, Haiku, 3.5-sonnet, mistral) di-replace dengan FLOOR_MODEL.
  if (payloadModel && ALLOWED_MODELS.has(payloadModel)) return payloadModel
  if (envModel && ALLOWED_MODELS.has(envModel)) return envModel
  if (tier === 'content') return CONTENT_MODEL
  return ORCHESTRATION_MODEL
}

// === PERSONA SOURCE ===
// 17 persona (CEO + 4 C-suite + 12 specialist) sekarang SINGLE SOURCE di api/_agents.js.
// reply.js (app + brief n8n) DAN _mcp_handler.js (LibreChat) baca dari sana, jadi tidak ada
// lagi drift "Wira di app beda dengan Wira di MCP". Lihat AGENTS + buildSystemPromptFromAgent.

const SHARED_INSTRUCTIONS = [
  '## Standar jawaban Anda (WAJIB)',
  '',
  '1. **Spesifik untuk Gerai 1000 Pintu** — reference vendor name, brand decision, financial constraint, channel mix yang Anda sudah tahu dari memory.',
  '2. **Reasoning visible** — kasih "kenapa" di balik setiap rekomendasi, anchor ke konteks Gerai konkret.',
  '3. **Actionable concrete** — sebut hari, vendor, budget, langkah konkret. Tidak "pertimbangkan" — tapi "lakukan X di hari Y".',
  '4. **Numbers kalau bisa** — angka konkret (Rp budget, hari lead time, %, count). Hindari "sekitar segini" generic.',
  '5. **Punchy structure** — heading + bullet + table kalau topic kompleks. Tetap padat, no fluff.',
  '',
  '## YANG DIHINDARI',
  '- Generic retail advice ("kenali target customer", "buat content menarik") — basic level',
  '- Hedging berlebihan ("mungkin sebaiknya", "ada baiknya") — Matthew butuh stance jelas',
  '- Disclaimer berlebihan ("perlu validasi lebih lanjut") — kasih working assumption + tetap rekomendasi',
  '',
  '## Brand canon',
  'NO em-dash. Pakai "tempat" bukan "rumah". Sebut "Gerai 1000 Pintu" lengkap. Tone calm refined premium curated retail.',
  '',
  '## Multimodal',
  'Image: vision aktif, analisis konkret isi. PDF metadata only: jujur belum lihat isi, tawarkan extract.',
]

// Slice memory file ke section yang relevan untuk role
function sliceMemoryForRole(fullMemory, sections) {
  if (!fullMemory || typeof fullMemory !== 'string') return ''
  if (!Array.isArray(sections) || sections.length === 0) return fullMemory.slice(0, 3000)

  const sliced = []
  for (const section of sections) {
    const header = `## ${section}`
    const startIdx = fullMemory.indexOf(header)
    if (startIdx === -1) continue
    const nextHeaderIdx = fullMemory.indexOf('\n## ', startIdx + header.length)
    const endIdx = nextHeaderIdx === -1 ? fullMemory.length : nextHeaderIdx
    sliced.push(fullMemory.slice(startIdx, endIdx).trim())
  }
  return sliced.join('\n\n')
}

function buildSystemPrompt(role, briefContext, memoryContent) {
  // Persona penuh dari single source (api/_agents.js). Fallback ke ceo kalau role tak dikenal.
  const resolvedRole = AGENTS[role] ? role : 'ceo'
  const agent = AGENTS[resolvedRole]
  const memorySlice = sliceMemoryForRole(memoryContent, agent.memorySections)

  const lines = [
    // Identitas + background + voice + quirks + output template + brand canon (full persona).
    buildSystemPromptFromAgent(resolvedRole),
    '',
    ...SHARED_INSTRUCTIONS,
  ]

  if (briefContext) {
    lines.push('', '## Brief yang sedang dibahas', briefContext)
  }

  if (memorySlice) {
    lines.push(
      '',
      `## Konteks Gerai 1000 Pintu (relevant untuk ${agent.display_name})`,
      'PAKAI SECARA NATURAL sebagai konteks. Reference vendor + brand + numbers dari sini untuk jawaban tajam.',
      '',
      memorySlice,
    )
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

// MCP + doc handler import. File _mcp_handler.js underscore prefix = bukan route Vercel,
// tapi tetap importable. Vercel rewrites /api/mcp + /api/doc ke endpoint ini via ?type=.
import { handleMcpRequest, serveDocument } from '../_mcp_handler.js'

function getRequestType(req) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const t = url.searchParams.get('type')
    if (t === 'mcp' || t === 'doc') return t
  } catch {}
  const xMcp = String(req.headers?.['x-mcp'] ?? '').toLowerCase()
  if (xMcp === 'true' || xMcp === '1') return 'mcp'
  return null
}

export default async function handler(req, res) {
  // === DISPATCH (sebelum route checks) ===
  const reqType = getRequestType(req)
  if (reqType === 'mcp') {
    return handleMcpRequest(req, res)
  }
  if (reqType === 'doc') {
    // Serve generated document HTML dari KV (GET, no auth: dokumen publik untuk print).
    return serveDocument(req, res)
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders)
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }
  // Provider gate: minimal salah satu dari Anthropic direct ATAU OpenRouter harus configured.
  // Anthropic direct = primary kalau ANTHROPIC_API_KEY ada. OpenRouter = fallback / fallback-only mode.
  const USE_ANTHROPIC_DIRECT = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const HAS_OPENROUTER = Boolean(process.env.OPENROUTER_API_KEY) && process.env.ATMAJA_OPENROUTER_ENABLED === 'true'
  if (!USE_ANTHROPIC_DIRECT && !HAS_OPENROUTER) {
    sendJson(res, 503, {
      ok: false,
      error: 'no_provider_configured',
      note: 'Set ANTHROPIC_API_KEY (primary) atau OPENROUTER_API_KEY + ATMAJA_OPENROUTER_ENABLED=true (fallback).',
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

  const role = clampText(payload?.role, 60) || 'ceo'
  const tier = payload?.tier === 'content' ? 'content' : 'orchestration'
  const briefContext = clampText(payload?.briefContext, 1_500)
  const attachments = normalizeAttachments(payload?.attachments)

  const payloadModel = clampText(payload?.model, 200)
  const envModel = process.env.AGENT_REPLY_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? ''
  const primaryModel = resolveModel(payloadModel, envModel, tier)

  const referer = process.env.AGENT_REPLY_REFERER ?? process.env.PUBLIC_APP_URL ?? 'https://gerai.mahewwork.com'

  // Load memory file untuk slice per role. Best-effort, kalau gagal pakai empty.
  let memoryContent = ''
  try {
    memoryContent = await readMemory()
  } catch (error) {
    console.error('[agent-reply] readMemory failed:', error?.message ?? error)
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(role, briefContext, memoryContent) },
    ...normalizeHistory(payload?.history),
    { role: 'user', content: buildUserContent(userMessage, attachments) },
  ]

  const MAX_TOKENS = 2500
  const TEMPERATURE = 0.7

  async function callAnthropicDirect(modelId) {
    const anthropicModelId = toAnthropicModelId(modelId)
    const { system, messages: nonSystemMessages } = splitSystemFromMessages(messages)
    const anthropicMessages = adaptMessagesForAnthropic(nonSystemMessages)
    // Opus 4.7+ deprecate `temperature`, skip kalau model 4.7+
    const supportsTemperature = !/claude-opus-4-7|claude-opus-4-8|claude-opus-5/.test(anthropicModelId)
    const reqBody = {
      model: anthropicModelId,
      max_tokens: MAX_TOKENS,
      system,
      messages: anthropicMessages,
    }
    if (supportsTemperature) reqBody.temperature = TEMPERATURE

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(reqBody),
    })
    const raw = await upstream.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { raw: raw.slice(0, 500) }
    }
    if (upstream.ok && parsed) {
      const textParts = Array.isArray(parsed.content)
        ? parsed.content.filter((c) => c?.type === 'text').map((c) => c.text).join('')
        : ''
      const usage = parsed.usage
        ? {
            prompt_tokens: Number(parsed.usage.input_tokens) || 0,
            completion_tokens: Number(parsed.usage.output_tokens) || 0,
            total_tokens: (Number(parsed.usage.input_tokens) || 0) + (Number(parsed.usage.output_tokens) || 0),
          }
        : undefined
      return {
        upstream,
        body: { choices: [{ message: { role: 'assistant', content: textParts } }], model: parsed.model ?? anthropicModelId, usage },
      }
    }
    return { upstream, body: parsed }
  }

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
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
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

  async function callLLM(modelId) {
    if (USE_ANTHROPIC_DIRECT) {
      return callLLMFromProvider({ modelId, messages, maxTokens: MAX_TOKENS, temperature: TEMPERATURE })
    }
    return callOpenRouter(modelId)
  }

  try {
    let { upstream, body } = await callLLM(primaryModel)
    let usedModel = primaryModel
    let fallbackTried = false
    let usedProvider = USE_ANTHROPIC_DIRECT ? 'Anthropic (direct)' : 'OpenRouter'
    let anthropicError = null

    // Auto-fallback: kalau Anthropic direct gagal + OpenRouter available, retry via OpenRouter.
    if (!upstream.ok && USE_ANTHROPIC_DIRECT && HAS_OPENROUTER) {
      anthropicError = {
        status: upstream.status,
        message: body?.error?.message ?? body?.message ?? 'unknown',
      }
      console.error(`[agent-reply ${role}] Anthropic direct failed, fallback OpenRouter:`, anthropicError)
      const orResult = await callOpenRouter(primaryModel)
      if (orResult.upstream.ok) {
        upstream = orResult.upstream
        body = orResult.body
        usedProvider = 'OpenRouter (Anthropic fallback)'
        fallbackTried = true
      }
    }

    if (!upstream.ok) {
      const providerLabel = USE_ANTHROPIC_DIRECT ? 'Anthropic' : 'OpenRouter'
      sendJson(res, upstream.status, {
        ok: false,
        error: USE_ANTHROPIC_DIRECT ? 'anthropic_error' : 'openrouter_error',
        upstreamStatus: upstream.status,
        modelTried: primaryModel,
        provider: providerLabel,
        anthropicError,
        note: body?.error?.message ?? body?.message ?? `${providerLabel} request failed.`,
      })
      return
    }

    let replyText = body?.choices?.[0]?.message?.content

    if ((typeof replyText !== 'string' || !replyText.trim()) && primaryModel !== FLOOR_MODEL) {
      fallbackTried = true
      const retry = await callLLM(FLOOR_MODEL)
      upstream = retry.upstream
      body = retry.body
      usedModel = FLOOR_MODEL
      replyText = body?.choices?.[0]?.message?.content
    }

    if (typeof replyText !== 'string' || !replyText.trim()) {
      sendJson(res, 502, {
        ok: false,
        error: 'empty_reply',
        provider: usedProvider,
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
      provider: usedProvider,
      anthropicEnabled: USE_ANTHROPIC_DIRECT,
      anthropicError,
      role,
      tier,
      model: (body?.model ?? usedModel) || null,
      requestedModel: primaryModel,
      anthropicModelTried: USE_ANTHROPIC_DIRECT ? toAnthropicModelId(primaryModel) : null,
      fallbackUsed: fallbackTried,
      text: replyText.trim(),
      usage: body?.usage ?? null,
      attachmentsPolicy: policy,
      attachmentsSummary: { imagesSent, textsSent, metadataOnly: metadataOnlyCount },
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: 'provider_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

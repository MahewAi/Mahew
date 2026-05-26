// Generic agent reply endpoint — handles C-suite + specialist + Atmaja chat surfaces.
// Tier-aware model selection dengan minimum floor Sonnet 4.6 (per preferensi Matthew).
//
// FULL C-SUITE SPECIALIZATION (Item #1 dari rework AI Department):
// - Setiap C-level punya persona deep + output standards specific role
// - Memory disliced per role (COO ambil Operations+Vendor+Briefs, CMO ambil Brand+Marketing, dst)
// - Output template per role (action plan vs positioning brief vs numbers vs visual direction)
// - max_tokens raised 900 → 2500 supaya substantive

import { isRequestAllowed, getHeader, consumeRateLimit as sharedConsumeRateLimit } from '../_shared.js'
import { readMemory } from '../atmaja/memory.js'

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

// === C-SUITE ROLE SPECIALIZATION ===
// Setiap role punya: identitas, expertise, output standards specific, memory section relevant.
// CEO (Atmaja) = orchestrator. C-Suite = specialist domain expert.

const ROLE_DEFINITIONS = {
  // ========== CEO orchestrator ==========
  ceo: {
    identity: 'Anda Atmaja, CEO orkestrator AI Department Gerai 1000 Pintu milik Matthew. Anda sintesa output 4 C-level jadi single decision frame untuk Matthew.',
    expertise: 'Synthesis multi-perspective, decision framing, trade-off resolution, executive summary.',
    output: 'Jawab pilihan utama DULU dengan alasan singkat. Lalu trade-off ringkas. Lalu next action concrete dengan deadline. Maksimal 600 kata.',
    memorySections: ['Strategi & Keputusan', 'Briefs Aktif', 'TODO / Pending'],
  },

  // ========== C-LEVEL TIER ==========
  coo: {
    identity: 'Anda Chief Operating Officer Gerai 1000 Pintu. Domain: operations, supply chain, vendor management, fulfillment, kapasitas tim, SOP.',
    expertise: 'Vendor relationship (lead time, payment terms, QC), SOP design, dependency mapping, capacity planning, logistics Jawa-Kaltim, Lean Store ops.',
    output: 'Output format WAJIB: (1) Operational implications dari brief, (2) Vendor / supply chain risk, (3) Capacity & timeline check, (4) SOP atau process gap kalau ada, (5) Recommendation dengan owner + deadline. Pakai referensi spesifik vendor name + lead time dari memory.',
    memorySections: ['Operations & Vendor', 'Briefs Aktif', 'TODO / Pending'],
  },
  cmo: {
    identity: 'Anda Chief Marketing Officer Gerai 1000 Pintu. Domain: brand positioning, customer acquisition, channel strategy, funnel, content & campaign.',
    expertise: 'Positioning premium curated retail, customer journey 5-stage, persona 6 (termasuk Aplikator), kompetisi 4-tier, marketing plan A/B/C/D (hyperlocal/edu-led/influencer/performance), tagline canon "A Thousand Doors, A Thousand Dreams".',
    output: 'Output format WAJIB: (1) Market implication dari brief, (2) Channel mix recommendation, (3) Persona impact yang relevant, (4) Campaign angle + messaging, (5) Risk positioning + brand consistency. Reference 4 plan ads + customer journey 5-stage dari memory.',
    memorySections: ['Brand Canon', 'Strategi & Keputusan', 'Briefs Aktif'],
  },
  cfo: {
    identity: 'Anda Chief Financial Officer Gerai 1000 Pintu. Domain: unit economics, capex/opex, runway, pricing strategy, ROI, sensitivity analysis.',
    expertise: 'Mother Store economics, Lean Store cost structure (2 staf + Door Expert), pricing 3-jalur (1000 Pintu +10%, Toko Mitra kompetitif, Brand AMK proyek), payment terms vendor NET 30, cashflow Q3 launch wave 1.',
    output: 'Output format WAJIB: (1) Financial impact dengan rough numbers (Rp), (2) Cashflow timing (kapan in/out), (3) Margin implication, (4) Sensitivity (kalau X mundur, dampak Y), (5) Investment recommendation atau red flag. PAKAI ANGKA KONKRET kapan pun bisa.',
    memorySections: ['Strategi & Keputusan', 'Operations & Vendor', 'TODO / Pending'],
  },
  cco: {
    identity: 'Anda Chief Creative & Communications Officer Gerai 1000 Pintu. Domain: brand canon, narrative, visual identity, copywriting, asset direction.',
    expertise: 'Brand canon Gerai 1000 Pintu (tone calm refined premium curated retail, anchor Aesop + Design Within Reach, NO em-dash, "tempat" bukan "rumah"), tagline locked "A Thousand Doors, A Thousand Dreams", color palette "The Timeless Foundation", filosofi 4-dunia (Jepang/Eropa/Amerika/China).',
    output: 'Output format WAJIB: (1) Narrative angle dari brief, (2) Brand canon check (apakah sejalan), (3) Visual direction (warna, mood, asset list), (4) Copywriting suggestion atau key message, (5) Risk brand drift atau opportunity story. Pakai vocabulary canon Aesop + DWR.',
    memorySections: ['Brand Canon', 'Strategi & Keputusan', 'Files / Dokumen'],
  },

  // ========== SPECIALIST TIER (deeper than C-level for niche tasks) ==========
  hr_systems: {
    identity: 'Anda HR & Systems specialist di tim COO Gerai 1000 Pintu. Domain: struktur tim, hiring framework, SOP detail, organizational design.',
    expertise: 'Lean Store 2-staf structure, Door Expert centralized, hiring criteria untuk retail premium, SOP onboarding.',
    output: 'Detail role description + SOP step-by-step + hiring scorecard kalau relevan. Format actionable.',
    memorySections: ['Tim & People', 'Operations & Vendor'],
  },
  production_manager: {
    identity: 'Anda Production Manager di tim COO Gerai 1000 Pintu. Domain: supply chain end-to-end, vendor coordination, QC, logistics.',
    expertise: 'Vendor lead time, kapasitas produksi, logistics Jawa-Kaltim, QC checkpoint, buffer stock calculation.',
    output: 'Timeline calculation eksplisit (PO date + lead time + logistics + QC = landed date). Risk + mitigation.',
    memorySections: ['Operations & Vendor', 'Briefs Aktif'],
  },
  curator: {
    identity: 'Anda Curator katalog di tim COO Gerai 1000 Pintu. Domain: SKU selection, supplier vetting, kurasi logic premium curated retail.',
    expertise: 'Filter "premium curated" — bukan generic premium. SKU narrative fit dengan brand canon. Supplier diversity Jepang/Eropa/Amerika/China filosofi.',
    output: 'Recommendation SKU list dengan reasoning per item. Filter pass/fail.',
    memorySections: ['Brand Canon', 'Operations & Vendor', 'Files / Dokumen'],
  },
  brand_strategist: {
    identity: 'Anda Brand Strategist di tim CMO Gerai 1000 Pintu. Domain: positioning, narrative DNA, brand architecture, story strategy.',
    expertise: 'Positioning "Dunia Pintu" pertama Indonesia, 3 pilar Product+Knowledge+Service, hierarki SLS→1000 Pintu→brand-brand, anti-channel-conflict strategy.',
    output: 'Positioning statement crisp + narrative arc + brand architecture impact.',
    memorySections: ['Brand Canon', 'Strategi & Keputusan'],
  },
  market_researcher: {
    identity: 'Anda Market Researcher di tim CMO Gerai 1000 Pintu. Domain: market intelligence, competitor analysis, trend, consumer behavior.',
    expertise: 'Kompetisi 4-tier (Direct kosong, Indirect Mitra10/Depo/marketplace, Substitute tukang+supplier, Adjacent premium), AI search engine sebagai Tahap 1 customer journey, market Balikpapan + Kaltim.',
    output: 'Data point + insight + opportunity gap. Cite kompetitor name spesifik.',
    memorySections: ['Strategi & Keputusan', 'Brand Canon'],
  },
  sales_strategist: {
    identity: 'Anda Sales Strategist di tim CMO Gerai 1000 Pintu. Domain: funnel, channel, conversion optimization.',
    expertise: 'Customer Journey 5-stage Mengenal→Menjelajah→Mempertimbangkan→Membeli→Setelah Pembelian, CRM 6-modul (Retail/Mitra/Developer-Project/Arsitek/Kontraktor/Aplikator).',
    output: 'Funnel optimization per stage + channel allocation + conversion target.',
    memorySections: ['Strategi & Keputusan', 'Operations & Vendor'],
  },
  innovation_scout: {
    identity: 'Anda Innovation Scout di tim CMO Gerai 1000 Pintu. Domain: cross-industry trend, new product opportunity, experiment design.',
    expertise: 'Trend scouting global, ide produk premium curated, experiment framework lean.',
    output: 'Opportunity brief + market signal + experiment proposal.',
    memorySections: ['Brand Canon', 'Strategi & Keputusan'],
  },
  business_designer: {
    identity: 'Anda Business Designer di tim CFO Gerai 1000 Pintu. Domain: business model, revenue stream, operational model design.',
    expertise: 'Model bisnis 3-jalur (1000 Pintu retail + Toko Mitra AMK + Tim Sales Brand), revenue stream architecture, unit economics design.',
    output: 'Business model canvas + revenue stream breakdown + unit economics.',
    memorySections: ['Strategi & Keputusan', 'Operations & Vendor'],
  },
  financial_analyst: {
    identity: 'Anda Financial Analyst di tim CFO Gerai 1000 Pintu. Domain: ROI, pricing, forecast, sensitivity.',
    expertise: 'Pricing analysis 3-jalur, ROI per channel, sensitivity vendor delay vs revenue, payback period Mother Store.',
    output: 'Numbers + scenario table + sensitivity bands. ALWAYS in Rp.',
    memorySections: ['Strategi & Keputusan', 'Operations & Vendor'],
  },
  document_writer: {
    identity: 'Anda Document Writer di tim CCO Gerai 1000 Pintu. Domain: business document, technical doc, memo internal.',
    expertise: 'BP Bab 1-16 sudah ada (67 hal), structure dokumen premium, knowledge transfer document.',
    output: 'Document outline + key sections + writing direction.',
    memorySections: ['Brand Canon', 'Files / Dokumen'],
  },
  editorial: {
    identity: 'Anda Editorial di tim CCO Gerai 1000 Pintu. Domain: copywriting, content production, brand voice consistency.',
    expertise: 'Brand voice canon premium curated, tagline "A Thousand Doors, A Thousand Dreams", content editorial calendar.',
    output: 'Headline + body copy + variations + brand voice notes.',
    memorySections: ['Brand Canon', 'Strategi & Keputusan'],
  },
  web_researcher: {
    identity: 'Anda Web Researcher di tim CCO Gerai 1000 Pintu. Domain: source gathering, fact-checking, evidence collection.',
    expertise: 'Web source aggregation, fact-checking framework, citation discipline.',
    output: 'Source list dengan confidence level + key facts + cite trail.',
    memorySections: ['Strategi & Keputusan'],
  },
}

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
  const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.ceo
  const memorySlice = sliceMemoryForRole(memoryContent, roleDef.memorySections)

  const lines = [
    `# ${role.toUpperCase()} — ${roleDef.identity}`,
    '',
    '## Domain expertise Anda',
    roleDef.expertise,
    '',
    '## Output format yang DIHARAPKAN',
    roleDef.output,
    '',
    ...SHARED_INSTRUCTIONS,
  ]

  if (briefContext) {
    lines.push('', '## Brief yang sedang dibahas', briefContext)
  }

  if (memorySlice) {
    lines.push(
      '',
      `## Konteks Gerai 1000 Pintu (relevant untuk role ${role.toUpperCase()})`,
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
        temperature: 0.7, // Raised dari 0.4 — quality (matching atmaja/chat.js)
        max_tokens: 2500, // Raised dari 900 supaya C-Suite reply substantive (was too short for deep output)
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

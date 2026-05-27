// Anthropic native API adapter.
// Extracted dari chat.js + reply.js. Single source of truth untuk Anthropic call logic.
// API: callAnthropic({ modelId, messages, maxTokens, temperature }) → { upstream, body, providerUsed }

import { getModelMeta, PROVIDER } from '../_models.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Map slug-style model ID (anthropic/claude-opus-4.7) ke Anthropic native alias (claude-opus-4-7).
// Lookup via registry. Fallback: strip prefix + replace dot dengan dash.
export function toAnthropicModelId(slug) {
  const meta = getModelMeta(slug)
  if (meta?.provider === PROVIDER.ANTHROPIC && meta.anthropicId) return meta.anthropicId
  if (typeof slug === 'string') return slug.replace('anthropic/', '').replace(/\./g, '-')
  return String(slug || '')
}

// Anthropic native pisahkan system messages (separate 'system' field) dari user/assistant.
// Input: array messages OpenAI-style. Output: { system: string, messages: array sisanya }
export function splitSystemFromMessages(msgs) {
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

// Adapt content block dari OpenAI-format ke Anthropic-format.
// - image_url block: data URL → base64 source; non-data URL → url source.
// - file (PDF) block: data URL → document base64 source.
// - text block + lainnya: passthrough.
export function adaptContentBlocksForAnthropic(content) {
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

export function adaptMessagesForAnthropic(messages) {
  return messages.map((m) => ({ role: m.role, content: adaptContentBlocksForAnthropic(m.content) }))
}

// Direct call ke Anthropic native API.
// Returns OpenAI-compatible adapted shape supaya downstream code (yang masih bicara OpenAI) tidak perlu diubah.
export async function callAnthropic({ modelId, messages, maxTokens = 16384, temperature = 0.7 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('anthropic_key_not_configured')
  }

  const anthropicModelId = toAnthropicModelId(modelId)
  const { system, messages: nonSystemMessages } = splitSystemFromMessages(messages)
  const anthropicMessages = adaptMessagesForAnthropic(nonSystemMessages)

  // Opus 4.7+ deprecate `temperature` field (return 400). Omit untuk model itu.
  const supportsTemperature = !/claude-opus-4-7|claude-opus-4-8|claude-opus-5/.test(anthropicModelId)
  const body = {
    model: anthropicModelId,
    max_tokens: maxTokens,
    system,
    messages: anthropicMessages,
  }
  if (supportsTemperature) body.temperature = temperature

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await upstream.text()
  let parsed = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = { raw: raw.slice(0, 500) }
  }

  if (upstream.ok && parsed) {
    // Adapt Anthropic response → OpenAI-compatible shape.
    // Anthropic: { content: [{type:'text', text:'...'}], stop_reason, usage }
    // OpenAI:    { choices: [{message:{content:'...'}, finish_reason}], usage }
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
          prompt_tokens: numericOrZero(parsed.usage.input_tokens),
          completion_tokens: numericOrZero(parsed.usage.output_tokens),
          total_tokens: numericOrZero(parsed.usage.input_tokens) + numericOrZero(parsed.usage.output_tokens),
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
    return { upstream, body: adapted, providerUsed: PROVIDER.ANTHROPIC }
  }

  // Error path: pass body as-is supaya caller bisa baca error.code dst.
  return { upstream, body: parsed, providerUsed: PROVIDER.ANTHROPIC }
}

function numericOrZero(v) { return Number.isFinite(Number(v)) ? Number(v) : 0 }

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

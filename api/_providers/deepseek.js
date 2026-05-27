// DeepSeek adapter. API OpenAI-compatible (paling simpel di antara provider lain).
// API: callDeepSeek({ modelId, messages, maxTokens, temperature }) → { upstream, body, providerUsed }
//
// Auth via DEEPSEEK_API_KEY env (dari https://platform.deepseek.com/api_keys).
// DeepSeek pricing paling murah: V3 $0.27/$1.10 per 1M tokens, R1 $0.55/$2.19.

import { getModelMeta, PROVIDER } from '../_models.js'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export function toDeepSeekModelId(slug) {
  const meta = getModelMeta(slug)
  if (meta?.provider === PROVIDER.DEEPSEEK && meta.deepseekId) return meta.deepseekId
  if (typeof slug === 'string') return slug.replace('deepseek/', '')
  return String(slug || '')
}

// DeepSeek adopts OpenAI Chat Completions API shape directly. No message adaptation needed
// kecuali extract content blocks ke plain text (DeepSeek tidak support vision/PDF di sini).
export function adaptMessagesForDeepSeek(messages) {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content }
    if (Array.isArray(m.content)) {
      const textParts = m.content
        .filter((b) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
      return { role: m.role, content: textParts || '' }
    }
    return { role: m.role, content: String(m.content || '') }
  })
}

export async function callDeepSeek({ modelId, messages, maxTokens = 8192, temperature = 0.7 }) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('deepseek_key_not_configured')
  }

  const deepseekModelId = toDeepSeekModelId(modelId)
  const adaptedMessages = adaptMessagesForDeepSeek(messages)

  const body = {
    model: deepseekModelId,
    messages: adaptedMessages,
    temperature,
    max_tokens: maxTokens,
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
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

  // DeepSeek already returns OpenAI shape, just attach providerUsed.
  return { upstream, body: parsed, providerUsed: PROVIDER.DEEPSEEK }
}

export function isDeepSeekConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
}

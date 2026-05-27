// Google Gemini adapter (Generative AI REST API).
// API: callGoogle({ modelId, messages, maxTokens, temperature }) → { upstream, body, providerUsed }
//
// Auth via GOOGLE_AI_API_KEY env (dari https://aistudio.google.com/apikey).
// Adapter convert OpenAI-style messages ke Gemini format, lalu adapt response balik
// ke OpenAI-compatible shape supaya downstream code tidak perlu ubah.

import { getModelMeta, PROVIDER } from '../_models.js'

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Map slug-style model ID (google/gemini-2.5-pro) ke Gemini native ID (gemini-2.5-pro).
// Lookup via registry. Fallback: strip prefix.
export function toGoogleModelId(slug) {
  const meta = getModelMeta(slug)
  if (meta?.provider === PROVIDER.GOOGLE && meta.googleId) return meta.googleId
  if (typeof slug === 'string') return slug.replace('google/', '')
  return String(slug || '')
}

// Gemini API tidak punya 'system' role; system prompt ditaruh di systemInstruction.parts.
// Output: { systemInstruction (atau null), contents: array Gemini format }
export function adaptMessagesForGoogle(messages) {
  const systemParts = []
  const contents = []
  for (const m of messages) {
    if (m.role === 'system') {
      if (typeof m.content === 'string') systemParts.push(m.content)
      continue
    }
    const role = m.role === 'assistant' ? 'model' : 'user'
    const parts = adaptContentForGoogle(m.content)
    contents.push({ role, parts })
  }
  return {
    systemInstruction: systemParts.length > 0 ? { parts: [{ text: systemParts.join('\n\n') }] } : null,
    contents,
  }
}

// Adapt content block dari OpenAI-format ke Gemini parts array.
// - string: 1 text part
// - image_url base64: inlineData part dengan mimeType + base64 data
// - file (PDF) base64: inlineData part dengan mimeType application/pdf
// - text block: passthrough sebagai text part
export function adaptContentForGoogle(content) {
  if (typeof content === 'string') return [{ text: content }]
  if (!Array.isArray(content)) return [{ text: String(content || '') }]

  const parts = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue

    if (block.type === 'text' && typeof block.text === 'string') {
      parts.push({ text: block.text })
      continue
    }

    if (block.type === 'image_url' && block.image_url?.url) {
      const url = String(block.image_url.url)
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
        continue
      }
      // Non-data URL: Gemini support fileData with fileUri (untuk Google Cloud Storage).
      // Public HTTP URL tidak supported langsung. Skip atau fall back ke text reference.
      parts.push({ text: `[image: ${url}]` })
      continue
    }

    if (block.type === 'file' && block.file?.file_data) {
      const fileData = String(block.file.file_data)
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        parts.push({ inlineData: { mimeType: match[1] || 'application/pdf', data: match[2] } })
        continue
      }
    }
  }
  return parts.length > 0 ? parts : [{ text: '' }]
}

// Direct call ke Gemini generateContent endpoint.
// Returns OpenAI-compatible adapted shape.
export async function callGoogle({ modelId, messages, maxTokens = 8192, temperature = 0.7 }) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('google_ai_key_not_configured')
  }

  const googleModelId = toGoogleModelId(modelId)
  const { systemInstruction, contents } = adaptMessagesForGoogle(messages)

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }
  if (systemInstruction) body.systemInstruction = systemInstruction

  const url = `${GOOGLE_API_BASE}/models/${encodeURIComponent(googleModelId)}:generateContent`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
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
    // Adapt Gemini response → OpenAI-compatible shape.
    // Gemini: { candidates: [{content: {parts:[{text:'...'}]}, finishReason}], usageMetadata: {...} }
    // OpenAI: { choices: [{message:{content:'...'}, finish_reason}], usage: {...} }
    const candidate = Array.isArray(parsed.candidates) && parsed.candidates[0] ? parsed.candidates[0] : null
    const textParts = candidate?.content?.parts
      ? candidate.content.parts.filter((p) => typeof p?.text === 'string').map((p) => p.text).join('')
      : ''
    const finishReasonRaw = candidate?.finishReason || ''
    const finishReason = finishReasonRaw === 'MAX_TOKENS' ? 'length'
      : finishReasonRaw === 'STOP' ? 'stop'
      : finishReasonRaw === 'SAFETY' ? 'content_filter'
      : finishReasonRaw.toLowerCase() || 'stop'
    const usage = parsed.usageMetadata
      ? {
          prompt_tokens: numericOrZero(parsed.usageMetadata.promptTokenCount),
          completion_tokens: numericOrZero(parsed.usageMetadata.candidatesTokenCount),
          total_tokens: numericOrZero(parsed.usageMetadata.totalTokenCount),
        }
      : undefined
    const adapted = {
      choices: [
        {
          message: { role: 'assistant', content: textParts },
          finish_reason: finishReason,
        },
      ],
      model: parsed.modelVersion || googleModelId,
      usage,
    }
    return { upstream, body: adapted, providerUsed: PROVIDER.GOOGLE }
  }

  // Error path
  return { upstream, body: parsed, providerUsed: PROVIDER.GOOGLE }
}

function numericOrZero(v) { return Number.isFinite(Number(v)) ? Number(v) : 0 }

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_AI_API_KEY?.trim())
}

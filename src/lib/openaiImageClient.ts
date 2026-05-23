// Client wrapper untuk /api/openai/image dan /api/openai/credits.
// Dipakai oleh surface Atmaja + C-suite chat saat user request image generation.
// Privacy: tetap pakai AGENT_BRIDGE_ALLOWED guard yang sama (key tidak pernah ke browser).

import { AGENT_BRIDGE_ALLOWED } from '@/lib/privacyGuard'

export type OpenAIImageModel = 'gpt-image-1' | 'dall-e-3'
export type OpenAIImageSize =
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '1024x1792'
  | '1792x1024'
  | 'auto'
export type OpenAIImageQuality = 'low' | 'medium' | 'high' | 'auto' | 'standard' | 'hd'

export interface GenerateImageInput {
  prompt: string
  model?: OpenAIImageModel
  size?: OpenAIImageSize
  quality?: OpenAIImageQuality
  /** Hanya untuk dall-e-3: 'vivid' (default) atau 'natural'. */
  style?: 'vivid' | 'natural'
}

export interface GenerateImageResult {
  /** Data URI lengkap, langsung bisa dipasang ke <img src>. */
  dataUri: string
  model: OpenAIImageModel
  /** DALL-E 3 sering menulis ulang prompt user untuk hasil lebih baik. */
  revisedPrompt: string | null
  size: string
  quality: string
  elapsedMs: number
}

export interface OpenAICreditsState {
  status: 'connected' | 'invalid_key' | 'not_configured' | 'error'
  keyConfigured: boolean
  modelCount?: number
  imageModelsAvailable?: { 'gpt-image-1': boolean; 'dall-e-3': boolean }
  note?: string
  updatedAt: string
}

export function isOpenAIBridgeAllowed() {
  return AGENT_BRIDGE_ALLOWED
}

/**
 * Parse user input untuk image-gen command.
 * Triggers (case-insensitive):
 *   /img <prompt>            → gpt-image-1 (default)
 *   /image <prompt>          → gpt-image-1
 *   /dalle <prompt>          → dall-e-3
 *   /gpt-image <prompt>      → gpt-image-1
 * Separator setelah command boleh spasi, ":", atau "-".
 */
export function parseImageCommand(text: string): { prompt: string; model: OpenAIImageModel } | null {
  const m = text.match(/^\/(img|image|dalle|gpt-image)\s*[:\-]?\s*([\s\S]+)$/i)
  if (!m) return null
  const cmd = m[1].toLowerCase()
  const prompt = m[2].trim()
  if (!prompt || prompt.length < 3) return null
  const model: OpenAIImageModel = cmd === 'dalle' ? 'dall-e-3' : 'gpt-image-1'
  return { prompt, model }
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model: input.model ?? 'gpt-image-1',
    size: input.size ?? '1024x1024',
    quality: input.quality ?? (input.model === 'dall-e-3' ? 'hd' : 'high'),
  }
  if (input.model === 'dall-e-3' && input.style) body.style = input.style

  try {
    const response = await fetch('/api/openai/image', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('application/json')) return null

    const payload = (await response.json()) as {
      ok?: boolean
      imageBase64?: string
      mime?: string
      model?: OpenAIImageModel
      revisedPrompt?: string | null
      requestedSize?: string
      requestedQuality?: string
      elapsedMs?: number
    }
    if (!payload.ok || !payload.imageBase64) return null

    const mime = payload.mime ?? 'image/png'
    return {
      dataUri: `data:${mime};base64,${payload.imageBase64}`,
      model: payload.model ?? (input.model ?? 'gpt-image-1'),
      revisedPrompt: payload.revisedPrompt ?? null,
      size: payload.requestedSize ?? (input.size ?? '1024x1024'),
      quality: payload.requestedQuality ?? '',
      elapsedMs: payload.elapsedMs ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchOpenAICredits(): Promise<OpenAICreditsState | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null

  try {
    const response = await fetch('/api/openai/credits', {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    return (await response.json()) as OpenAICreditsState
  } catch {
    return null
  }
}

// Model registry: model → provider mapping + ALLOWED_MODELS whitelist.
// Single source of truth untuk model floor enforcement + provider routing.
//
// Tambah model baru di sini, jangan duplikat ke chat.js atau reply.js.

export const PROVIDER = {
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  OPENAI: 'openai',
  DEEPSEEK: 'deepseek',
  OPENROUTER: 'openrouter', // legacy fallback, deprecated
}

// Model catalog. Setiap entry: { provider, tier, anthropicId?, displayName? }
// - tier: 'content' (Atmaja CEO, premium reasoning)
//       | 'orchestration' (C-suite + specialist, default Sonnet)
//       | 'image' (gpt-image-*)
//       | 'fast' (cepat, low-latency, e.g. Gemini Flash)
// - anthropicId: ID untuk Anthropic native API (kalau provider anthropic).
//   Map dari OpenRouter slug → Anthropic alias (verified via /v1/models endpoint).
export const MODELS = {
  // === Anthropic Claude ===
  'anthropic/claude-opus-4.7':      { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-7' },
  'anthropic/claude-opus-4.7-fast': { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-7' },
  'anthropic/claude-opus-4.6':      { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-6' },
  'anthropic/claude-opus-4.6-fast': { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-6' },
  'anthropic/claude-opus-4.5':      { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-5-20251101' },
  'anthropic/claude-opus-4.1':      { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-1' },
  'anthropic/claude-opus-4':        { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4' },
  'anthropic/claude-sonnet-4.6':    { provider: PROVIDER.ANTHROPIC, tier: 'orchestration', anthropicId: 'claude-sonnet-4-6' },

  // === Google Gemini (adapter live; aktif kalau GOOGLE_AI_API_KEY set di Vercel) ===
  // Native model name di-pakai sebagai googleId untuk Gemini REST API.
  'google/gemini-2.5-pro':            { provider: PROVIDER.GOOGLE, tier: 'content',       googleId: 'gemini-2.5-pro' },
  'google/gemini-2.5-flash':          { provider: PROVIDER.GOOGLE, tier: 'orchestration', googleId: 'gemini-2.5-flash' },
  'google/gemini-2.0-pro':            { provider: PROVIDER.GOOGLE, tier: 'content',       googleId: 'gemini-2.0-pro' },
  'google/gemini-2.0-flash':          { provider: PROVIDER.GOOGLE, tier: 'fast',          googleId: 'gemini-2.0-flash' },
  'google/gemini-2.0-flash-thinking': { provider: PROVIDER.GOOGLE, tier: 'content',       googleId: 'gemini-2.0-flash-thinking-exp' },

  // Native ID-style (untuk LibreChat Custom Endpoint yang kirim raw model name)
  'gemini-2.5-pro':                   { provider: PROVIDER.GOOGLE, tier: 'content',       googleId: 'gemini-2.5-pro' },
  'gemini-2.5-flash':                 { provider: PROVIDER.GOOGLE, tier: 'orchestration', googleId: 'gemini-2.5-flash' },
  'gemini-2.0-pro':                   { provider: PROVIDER.GOOGLE, tier: 'content',       googleId: 'gemini-2.0-pro' },
  'gemini-2.0-flash':                 { provider: PROVIDER.GOOGLE, tier: 'fast',          googleId: 'gemini-2.0-flash' },

  // Native Anthropic ID-style (untuk LibreChat Custom Endpoint)
  'claude-opus-4-7':                  { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-7' },
  'claude-opus-4-6':                  { provider: PROVIDER.ANTHROPIC, tier: 'content',       anthropicId: 'claude-opus-4-6' },
  'claude-sonnet-4-6':                { provider: PROVIDER.ANTHROPIC, tier: 'orchestration', anthropicId: 'claude-sonnet-4-6' },

  // === DeepSeek (paling murah: V3 $0.27/$1.10, R1 $0.55/$2.19 per 1M tokens) ===
  'deepseek/deepseek-chat':           { provider: PROVIDER.DEEPSEEK, tier: 'orchestration', deepseekId: 'deepseek-chat' },
  'deepseek/deepseek-reasoner':       { provider: PROVIDER.DEEPSEEK, tier: 'content',       deepseekId: 'deepseek-reasoner' },

  // Native DeepSeek ID-style
  'deepseek-chat':                    { provider: PROVIDER.DEEPSEEK, tier: 'orchestration', deepseekId: 'deepseek-chat' },
  'deepseek-reasoner':                { provider: PROVIDER.DEEPSEEK, tier: 'content',       deepseekId: 'deepseek-reasoner' },
}

// Whitelist model yang boleh dipakai untuk chat. Floor enforcement.
// Apapun di luar set ini akan di-fallback ke DEFAULT_MODELS.content (Opus 4.7).
export const ALLOWED_MODELS = new Set([
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.7-fast',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.6-fast',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4.6',
])

// Default model per tier. Floor untuk Atmaja = Opus 4.7. Floor untuk C-suite = Sonnet 4.6.
export const DEFAULT_MODELS = {
  content: 'anthropic/claude-opus-4.7',
  orchestration: 'anthropic/claude-sonnet-4.6',
}

// Helper: resolve model entry dari registry.
export function getModelMeta(modelId) {
  return MODELS[modelId]
}

// Helper: resolve provider key untuk model ID.
// Default ke prefix slug (anthropic/, google/, openai/) kalau tidak ada di registry.
export function getProvider(modelId) {
  const meta = MODELS[modelId]
  if (meta?.provider) return meta.provider
  if (typeof modelId === 'string' && modelId.startsWith('anthropic/')) return PROVIDER.ANTHROPIC
  if (typeof modelId === 'string' && modelId.startsWith('google/')) return PROVIDER.GOOGLE
  if (typeof modelId === 'string' && modelId.startsWith('openai/')) return PROVIDER.OPENAI
  return null
}

// Helper: floor enforcement. Kalau modelId tidak di ALLOWED_MODELS, return default untuk tier.
export function enforceFloor(modelId, tier = 'orchestration') {
  if (modelId && ALLOWED_MODELS.has(modelId)) return modelId
  return DEFAULT_MODELS[tier] ?? DEFAULT_MODELS.orchestration
}

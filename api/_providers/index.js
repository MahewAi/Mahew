// Provider router. Dispatch LLM call ke adapter sesuai model ID.
// Caller cuma kirim model + messages. Router resolve provider lewat _models.js registry.
//
// Cara nambah provider baru:
//   1. Buat file _providers/<name>.js dengan export `call<Name>` dan `is<Name>Configured`
//   2. Tambah entry di MODELS registry (_models.js) dengan provider key cocok
//   3. Tambah import + entry di ADAPTERS + providerCallFn + getProviderStatus di bawah
//   4. Set env var key-nya di Vercel

import { getProvider, PROVIDER } from '../_models.js'
import * as anthropic from './anthropic.js'
import * as google from './google.js'
import * as deepseek from './deepseek.js'

const ADAPTERS = {
  [PROVIDER.ANTHROPIC]: anthropic,
  [PROVIDER.GOOGLE]: google,
  [PROVIDER.DEEPSEEK]: deepseek,
  // [PROVIDER.OPENAI]: openai,   // aktif kalau perlu OpenAI chat (saat ini cuma image/video)
}

// Dispatcher utama. Input: { modelId, messages, maxTokens, temperature }
// Output: shape sama dengan adapter return (upstream + body + providerUsed)
export async function callLLM({ modelId, messages, maxTokens, temperature }) {
  const providerKey = getProvider(modelId)
  if (!providerKey) {
    throw new Error('provider_unknown_for_model_' + modelId)
  }
  const adapter = ADAPTERS[providerKey]
  if (!adapter) {
    throw new Error('provider_not_installed_' + providerKey)
  }
  const fnName = providerCallFn(providerKey)
  return adapter[fnName]({ modelId, messages, maxTokens, temperature })
}

// Map provider key → adapter call function name.
function providerCallFn(providerKey) {
  if (providerKey === PROVIDER.ANTHROPIC) return 'callAnthropic'
  if (providerKey === PROVIDER.GOOGLE) return 'callGoogle'
  if (providerKey === PROVIDER.DEEPSEEK) return 'callDeepSeek'
  if (providerKey === PROVIDER.OPENAI) return 'callOpenAI'
  throw new Error('no_call_fn_for_' + providerKey)
}

// Per-provider config status untuk health endpoint matrix.
export function getProviderStatus() {
  return {
    anthropic: {
      enabled: anthropic.isAnthropicConfigured(),
      keyConfigured: anthropic.isAnthropicConfigured(),
      keyEnvName: 'ANTHROPIC_API_KEY',
      scope: 'chat (Atmaja CEO + C-suite + specialist)',
    },
    google: {
      enabled: google.isGoogleConfigured(),
      keyConfigured: google.isGoogleConfigured(),
      keyEnvName: 'GOOGLE_AI_API_KEY',
      scope: 'chat (Gemini 2.5/2.0 Pro+Flash, eksperimen multi-modal)',
    },
    openai: {
      enabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
      keyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      keyEnvName: 'OPENAI_API_KEY',
      scope: 'image + video generation only',
    },
    deepseek: {
      enabled: deepseek.isDeepSeekConfigured(),
      keyConfigured: deepseek.isDeepSeekConfigured(),
      keyEnvName: 'DEEPSEEK_API_KEY',
      scope: 'chat (V3 + R1 reasoner, paling hemat untuk eksperimen)',
    },
  }
}

// Re-export provider keys + helpers untuk caller convenience.
export { PROVIDER, getProvider } from '../_models.js'

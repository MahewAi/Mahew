// OpenAI billing/usage probe.
// OpenAI tidak punya "credits balance" endpoint public seperti OpenRouter.
// Cara cek yang reliable: panggil endpoint billing yang butuh org-level admin key (sk-admin-...).
// Untuk most cases, kita ping endpoint Models untuk cek key validity + return usage yang
// kita track di server-side (kalau ada cost ledger lokal).

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { provider: 'OpenAI', status: 'error', note: 'Method not allowed.' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    sendJson(res, 200, {
      provider: 'OpenAI',
      status: 'not_configured',
      keyConfigured: false,
      note: 'OPENAI_API_KEY belum diset di server.',
      updatedAt: new Date().toISOString(),
    })
    return
  }

  // OpenAI tidak punya endpoint "credits remaining" untuk standard API key.
  // Yang bisa kita lakukan: panggil endpoint murah (Models list) untuk verify key live.
  try {
    const upstream = await fetch('https://api.openai.com/v1/models', {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      sendJson(res, 200, {
        provider: 'OpenAI',
        status: upstream.status === 401 ? 'invalid_key' : 'error',
        keyConfigured: true,
        upstreamStatus: upstream.status,
        note: `OpenAI Models endpoint returned ${upstream.status}.`,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    const payload = await upstream.json()
    const modelCount = Array.isArray(payload?.data) ? payload.data.length : 0
    const hasGptImage = Array.isArray(payload?.data) && payload.data.some((m) => m.id === 'gpt-image-1')
    const hasDallE3 = Array.isArray(payload?.data) && payload.data.some((m) => m.id === 'dall-e-3')

    sendJson(res, 200, {
      provider: 'OpenAI',
      status: 'connected',
      keyConfigured: true,
      modelCount,
      imageModelsAvailable: {
        'gpt-image-1': hasGptImage,
        'dall-e-3': hasDallE3,
      },
      note: 'Live dari OpenAI Models endpoint. Credit balance tidak tersedia via standard API key — cek di https://platform.openai.com/usage.',
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    sendJson(res, 200, {
      provider: 'OpenAI',
      status: 'error',
      keyConfigured: true,
      note: error instanceof Error ? error.message : 'Tidak bisa menghubungi OpenAI dari server.',
      updatedAt: new Date().toISOString(),
    })
  }
}

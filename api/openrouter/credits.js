import { isRequestAllowed } from '../_shared.js'

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
    sendJson(res, 405, { provider: 'OpenRouter', status: 'error', note: 'Method not allowed.' })
    return
  }

  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { provider: 'OpenRouter', status: 'error', error: 'request_not_allowed', reason: auth.reason })
    return
  }

  const apiKey = process.env.OPENROUTER_MANAGEMENT_KEY ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    sendJson(res, 200, {
      provider: 'OpenRouter',
      status: 'not_configured',
      totalCredits: null,
      totalUsage: null,
      remainingCredits: null,
      updatedAt: new Date().toISOString(),
      note: 'OPENROUTER_MANAGEMENT_KEY belum diset di server.',
    })
    return
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      sendJson(res, 200, {
        provider: 'OpenRouter',
        status: upstream.status === 401 || upstream.status === 403 ? 'locked' : 'error',
        totalCredits: null,
        totalUsage: null,
        remainingCredits: null,
        updatedAt: new Date().toISOString(),
        note: `OpenRouter credits endpoint returned ${upstream.status}.`,
      })
      return
    }

    const payload = await upstream.json()
    const totalCredits = Number(payload?.data?.total_credits ?? 0)
    const totalUsage = Number(payload?.data?.total_usage ?? 0)

    sendJson(res, 200, {
      provider: 'OpenRouter',
      status: 'connected',
      totalCredits,
      totalUsage,
      remainingCredits: Math.max(0, totalCredits - totalUsage),
      updatedAt: new Date().toISOString(),
      note: 'Live dari server-side OpenRouter credits endpoint.',
    })
  } catch {
    sendJson(res, 200, {
      provider: 'OpenRouter',
      status: 'error',
      totalCredits: null,
      totalUsage: null,
      remainingCredits: null,
      updatedAt: new Date().toISOString(),
      note: 'Tidak bisa membaca OpenRouter credits dari server.',
    })
  }
}

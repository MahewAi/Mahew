// GET /api/openai/video/content?id=video_xxx
// Proxy MP4 binary dari OpenAI ke client. Client pasang URL ini ke <video src=".." />.
// Server-side fetch + re-stream supaya client tidak butuh expose OpenAI auth.

import { isRequestAllowed } from '../../_shared.js'

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function parseCsv(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

// isOriginAllowed legacy diganti pakai isRequestAllowed dari _shared.js (strict mode).

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
    return
  }
  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'openai_key_missing' }))
    return
  }
  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'request_not_allowed', reason: auth.reason }))
    return
  }

  const url = new URL(req.url, `http://${getHeader(req, 'host') ?? 'localhost'}`)
  const id = url.searchParams.get('id') ?? ''
  if (!/^video_[A-Za-z0-9]{10,80}$/.test(id)) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid_id' }))
    return
  }

  try {
    const upstream = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, {
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        accept: 'video/mp4',
      },
    })

    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        ok: false,
        error: 'openai_error',
        upstreamStatus: upstream.status,
      }))
      return
    }

    const ct = upstream.headers.get('content-type') ?? 'video/mp4'
    const cl = upstream.headers.get('content-length')

    const headers = {
      'content-type': ct,
      // Cache 1 jam — OpenAI video URL valid 48h, jadi safe cache short.
      'cache-control': 'private, max-age=3600',
    }
    if (cl) headers['content-length'] = cl

    res.writeHead(200, headers)

    // Stream upstream body ke client.
    if (upstream.body) {
      const reader = upstream.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }
    }
    res.end()
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: false,
      error: 'openai_unreachable',
      note: error instanceof Error ? error.message : 'unknown_error',
    }))
  }
}

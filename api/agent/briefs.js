const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, jsonHeaders)
    res.end(JSON.stringify({ error: 'method_not_allowed' }))
    return
  }

  let payload
  try {
    payload = await readBody(req)
  } catch {
    res.writeHead(400, jsonHeaders)
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  const webhookUrl = process.env.ATMAJA_BRIEF_WEBHOOK_URL
  const bridgeToken = process.env.ATMAJA_BRIDGE_TOKEN
  const jobId = `gerai-job-${Date.now()}`

  if (!webhookUrl) {
    res.writeHead(202, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'contract',
        status: 'accepted',
        jobId,
        note: 'ATMAJA_BRIEF_WEBHOOK_URL belum dikonfigurasi. App memakai contract-mode fallback.',
      }),
    )
    return
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bridgeToken ? { authorization: `Bearer ${bridgeToken}` } : {}),
      },
      body: JSON.stringify({
        jobId,
        source: 'gerai-app',
        schema: 'gerai-agent-output-v1',
        payload,
      }),
    })

    const text = await upstream.text()
    let body = {}
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }

    res.writeHead(upstream.ok ? 202 : upstream.status, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'webhook',
        status: upstream.ok ? 'accepted' : 'upstream_error',
        jobId,
        upstreamStatus: upstream.status,
        upstream: body,
      }),
    )
  } catch (error) {
    res.writeHead(502, jsonHeaders)
    res.end(
      JSON.stringify({
        mode: 'webhook',
        status: 'bridge_error',
        jobId,
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
    )
  }
}

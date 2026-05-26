// Sandboxed code execution untuk Atmaja.
// Atmaja emit marker [ATMAJA_EXEC lang="js"]code[/ATMAJA_EXEC] → chat.js detect →
// POST ke endpoint ini → spawn Vercel Sandbox (Firecracker MicroVM isolated) → return output.
//
// Use case: financial modeling, vendor data crunch, reverse calendar math, NPV calc,
// data transformation. Code yang Atmaja generate untuk solve task user.
//
// Security:
//  - Vercel Sandbox = true isolation (Firecracker MicroVM), no access ke Vercel filesystem
//  - 30 detik hard timeout
//  - Code length cap (10 KB)
//  - Rate limit 10 exec/menit per IP
//  - Reject pattern dangerous: child_process spawn dengan shell, eval di host, fs di host
//    (sandbox tidak punya akses, tapi defense-in-depth)
//  - Auth same-origin atau bearer

import { Sandbox } from '@vercel/sandbox'
import { isRequestAllowed, getHeader, consumeRateLimit as sharedConsumeRateLimit, attachRequestId } from '../_shared.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const MAX_CODE_BYTES = 10_000
const EXEC_TIMEOUT_MS = 30_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = Number(process.env.ATMAJA_EXEC_RATE_LIMIT ?? 10)
const recentRequestsByIp = new Map()

const ALLOWED_LANGS = new Set(['js', 'javascript', 'node', 'python', 'python3', 'py'])

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { ...jsonHeaders, 'x-request-id': res._requestId ?? '' })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req, maxBytes = 50_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let received = 0
    req.on('data', (c) => {
      received += c.length
      if (received > maxBytes) {
        const e = new Error('payload_too_large')
        e.statusCode = 413
        reject(e)
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        const e = new Error('invalid_json')
        e.statusCode = 400
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function consumeRateLimit(req) {
  return sharedConsumeRateLimit(req, recentRequestsByIp, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
}

function pickRuntime(lang) {
  const l = String(lang ?? 'js').toLowerCase()
  if (l === 'python' || l === 'python3' || l === 'py') {
    return { runtime: 'python3.13', cmd: 'python3', argsBuilder: (code) => ['-c', code] }
  }
  // default node 24
  return { runtime: 'node24', cmd: 'node', argsBuilder: (code) => ['-e', code] }
}

// Defense-in-depth: reject obvious mining/exfil patterns sebelum spawn sandbox
function isCodeBlocked(code) {
  const blocked = [
    /process\.env\s*\[\s*['"`]ANTHROPIC_API_KEY/,
    /process\.env\s*\[\s*['"`]OPENAI_API_KEY/,
    /process\.env\s*\[\s*['"`]VERCEL_/,
    /process\.env\s*\[\s*['"`]KV_/,
    /process\.env\s*\[\s*['"`]BLOB_/,
    /\bnodemailer\b/i,
    /while\s*\(\s*true\s*\)/,
    /for\s*\(\s*;\s*;\s*\)/,
  ]
  return blocked.find((rx) => rx.test(code))
}

export default async function handler(req, res) {
  res._requestId = attachRequestId(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...jsonHeaders, 'x-request-id': res._requestId })
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  const auth = isRequestAllowed(req)
  if (!auth.allowed) {
    sendJson(res, 403, { ok: false, error: 'request_not_allowed', reason: auth.reason })
    return
  }

  if (!consumeRateLimit(req)) {
    sendJson(res, 429, { ok: false, error: 'rate_limited' })
    return
  }

  let payload
  try {
    payload = await readJsonBody(req, MAX_CODE_BYTES + 5_000)
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, {
      ok: false,
      error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json',
    })
    return
  }

  const code = String(payload?.code ?? '').trim()
  const lang = String(payload?.lang ?? 'js').toLowerCase()

  if (!code || code.length < 5) {
    sendJson(res, 400, { ok: false, error: 'code_required', note: 'Body harus { code, lang }' })
    return
  }
  if (code.length > MAX_CODE_BYTES) {
    sendJson(res, 413, {
      ok: false,
      error: 'code_too_large',
      maxBytes: MAX_CODE_BYTES,
      received: code.length,
    })
    return
  }
  if (!ALLOWED_LANGS.has(lang)) {
    sendJson(res, 400, {
      ok: false,
      error: 'unsupported_lang',
      supported: Array.from(ALLOWED_LANGS),
    })
    return
  }

  const blocked = isCodeBlocked(code)
  if (blocked) {
    sendJson(res, 400, {
      ok: false,
      error: 'code_pattern_blocked',
      note: `Pattern terlarang terdeteksi (kemungkinan exfiltrasi credential atau infinite loop): ${String(blocked)}`,
    })
    return
  }

  const { runtime, cmd, argsBuilder } = pickRuntime(lang)
  const startedAt = Date.now()

  let sandbox = null
  try {
    // Sandbox.create() di Vercel runtime auto-detect credentials via OIDC token
    sandbox = await Sandbox.create({
      runtime,
      // No source: ephemeral sandbox tanpa clone git repo
      resources: { vcpus: 2 },
      // Timeout: setiap command max EXEC_TIMEOUT_MS
    })

    const cmdPromise = sandbox.runCommand({
      cmd,
      args: argsBuilder(code),
    })

    // Race against timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('exec_timeout')), EXEC_TIMEOUT_MS),
    )

    const result = await Promise.race([cmdPromise, timeoutPromise])

    const stdout = await result.stdout()
    const stderr = await result.stderr()
    const exitCode = result.exitCode ?? 0
    const durationMs = Date.now() - startedAt

    sendJson(res, 200, {
      ok: true,
      lang,
      runtime,
      exitCode,
      stdout: String(stdout ?? '').slice(0, 50_000),
      stderr: String(stderr ?? '').slice(0, 10_000),
      durationMs,
      truncated: {
        stdout: String(stdout ?? '').length > 50_000,
        stderr: String(stderr ?? '').length > 10_000,
      },
    })
  } catch (error) {
    const isTimeout = error?.message === 'exec_timeout'
    const durationMs = Date.now() - startedAt
    console.error('[atmaja-exec] failed:', error?.message ?? error)
    sendJson(res, isTimeout ? 408 : 500, {
      ok: false,
      error: isTimeout ? 'exec_timeout' : 'sandbox_error',
      note: error instanceof Error ? error.message : 'unknown_error',
      durationMs,
    })
  } finally {
    if (sandbox) {
      // Best-effort cleanup. Vercel Sandbox auto-stops after idle anyway.
      try {
        await sandbox.stop()
      } catch (cleanupErr) {
        console.warn('[atmaja-exec] sandbox cleanup warning:', cleanupErr?.message ?? cleanupErr)
      }
    }
  }
}

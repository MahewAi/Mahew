// MCP Server Gerai 1000 Pintu — Phase 1 MVP
// Streamable HTTP transport untuk LibreChat integration.
// JSON-RPC 2.0 over POST.
//
// Endpoint: POST https://gerai.mahewwork.com/api/mcp
// Auth: Bearer token (N8N_WEBHOOK_TOKEN atau ATMAJA_BRIDGE_TOKEN)
//
// Tools exposed:
//   - consult_citra (CMO marketing)
//   - consult_wira (COO operations)
//   - consult_lestari (CCO brand)
//   - consult_aksa (CFO financial)
//   - alert_matthew (escalation visible di chat)
//   - log_decision (append decision summary, Phase 1 in-memory)
//
// Architecture:
//   LibreChat (Atmaja) → MCP tool call → this endpoint
//                       → buildSystemPromptFromAgent(role) → callLLM(model, messages)
//                       → return text response
//
// Spec reference: https://spec.modelcontextprotocol.io/specification/2024-11-05/

import { hasValidBearerToken } from '../_shared.js'
import { callLLM } from '../_providers/index.js'
import { AGENTS, buildSystemPromptFromAgent, listAgents } from '../_agents.js'

// MCP protocol version we support
const MCP_PROTOCOL_VERSION = '2024-11-05'

// Server metadata
const SERVER_INFO = {
  name: 'gerai-1000-pintu',
  version: '1.0.0',
  description: 'AI Department orchestration: consult Citra/Wira/Lestari/Aksa, alert Matthew, log decisions.',
}

// Tool definitions per MCP spec
const TOOLS = [
  {
    name: 'consult_citra',
    description: 'Konsultasi dengan Citra (CMO Marketing). Marketing positioning, channel mix, campaign angle, persona engagement, content calendar. Citra respond dengan output template structured: positioning thesis + audience segmentation + channel mix + creative angle + risk.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Pertanyaan / brief untuk Citra. Spesifik + actionable.',
        },
        context: {
          type: 'string',
          description: 'Context tambahan (opsional): hasil discussion sebelumnya, data, constraint Matthew, dll.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'consult_wira',
    description: 'Konsultasi dengan Wira (COO Operations). Vendor management, supply chain, SOP, Lean Store 2-staf, Door Expert, capacity planning, logistics Jawa-Kaltim. Wira respond dengan output template: operational implications + vendor risk + capacity check + SOP gap + recommendation.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Pertanyaan / brief untuk Wira. Spesifik + actionable.',
        },
        context: {
          type: 'string',
          description: 'Context tambahan (opsional).',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'consult_lestari',
    description: 'Konsultasi dengan Lestari (CCO Creative). Brand canon, narrative, visual identity, copywriting, brand audit. Lestari respond dengan output template: narrative core + visual direction + creative pillars + brand risk + recommendation. Selalu enforce hard rules canon (no em-dash, "tempat" not "rumah", "Gerai 1000 Pintu" lengkap).',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Pertanyaan / brief untuk Lestari.',
        },
        context: {
          type: 'string',
          description: 'Context tambahan (opsional): draft copy yang perlu di-audit, dll.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'consult_aksa',
    description: 'Konsultasi dengan Aksa (CFO Finance). Unit economics, runway, pricing, capex, ROI, scenario analysis. Aksa respond dengan output template: unit economics + cash runway scenario + capital allocation + financial risk solo founder + recommendation angka konkret.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Pertanyaan / brief untuk Aksa. Sebut angka kalau ada.',
        },
        context: {
          type: 'string',
          description: 'Context tambahan (opsional): financial data, budget constraint, dll.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'alert_matthew',
    description: 'Trigger alert ke Matthew. Pakai saat detect critical issue (brand canon LOCKED violation, financial red flag, operational blocker). Alert akan visible di response Atmaja sebagai warning section.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['info', 'warning', 'critical'],
          description: 'Level severity. critical = need Matthew immediate review.',
        },
        message: {
          type: 'string',
          description: 'Pesan alert yang Matthew harus baca. Concise + actionable.',
        },
        source: {
          type: 'string',
          description: 'Agent yang trigger alert (Citra/Wira/Lestari/Aksa/Atmaja).',
        },
      },
      required: ['severity', 'message', 'source'],
    },
  },
  {
    name: 'log_decision',
    description: 'Log final decision Atmaja ke vault Obsidian (Phase 1: return formatted summary untuk Matthew copy ke vault manual). Pakai saat Atmaja deliver final synthesis untuk strategic decision yang Matthew approve.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Judul decision (short, descriptive).',
        },
        brief: {
          type: 'string',
          description: 'Original brief Matthew yang trigger decision.',
        },
        perspectives: {
          type: 'object',
          description: 'Per-agent perspective summary. Key = role, value = key insight.',
          additionalProperties: { type: 'string' },
        },
        decision: {
          type: 'string',
          description: 'Final decision text + reasoning.',
        },
        action_items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Action steps + owner + deadline.',
        },
      },
      required: ['title', 'brief', 'decision'],
    },
  },
]

// ============================================================================
// MCP method handlers
// ============================================================================

function handleInitialize(params) {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {},
    },
    serverInfo: SERVER_INFO,
  }
}

function handleToolsList() {
  return { tools: TOOLS }
}

async function handleToolsCall(params) {
  const { name, arguments: args = {} } = params || {}

  if (!name) {
    throw new Error('tool_name_required')
  }

  // Map tool name → role
  const TOOL_TO_ROLE = {
    consult_citra: 'cmo',
    consult_wira: 'coo',
    consult_lestari: 'cco',
    consult_aksa: 'cfo',
  }

  if (TOOL_TO_ROLE[name]) {
    return await callConsultTool(TOOL_TO_ROLE[name], args)
  }

  if (name === 'alert_matthew') {
    return formatAlert(args)
  }

  if (name === 'log_decision') {
    return formatDecisionLog(args)
  }

  throw new Error('unknown_tool_' + name)
}

// ============================================================================
// Tool implementations
// ============================================================================

async function callConsultTool(role, args) {
  const { question, context = '' } = args
  if (!question || typeof question !== 'string') {
    throw new Error('question_required')
  }

  const agent = AGENTS[role]
  if (!agent) throw new Error('unknown_role_' + role)

  const systemPrompt = buildSystemPromptFromAgent(role, context)
  const userMessage = String(question).slice(0, 8000) // cap input

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  // Call via existing provider abstraction.
  // Opus 4.7 / Sonnet 4.6 thinking mode handled by anthropic.js adapter (temperature deprecation).
  let body
  try {
    const result = await callLLM({
      modelId: agent.model,
      messages,
      maxTokens: agent.max_tokens || 2500,
      // No temperature: anthropic.js akan omit otomatis untuk Opus 4.7.
      // Sonnet 4.6 thinking mode mungkin enabled, so let it default.
    })
    body = result.body
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `[${agent.display_name} ERROR] Provider call failed: ${err.message || String(err)}`,
        },
      ],
      isError: true,
    }
  }

  const responseText = extractText(body)

  return {
    content: [
      {
        type: 'text',
        text: `[${agent.display_name} | ${agent.title}]\n\n${responseText}`,
      },
    ],
  }
}

function formatAlert(args) {
  const { severity, message, source } = args
  const sevIcon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : 'ℹ️'
  const sevLabel = String(severity || 'info').toUpperCase()

  return {
    content: [
      {
        type: 'text',
        text: `${sevIcon} **MATTHEW ALERT [${sevLabel}]** — Source: ${source}\n\n${message}\n\n_Disampaikan via MCP alert_matthew. Atmaja harus include alert ini di response final ke Matthew._`,
      },
    ],
  }
}

function formatDecisionLog(args) {
  const { title, brief, perspectives = {}, decision, action_items = [] } = args
  const now = new Date().toISOString()
  const slug = String(title || 'decision').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)

  const perspectivesText = Object.entries(perspectives)
    .map(([role, insight]) => `- **${role}**: ${insight}`)
    .join('\n')

  const actionsText = action_items.length > 0
    ? action_items.map((a, i) => `${i + 1}. ${a}`).join('\n')
    : '_(belum ada action items spesifik)_'

  const vaultPath = `gerai-memory/04-decisions/${now.slice(0, 10)}-${slug}.md`

  const decisionMarkdown = `# Decision: ${title}

**Date:** ${now}
**Logged via:** Atmaja MCP log_decision

## Brief Matthew
${brief}

## C-Level Perspectives
${perspectivesText || '_(no perspectives recorded)_'}

## Atmaja Final Decision
${decision}

## Action Items
${actionsText}

---
_Auto-generated. Append to vault: \`${vaultPath}\` (Phase 1 manual copy. Phase 2 auto-write via GitHub API.)_
`

  return {
    content: [
      {
        type: 'text',
        text: `📝 **Decision Logged** — siap di-append ke vault.\n\nPath suggestion: \`${vaultPath}\`\n\n---\n\n${decisionMarkdown}\n\n---\n\n_Atmaja: kasih ini ke Matthew untuk copy-paste ke vault. Phase 2 akan auto-write via GitHub API._`,
      },
    ],
  }
}

// ============================================================================
// Helpers
// ============================================================================

function extractText(adaptedBody) {
  if (!adaptedBody) return '[no response body]'
  try {
    const content = adaptedBody?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) return content
    if (Array.isArray(content)) {
      return content
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('')
    }
    return JSON.stringify(adaptedBody).slice(0, 500)
  } catch (e) {
    return `[extract_error: ${e.message || String(e)}]`
  }
}

function jsonRpcSuccess(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id, code, message, data = undefined) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id: id ?? null, error }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  res.setHeader('access-control-allow-headers', 'authorization, content-type')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let bytes = 0
    const MAX_BYTES = 1_000_000 // 1MB cap for MCP requests
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BYTES) {
        reject(new Error('body_too_large'))
        req.destroy()
        return
      }
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

// ============================================================================
// HTTP handler (Vercel serverless function entry)
// ============================================================================

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'authorization, content-type')
    res.end()
    return
  }

  // GET → info endpoint (untuk debug / health check)
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      server: SERVER_INFO,
      protocol_version: MCP_PROTOCOL_VERSION,
      tools_count: TOOLS.length,
      tools: TOOLS.map((t) => t.name),
      agents: listAgents(),
      hint: 'POST JSON-RPC 2.0 envelope ke endpoint ini. Methods: initialize, tools/list, tools/call.',
    })
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, jsonRpcError(null, -32600, 'method_not_allowed'))
  }

  // Auth
  if (!hasValidBearerToken(req)) {
    return sendJson(res, 401, jsonRpcError(null, -32001, 'unauthorized', {
      hint: 'Bearer token required. Set Authorization header.',
    }))
  }

  // Parse body
  let envelope
  try {
    envelope = await readBody(req)
  } catch (err) {
    return sendJson(res, 400, jsonRpcError(null, -32700, 'parse_error', { detail: err.message }))
  }

  // Validate JSON-RPC envelope
  if (envelope?.jsonrpc !== '2.0' || !envelope?.method) {
    return sendJson(res, 400, jsonRpcError(envelope?.id ?? null, -32600, 'invalid_request', {
      hint: 'Expected JSON-RPC 2.0 envelope with method field.',
    }))
  }

  const { id, method, params = {} } = envelope

  try {
    let result
    switch (method) {
      case 'initialize':
        result = handleInitialize(params)
        break
      case 'tools/list':
        result = handleToolsList()
        break
      case 'tools/call':
        result = await handleToolsCall(params)
        break
      case 'notifications/initialized':
        // Client notification (no response needed for notifications)
        res.statusCode = 204
        res.end()
        return
      default:
        return sendJson(res, 200, jsonRpcError(id, -32601, 'method_not_found', { method }))
    }
    return sendJson(res, 200, jsonRpcSuccess(id, result))
  } catch (err) {
    return sendJson(res, 200, jsonRpcError(id, -32000, 'server_error', {
      detail: err.message || String(err),
      method,
    }))
  }
}

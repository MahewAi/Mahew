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

import { hasValidBearerToken } from './_shared.js'
import { callLLM } from './_providers/index.js'
import { AGENTS, buildSystemPromptFromAgent, listAgents } from './_agents.js'

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

  // ===========================================================================
  // PHASE 2: MEMORY TOOLS (vault Obsidian gerai-memory)
  // ===========================================================================

  {
    name: 'list_vault_sections',
    description: 'List semua section folder di vault Obsidian gerai-memory. Atmaja pakai ini untuk overview struktur memory yang available. Return: 12 sections (00-founding, 01-matthew, 02-customers, 03-projects, 04-konsultasi, 05-decisions, 06-patterns, 07-vendor, 08-team, 09-risk, 10-knowledge, 11-skill-catalog).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_vault_files',
    description: 'List markdown files di section vault tertentu. Pakai sebelum read_vault_file untuk discover apa yang available. Contoh section: "05-decisions" untuk decision history, "00-founding" untuk BP core docs, "06-patterns" untuk recurring patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Section folder name (e.g., "05-decisions", "00-founding", "06-patterns").',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'read_vault_file',
    description: 'Baca content markdown file di vault Obsidian. Pakai untuk reference founding docs, past decisions, patterns, customer notes. Path format: "{section}/{filename}.md" (e.g., "00-founding/brand-canon.md", "05-decisions/2026-05-29-samarinda-q3-decision.md").',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Vault path relatif (e.g., "05-decisions/wave-1-channel-strategy.md").',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_vault',
    description: 'Search vault Obsidian by keyword. Simple text match across all .md files. Pakai saat butuh refer past content tapi gak tau exact file. Return: list matching files dengan snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (case-insensitive). Spesifik lebih baik daripada generic.',
        },
        section: {
          type: 'string',
          description: 'Optional: limit search to specific section. Kosong = search semua sections.',
        },
      },
      required: ['query'],
    },
  },

  // ===========================================================================
  // WEB SEARCH (Tavily API)
  // ===========================================================================

  {
    name: 'web_search',
    description: 'Web search via Tavily. AI-optimized response format. Pakai saat butuh data live: market trend, kompetitor terbaru, kurs/inflation, KOL Instagram metrics, industry intelligence (HDII, IAI, ArchDaily), atau verify claim. JANGAN pakai untuk brand canon, decision history, persona detail, C-level consult (pakai vault atau consult tools instead). Free tier: 1000 search/bulan.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (Indonesia atau English). Spesifik lebih baik daripada generic.',
        },
        max_results: {
          type: 'integer',
          description: 'Number of top results (1-10). Default 5.',
        },
        include_answer: {
          type: 'boolean',
          description: 'Include Tavily AI-synthesized answer (recommended true). Default true.',
        },
      },
      required: ['query'],
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

  // Phase 2 memory tools (vault Obsidian access via GitHub API)
  if (name === 'list_vault_sections') {
    return listVaultSections()
  }
  if (name === 'list_vault_files') {
    return await listVaultFiles(args)
  }
  if (name === 'read_vault_file') {
    return await readVaultFile(args)
  }
  if (name === 'search_vault') {
    return await searchVault(args)
  }

  // Web search via Tavily
  if (name === 'web_search') {
    return await webSearch(args)
  }

  throw new Error('unknown_tool_' + name)
}

// ============================================================================
// WEB SEARCH (Tavily API)
// ============================================================================

async function webSearch(args) {
  const query = String(args?.query || '').trim()
  if (!query) throw new Error('query_required')

  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return {
      content: [{ type: 'text', text: '[Web Search Error] TAVILY_API_KEY not configured di Vercel env vars. Matthew add API key dulu (signup tavily.com).' }],
      isError: true,
    }
  }

  const maxResults = Math.min(Math.max(Number(args?.max_results) || 5, 1), 10)
  const includeAnswer = args?.include_answer !== false

  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: includeAnswer,
        include_raw_content: false,
        include_images: false,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return {
        content: [{ type: 'text', text: `[Web Search Error] Tavily API ${resp.status}: ${errText.slice(0, 300)}` }],
        isError: true,
      }
    }

    const data = await resp.json()

    let output = `[Web Search: "${query}"]\n\n`

    if (data.answer && includeAnswer) {
      output += `**AI Answer:**\n${data.answer}\n\n---\n\n`
    }

    if (Array.isArray(data.results) && data.results.length > 0) {
      output += `**Sources (${data.results.length}):**\n\n`
      output += data.results
        .map((r, i) => {
          const title = r.title || 'Untitled'
          const url = r.url || ''
          const content = (r.content || '').slice(0, 300)
          const score = typeof r.score === 'number' ? ` (score: ${r.score.toFixed(2)})` : ''
          return `${i + 1}. **${title}**${score}\n   ${url}\n   > ${content}${r.content && r.content.length > 300 ? '...' : ''}`
        })
        .join('\n\n')
    } else {
      output += '_(no results)_'
    }

    output += `\n\n_Tavily search ${resp.status} OK._`

    return {
      content: [{ type: 'text', text: output }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Web Search Error] ${err.message || String(err)}` }],
      isError: true,
    }
  }
}

// ============================================================================
// PHASE 2: Vault Obsidian access (GitHub API)
// ============================================================================

const VAULT_REPO = 'MahewAi/gerai-memory'
const VAULT_BRANCH = 'main'
const VAULT_SECTIONS = [
  { name: '00-founding', desc: 'LOCKED founding knowledge: brand canon, vision, 5 nilai, filosofi Dunia Pintu' },
  { name: '01-matthew', desc: 'Matthew profile, communication style, decision patterns, preferences' },
  { name: '02-customers', desc: 'Customer personas: End User, Arsitek, Kontraktor, Developer, Procurement Korporat, Aplikator' },
  { name: '03-projects', desc: 'Active projects (Wave 1 launch, vendor sourcing, dll)' },
  { name: '04-konsultasi', desc: 'Konsultasi records dengan customer / partner' },
  { name: '05-decisions', desc: 'Past strategic decisions, recommended, executed, accepted/declined' },
  { name: '06-patterns', desc: 'Recurring patterns identified, recurring questions, decision frameworks' },
  { name: '07-vendor', desc: 'Vendor relationships, PO history, payment terms, QC notes' },
  { name: '08-team', desc: 'Team members, hiring, performance, roles' },
  { name: '09-risk', desc: 'Risk register, mitigation strategies, contingencies' },
  { name: '10-knowledge', desc: 'External knowledge: industry research, competitor intel, market data' },
  { name: '11-skill-catalog', desc: 'Reference: skill catalog dari repo librechat-deploy/skills/ (122 skills)' },
]

function listVaultSections() {
  return {
    content: [
      {
        type: 'text',
        text: `[Vault Sections]\n\n${VAULT_SECTIONS.map(s => `- **${s.name}**: ${s.desc}`).join('\n')}\n\n_Total 12 sections. Pakai list_vault_files(section) untuk lihat files di section tertentu._`,
      },
    ],
  }
}

async function githubFetch(path) {
  const pat = process.env.GITHUB_VAULT_PAT
  if (!pat) {
    throw new Error('github_vault_pat_not_configured')
  }
  const url = `https://api.github.com/repos/${VAULT_REPO}/contents/${path}?ref=${VAULT_BRANCH}`
  const resp = await fetch(url, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'gerai-mcp-server/1.0',
    },
  })
  if (!resp.ok) {
    throw new Error(`github_api_${resp.status}: ${path}`)
  }
  return resp.json()
}

async function listVaultFiles(args) {
  const section = String(args?.section || '').replace(/^\/+|\/+$/g, '')
  if (!section) throw new Error('section_required')

  const validSections = VAULT_SECTIONS.map(s => s.name)
  if (!validSections.includes(section)) {
    return {
      content: [{ type: 'text', text: `[Error] Section "${section}" not found. Valid: ${validSections.join(', ')}` }],
      isError: true,
    }
  }

  try {
    const listing = await githubFetch(section)
    const mdFiles = listing
      .filter(item => item.type === 'file' && item.name.endsWith('.md'))
      .map(item => `- ${section}/${item.name} (${item.size} bytes)`)

    return {
      content: [
        {
          type: 'text',
          text: `[Vault ${section}]\n\n${mdFiles.length > 0 ? mdFiles.join('\n') : '_(no markdown files)_'}\n\n_${mdFiles.length} files. Pakai read_vault_file(path) untuk full content._`,
        },
      ],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Vault Error] ${err.message}` }],
      isError: true,
    }
  }
}

async function readVaultFile(args) {
  const path = String(args?.path || '').replace(/^\/+|\/+$/g, '')
  if (!path) throw new Error('path_required')
  if (!path.endsWith('.md')) {
    return {
      content: [{ type: 'text', text: `[Error] Path must end with .md: ${path}` }],
      isError: true,
    }
  }

  try {
    const file = await githubFetch(path)
    if (file.type !== 'file') {
      throw new Error(`not_a_file: ${path}`)
    }
    // GitHub API returns base64-encoded content
    const content = Buffer.from(file.content, 'base64').toString('utf8')
    return {
      content: [
        {
          type: 'text',
          text: `[Vault: ${path}]\n\n${content}`,
        },
      ],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Vault Error reading ${path}] ${err.message}` }],
      isError: true,
    }
  }
}

async function searchVault(args) {
  const query = String(args?.query || '').toLowerCase()
  const sectionFilter = String(args?.section || '').replace(/^\/+|\/+$/g, '')
  if (!query) throw new Error('query_required')

  const sectionsToSearch = sectionFilter
    ? [sectionFilter]
    : VAULT_SECTIONS.map(s => s.name)

  const matches = []
  const MAX_FILES_PER_SECTION = 10
  const MAX_MATCHES = 15

  try {
    for (const section of sectionsToSearch) {
      if (matches.length >= MAX_MATCHES) break

      let listing
      try {
        listing = await githubFetch(section)
      } catch {
        continue
      }
      if (!Array.isArray(listing)) continue

      const mdFiles = listing
        .filter(item => item.type === 'file' && item.name.endsWith('.md'))
        .slice(0, MAX_FILES_PER_SECTION)

      for (const file of mdFiles) {
        if (matches.length >= MAX_MATCHES) break
        try {
          const fileData = await githubFetch(`${section}/${file.name}`)
          const content = Buffer.from(fileData.content, 'base64').toString('utf8')
          const lowerContent = content.toLowerCase()

          if (lowerContent.includes(query)) {
            // Extract snippet around first match
            const idx = lowerContent.indexOf(query)
            const start = Math.max(0, idx - 80)
            const end = Math.min(content.length, idx + query.length + 200)
            const snippet = content.slice(start, end).trim()
            matches.push({
              path: `${section}/${file.name}`,
              snippet: snippet.length < content.length ? `...${snippet}...` : snippet,
            })
          }
        } catch {
          continue
        }
      }
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Vault Search Error] ${err.message}` }],
      isError: true,
    }
  }

  if (matches.length === 0) {
    return {
      content: [{ type: 'text', text: `[Vault Search] No matches for "${query}"${sectionFilter ? ` in ${sectionFilter}` : ''}.` }],
    }
  }

  const matchesText = matches
    .map((m, i) => `**${i + 1}. \`${m.path}\`**\n\n> ${m.snippet}`)
    .join('\n\n---\n\n')

  return {
    content: [
      {
        type: 'text',
        text: `[Vault Search: "${query}"]\n\nFound ${matches.length} match${matches.length > 1 ? 'es' : ''}${sectionFilter ? ` in ${sectionFilter}` : ''}.\n\n${matchesText}\n\n_Pakai read_vault_file(path) untuk full content._`,
      },
    ],
  }
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
// HTTP handler. Exported untuk dipanggil dari api/agent/reply.js (file underscore
// gak jadi route Vercel, tapi tetap importable. Vercel rewrites /api/mcp ke
// /api/agent/reply yang dispatch ke sini berdasarkan query param ?type=mcp).
// ============================================================================

export async function handleMcpRequest(req, res) {
  const startTime = Date.now()
  const reqId = Math.random().toString(36).slice(2, 8)

  // Comprehensive request logging (Vercel auto-captures console)
  console.log(`[MCP ${reqId}] ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    headers: {
      authorization: req.headers?.authorization ? 'Bearer [REDACTED]' : 'MISSING',
      'content-type': req.headers?.['content-type'],
      accept: req.headers?.accept,
      'mcp-session-id': req.headers?.['mcp-session-id'],
      'user-agent': req.headers?.['user-agent'],
    },
  })

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS')
    res.setHeader('access-control-allow-headers', 'authorization, content-type, mcp-session-id, mcp-protocol-version')
    res.setHeader('access-control-expose-headers', 'mcp-session-id')
    res.end()
    console.log(`[MCP ${reqId}] OPTIONS preflight (${Date.now() - startTime}ms)`)
    return
  }

  // GET → info endpoint (untuk debug / health check)
  if (req.method === 'GET') {
    console.log(`[MCP ${reqId}] GET info endpoint`)
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
    console.log(`[MCP ${reqId}] method_not_allowed: ${req.method}`)
    return sendJson(res, 405, jsonRpcError(null, -32600, 'method_not_allowed'))
  }

  // Auth
  if (!hasValidBearerToken(req)) {
    console.log(`[MCP ${reqId}] unauthorized: bearer missing or invalid`)
    return sendJson(res, 401, jsonRpcError(null, -32001, 'unauthorized', {
      hint: 'Bearer token required. Set Authorization header.',
    }))
  }

  // Parse body
  let envelope
  try {
    envelope = await readBody(req)
  } catch (err) {
    console.log(`[MCP ${reqId}] parse_error:`, err.message)
    return sendJson(res, 400, jsonRpcError(null, -32700, 'parse_error', { detail: err.message }))
  }

  // Validate JSON-RPC envelope
  if (envelope?.jsonrpc !== '2.0' || !envelope?.method) {
    console.log(`[MCP ${reqId}] invalid_request:`, JSON.stringify(envelope).slice(0, 200))
    return sendJson(res, 400, jsonRpcError(envelope?.id ?? null, -32600, 'invalid_request', {
      hint: 'Expected JSON-RPC 2.0 envelope with method field.',
    }))
  }

  const { id, method, params = {} } = envelope
  console.log(`[MCP ${reqId}] method=${method} id=${id} params=`, JSON.stringify(params).slice(0, 300))

  try {
    // Handle notifications (no response per JSON-RPC 2.0).
    // MCP Streamable HTTP spec: respond with 202 Accepted, empty body.
    if (method.startsWith('notifications/')) {
      console.log(`[MCP ${reqId}] notification handled (${Date.now() - startTime}ms)`)
      res.statusCode = 202
      res.setHeader('access-control-allow-origin', '*')
      res.end()
      return
    }

    let result
    switch (method) {
      case 'initialize':
        result = handleInitialize(params)
        break
      case 'ping':
        // MCP spec keep-alive. Server respond dengan empty result {}.
        result = {}
        break
      case 'tools/list':
        result = handleToolsList()
        break
      case 'tools/call':
        console.log(`[MCP ${reqId}] dispatching tools/call to: ${params?.name}`)
        result = await handleToolsCall(params)
        console.log(`[MCP ${reqId}] tools/call ${params?.name} completed (${Date.now() - startTime}ms)`)
        break
      case 'resources/list':
        // We don't expose resources, return empty list
        result = { resources: [] }
        break
      case 'prompts/list':
        // We don't expose prompts, return empty list
        result = { prompts: [] }
        break
      case 'completion/complete':
        // We don't support argument autocompletion
        result = { completion: { values: [], total: 0, hasMore: false } }
        break
      case 'logging/setLevel':
        // Accept any log level setting
        result = {}
        break
      default:
        console.log(`[MCP ${reqId}] method_not_found: ${method}`)
        return sendJson(res, 200, jsonRpcError(id, -32601, 'method_not_found', { method }))
    }

    console.log(`[MCP ${reqId}] success ${method} (${Date.now() - startTime}ms)`)
    return sendJson(res, 200, jsonRpcSuccess(id, result))
  } catch (err) {
    console.log(`[MCP ${reqId}] server_error in ${method}:`, err.message, err.stack?.slice(0, 300))
    return sendJson(res, 200, jsonRpcError(id, -32000, 'server_error', {
      detail: err.message || String(err),
      method,
    }))
  }
}

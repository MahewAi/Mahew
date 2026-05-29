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

  // ===========================================================================
  // DOCUMENT GENERATION (HTML, browser-printable to PDF)
  // ===========================================================================

  {
    name: 'generate_document',
    description: 'Generate styled HTML document dengan brand canon (palette The Timeless Foundation). Simpan di KV, return URL. Matthew open URL → browser print (Ctrl+P) → save as PDF. Pakai saat Matthew butuh deliverable LINEAR: executive brief, decision document, proposal, report, meeting notes. Content input: markdown. UNTUK architectural map / org-chart visual (4-level hierarchy multi-kolom), pakai generate_architecture_map.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Document title (akan jadi h1 dan filename).',
        },
        content_markdown: {
          type: 'string',
          description: 'Document content in markdown. Support: headings (#/##), bold/italic, lists, tables, code, blockquotes, links. Akan render dengan brand canon styling (Brass gold + Deep charcoal + Warm ivory).',
        },
      },
      required: ['title', 'content_markdown'],
    },
  },

  {
    name: 'generate_architecture_map',
    description: 'Generate VISUAL architecture map (org-chart / tree diagram style) dengan format hirarki 4-level: SEKTOR (banner) → SUB-AREA (kolom sejajar) → KERJAAN (block) → TASK (bullet). Landscape layout, 1 sektor per halaman, brand canon palette. Match format "Foundation Phase" Matthew. Pakai saat Matthew butuh peta arsitektur/struktur tim/roadmap visual yang multi-kolom (BUKAN dokumen linear). Output: URL → browser print landscape → PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Judul utama (e.g., "Architectural Model Gerai 1000 Pintu v25").',
        },
        subtitle: {
          type: 'string',
          description: 'Subtitle (e.g., "Foundation Phase, evolusi dari v24"). Optional.',
        },
        footer_label: {
          type: 'string',
          description: 'Label footer tiap halaman (e.g., "Gerai 1000 Pintu , Foundation Phase (Pre-Launch)"). Optional, default brand.',
        },
        intro_notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bullet notes di cover page (e.g., penjelasan format, list sektor, perubahan vs versi sebelumnya). Optional.',
        },
        sectors: {
          type: 'array',
          description: 'Array sektor (Level 0). Tiap sektor jadi 1 halaman dengan banner + kolom sub-area.',
          items: {
            type: 'object',
            properties: {
              number: { type: 'string', description: 'Nomor sektor (e.g., "01").' },
              name: { type: 'string', description: 'Nama sektor (e.g., "MARKETING & DISTRIBUSI").' },
              meta: { type: 'string', description: 'Meta info optional (e.g., "Owner: CMO (Citra) | Timeline: Juni-Agustus").' },
              sub_areas: {
                type: 'array',
                description: 'Sub-area (Level 1) = kolom sejajar dalam sektor.',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nama sub-area (header kolom).' },
                    kerjaan: {
                      type: 'array',
                      description: 'Kerjaan (Level 2) dalam sub-area ini.',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', description: 'Nama kerjaan (bold).' },
                          tasks: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Task (Level 3) bullet points. Boleh pakai prefix "> " untuk sub-task indent.',
                          },
                        },
                        required: ['name'],
                      },
                    },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['number', 'name', 'sub_areas'],
          },
        },
      },
      required: ['title', 'sectors'],
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

  // Document generation (HTML, browser-printable to PDF)
  if (name === 'generate_document') {
    return await generateDocument(args)
  }

  // Architecture map (visual multi-column 4-level hierarchy)
  if (name === 'generate_architecture_map') {
    return await generateArchitectureMap(args)
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

// ============================================================================
// DOCUMENT GENERATION (markdown → styled HTML → Vercel Blob)
// ============================================================================

async function generateDocument(args) {
  const title = String(args?.title || 'Document').slice(0, 200)
  const content = String(args?.content_markdown || '')
  if (!content) throw new Error('content_markdown_required')

  // Lazy import: marked + @vercel/kv
  // KV (bukan Blob) supaya gak bentrok dengan private Blob store (BP + memory files).
  // Document HTML disimpan di KV dengan TTL 7 hari, di-serve via /api/doc rewrite.
  let marked, kv
  try {
    const markedModule = await import('marked')
    marked = markedModule.marked || markedModule.default
    const kvModule = await import('@vercel/kv')
    kv = kvModule.kv
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Document Gen Error] Dependencies missing: ${err.message}. Run "npm install" + redeploy.` }],
      isError: true,
    }
  }

  try {
    // Parse markdown → HTML
    const bodyHtml = marked.parse(content, { gfm: true, breaks: false })

    // Wrap dengan styled template (brand canon palette: Brass gold + Deep charcoal + Warm ivory)
    const styledHtml = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --brass: #B8956B;
    --charcoal: #1F1A14;
    --ivory: #FAF8F4;
    --muted: #6b6357;
    --border: #e8e3d8;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--ivory); }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: var(--charcoal);
    line-height: 1.65;
    font-size: 16px;
  }
  .doc {
    max-width: 820px;
    margin: 40px auto;
    padding: 60px 50px;
    background: white;
    border: 1px solid var(--border);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .doc-header {
    border-bottom: 2px solid var(--brass);
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  .doc-brand {
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--brass);
    font-weight: 600;
    margin-bottom: 8px;
  }
  .doc-title {
    margin: 0;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 32px;
    font-weight: 700;
    color: var(--charcoal);
    line-height: 1.25;
  }
  .doc-meta {
    margin-top: 12px;
    color: var(--muted);
    font-size: 13px;
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 700; color: var(--charcoal); margin-top: 30px; margin-bottom: 12px; line-height: 1.3; }
  h1 { font-size: 26px; }
  h2 { font-size: 22px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  h3 { font-size: 18px; color: var(--brass); }
  h4 { font-size: 16px; }
  p { margin: 12px 0; }
  a { color: var(--brass); text-decoration: none; border-bottom: 1px solid var(--brass); }
  a:hover { background: var(--ivory); }
  strong { color: var(--charcoal); font-weight: 700; }
  em { font-style: italic; color: var(--muted); }
  ul, ol { padding-left: 22px; margin: 12px 0; }
  li { margin: 6px 0; }
  code { background: var(--ivory); padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 0.9em; color: var(--charcoal); }
  pre { background: var(--charcoal); color: var(--ivory); padding: 16px 20px; overflow-x: auto; border-radius: 4px; }
  pre code { background: transparent; color: var(--ivory); padding: 0; }
  blockquote { border-left: 3px solid var(--brass); padding: 4px 16px; margin: 16px 0; color: var(--muted); font-style: italic; background: var(--ivory); }
  blockquote p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid var(--border); padding: 10px 14px; text-align: left; }
  th { background: var(--ivory); font-weight: 700; color: var(--charcoal); }
  tr:nth-child(even) td { background: rgba(250, 248, 244, 0.4); }
  hr { border: none; border-top: 1px solid var(--border); margin: 30px 0; }
  img { max-width: 100%; height: auto; }
  .doc-footer {
    margin-top: 50px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
  @media print {
    body { background: white; }
    .doc { box-shadow: none; border: none; margin: 0; max-width: none; padding: 30px 40px; }
  }
</style>
</head>
<body>
  <div class="doc">
    <header class="doc-header">
      <div class="doc-brand">Gerai 1000 Pintu , AI Department</div>
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      <div class="doc-meta">Generated ${new Date().toISOString().slice(0, 10)} via Atmaja</div>
    </header>
    <main>${bodyHtml}</main>
    <footer class="doc-footer">
      Brand canon LOCKED per BP Latest Section 15.1, The Timeless Foundation palette
    </footer>
  </div>
</body>
</html>`

    // Store di KV dengan TTL 7 hari (604800 detik). Serve via /api/doc rewrite.
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'doc'
    const rand = Math.abs(hashString(styledHtml + title)).toString(36).slice(0, 8)
    const docId = `${safeTitle}-${rand}`

    await kv.set(`doc:${docId}`, styledHtml, { ex: 604800 })

    const docUrl = `https://gerai.mahewwork.com/api/doc?id=${docId}`

    return {
      content: [
        {
          type: 'text',
          text: `📄 **Document Generated**\n\n**Title:** ${title}\n**URL:** ${docUrl}\n\n_Open URL di browser, lalu Ctrl+P (atau Cmd+P) untuk print. Pilih "Save as PDF" sebagai destination untuk export PDF._\n\n_Format: HTML dengan brand canon styling (The Timeless Foundation palette). Print-optimized. Tersimpan 7 hari._`,
        },
      ],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Document Gen Error] ${err.message || String(err)}` }],
      isError: true,
    }
  }
}

// ============================================================================
// ARCHITECTURE MAP (visual multi-column 4-level hierarchy → KV → /api/doc)
// ============================================================================

async function generateArchitectureMap(args) {
  const title = String(args?.title || 'Architecture Map').slice(0, 200)
  const subtitle = String(args?.subtitle || '')
  const footerLabel = String(args?.footer_label || 'Gerai 1000 Pintu , Foundation Phase')
  const introNotes = Array.isArray(args?.intro_notes) ? args.intro_notes : []
  const sectors = Array.isArray(args?.sectors) ? args.sectors : []

  if (sectors.length === 0) {
    return {
      content: [{ type: 'text', text: '[Architecture Map Error] sectors array kosong. Kirim minimal 1 sektor dengan sub_areas.' }],
      isError: true,
    }
  }

  let kv
  try {
    const kvModule = await import('@vercel/kv')
    kv = kvModule.kv
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Architecture Map Error] KV import failed: ${err.message}` }],
      isError: true,
    }
  }

  // Render task (support "> " prefix untuk sub-task indent)
  const renderTask = (task) => {
    const t = String(task || '')
    if (t.startsWith('> ')) {
      return `<li class="subtask">${escapeHtml(t.slice(2))}</li>`
    }
    return `<li>${escapeHtml(t)}</li>`
  }

  // Render kerjaan block
  const renderKerjaan = (k) => {
    const name = escapeHtml(String(k?.name || ''))
    const tasks = Array.isArray(k?.tasks) ? k.tasks : []
    const tasksHtml = tasks.length > 0
      ? `<ul class="tasks">${tasks.map(renderTask).join('')}</ul>`
      : ''
    return `<div class="kerjaan"><div class="kerjaan-name">${name}</div>${tasksHtml}</div>`
  }

  // Render sub-area column
  const renderSubArea = (sa) => {
    const name = escapeHtml(String(sa?.name || ''))
    const kerjaan = Array.isArray(sa?.kerjaan) ? sa.kerjaan : []
    const kerjaanHtml = kerjaan.map(renderKerjaan).join('')
    return `<div class="subarea"><div class="subarea-head">${name}</div>${kerjaanHtml}</div>`
  }

  // Render sektor page
  const renderSector = (s) => {
    const num = escapeHtml(String(s?.number || ''))
    const name = escapeHtml(String(s?.name || ''))
    const meta = s?.meta ? `<div class="sector-meta">${escapeHtml(String(s.meta))}</div>` : ''
    const subAreas = Array.isArray(s?.sub_areas) ? s.sub_areas : []
    const columnsHtml = subAreas.map(renderSubArea).join('')
    return `<section class="sector-page">
      <div class="sector-banner">
        <span class="sector-num">${num}</span>
        <span class="sector-name">${name}</span>
      </div>
      ${meta}
      <div class="columns">${columnsHtml}</div>
      <div class="page-footer">${escapeHtml(footerLabel)}</div>
    </section>`
  }

  const sectorsHtml = sectors.map(renderSector).join('')

  const introHtml = introNotes.length > 0
    ? `<div class="intro-box">${introNotes.map(n => `<div class="intro-line">${escapeHtml(String(n))}</div>`).join('')}</div>`
    : ''

  const styledHtml = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --brass: #B8956B;
    --charcoal: #1F1A14;
    --ivory: #FAF8F4;
    --muted: #6b6357;
    --border: #d8d2c4;
    --col-bg: #ffffff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--ivory); }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: var(--charcoal);
    font-size: 12px;
    line-height: 1.4;
  }

  /* Cover page */
  .cover {
    min-height: 90vh;
    padding: 80px 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
  }
  .cover-brand {
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--brass);
    font-weight: 600;
    margin-bottom: 16px;
  }
  .cover-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 42px;
    font-weight: 700;
    color: var(--charcoal);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .cover-subtitle {
    font-size: 16px;
    color: var(--muted);
    margin-bottom: 32px;
  }
  .intro-box {
    border-left: 3px solid var(--brass);
    background: white;
    padding: 20px 26px;
    max-width: 800px;
  }
  .intro-line {
    font-size: 13px;
    color: var(--charcoal);
    margin: 6px 0;
    line-height: 1.5;
  }

  /* Sector page */
  .sector-page {
    padding: 30px 36px 50px;
    page-break-after: always;
    position: relative;
    min-height: 90vh;
  }
  .sector-banner {
    background: var(--charcoal);
    color: var(--ivory);
    padding: 14px 28px;
    text-align: center;
    border-radius: 4px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .sector-num {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--brass);
  }
  .sector-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .sector-meta {
    text-align: center;
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 18px;
    font-style: italic;
  }

  /* Columns layout (sub-areas side by side) */
  .columns {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
  }
  .subarea {
    flex: 1 1 220px;
    min-width: 200px;
    max-width: 320px;
    background: var(--col-bg);
    border: 1px solid var(--border);
    border-top: 3px solid var(--brass);
    border-radius: 3px;
    padding: 14px 16px;
  }
  .subarea-head {
    font-size: 13px;
    font-weight: 700;
    color: var(--charcoal);
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .kerjaan {
    margin-bottom: 12px;
  }
  .kerjaan:last-child { margin-bottom: 0; }
  .kerjaan-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--brass);
    margin-bottom: 4px;
  }
  .tasks {
    list-style: none;
    padding-left: 2px;
  }
  .tasks li {
    font-size: 11px;
    color: var(--charcoal);
    padding-left: 14px;
    position: relative;
    margin: 3px 0;
    line-height: 1.35;
  }
  .tasks li::before {
    content: "•";
    color: var(--brass);
    position: absolute;
    left: 2px;
  }
  .tasks li.subtask {
    padding-left: 26px;
    color: var(--muted);
  }
  .tasks li.subtask::before {
    content: "▸";
    left: 14px;
    font-size: 9px;
  }

  .page-footer {
    position: absolute;
    bottom: 18px;
    left: 36px;
    right: 36px;
    text-align: center;
    font-size: 10px;
    color: var(--muted);
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }

  @page { size: A4 landscape; margin: 12mm; }
  @media print {
    body { background: white; }
    .cover, .sector-page { min-height: auto; }
    .subarea { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-brand">Gerai 1000 Pintu , AI Department</div>
    <h1 class="cover-title">${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="cover-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    ${introHtml}
  </div>
  ${sectorsHtml}
</body>
</html>`

  try {
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'map'
    const rand = Math.abs(hashString(styledHtml)).toString(36).slice(0, 8)
    const docId = `map-${safeTitle}-${rand}`

    await kv.set(`doc:${docId}`, styledHtml, { ex: 604800 })

    const docUrl = `https://gerai.mahewwork.com/api/doc?id=${docId}`

    return {
      content: [
        {
          type: 'text',
          text: `🗺️ **Architecture Map Generated**\n\n**Title:** ${title}\n**Sektor:** ${sectors.length} halaman\n**URL:** ${docUrl}\n\n_Open URL di browser. Layout LANDSCAPE multi-kolom (banner sektor + kolom sub-area + kerjaan + task). Ctrl+P → pilih "Landscape" orientation → "Save as PDF". Tersimpan 7 hari._`,
        },
      ],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `[Architecture Map Error] ${err.message || String(err)}` }],
      isError: true,
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Deterministic hash (no Math.random, supaya same content = same id, dedup-friendly).
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // 32-bit int
  }
  return hash
}

// ============================================================================
// DOCUMENT SERVING (dipanggil dari api/agent/reply.js saat ?type=doc&id=...)
// Fetch HTML dari KV, serve dengan content-type text/html.
// ============================================================================

export async function serveDocument(req, res) {
  let docId = ''
  try {
    const url = new URL(req.url, 'http://localhost')
    docId = url.searchParams.get('id') || ''
  } catch {}

  if (!docId || !/^[a-z0-9-]+$/i.test(docId)) {
    res.statusCode = 400
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('Invalid document id.')
    return
  }

  try {
    const kvModule = await import('@vercel/kv')
    const html = await kvModule.kv.get(`doc:${docId}`)

    if (!html) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#1F1A14"><h1>Document not found</h1><p>Dokumen ini sudah expired (TTL 7 hari) atau id salah. Minta Atmaja generate ulang.</p></body></html>')
      return
    }

    res.statusCode = 200
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', 'private, max-age=3600')
    res.end(html)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(`Document serve error: ${err.message || String(err)}`)
  }
}

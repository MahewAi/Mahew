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
import { randomBytes } from 'node:crypto'

// Secure unguessable doc ID: {type}-{128-bit random hex}. Capability-URL model
// (kayak Google Docs share link). Title TIDAK di-embed supaya URL gak bocorin content.
function genSecureId(prefix) {
  return `${prefix}-${randomBytes(16).toString('hex')}`
}

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

  // ===========================================================================
  // IMAGE GENERATION (OpenAI gpt-image-1)
  // ===========================================================================

  {
    name: 'generate_image',
    description: 'Generate gambar via AI (OpenAI gpt-image-1). Pakai untuk: konsep visual, mockup produk, social media image, moodboard, ilustrasi, logo concept draft. Return URL ke PNG. Sebutkan brand canon di prompt kalau perlu (palette Brass #B8956B + Charcoal #1F1A14 + Ivory #FAF8F4, premium tetapi inklusif).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Deskripsi gambar yang detail. Bahasa Inggris lebih bagus untuk image model. Include style, mood, composition, color.',
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1536', '1536x1024'],
          description: 'Ukuran. 1024x1024 square (default), 1024x1536 portrait, 1536x1024 landscape.',
        },
        quality: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Kualitas. medium default (balance speed+cost). high untuk final asset.',
        },
      },
      required: ['prompt'],
    },
  },

  // ===========================================================================
  // SLIDES (HTML deck, printable to PDF landscape)
  // ===========================================================================

  {
    name: 'generate_slides',
    description: 'Generate slide deck presentasi (HTML, brand canon styled). Pakai untuk: pitch deck, board presentation, internal deck, proposal visual. 1 slide per halaman landscape. Return URL → browser Ctrl+P → PDF. Untuk dokumen teks panjang pakai generate_document; untuk org-chart pakai generate_architecture_map.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Judul deck (jadi slide cover).' },
        subtitle: { type: 'string', description: 'Subtitle cover. Optional.' },
        slides: {
          type: 'array',
          description: 'Array slide. Tiap slide jadi 1 halaman.',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: 'Judul slide.' },
              bullets: { type: 'array', items: { type: 'string' }, description: 'Bullet points. Prefix "> " untuk sub-bullet.' },
              note: { type: 'string', description: 'Catatan kecil di bawah slide (optional).' },
            },
            required: ['heading'],
          },
        },
      },
      required: ['title', 'slides'],
    },
  },

  // ===========================================================================
  // SPREADSHEET (XLSX export)
  // ===========================================================================

  {
    name: 'generate_spreadsheet',
    description: 'Generate file Excel (.xlsx) multi-sheet. Pakai untuk: budget, inventory, forecast, data tabel, financial model, tracking. Return URL download. Bisa dibuka di Excel / Google Sheets. Untuk laporan naratif pakai generate_document.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nama file (tanpa .xlsx).' },
        sheets: {
          type: 'array',
          description: 'Array sheet. Tiap sheet punya nama + rows.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nama sheet/tab.' },
              headers: { type: 'array', items: { type: 'string' }, description: 'Header kolom (baris pertama, bold).' },
              rows: {
                type: 'array',
                description: 'Array baris data. Tiap baris = array cell (string atau number).',
                items: { type: 'array', items: {} },
              },
            },
            required: ['name', 'rows'],
          },
        },
      },
      required: ['title', 'sheets'],
    },
  },

  // ===========================================================================
  // VAULT WRITE (persistent memory, GitHub API)
  // ===========================================================================

  {
    name: 'write_vault_file',
    description: 'TULIS / update file di vault Obsidian gerai-memory (persistent memory). Pakai untuk SIMPAN: decision, insight, pattern, notes, learning, customer record, sehingga inget di sesi depan. Path format "{section}/{filename}.md" (e.g. "05-decisions/2026-05-29-wave-1-channel.md", "06-patterns/matthew-decision-style.md"). mode: "overwrite" (ganti penuh) atau "append" (tambah di bawah). Tanpa write, AI Department amnesia tiap sesi. SELALU konfirmasi ke Matthew sebelum nulis hal penting.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault path "{section}/{filename}.md". Section valid: 00-founding (HATI-HATI, LOCKED), 01-matthew, 02-customers, 03-projects, 04-konsultasi, 05-decisions, 06-patterns, 07-vendor, 08-team, 09-risk, 10-knowledge.' },
        content: { type: 'string', description: 'Content markdown. Untuk append, ini yang ditambahkan di bawah existing.' },
        mode: { type: 'string', enum: ['overwrite', 'append'], description: 'overwrite (default) atau append.' },
      },
      required: ['path', 'content'],
    },
  },

  // ===========================================================================
  // LIVING CONTEXT (shared state lintas chat)
  // ===========================================================================

  {
    name: 'read_context',
    description: 'Baca KONTEKS AKTIF (living state lintas chat) = status terkini yang penting: prioritas aktif, keputusan terbaru, fakta terkunci, open questions. WAJIB dipanggil di AWAL setiap chat strategic supaya tau perkembangan dari chat lain (marketing, branding, finance, dll). Ini yang bikin semua chat tetap sync meski terpisah.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_context',
    description: 'Update KONTEKS AKTIF saat ada hal PENTING (keputusan, prioritas baru, fakta berubah, milestone). Entry langsung kebaca di chat lain via read_context. Pakai ini biar info penting selalu sync lintas chat tanpa Matthew ngulang. Contoh: habis decide channel marketing IG-primary, update_context supaya chat branding langsung tau.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['prioritas', 'keputusan', 'fakta', 'open-question', 'milestone'], description: 'Jenis update.' },
        title: { type: 'string', description: 'Judul singkat update (1 baris).' },
        content: { type: 'string', description: 'Detail update. Sebut sumber chat kalau relevan (e.g. "dari diskusi marketing").' },
      },
      required: ['category', 'title', 'content'],
    },
  },

  // ===========================================================================
  // FETCH URL (baca full halaman web)
  // ===========================================================================

  {
    name: 'fetch_url',
    description: 'Baca FULL content satu halaman web (bukan snippet). Pakai untuk: deep-read artikel, baca halaman kompetitor, analisa konten spesifik, baca dokumentasi. Beda dari web_search (yang cuma snippet + sumber). fetch_url ambil text lengkap 1 URL. SSRF-protected (block private IP).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL lengkap (http/https) yang mau dibaca full.' },
      },
      required: ['url'],
    },
  },

  // ===========================================================================
  // RUN CODE (sandboxed execution)
  // ===========================================================================

  {
    name: 'run_code',
    description: 'Eksekusi kode JavaScript di sandbox terisolasi (Vercel Firecracker). Pakai untuk: financial modeling, NPV/IRR calc, data crunch, reverse calendar math, transformasi data, simulasi numerik. Return stdout. 30 detik timeout. Code harus self-contained (console.log untuk output).',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code self-contained. Pakai console.log() untuk output hasil.' },
      },
      required: ['code'],
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
    return await formatDecisionLog(args)
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

  // Image generation (OpenAI gpt-image-1)
  if (name === 'generate_image') {
    return await generateImage(args)
  }

  // Slides (HTML deck)
  if (name === 'generate_slides') {
    return await generateSlides(args)
  }

  // Spreadsheet (xlsx)
  if (name === 'generate_spreadsheet') {
    return await generateSpreadsheet(args)
  }

  // Vault write (persistent memory)
  if (name === 'write_vault_file') {
    return await writeVaultFile(args)
  }

  // Living context (shared state lintas chat)
  if (name === 'read_context') {
    return await readContext()
  }
  if (name === 'update_context') {
    return await updateContext(args)
  }

  // Fetch full URL
  if (name === 'fetch_url') {
    return await fetchUrl(args)
  }

  // Run code (sandbox)
  if (name === 'run_code') {
    return await runCode(args)
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

// Write/update file di vault via GitHub Contents API (PUT). Auto-handle SHA untuk update.
async function githubWrite(path, content, commitMessage) {
  const pat = process.env.GITHUB_VAULT_PAT
  if (!pat) throw new Error('github_vault_pat_not_configured')

  // Cek existing file untuk dapat SHA (kalau update)
  let sha = null
  try {
    const existing = await githubFetch(path)
    if (existing && existing.sha) sha = existing.sha
  } catch {
    // File belum ada, create baru (sha null)
  }

  const url = `https://api.github.com/repos/${VAULT_REPO}/contents/${path}`
  const body = {
    message: commitMessage || `vault: update ${path} via Atmaja MCP`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: VAULT_BRANCH,
  }
  if (sha) body.sha = sha

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'gerai-mcp-server/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`github_write_${resp.status}: ${errText.slice(0, 200)}`)
  }
  const result = await resp.json()
  return { created: !sha, path, htmlUrl: result?.content?.html_url || '' }
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

async function formatDecisionLog(args) {
  const { title, brief, perspectives = {}, decision, action_items = [] } = args
  const now = new Date().toISOString()
  const dateStr = now.slice(0, 10)
  const slug = String(title || 'decision').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

  const perspectivesText = Object.entries(perspectives)
    .map(([role, insight]) => `- **${role}**: ${insight}`)
    .join('\n')

  const actionsText = action_items.length > 0
    ? action_items.map((a, i) => `${i + 1}. ${a}`).join('\n')
    : '_(belum ada action items spesifik)_'

  const vaultPath = `05-decisions/${dateStr}-${slug}.md`

  const decisionMarkdown = `---
id: decision-${dateStr}-${slug}
type: decision
created: ${now}
tags: [decision, atmaja-logged]
---

# Decision: ${title}

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
`

  // Auto-write ke vault (GitHub API). GITHUB_VAULT_PAT sudah ada.
  let writeStatus
  try {
    const result = await githubWrite(vaultPath, decisionMarkdown, `vault: log decision "${title}" via Atmaja`)
    writeStatus = `💾 **Tersimpan permanen** di vault: \`${vaultPath}\` (${result.created ? 'created' : 'updated'}). Bisa dibaca sesi depan via search_vault atau read_vault_file.`
  } catch (err) {
    writeStatus = `⚠️ Decision diformat tapi GAGAL auto-save ke vault: ${err.message}. Matthew bisa copy manual ke \`${vaultPath}\`.`
  }

  return {
    content: [
      {
        type: 'text',
        text: `📝 **Decision Logged**\n\n${writeStatus}\n\n---\n\n${decisionMarkdown}`,
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
    const docId = genSecureId('doc')

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

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  // Render task (support "> " prefix untuk sub-task indent Level 3+)
  const renderTask = (task) => {
    const t = String(task || '')
    if (t.startsWith('> ')) {
      return `<li class="subtask">${escapeHtml(t.slice(2))}</li>`
    }
    return `<li>${escapeHtml(t)}</li>`
  }

  // Render kerjaan block (Level 2) dengan auto-number A1, A2...
  const renderKerjaan = (k, saLetter, kIdx) => {
    const name = escapeHtml(String(k?.name || ''))
    const code = `${saLetter}${kIdx + 1}`
    const tasks = Array.isArray(k?.tasks) ? k.tasks : []
    const tasksHtml = tasks.length > 0
      ? `<ul class="tasks">${tasks.map(renderTask).join('')}</ul>`
      : ''
    return `<div class="kerjaan"><div class="kerjaan-name"><span class="k-code">${code}</span>${name}</div>${tasksHtml}</div>`
  }

  // Render sub-area column (Level 1) dengan auto-letter A, B, C...
  const renderSubArea = (sa, saIdx) => {
    const letter = LETTERS[saIdx] || String(saIdx + 1)
    const name = escapeHtml(String(sa?.name || ''))
    const kerjaan = Array.isArray(sa?.kerjaan) ? sa.kerjaan : []
    const kerjaanHtml = kerjaan.map((k, i) => renderKerjaan(k, letter, i)).join('')
    return `<div class="subarea">
      <div class="subarea-head"><span class="sa-badge">${letter}</span><span class="sa-name">${name}</span></div>
      ${kerjaanHtml}
    </div>`
  }

  // Render sektor page (Level 0) dengan tree connector
  const renderSector = (s, sIdx, pageNum) => {
    const num = escapeHtml(String(s?.number || String(sIdx + 1).padStart(2, '0')))
    const name = escapeHtml(String(s?.name || ''))
    const meta = s?.meta ? `<div class="sector-meta">${escapeHtml(String(s.meta))}</div>` : ''
    const subAreas = Array.isArray(s?.sub_areas) ? s.sub_areas : []
    const columnsHtml = subAreas.map((sa, i) => renderSubArea(sa, i)).join('')
    const colCount = subAreas.length
    // Density class: banyak kolom = lebih rapat
    const densityClass = colCount >= 5 ? 'dense' : colCount >= 4 ? 'medium' : 'wide'
    return `<section class="sector-page">
      <div class="sector-runhead">${escapeHtml(footerLabel)}</div>
      <div class="sector-banner">
        <span class="sector-num">${num}</span>
        <span class="sector-name">${name}</span>
      </div>
      ${meta}
      <div class="tree-spine"></div>
      <div class="columns ${densityClass}">${columnsHtml}</div>
      <div class="page-footer"><span>${escapeHtml(footerLabel)}</span><span class="page-no">Halaman ${pageNum}</span></div>
    </section>`
  }

  let pageCounter = 1
  const sectorsHtml = sectors.map((s, i) => renderSector(s, i, ++pageCounter)).join('')

  // Table of Contents (cover) + intro
  const tocHtml = `<div class="toc">
    <div class="toc-title">Daftar Sektor</div>
    <div class="toc-grid">
      ${sectors.map((s, i) => {
        const num = escapeHtml(String(s?.number || String(i + 1).padStart(2, '0')))
        const name = escapeHtml(String(s?.name || ''))
        const saCount = Array.isArray(s?.sub_areas) ? s.sub_areas.length : 0
        return `<div class="toc-item"><span class="toc-num">${num}</span><span class="toc-name">${name}</span><span class="toc-count">${saCount} sub-area</span></div>`
      }).join('')}
    </div>
  </div>`

  const introHtml = introNotes.length > 0
    ? `<div class="intro-box">
        <div class="intro-legend">SEKTOR <span class="lg">›</span> SUB-AREA <span class="lg">›</span> KERJAAN <span class="lg">›</span> TASK</div>
        ${introNotes.map(n => `<div class="intro-line">${escapeHtml(String(n))}</div>`).join('')}
      </div>`
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
    --brass-soft: #d8c4a6;
    --charcoal: #1F1A14;
    --charcoal-soft: #3a332a;
    --ivory: #FAF8F4;
    --muted: #6b6357;
    --border: #e2dccf;
    --col-bg: #ffffff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--ivory); }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: var(--charcoal);
    font-size: 12px;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
  }

  /* ===== Cover page ===== */
  .cover {
    min-height: 94vh;
    padding: 60px 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
    background: linear-gradient(135deg, var(--ivory) 0%, #f3eee4 100%);
  }
  .cover-brand {
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--brass);
    font-weight: 600;
    margin-bottom: 14px;
  }
  .cover-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 40px;
    font-weight: 700;
    color: var(--charcoal);
    line-height: 1.18;
    margin-bottom: 10px;
    max-width: 900px;
  }
  .cover-subtitle {
    font-size: 15px;
    color: var(--muted);
    margin-bottom: 26px;
  }
  .intro-box {
    border-left: 3px solid var(--brass);
    background: white;
    padding: 18px 24px;
    max-width: 860px;
    border-radius: 0 4px 4px 0;
    box-shadow: 0 1px 4px rgba(31,26,20,0.05);
    margin-bottom: 26px;
  }
  .intro-legend {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--charcoal);
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--border);
  }
  .intro-legend .lg { color: var(--brass); margin: 0 4px; }
  .intro-line {
    font-size: 12.5px;
    color: var(--charcoal-soft);
    margin: 5px 0;
    line-height: 1.5;
  }

  /* ===== Table of Contents ===== */
  .toc { max-width: 980px; }
  .toc-title {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--brass);
    font-weight: 700;
    margin-bottom: 12px;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 18px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .toc-num {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 700;
    color: var(--brass);
    font-size: 14px;
    min-width: 24px;
  }
  .toc-name { font-weight: 600; font-size: 12px; color: var(--charcoal); flex: 1; }
  .toc-count { font-size: 10px; color: var(--muted); }

  /* ===== Sector page ===== */
  .sector-page {
    padding: 26px 34px 48px;
    page-break-after: always;
    position: relative;
    min-height: 94vh;
  }
  .sector-runhead {
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--brass);
    text-align: right;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .sector-banner {
    background: linear-gradient(135deg, var(--charcoal) 0%, var(--charcoal-soft) 100%);
    color: var(--ivory);
    padding: 15px 30px;
    text-align: center;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    box-shadow: 0 2px 8px rgba(31,26,20,0.18);
  }
  .sector-num {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--brass);
    border-right: 1px solid rgba(184,149,107,0.4);
    padding-right: 16px;
  }
  .sector-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .sector-meta {
    text-align: center;
    font-size: 11px;
    color: var(--muted);
    margin-top: 8px;
    font-style: italic;
  }

  /* Tree connector spine: garis turun dari banner ke kolom */
  .tree-spine {
    height: 18px;
    width: 2px;
    background: var(--brass);
    margin: 0 auto 0;
    opacity: 0.5;
  }

  /* ===== Columns (sub-areas Level 1) ===== */
  .columns {
    display: grid;
    gap: 14px;
    align-items: start;
    border-top: 2px solid var(--brass-soft);
    padding-top: 16px;
    position: relative;
  }
  .columns.wide { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .columns.medium { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
  .columns.dense { grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); font-size: 11px; }

  .subarea {
    background: var(--col-bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0 0 12px;
    box-shadow: 0 1px 3px rgba(31,26,20,0.04);
    overflow: hidden;
    break-inside: avoid;
  }
  .subarea-head {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #faf7f1;
    font-weight: 700;
    color: var(--charcoal);
    padding: 9px 12px;
    border-bottom: 2px solid var(--brass);
    margin-bottom: 8px;
  }
  .sa-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px; height: 18px;
    background: var(--brass);
    color: white;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .sa-name { font-size: 12.5px; line-height: 1.25; }

  .kerjaan { margin: 0 12px 11px; }
  .kerjaan:last-child { margin-bottom: 2px; }
  .kerjaan-name {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--charcoal);
    margin-bottom: 4px;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  .k-code {
    color: var(--brass);
    font-weight: 700;
    font-size: 10px;
    flex-shrink: 0;
  }
  .tasks { list-style: none; padding-left: 4px; }
  .tasks li {
    font-size: 10.5px;
    color: var(--charcoal-soft);
    padding-left: 13px;
    position: relative;
    margin: 2.5px 0;
    line-height: 1.35;
  }
  .tasks li::before {
    content: "•";
    color: var(--brass);
    position: absolute;
    left: 2px;
  }
  .tasks li.subtask {
    padding-left: 25px;
    color: var(--muted);
  }
  .tasks li.subtask::before {
    content: "▸";
    left: 13px;
    font-size: 8px;
    top: 1px;
  }

  .page-footer {
    position: absolute;
    bottom: 16px;
    left: 34px;
    right: 34px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9.5px;
    color: var(--muted);
    border-top: 1px solid var(--border);
    padding-top: 7px;
  }
  .page-no { font-weight: 600; color: var(--brass); }

  @page { size: A4 landscape; margin: 11mm; }
  @media print {
    body { background: white; }
    .cover { background: white; }
    .cover, .sector-page { min-height: auto; }
    .subarea { break-inside: avoid; }
    .sector-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sa-badge, .toc-num, .sector-num { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-brand">Gerai 1000 Pintu , AI Department</div>
    <h1 class="cover-title">${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="cover-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    ${introHtml}
    ${tocHtml}
  </div>
  ${sectorsHtml}
</body>
</html>`

  try {
    const docId = genSecureId('map')

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

// ============================================================================
// IMAGE GENERATION (OpenAI gpt-image-1 → KV → /api/doc)
// ============================================================================

async function generateImage(args) {
  const prompt = String(args?.prompt || '').trim()
  if (!prompt) throw new Error('prompt_required')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      content: [{ type: 'text', text: '[Image Gen Error] OPENAI_API_KEY not set di Vercel env.' }],
      isError: true,
    }
  }

  const size = ['1024x1024', '1024x1536', '1536x1024'].includes(args?.size) ? args.size : '1024x1024'
  const quality = ['low', 'medium', 'high'].includes(args?.quality) ? args.quality : 'medium'

  let kv
  try {
    kv = (await import('@vercel/kv')).kv
  } catch (err) {
    return { content: [{ type: 'text', text: `[Image Gen Error] KV import: ${err.message}` }], isError: true }
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size, quality, n: 1 }),
    })

    const raw = await upstream.text()
    let parsed = {}
    try { parsed = JSON.parse(raw) } catch { parsed = {} }

    if (!upstream.ok) {
      const msg = parsed?.error?.message || raw.slice(0, 300)
      return { content: [{ type: 'text', text: `[Image Gen Error] OpenAI ${upstream.status}: ${msg}` }], isError: true }
    }

    const b64 = parsed?.data?.[0]?.b64_json
    if (!b64) {
      return { content: [{ type: 'text', text: '[Image Gen Error] No image data returned.' }], isError: true }
    }

    const docId = genSecureId('img')
    await kv.set(`doc:${docId}`, { ct: 'image/png', body: b64 }, { ex: 604800 })

    const url = `https://gerai.mahewwork.com/api/doc?id=${docId}`
    return {
      content: [
        {
          type: 'text',
          text: `🖼️ **Image Generated**\n\n**Prompt:** ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}\n**Size:** ${size} | **Quality:** ${quality}\n**URL:** ${url}\n\n_Open URL untuk lihat/download. Tersimpan 7 hari._\n\n![generated](${url})`,
        },
      ],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Image Gen Error] ${err.message || String(err)}` }], isError: true }
  }
}

// ============================================================================
// SLIDES (HTML deck, landscape → KV → /api/doc)
// ============================================================================

async function generateSlides(args) {
  const title = String(args?.title || 'Presentation').slice(0, 200)
  const subtitle = String(args?.subtitle || '')
  const slides = Array.isArray(args?.slides) ? args.slides : []
  if (slides.length === 0) {
    return { content: [{ type: 'text', text: '[Slides Error] slides array kosong.' }], isError: true }
  }

  let kv
  try {
    kv = (await import('@vercel/kv')).kv
  } catch (err) {
    return { content: [{ type: 'text', text: `[Slides Error] KV import: ${err.message}` }], isError: true }
  }

  const renderBullet = (b) => {
    const t = String(b || '')
    if (t.startsWith('> ')) return `<li class="sub">${escapeHtml(t.slice(2))}</li>`
    return `<li>${escapeHtml(t)}</li>`
  }

  const renderSlide = (s, i) => {
    const heading = escapeHtml(String(s?.heading || ''))
    const bullets = Array.isArray(s?.bullets) ? s.bullets : []
    const bulletsHtml = bullets.length ? `<ul class="bullets">${bullets.map(renderBullet).join('')}</ul>` : ''
    const note = s?.note ? `<div class="slide-note">${escapeHtml(String(s.note))}</div>` : ''
    return `<section class="slide">
      <div class="slide-num">${String(i + 1).padStart(2, '0')}</div>
      <h2 class="slide-heading">${heading}</h2>
      ${bulletsHtml}
      ${note}
      <div class="slide-footer">Gerai 1000 Pintu , 1000 Mimpi</div>
    </section>`
  }

  const slidesHtml = slides.map(renderSlide).join('')

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  :root { --brass:#B8956B; --charcoal:#1F1A14; --ivory:#FAF8F4; --muted:#6b6357; --border:#d8d2c4; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',-apple-system,system-ui,sans-serif; background:var(--charcoal); color:var(--charcoal); }
  .slide, .cover {
    width:100%; min-height:96vh; padding:70px 80px; background:var(--ivory);
    page-break-after:always; position:relative; display:flex; flex-direction:column; justify-content:center;
  }
  .cover { background:var(--charcoal); color:var(--ivory); }
  .cover-brand { font-size:14px; letter-spacing:3px; text-transform:uppercase; color:var(--brass); font-weight:600; margin-bottom:24px; }
  .cover-title { font-family:'Playfair Display',Georgia,serif; font-size:54px; font-weight:700; line-height:1.15; margin-bottom:16px; }
  .cover-subtitle { font-size:20px; color:#cabfa9; }
  .slide-num { position:absolute; top:50px; right:70px; font-family:'Playfair Display',Georgia,serif; font-size:28px; color:var(--brass); font-weight:700; }
  .slide-heading { font-family:'Playfair Display',Georgia,serif; font-size:38px; font-weight:700; color:var(--charcoal); margin-bottom:30px; padding-bottom:16px; border-bottom:3px solid var(--brass); }
  .bullets { list-style:none; }
  .bullets li { font-size:22px; line-height:1.5; margin:14px 0; padding-left:32px; position:relative; }
  .bullets li::before { content:"•"; color:var(--brass); position:absolute; left:6px; font-size:24px; }
  .bullets li.sub { font-size:18px; padding-left:60px; color:var(--muted); }
  .bullets li.sub::before { content:"▸"; left:36px; font-size:16px; }
  .slide-note { margin-top:auto; padding-top:24px; font-size:14px; color:var(--muted); font-style:italic; }
  .slide-footer { position:absolute; bottom:36px; left:80px; font-size:12px; color:var(--muted); letter-spacing:1px; }
  @page { size:A4 landscape; margin:0; }
  @media print { body { background:white; } .slide, .cover { min-height:100vh; } }
</style></head><body>
  <div class="cover">
    <div class="cover-brand">Gerai 1000 Pintu , AI Department</div>
    <div class="cover-title">${escapeHtml(title)}</div>
    ${subtitle ? `<div class="cover-subtitle">${escapeHtml(subtitle)}</div>` : ''}
  </div>
  ${slidesHtml}
</body></html>`

  try {
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'deck'
    const docId = genSecureId('slides')
    await kv.set(`doc:${docId}`, html, { ex: 604800 })
    const url = `https://gerai.mahewwork.com/api/doc?id=${docId}`
    return {
      content: [
        {
          type: 'text',
          text: `📊 **Slides Generated**\n\n**Title:** ${title}\n**Slides:** ${slides.length} + cover\n**URL:** ${url}\n\n_Open URL → Ctrl+P → Landscape → Save as PDF. Tersimpan 7 hari._`,
        },
      ],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Slides Error] ${err.message || String(err)}` }], isError: true }
  }
}

// ============================================================================
// SPREADSHEET (XLSX → KV → /api/doc download)
// ============================================================================

async function generateSpreadsheet(args) {
  const title = String(args?.title || 'spreadsheet').slice(0, 100)
  const sheets = Array.isArray(args?.sheets) ? args.sheets : []
  if (sheets.length === 0) {
    return { content: [{ type: 'text', text: '[Spreadsheet Error] sheets array kosong.' }], isError: true }
  }

  let XLSX, kv
  try {
    XLSX = (await import('xlsx')).default || (await import('xlsx'))
    kv = (await import('@vercel/kv')).kv
  } catch (err) {
    return { content: [{ type: 'text', text: `[Spreadsheet Error] Dependency: ${err.message}. npm install xlsx + redeploy.` }], isError: true }
  }

  try {
    const wb = XLSX.utils.book_new()

    sheets.forEach((sheet, idx) => {
      const name = String(sheet?.name || `Sheet${idx + 1}`).slice(0, 31).replace(/[\\/?*[\]:]/g, '')
      const headers = Array.isArray(sheet?.headers) ? sheet.headers : []
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      const aoa = headers.length ? [headers, ...rows] : rows
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, name || `Sheet${idx + 1}`)
    })

    // Write to base64
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'sheet'
    const docId = genSecureId('xlsx')
    await kv.set(`doc:${docId}`, {
      ct: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: b64,
      dl: `${safeTitle}.xlsx`,
    }, { ex: 604800 })

    const url = `https://gerai.mahewwork.com/api/doc?id=${docId}`
    const totalRows = sheets.reduce((s, sh) => s + (Array.isArray(sh?.rows) ? sh.rows.length : 0), 0)
    return {
      content: [
        {
          type: 'text',
          text: `📈 **Spreadsheet Generated**\n\n**File:** ${safeTitle}.xlsx\n**Sheets:** ${sheets.length} | **Total rows:** ${totalRows}\n**URL:** ${url}\n\n_Click URL untuk download .xlsx. Buka di Excel / Google Sheets. Tersimpan 7 hari._`,
        },
      ],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Spreadsheet Error] ${err.message || String(err)}` }], isError: true }
  }
}

// ============================================================================
// VAULT WRITE (persistent memory via GitHub API)
// ============================================================================

async function writeVaultFile(args) {
  const path = String(args?.path || '').replace(/^\/+|\/+$/g, '')
  const content = String(args?.content || '')
  const mode = args?.mode === 'append' ? 'append' : 'overwrite'

  if (!path) throw new Error('path_required')
  if (!path.endsWith('.md')) {
    return { content: [{ type: 'text', text: `[Vault Write Error] Path harus .md: ${path}` }], isError: true }
  }
  if (!content) throw new Error('content_required')

  // Guard: 00-founding LOCKED, butuh extra care
  if (path.startsWith('00-founding/')) {
    return {
      content: [{ type: 'text', text: `[Vault Write BLOCKED] Section 00-founding LOCKED (brand canon, BP). Tidak bisa di-write via tool. Kalau Matthew benar-benar mau ubah founding knowledge, harus manual + ADR formal. Pakai section lain (05-decisions, 06-patterns, dll).` }],
      isError: true,
    }
  }

  try {
    let finalContent = content
    if (mode === 'append') {
      try {
        const existing = await githubFetch(path)
        if (existing && existing.content) {
          const existingText = Buffer.from(existing.content, 'base64').toString('utf8')
          finalContent = existingText.trimEnd() + '\n\n' + content
        }
      } catch {
        // File belum ada, append = create baru
      }
    }

    const result = await githubWrite(path, finalContent, `vault: ${mode} ${path} via Atmaja`)

    return {
      content: [
        {
          type: 'text',
          text: `💾 **Vault ${result.created ? 'Created' : 'Updated'}** (${mode})\n\n**Path:** ${path}\n**Size:** ${finalContent.length} chars\n\n_Tersimpan permanen di vault gerai-memory. Bisa dibaca sesi depan via read_vault_file("${path}"). Auto-backup ke GitHub._`,
        },
      ],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Vault Write Error] ${err.message || String(err)}` }], isError: true }
  }
}

// ============================================================================
// LIVING CONTEXT (shared state lintas chat) — 03-projects/active-context.md
// ============================================================================

const CONTEXT_PATH = '03-projects/active-context.md'

const CONTEXT_HEADER = `---
id: active-context
type: living-state
tags: [active, shared, cross-chat]
---

# Konteks Aktif , Gerai 1000 Pintu

_Living state lintas chat. Dibaca di awal tiap chat strategic, di-update saat ada hal penting. Entry terbaru di atas._
`

async function readContext() {
  try {
    const file = await githubFetch(CONTEXT_PATH)
    const content = Buffer.from(file.content, 'base64').toString('utf8')
    return {
      content: [{ type: 'text', text: `[KONTEKS AKTIF , status terkini lintas chat]\n\n${content}` }],
    }
  } catch (err) {
    // File belum ada = belum ada konteks
    return {
      content: [{ type: 'text', text: `[KONTEKS AKTIF] Belum ada konteks tersimpan. Ini chat pertama atau belum ada update penting. Mulai isi via update_context saat ada keputusan/prioritas/fakta penting.` }],
    }
  }
}

async function updateContext(args) {
  const category = String(args?.category || 'fakta')
  const title = String(args?.title || '').trim()
  const content = String(args?.content || '').trim()
  if (!title || !content) throw new Error('title_and_content_required')

  const now = new Date().toISOString()
  const dateStr = now.slice(0, 16).replace('T', ' ')
  const icon = { prioritas: '🎯', keputusan: '✅', fakta: '🔒', 'open-question': '⏳', milestone: '🚩' }[category] || '•'

  const newEntry = `\n### ${icon} [${category}] ${title}\n_${dateStr}_\n\n${content}\n`

  try {
    // Baca existing, prepend entry baru setelah header
    let existing = ''
    try {
      const file = await githubFetch(CONTEXT_PATH)
      existing = Buffer.from(file.content, 'base64').toString('utf8')
    } catch {
      existing = CONTEXT_HEADER
    }

    // Insert entry baru setelah header (setelah baris "_Living state..._")
    const splitMarker = 'Entry terbaru di atas._\n'
    let finalContent
    if (existing.includes(splitMarker)) {
      const idx = existing.indexOf(splitMarker) + splitMarker.length
      finalContent = existing.slice(0, idx) + newEntry + existing.slice(idx)
    } else {
      finalContent = (existing || CONTEXT_HEADER) + newEntry
    }

    // Cap: keep max ~40 entries (trim oldest kalau kepanjangan)
    if (finalContent.length > 30000) {
      finalContent = finalContent.slice(0, 30000) + '\n\n_(entry lama di-trim, lihat 05-decisions untuk arsip lengkap)_\n'
    }

    await githubWrite(CONTEXT_PATH, finalContent, `context: ${category} "${title}" via Atmaja`)

    return {
      content: [{ type: 'text', text: `🔄 **Konteks Aktif Updated** [${category}]\n\n**${title}**\n${content}\n\n_Langsung kebaca di chat lain via read_context. Semua chat sekarang sync._` }],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Update Context Error] ${err.message || String(err)}` }], isError: true }
  }
}

// ============================================================================
// FETCH URL (full page read, cheerio extract)
// ============================================================================

async function fetchUrl(args) {
  const url = String(args?.url || '').trim()
  if (!url) throw new Error('url_required')
  if (!/^https?:\/\//i.test(url)) {
    return { content: [{ type: 'text', text: '[Fetch Error] URL harus http/https.' }], isError: true }
  }

  // SSRF guard: block private IP ranges
  try {
    const u = new URL(url)
    const host = u.hostname
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        host.endsWith('.internal') || host.endsWith('.local')) {
      return { content: [{ type: 'text', text: '[Fetch Error] Private/internal host diblokir (SSRF protection).' }], isError: true }
    }
  } catch {
    return { content: [{ type: 'text', text: '[Fetch Error] URL invalid.' }], isError: true }
  }

  let cheerio
  try {
    cheerio = await import('cheerio')
  } catch (err) {
    return { content: [{ type: 'text', text: `[Fetch Error] cheerio import: ${err.message}` }], isError: true }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeraiBot/1.0)' },
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      return { content: [{ type: 'text', text: `[Fetch Error] HTTP ${resp.status} dari ${url}` }], isError: true }
    }

    const ct = resp.headers.get('content-type') || ''
    let bodyText = await resp.text()
    if (bodyText.length > 2_500_000) bodyText = bodyText.slice(0, 2_500_000)

    let extracted
    if (ct.includes('text/html')) {
      const $ = cheerio.load(bodyText)
      $('script, style, nav, footer, header, aside, noscript, iframe').remove()
      const title = $('title').first().text().trim()
      const main = $('main, article, [role=main]').first()
      const text = (main.length ? main.text() : $('body').text())
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 20000)
      extracted = `**Title:** ${title}\n\n${text}`
    } else {
      extracted = bodyText.slice(0, 20000)
    }

    return {
      content: [{ type: 'text', text: `[Fetched: ${url}]\n\n${extracted}` }],
    }
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'timeout (12s)' : (err.message || String(err))
    return { content: [{ type: 'text', text: `[Fetch Error] ${msg}` }], isError: true }
  }
}

// ============================================================================
// RUN CODE (Vercel Sandbox)
// ============================================================================

async function runCode(args) {
  const code = String(args?.code || '').trim()
  if (!code) throw new Error('code_required')
  if (code.length > 10000) {
    return { content: [{ type: 'text', text: '[Run Code Error] Code max 10KB.' }], isError: true }
  }

  let Sandbox
  try {
    Sandbox = (await import('@vercel/sandbox')).Sandbox
  } catch (err) {
    return { content: [{ type: 'text', text: `[Run Code Error] Sandbox import: ${err.message}` }], isError: true }
  }

  let sandbox
  try {
    sandbox = await Sandbox.create({ timeout: 30000 })
    await sandbox.writeFiles([{ path: 'script.mjs', content: Buffer.from(code, 'utf8') }])
    const result = await sandbox.runCommand({ cmd: 'node', args: ['script.mjs'] })

    const stdout = (await result.stdout?.()) ?? result.stdout ?? ''
    const stderr = (await result.stderr?.()) ?? result.stderr ?? ''
    const out = String(stdout || '').slice(0, 8000)
    const err = String(stderr || '').slice(0, 2000)

    let text = `⚙️ **Code Executed**\n\n**Output:**\n\`\`\`\n${out || '(no output)'}\n\`\`\``
    if (err.trim()) text += `\n\n**Stderr:**\n\`\`\`\n${err}\n\`\`\``
    return { content: [{ type: 'text', text }] }
  } catch (err) {
    return { content: [{ type: 'text', text: `[Run Code Error] ${err.message || String(err)}` }], isError: true }
  } finally {
    try { if (sandbox) await sandbox.stop() } catch {}
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

// ============================================================================
// DOCUMENT SERVING (dipanggil dari api/agent/reply.js saat ?type=doc&id=...)
// Fetch HTML dari KV, serve dengan content-type text/html.
// ============================================================================

export async function serveDocument(req, res) {
  // Security headers: dokumen bisnis sensitif. Capability-URL model (unguessable id).
  // noindex: jangan ke-crawl search engine. no-referrer: URL gak bocor via referrer.
  res.setHeader('x-robots-tag', 'noindex, nofollow, noarchive')
  res.setHeader('referrer-policy', 'no-referrer')
  res.setHeader('x-content-type-options', 'nosniff')

  let docId = ''
  try {
    const url = new URL(req.url, 'http://localhost')
    docId = url.searchParams.get('id') || ''
  } catch {}

  // Strict id format: {prefix}-{32 hex}. Tolak yang gak match (anti-enumeration).
  if (!docId || !/^[a-z]+-[a-f0-9]{8,64}$/i.test(docId)) {
    res.statusCode = 400
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('Invalid document id.')
    return
  }

  try {
    const kvModule = await import('@vercel/kv')
    const stored = await kvModule.kv.get(`doc:${docId}`)

    if (!stored) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#1F1A14"><h1>Document not found</h1><p>Dokumen ini sudah expired (TTL 7 hari) atau id salah. Minta Atmaja generate ulang.</p></body></html>')
      return
    }

    // 2 format:
    // - Legacy: stored = string HTML langsung (text/html)
    // - New: stored = { ct, body, dl } untuk binary (image, xlsx). body = base64.
    if (typeof stored === 'string') {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'private, max-age=3600')
      res.end(stored)
      return
    }

    if (stored && typeof stored === 'object' && stored.ct) {
      const buf = Buffer.from(stored.body, 'base64')
      res.statusCode = 200
      res.setHeader('content-type', stored.ct)
      res.setHeader('cache-control', 'private, max-age=3600')
      if (stored.dl) {
        res.setHeader('content-disposition', `attachment; filename="${stored.dl}"`)
      }
      res.end(buf)
      return
    }

    // Fallback
    res.statusCode = 200
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(String(stored))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(`Document serve error: ${err.message || String(err)}`)
  }
}

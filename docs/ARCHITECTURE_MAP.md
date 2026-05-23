# Gerai 1000 Pintu — Architecture Map

**Tanggal:** 2026-05-23
**Untuk:** Matthew (founder) supaya bisa lihat state sekarang + roadmap besar
**Status:** Living document. Update kalau ada perubahan signifikan.

---

## Bagian 1 · State sistem sekarang (sudah hidup end-to-end)

### 1.1 Big picture

```
                          ┌─────────────────────────────┐
                          │  Matthew (solo founder)      │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
        ┌───────────────────────────────────────────────────────────┐
        │  FRONTEND (Vite + React PWA, di gerai.mahewwork.com)       │
        │  ────────────────────────────────────────────────────────  │
        │  /atmaja        → chat CEO sintesis                        │
        │  /              → Inbox (brief list + cost dashboard)      │
        │  /brief/:id     → Detail brief + C-suite discussion        │
        │  /workmap/:id   → Workmap visual brief                     │
        │  /settings      → Privacy + bridge config                  │
        └──────────────────────────┬───────────────────────────────┘
                                   │  same-origin fetch only (CSP)
                                   │  privacy guard: bridge on/off
                                   ▼
        ┌───────────────────────────────────────────────────────────┐
        │  VERCEL SERVERLESS FUNCTIONS (di project gerai-app)        │
        │  ────────────────────────────────────────────────────────  │
        │  Chat tier (OpenRouter bridge):                            │
        │   • POST /api/atmaja/chat   ─ Opus 4.7 content tier        │
        │   • POST /api/agent/reply   ─ Sonnet 4.6 orchestration     │
        │  Image tier (OpenAI direct):                               │
        │   • POST /api/openai/image  ─ gpt-image family             │
        │   • GET  /api/openai/credits                               │
        │  Video tier (OpenAI Sora 2):                               │
        │   • POST /api/openai/video/create                          │
        │   • GET  /api/openai/video/status                          │
        │   • GET  /api/openai/video/content  (MP4 proxy stream)     │
        │  Meta:                                                     │
        │   • GET  /api/agent/health                                 │
        │   • POST /api/agent/briefs   (submit, foundation)          │
        │   • GET  /api/openrouter/credits                           │
        │  ────────────────────────────────────────────────────────  │
        │  Guardrails per endpoint:                                  │
        │   • Origin allowlist                                       │
        │   • Rate limit (12 chat, 24 agent, 6 image, 3 video / min) │
        │   • Body cap (4.3 MB chat, 64 KB image/video request)      │
        │   • Model floor whitelist (Sonnet 4.6 minimum chat)        │
        │   • Vision cap (2.1 MB base64 image, max 2 per turn)       │
        └──────────────────────────┬───────────────────────────────┘
                                   │  Bearer auth, per-tier API key
                                   ▼
        ┌───────────────────────────────────────────────────────────┐
        │  AI PROVIDER LAYER                                         │
        │  ────────────────────────────────────────────────────────  │
        │  OpenRouter  → Anthropic Claude (Opus 4.7 + Sonnet 4.6)    │
        │  OpenAI      → gpt-image-1/1.5/2, sora-2, sora-2-pro       │
        │  Anthropic   → (siap migrasi saat OpenRouter habis)        │
        └───────────────────────────────────────────────────────────┘
```

### 1.2 AI Department struktur (17 role + tier model)

```
                ┌─────────────────────────────────────┐
                │  ATMAJA · CEO Orchestrator           │
                │  Model: Opus 4.7 (content tier)      │
                │  Endpoint: /api/atmaja/chat          │
                │  Tugas: sintesis, decision routing,  │
                │  brief generation, planning OS V6    │
                └────────────────┬─────────────────────┘
                                 │
       ┌────────────┬────────────┼────────────┬────────────┐
       ▼            ▼            ▼            ▼            ▼
   ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    (all C-suite:
   │  COO  │    │  CMO  │    │  CFO  │    │  CCO  │     Sonnet 4.6
   │ Ops + │    │Brand +│    │ROI +  │    │Creative│    orchestration
   │ SOP   │    │Growth │    │Finance│    │+Comms │    tier)
   └───┬───┘    └───┬───┘    └───┬───┘    └───┬───┘
       │            │            │            │
       ▼            ▼            ▼            ▼
  hr_systems  brand_strategist  business_designer  document_writer
  production  market_researcher financial_analyst  editorial
  curator     sales_strategist                     web_researcher
              innovation_scout

12 specialist, semua Sonnet 4.6 orchestration tier.
Persona prompt di api/agent/reply.js:50-68 (ROLE_PERSONAS).
```

### 1.3 Frontend surface inventory

| Page | File | Fungsi |
|---|---|---|
| `/atmaja` | `src/pages/Atmaja.tsx` | Chat CEO, drag-drop attachment, vision, slash command image + video |
| `/` (Inbox) | `src/pages/Inbox.tsx` | Daftar brief + cost dashboard + service status |
| `/brief/:id` | (via Inbox) | Detail brief + CommentThread + AskRolePanel |
| `/workmap/:id` | `src/pages/WorkMapDetail.tsx` | Visual workmap C-level lane + dependency |
| `/settings` | `src/pages/Settings.tsx` | Privacy lock toggle, bridge state, env posture |

| Component | File | Fungsi |
|---|---|---|
| AskRolePanel | `src/components/brief/AskRolePanel.tsx` | Bottom sheet tanya satu C-suite/specialist, support /img + /vid |
| CommentThread | `src/components/brief/CommentThread.tsx` | Discussion thread di brief detail |
| ComposeSheet | `src/components/brief/ComposeSheet.tsx` | Generate brief baru (belum di-wire ke remote) |
| BriefTile | `src/components/brief/BriefTile.tsx` | Card brief di inbox |
| BriefDetailSheet | `src/components/brief/BriefDetailSheet.tsx` | Modal detail brief |
| CSuiteCard | `src/components/brief/CSuiteCard.tsx` | Card C-suite di dashboard |
| GeneratedCover | `src/components/brief/GeneratedCover.tsx` | SVG mockup cover (placeholder, bukan AI-generated) |
| VoteChart | `src/components/brief/VoteChart.tsx` | Recharts vote visualization |
| Atmaja blocks renderer | `src/components/blocks/BlockRenderer.tsx` | Render brief blocks: markdown, chart, mermaid, generated-image |

### 1.4 Client library inventory

| File | Fungsi |
|---|---|
| `agentApi.ts` | Health endpoint + brief submit contract |
| `agentClient.ts` | Bridge ke `/api/agent/reply` (C-suite + specialist) |
| `atmajaClient.ts` | Bridge ke `/api/atmaja/chat` |
| `openaiImageClient.ts` | Bridge ke `/api/openai/image` + `parseImageCommand` |
| `openaiVideoClient.ts` | Bridge ke `/api/openai/video/*` + `parseVideoCommand` + polling loop |
| `privacyGuard.ts` | `AGENT_BRIDGE_ALLOWED` flag + runtime fetch hijack |
| `briefStore.ts` | localStorage brief CRUD + state |
| `learningMemory.ts` | Interaction lessons store (preferences, patterns) |
| `costLedger.ts` | Local cost estimation + log |
| `mockReplies.ts` | Fallback reply engine kalau remote return null |
| `atmajaSystem.ts` | Repair heuristics (sekarang tidak dipakai untuk overwrite) |
| `caseAutomation.ts` | Case-by-case automation rules |
| `privateSync.ts` | Private Sync Vault (export to Syncthing folder) |
| `agentContracts.ts` | `AgentOutputEnvelope` v1 schema (untuk integrasi OpenClaw/n8n) |
| `appReset.ts` | App state reset helper |
| `types.ts` | Brief, Contributor, Role, BriefBlock, GeneratedImage type definitions |
| `utils.ts` | `cn` classnames helper |

### 1.5 Tools yang sudah dipakai (per layer)

| Layer | Tool / Service | Pakai untuk | State |
|---|---|---|---|
| Hosting | Vercel | Static frontend + serverless functions | Live |
| Domain | Namecheap | gerai.mahewwork.com CNAME ke Vercel | Live |
| Build | Vite | Bundling React + TypeScript | Live |
| UI framework | React 18 + TypeScript | Component model | Live |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix primitives) | Glassmorphism + brand tokens | Live |
| Animation | Framer Motion | Page + element transitions | Live |
| Icons | Lucide React | Iconography | Live |
| Routing | React Router v6 | Client-side routing | Live |
| PWA | vite-plugin-pwa | Service worker, offline shell | Live |
| Analytics | @vercel/analytics + speed-insights | Telemetry | Live |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | Render reply content | Live |
| Diagrams | mermaid 11.x | Workmap + flow rendering | Live |
| Charts | recharts 3.x | Cost dashboard + vote chart | Live |
| AI text inference | OpenRouter → Anthropic | Atmaja chat (Opus 4.7) + C-suite (Sonnet 4.6) | Live |
| AI image inference | OpenAI Images API | gpt-image-1, 1.5, 2, mini | Live |
| AI video inference | OpenAI Sora 2 | sora-2, sora-2-pro | Live |
| Search (planned) | Tavily | Web research wrapper di OpenClaw | Foundation (external) |
| Memory store | localStorage + Private Sync Vault | Brief, lessons, preferences | Live |
| Version control | git + GitHub | Source code | Live |
| CI/CD | Vercel auto-deploy on push to `main` | Production deployment | Live |

### 1.6 Slash command reference (yang sudah hidup)

| Command | Surface | Tujuan | Model |
|---|---|---|---|
| Free text | Atmaja + AskRolePanel + CommentThread | Chat normal | Opus 4.7 (Atmaja) atau Sonnet 4.6 (C-suite) |
| `/img <prompt>` | Atmaja + AskRolePanel | Generate image (balance) | gpt-image-1 |
| `/image <prompt>` | sama | Alias `/img` | gpt-image-1 |
| `/img2 <prompt>` | sama | Generate image kualitas tertinggi | gpt-image-2 |
| `/img15 <prompt>` | sama | Generate image mid-tier | gpt-image-1.5 |
| `/imgmini <prompt>` | sama | Generate image cepat + murah | gpt-image-1-mini |
| `/dalle <prompt>` | sama | Legacy DALL-E (404 di akun baru) | dall-e-3 |
| `/vid <prompt>` | sama | Generate video 4s portrait | sora-2 |
| `/video <prompt>` | sama | Alias `/vid` | sora-2 |
| `/sora <prompt>` | sama | Alias `/vid` | sora-2 |
| `/vidpro <prompt>` | sama | Generate video high-quality | sora-2-pro |
| `/sora-pro <prompt>` | sama | Alias `/vidpro` | sora-2-pro |

### 1.7 Defense layers (kenapa aman)

```
┌──────────────────────────────────────────────────────────────┐
│ L1 · Privacy guard (frontend)                                 │
│  privacyGuard.ts → window.fetch hijacked kalau lock aktif     │
│  Block /api/agent + /api/atmaja + /api/telemetry              │
├──────────────────────────────────────────────────────────────┤
│ L2 · CSP (vercel.json headers)                                │
│  connect-src 'self', script-src 'self', no inline             │
│  Plus: img/font/media data: + blob: untuk image gen           │
├──────────────────────────────────────────────────────────────┤
│ L3 · Server origin check                                      │
│  isOriginAllowed() di setiap endpoint                         │
├──────────────────────────────────────────────────────────────┤
│ L4 · Rate limit per IP per menit                              │
│  Chat 12 + Agent 24 + Image 6 + Video 3                       │
├──────────────────────────────────────────────────────────────┤
│ L5 · Body cap + attachment validation                         │
│  4.3 MB chat body, 64 KB image/video request,                 │
│  2.1 MB base64/image, max 2 image per turn                    │
├──────────────────────────────────────────────────────────────┤
│ L6 · Model floor whitelist                                    │
│  Chat ALLOWED_MODELS = Opus 4.x + Sonnet 4.6 only             │
│  Image whitelist = gpt-image family + dall-e-3 legacy         │
│  Video whitelist = sora-2 + sora-2-pro                        │
│  Apa pun di luar → replace ke FLOOR_MODEL atau 400 error      │
├──────────────────────────────────────────────────────────────┤
│ L7 · Secret isolation                                         │
│  Semua API key (OpenRouter, OpenAI) cuma di server env.       │
│  Frontend tidak pernah lihat key. Bridge ke OpenAI/OpenRouter │
│  via serverless function proxy.                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.8 Workflow lifecycle satu brief

```
1. Matthew open Atmaja chat → tulis intent
2. Atmaja (Opus 4.7) reply text + (optional) suggest brief structure
3. Matthew minta brief → ComposeSheet generate (saat ini: mock,
   akan di-wire ke /api/agent/reply content tier nanti)
4. Brief masuk ke /api/agent/briefs (foundation, default OFF)
5. Brief disimpan di briefStore → muncul di Inbox
6. Open brief detail → CommentThread + AskRolePanel tersedia
7. Matthew tanya satu C-suite via AskRolePanel → Sonnet 4.6 reply
8. Matthew minta visual via /img atau /vid → render inline
9. Approval gate + decision log (foundation, belum full)
10. Outcome → learningMemory.ts catat preferensi
11. Archive ke Private Sync Vault (untuk export ke Syncthing)
```

Score per area (per `src/data/departmentStrength.ts`):
- Konsep Department: 98%
- App/Dashboard: 86%
- Rich Visual Output: 104%
- Agent Runtime: 88%
- Integrasi App ke Agent: 72%
- Memory Bisnis: 94%
- Automation Workflow: 82%
- Security & Reliability: 58%

---

## Bagian 2 · Roadmap pengembangan

### 2.1 n8n — workflow orchestration

**Apa itu:** Visual node-based workflow automation. Open source, bisa self-host atau cloud. 150+ integrations built-in (OpenAI, Anthropic, Slack, Google, webhook, dll).

**Kenapa cocok untuk Gerai:**
- Solo founder, butuh visual debugging
- Workflow brief = event-driven (submit → fan-out ke 4 C-suite → assemble → output)
- Audit trail penting untuk "kenapa C-level reply gini"
- Retry + branching + scheduled jobs built-in
- Tidak perlu code untuk setiap integrasi baru

**Skenario integrasi:**

```
Vercel App (UI live chat)
      │  webhook: brief submit
      ▼
n8n workflow #1: "Brief lifecycle"
   ┌─────────────────────────────────┐
   │ Trigger: webhook /briefs/submit  │
   │   ↓                              │
   │ Validate input + log             │
   │   ↓                              │
   │ Parallel fan-out:                │
   │   ├─ HTTP POST → COO Sonnet      │
   │   ├─ HTTP POST → CMO Sonnet      │
   │   ├─ HTTP POST → CFO Sonnet      │
   │   └─ HTTP POST → CCO Sonnet      │
   │   ↓                              │
   │ Wait all → assemble reply        │
   │   ↓                              │
   │ POST → Atmaja Opus (final synth) │
   │   ↓                              │
   │ Save to result store             │
   │   ↓                              │
   │ Webhook back ke app (job done)   │
   └─────────────────────────────────┘

n8n workflow #2: "Daily digest"
   • Cron 7 pagi
   • Pull latest briefs status
   • Call Atmaja Opus untuk sintesis
   • Push notifikasi ke app

n8n workflow #3: "Recurring radar"
   • Cron mingguan
   • Tavily search market trend
   • Push ke Innovation Scout
   • Generate alert kalau ada signal kuat
```

**Self-host vs cloud:**

| Aspek | n8n cloud | Self-host (droplet sama dengan OpenClaw) |
|---|---|---|
| Setup | 5 menit | 2-3 jam (Docker compose) |
| Cost | ~$20/bulan | ~$0 tambahan (droplet sudah ada) |
| Maintenance | Vendor handle | Kamu update + backup |
| Privacy | Data ke n8n cloud | Full lokal |
| Workflow limit | 5 active workflows starter | Unlimited |

**Rekomendasi:** Mulai self-host di droplet yang sama dengan OpenClaw (karena infrastruktur sudah ada). Kalau ribet maintenance, migrasi ke n8n cloud nanti.

### 2.2 OpenClaw — decision pension atau evolve

**State sekarang (dari codebase):**
- Service `openclaw-atmaja` aktif di droplet, path `/opt/openclaw-atmaja/`
- Jalankan 17 agent registry
- Tavily search wired via `web_search_pro.sh`
- App ↔ OpenClaw integration: **score 72/100, default OFF**
- Security: **score 58/100, "insecure control UI"** per `AI_DEPARTMENT_STRENGTHENING.md` line 84
- App health endpoint cuma hardcoded label, tidak benar-benar query OpenClaw

**Tiga skenario:**

| Skenario | Maksud | Effort | Risk |
|---|---|---|---|
| **A. Pension total** | Matikan OpenClaw, semua workflow pindah n8n + direct API | High (migrate semua workflow) | Medium (kehilangan custom logic kalau ada) |
| **B. Hybrid** | n8n untuk top-level orchestration, OpenClaw untuk specialized engine | Medium | Low (gradual) |
| **C. Keep + harden** | Tetap pakai OpenClaw, fix security UI + observability | Medium (security audit + auth wrapper) | Low |

**Decision yang harus kamu jawab:**
1. OpenClaw saat ini jalan workflow apa **yang tidak bisa di-replicate** dengan n8n + direct API?
2. Kalau jawaban "tidak ada" → pension. Kalau ada → hybrid atau keep.

### 2.3 Obsidian — knowledge base / second brain

**Apa itu:** Markdown note app dengan bidirectional linking, plugin ecosystem (Dataview, Templater, Excalidraw), graph view. Lokal-first, sync via Syncthing/iCloud/Obsidian Sync. Free untuk personal.

**Kenapa relevan untuk Gerai:**

| Kebutuhan | Saat ini | Obsidian bisa apa |
|---|---|---|
| Brand bible (canon, tone, palette, do/don't) | Tersebar di handoff doc + kode | Single source of truth, link bidirectional |
| SOP per role/department | SHARED_INSTRUCTIONS di server prompt | Markdown template, AI Department bisa baca via API |
| Decision log (kenapa pilih X bukan Y) | learningMemory.ts (localStorage) | Permanent + searchable + linked |
| Archive brief yang sudah selesai | briefStore.ts (localStorage volatile) | File markdown per brief, never lost |
| Persona library (system prompt per role) | Hardcoded di api/agent/reply.js | Editable markdown, hot-reload via webhook |
| Workflow template | Tersebar di docs/ | Templater plugin auto-generate |
| Knowledge graph relasi (vendor, SKU, supplier) | Belum ada | Native graph view |

**Skenario integrasi:**

```
Obsidian vault (local-first, syncthing)
   │
   ├── 00-brand/                      → brand canon, palette, voice
   │   ├── 00-bible.md
   │   ├── 01-tone-of-voice.md
   │   └── 02-palette.md
   │
   ├── 10-personas/                   → system prompts per role
   │   ├── ceo-atmaja.md
   │   ├── coo.md
   │   ├── cmo.md
   │   └── ... (17 file)
   │
   ├── 20-sops/                       → operating procedures
   │   ├── vendor-vetting.md
   │   └── ...
   │
   ├── 30-briefs/                     → archive brief markdown
   │   ├── 2026-05-23-launch-wave-1.md
   │   └── ...
   │
   ├── 40-decisions/                  → decision log
   │   └── ...
   │
   └── 50-knowledge/                  → product, vendor, market data
       └── ...

         │
         │ Syncthing sync ke droplet
         ▼
   n8n workflow: "Sync Obsidian to AI Department"
   • Watch folder /vault changes
   • Push markdown ke endpoint /api/knowledge/sync
   • Update server-side context untuk persona prompts
```

**Apakah perlu sekarang?**

- ✓ **Sangat berguna** kalau Matthew sudah punya >50 brief / decision / SOP yang tersebar
- ✓ **Sangat berguna** untuk memory bisnis permanent yang outlast localStorage
- ✓ **Sangat berguna** kalau mau hot-swap persona prompt tanpa redeploy
- ⚠ **Bisa ditunda** kalau saat ini Matthew cuma punya 5-10 dokumen, masih bisa langsung di-edit di kode

**Rekomendasi:** Setup Obsidian setelah pension/hybrid OpenClaw decision. Karena Obsidian = knowledge layer, OpenClaw/n8n = orchestration layer. Cleanly separated.

### 2.4 Anthropic API direct migration

**Detail di handoff doc + commit history.** Singkatnya:
- Phase 1: Install `@anthropic-ai/sdk`, abstract provider layer di endpoint
- Phase 2: Env switch `AI_PROVIDER=anthropic`, smoke test
- Phase 3: Production deploy, add prompt caching
- Effort: 2-3 jam Phase 1+2, 15 menit Phase 3
- Trigger: saat credit OpenRouter habis (sekarang sisa $19.63 dari $70)

### 2.5 Workmap visual + Brief lifecycle full

**Sudah ada infrastructure** (mermaid + recharts + BriefBlock renderer) tapi belum semua di-wire:
- Workmap card di brief detail bisa di-buka ke `/workmap/coo/1` dst (sebagian)
- Brief block types: markdown, chart, mermaid, generated-image (sudah render), generated-video (baru sekarang)
- ComposeSheet (generate brief) belum di-wire ke real `/api/agent/reply` content tier (masih simulate via mock)
- Job polling result Atmaja ke app (foundation)

### 2.6 Future capability lain

| Feature | Status | Effort |
|---|---|---|
| PDF native vision (Anthropic document block) | Belum di-wire | Medium |
| Image > 1.5 MB upload via signed URL | Belum | Medium |
| Zip auto-extract di server | Belum | Low-medium |
| Streaming reply (SSE) | Belum | Medium-high |
| Sora 2 storyboard sequence (multi-shot) | Belum | High |
| Voice input + TTS reply (OpenAI Realtime API) | Belum | High |
| Multi-language output (EN selain ID) | Belum | Low |
| Audit log persistent (Vercel KV atau D1) | Belum | Medium |
| Email digest (Resend / SES) | Belum | Low |

---

## Bagian 3 · Decision points untuk Matthew

Yang harus kamu putuskan untuk roadmap maju:

1. **OpenClaw masih jalan workflow custom apa yang n8n tidak bisa?**
   - Jawaban menentukan pension total / hybrid / keep
2. **n8n: self-host di droplet OpenClaw atau cloud $20/bulan?**
   - Cloud lebih cepat, self-host lebih murah + privacy
3. **Anthropic abstraction Phase 1 sekarang atau tunggu OpenRouter habis?**
   - Sekarang = lebih siap, OpenRouter habis di ~5000 chat lagi
4. **Obsidian vault setup sekarang atau setelah OpenClaw decision?**
   - Setelah OpenClaw lebih clean separation
5. **Prioritas next feature** (pilih 2-3):
   - Brief generation real (ComposeSheet wire ke remote)
   - Workmap full interactive
   - PDF native vision
   - Streaming reply
   - Sora 2 storyboard
   - Voice input + TTS

---

## Bagian 4 · Quick reference

### Live URLs
- Production: https://gerai.mahewwork.com
- Atmaja chat: https://gerai.mahewwork.com/atmaja
- Repo: https://github.com/MahewAi/Mahew
- Vercel project: gerai-app

### Key files untuk Matthew lihat
- `docs/AI_TRANSFER_MEMORY.md` — handoff lengkap (source of truth)
- `docs/AI_DEPARTMENT_STRENGTHENING.md` — roadmap penguatan area
- `docs/QUICKSTART_PC.md` — setup PC baru
- `docs/AUTOMATION_COST_CONTROL.md` — strategi kontrol biaya
- `docs/SECURITY_SYNC.md` — keamanan sync antar device
- `docs/ARCHITECTURE_MAP.md` — file ini

### Commands untuk verify state
```powershell
# Health endpoint
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/agent/health" -UseBasicParsing

# Credit OpenRouter
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/openrouter/credits" -UseBasicParsing

# Credit OpenAI
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/openai/credits" -UseBasicParsing

# Local dev start
cd "C:\Users\PC\Documents\Claude\Projects\Gerai app"
.\scripts\start-vercel-dev.ps1
# Buka http://localhost:3000/atmaja
```

---

**Update doc ini kalau ada perubahan signifikan supaya AI berikutnya + kamu sendiri tidak mulai dari nol.**

# LibreChat untuk 1000 Pintu — AI Department Deploy

LibreChat = multi-provider AI chat UI (Claude, Gemini, GPT, DeepSeek) open source. Sekarang configured dengan **5 AI Department agents BP-aligned** (Atmaja + CMO + COO + CCO + CFO) plus playground multi-provider untuk eksperimen.

**Source of truth:** BP Latest (Gerai 1000 Pintu BP Latest.pdf)
**Production deploy:** https://librechat-production-a164.up.railway.app

## Apa yang Sudah Configured

### 5 AI Department Agents (BP-aligned system prompts)

| Agent | Model | Function | Skill Catalog |
|---|---|---|---|
| **Atmaja** | Sonnet 4.6 (default) | CEO Orchestrator: strategic decomposition + multi-agent synthesis + executive briefing | `skills/atmaja/` (28 skills) |
| **CMO** | Sonnet 4.6 | Marketing: lead, channel, campaign, persona, content | `skills/cmo/` (31 skills) |
| **COO** | Sonnet 4.6 | Operations: vendor, supply, sprint, HR, Lean Store, risk | `skills/coo/` (25 skills) |
| **CCO** | Sonnet 4.6 (temp 0.5) | Brand & Creative: brand canon, editorial, visual, audience | `skills/cco/` (23 skills) |
| **CFO** | Sonnet 4.6 (temp 0.5) | Financial: budget, cash flow, unit economics, pricing | `skills/cfo/` (15 skills) |

### 8 Playground Models (raw, untuk eksperimen)

- Claude Opus 4.7 (strategic deep analysis)
- Claude Sonnet 4.6 (raw)
- Gemini 2.5 Pro (multimodal + reasoning)
- Gemini 2.5 Flash (cepat + murah, free tier)
- GPT-5 (benchmark)
- GPT-5.5 (latest)
- DeepSeek R1 Reasoner ($0.55/$2.19 per 1M tokens)
- DeepSeek V3 ($0.27/$1.10 per 1M tokens)

## Brand Canon Enforcement (LOCKED per BP)

Setiap agent system prompt include BP-aligned canon:

### Identity & Positioning
- **Tagline:** "A Thousand Doors, A Thousand Dreams" / "1000 Pintu, 1000 Mimpi" (BP Section 3.4.2)
- **Positioning:** "Dunia Pintu Indonesia" (BP Section 3.5)
- **Ekosistem:** 1000 Pintu = destination retail di bawah PT Selaras Lawang Sewu (BP Section 11.1)
- **Color palette:** "The Timeless Foundation" LOCKED (BP Section 15.1)
- **Brand karakter:** Inspiratif, berpengetahuan, premium tetapi inklusif, hangat dan membantu, modern dan sistematis

### Tone
- "Advisor yang membantu, BUKAN sales yang memaksa"
- "Premium tetapi inklusif" (BP Section 6.1) — semua segmen harga
- Inspiratif, berpengetahuan, hangat, jelas, terpercaya

### Editorial Rules
- TIDAK em-dash (period atau koma)
- "tempat" untuk cabang/showroom, BUKAN "rumah"
- "Gerai 1000 Pintu" lengkap formal, "1000 Pintu" body
- "Door Expert", "Marketing Advisor", "Self-Ordering Kiosk" preserved
- "Mitra Dagang" = channel partner (BUKAN persona)

### 6 Persona Customer-Facing (BP Section 6.2)
1. End User (Konsumen Akhir)
2. Arsitek
3. Kontraktor
4. Developer
5. Procurement Korporat
6. Aplikator

### 5 Nilai (BP Section 3.3)
1. Inspirasi
2. Keahlian
3. Pelayanan yang Nyaman
4. Inovasi
5. Aftersales

### 3 Pilar Bisnis (BP Bab 5)
- Product (katalog terlengkap)
- Knowledge (edukasi + inspirasi)
- Service (Marketing Advisor + Door Expert)

### Decision Hierarchy LOCKED
1. Brand canon (LOCKED — overrides all)
2. Strategic direction (Matthew/Atmaja)
3. Financial sustainability (CFO veto)
4. Operational feasibility (COO veto)
5. Customer experience (CMO+CCO joint)

### Matthew Preference (LOCKED)
- Panggil "Matthew" saja (BUKAN "Matthew Wijaya")
- Brief + actionable preferred
- Visual + architectural model resonates
- Independent synthesis (NO sycophancy)
- LOCKED founding knowledge NEVER overridden by daily preference

## Anti-Pattern Yang Dihindari (per BP)

Setiap agent system prompt explicit REJECT:

- "Aesop + DWR + Kinfolk anchor" (TIDAK di BP)
- "Filosofi 4-Dunia LOCKED as mandatory customer archetype" (TIDAK di BP — 4 negara hanya cultural context)
- Old tagline "Tempat impian dimulai dari pintu yang tepat" (BUKAN BP final)
- "Premium curated" Aesop-style (BP pakai "premium tetapi inklusif")
- "Brass focal 10%" assumption (refer Brand Guideline separate document)
- "Mitra Dagang" sebagai customer persona (BUKAN persona, channel partner)
- Em-dash + "rumah" customer-facing
- Sales agresif tone
- Sycophantic agreement
- Commission-based KPI

## Setup Status

### ✅ Sudah Done
- LibreChat deployed di Railway
- 5 agents configured dengan BP-aligned system prompts
- 8 playground models configured
- 5 avatars generated (`avatars/`)
- 122 skill catalog di `skills/` (BP-alignment partial — pending Phase D update)

### 🟡 Pending (Manual Steps untuk Matthew)
- Assign avatars per agent via LibreChat UI (Atmaja, CMO, COO, CCO, CFO)
- Test conversation flow per agent
- Verify production deploy reflects yaml updates
- Update skill catalog content ke BP terms (122 files — gradual)

### ❌ Deferred (Phase D++)
- **MCP server Gerai** — agent access ke Obsidian vault (`gerai-memory/`) sebagai memory layer
- **OpenAI-compat shim** `/v1/chat/completions` — untuk Custom Endpoint Atmaja Gerai full
- **Inter-agent handoff** — Atmaja auto-route ke C-Level

## Env Vars Required (Railway)

Per `.env.example`:
- `ANTHROPIC_API_KEY` (Anthropic Claude)
- `GOOGLE_KEY` (Gemini)
- `OPENAI_API_KEY` (GPT — kalau pakai)
- `DEEPSEEK_API_KEY` (kalau pakai)
- `JWT_SECRET` + `JWT_REFRESH_SECRET` (32+ char random)
- `CREDS_KEY` (32-byte hex) + `CREDS_IV` (16-byte hex)
- `MEILI_MASTER_KEY` (16+ char)
- `ALLOW_REGISTRATION=false` (production lock)

## Deploy Update

Setelah edit `librechat.yaml`:

1. Commit + push ke repo (auto-deploy via Railway GitHub integration)
2. Atau: upload manual via Railway dashboard → "Files" tab → upload librechat.yaml → redeploy
3. Tunggu Railway build (~2-3 menit)
4. Verify di production URL: agent baru muncul di model spec dropdown

## Test Conversation Flow

Setelah deploy, test:

1. **Atmaja test:**
   ```
   "Apa positioning core 1000 Pintu menurut BP?"
   ```
   Expected: Atmaja sebut "Dunia Pintu Indonesia" + 3 Pilar + advisor tone

2. **CMO test:**
   ```
   "Bagaimana strategi marketing untuk persona Arsitek?"
   ```
   Expected: CMO refer Wadah Arsitek + 4 Marketing Plan + 6 Pilar Konten

3. **COO test:**
   ```
   "Berapa staf per cabang Lean Store?"
   ```
   Expected: COO sebut "2 staf: MA + Office Boy" + Self-Ordering Kiosk + Door Expert pusat

4. **CCO test:**
   ```
   "Tagline 1000 Pintu apa?"
   ```
   Expected: "A Thousand Doors, A Thousand Dreams" + "1000 Pintu, 1000 Mimpi"

5. **CFO test:**
   ```
   "Strategi pricing 1000 Pintu?"
   ```
   Expected: Fixed price (no nego) + 10% premium vs toko mitra + 4 reward + baseline service

## Cost Estimate

Railway free tier: $5 credit/bulan.

Production usage estimate:
- LibreChat container: ~$3-5/bulan
- MongoDB Atlas: free tier OK
- Anthropic API: pay-per-token (Sonnet 4.6 ~$3/1M input, $15/1M output)
- Estimasi total bulanan: $10-30 untuk usage normal AI Department

## Roadmap LibreChat (Phase D++)

### Quick (sekarang done)
- ✅ BP-aligned system prompts 5 agents
- ✅ Playground multi-provider

### Medium (~4-6 jam manual UI work)
- Create formal Agents di LibreChat UI (Agents feature)
- Assign avatars per agent
- Test conversation flow

### Full (Phase D — 1-2 hari serious work)
- MCP server Gerai (api/mcp/index.js) — access Obsidian vault + memory
- OpenAI-compat shim — Atmaja Gerai full endpoint
- Inter-agent handoff automation
- Provider abstraction failover

## Notes

- Skill catalog di `skills/` content masih partial old (Aesop+DWR+Kinfolk references, 4-Dunia LOCKED, dll). Update gradual saat di-invoke. Vault Obsidian (`gerai-memory/`) is source of truth.
- Agent system prompts di yaml ini = production source of truth untuk LibreChat agents.
- Untuk update skill catalog content batch: pending decision Matthew.

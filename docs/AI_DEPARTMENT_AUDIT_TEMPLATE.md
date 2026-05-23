# AI Department Audit Template — Notion legacy vs current state

**Tanggal:** 2026-05-23
**Tujuan:** Standardize cara saya audit content Notion lama Matthew supaya bisa di-update jadi sync dengan kondisi Gerai 1000 Pintu sekarang.
**Cara pakai:** Matthew export Notion page "AI Department" ke markdown → kasih ke saya di `notion-import/` → saya jalankan audit pakai checklist ini → output `notion-export-updated/`.

---

## Bagian 1 · Yang akan saya cek per page Notion

### 1.1 Identitas + Brand DNA

Kriteria pass (semua harus benar):

- [ ] Nama produk = **"Gerai 1000 Pintu"** (lengkap, bukan disingkat)
- [ ] Lokasi = **Balikpapan**
- [ ] Scope = **nasional**
- [ ] Brand mood = **calm refined premium curated retail**
- [ ] Anchor mood = **Aesop + Design Within Reach**
- [ ] Owner = **Matthew (solo founder)**
- [ ] Brand palette:
  - Brass gold `#B8956B` (signature accent)
  - Deep charcoal `#1F1A14` (authority base)
  - Warm ivory `#FAF8F4` (clean support)
- [ ] Typography:
  - Display: **Cormorant Garamond**
  - Body: **Inter**
- [ ] Tone rules:
  - NO em-dash (—)
  - Pakai "tempat" bukan "rumah"
  - Sebut "Gerai 1000 Pintu" lengkap

### 1.2 AI Department struktur (17 role)

Kriteria pass:

- [ ] CEO **Atmaja** ada di top
- [ ] 4 C-suite: **COO, CMO, CFO, CCO**
- [ ] 12 specialist per parent C-suite:
  - **COO**: hr_systems, production_manager, curator
  - **CMO**: brand_strategist, market_researcher, sales_strategist, innovation_scout
  - **CFO**: business_designer, financial_analyst
  - **CCO**: document_writer, editorial, web_researcher
- [ ] Model tier per role:
  - Atmaja = **Opus 4.7** (content tier)
  - C-suite + specialist = **Sonnet 4.6** (orchestration tier)
- [ ] Persona description per role (system prompt) selaras dengan `api/agent/reply.js:50-68`

### 1.3 Endpoint + Tools yang dipakai

Kriteria pass — Notion mention semua yang sudah live:

**Chat endpoints:**
- [ ] `POST /api/atmaja/chat` (Atmaja content tier)
- [ ] `POST /api/agent/reply` (C-suite + specialist orchestration)

**Image endpoints:**
- [ ] `POST /api/openai/image` (gpt-image family + dall-e-3 legacy)
- [ ] `GET /api/openai/credits`

**Video endpoints (newest, sering missed di Notion lama):**
- [ ] `POST /api/openai/video/create`
- [ ] `GET /api/openai/video/status`
- [ ] `GET /api/openai/video/content`

**Meta endpoints:**
- [ ] `GET /api/agent/health`
- [ ] `GET /api/openrouter/credits`
- [ ] `POST /api/agent/briefs` (foundation)

**AI Provider:**
- [ ] OpenRouter (Anthropic Claude proxy) untuk text
- [ ] OpenAI direct untuk image + video
- [ ] Anthropic direct (planned migration)

**Tools / services:**
- [ ] Vercel (hosting + serverless)
- [ ] Namecheap (domain)
- [ ] OpenClaw droplet (specialized engine)
- [ ] n8n (orchestration, akan di-revive)
- [ ] Tavily (search, optional)

### 1.4 Slash command (yang sudah live)

Kriteria pass — Notion mention 12 command ini:

| Command | Model | Status saat audit |
|---|---|---|
| Free text chat | Opus 4.7 atau Sonnet 4.6 | [ ] |
| `/img <prompt>` | gpt-image-1 | [ ] |
| `/image <prompt>` | gpt-image-1 | [ ] |
| `/img2 <prompt>` | gpt-image-2 | [ ] |
| `/img15 <prompt>` | gpt-image-1.5 | [ ] |
| `/imgmini <prompt>` | gpt-image-1-mini | [ ] |
| `/dalle <prompt>` | dall-e-3 (legacy, may 404) | [ ] |
| `/vid <prompt>` | sora-2 | [ ] |
| `/video <prompt>` | sora-2 | [ ] |
| `/sora <prompt>` | sora-2 | [ ] |
| `/vidpro <prompt>` | sora-2-pro | [ ] |
| `/sora-pro <prompt>` | sora-2-pro | [ ] |

### 1.5 Defense layer (7 layer)

Kriteria pass:

- [ ] L1 — Privacy guard frontend (window.fetch hijacked saat lock on)
- [ ] L2 — CSP `connect-src 'self'`
- [ ] L3 — Server origin allowlist
- [ ] L4 — Rate limit (Chat 12, Agent 24, Image 6, Video 3 per IP per menit)
- [ ] L5 — Body cap + attachment validation (2.1 MB base64 image, max 2 per turn)
- [ ] L6 — Model floor whitelist (Sonnet 4.6 minimum chat)
- [ ] L7 — Secret isolation (key cuma di server env)

### 1.6 Workflow / lifecycle

Kriteria pass:

- [ ] Brief lifecycle 11 step (submit → fan-out → assemble → archive) ter-dokumentasi
- [ ] Approval gate mentioned
- [ ] Decision log + learning memory mentioned
- [ ] Private Sync Vault untuk export Syncthing
- [ ] AgentOutputEnvelope v1 schema

### 1.7 Tech stack

Kriteria pass:

- [ ] Vite + React 18 + TypeScript
- [ ] Tailwind v3 + shadcn/ui (Radix primitives)
- [ ] Framer Motion + Lucide React
- [ ] React Router v6
- [ ] vite-plugin-pwa
- [ ] react-markdown + remark-gfm + rehype-sanitize + rehype-raw
- [ ] mermaid 11.x + recharts 3.x
- [ ] @vercel/analytics + speed-insights

### 1.8 Department strength score (per area)

Kriteria pass — kalau Notion punya tabel ini, harus match dengan `src/data/departmentStrength.ts`:

| Area | Score current |
|---|---|
| Konsep Department | 98% |
| App / Dashboard | 86% |
| Rich Visual Output | 104% |
| Agent Runtime | 88% |
| Integrasi App ke Agent | 72% |
| Memory Bisnis | 94% |
| Automation Workflow | 82% |
| Security & Reliability | 58% |

---

## Bagian 2 · Yang biasanya outdated di Notion lama

Berdasarkan apa yang sudah berkembang sejak handoff awal (~3 hari ini banyak update), saya curiga Notion lama miss hal-hal ini:

1. **OpenAI Images integration** (baru di-wire kemarin) — `gpt-image-1/1.5/2/mini`
2. **OpenAI Sora 2 video integration** (baru hari ini) — `sora-2`, `sora-2-pro`
3. **12 slash command** — Notion lama mungkin cuma sebut "chat" tanpa command
4. **3 endpoint OpenAI video** (`/api/openai/video/{create,status,content}`)
5. **vercel.json rewrite exclusion** untuk dev compat (technical detail)
6. **Helper PowerShell scripts** (`start-vercel-dev.ps1`, `set-openai-key.ps1`, `set-openrouter-key.ps1`)
7. **Anthropic migration plan** (planned saat OpenRouter habis)
8. **n8n revival plan** (akan dibangun ulang)
9. **Architecture map doc** (`docs/ARCHITECTURE_MAP.md`)
10. **Brand canon strict no em-dash** (mungkin di Notion lama masih ada em-dash)

Setiap item di atas akan saya cek di markdown export dan tag sebagai **OUTDATED — perlu rewrite** kalau Notion lama masih state lama.

---

## Bagian 3 · Section baru yang saya saranin ditambah ke Notion

Kalau Notion lama belum punya, saya akan suggest add:

### Page baru #1: "Slash Command Reference"
Tabel 12 command + use case + cost estimate.

### Page baru #2: "API Endpoint Map"
Tabel 10 endpoint + method + request schema + response schema + tier + provider.

### Page baru #3: "Decision Log Permanent"
Format:
```
## 2026-05-23 — Switch DALL-E 3 → gpt-image-2 family
Context: DALL-E 3 tidak available di akun OpenAI Matthew (post-2026 pension)
Options considered: A) request DALL-E 3 access  B) skip image gen  C) pakai gpt-image
Decision: C, pakai gpt-image family (gpt-image-2 kualitas tertinggi)
Reasoning: Lebih baru, text-in-image lebih bagus, sudah tersedia tanpa request access
Trade-off: Tidak ada (gpt-image strictly better)
```

### Page baru #4: "Workflow Lifecycle"
Diagram + step-by-step satu brief dari submit ke archive (11 step di ARCHITECTURE_MAP).

### Page baru #5: "Cost Tracking"
Live link ke `/api/openrouter/credits` + `/api/openai/credits` + history monthly spend.

### Page baru #6: "Brand Canon Strict"
- NO em-dash (—) di output AI Department
- Pakai "tempat" bukan "rumah"
- Sebut "Gerai 1000 Pintu" lengkap
- Tone: calm refined premium curated retail
- Palette + typography
- Anchor mood: Aesop + Design Within Reach

### Page baru #7: "Defense Layers Reference"
7 layer security defense + apa block-nya + cara verify

---

## Bagian 4 · Output yang akan saya hasilkan setelah audit

Untuk setiap page Notion lama yang saya audit, output saya akan:

```
File: notion-export-updated/<page-name>.md

## AUDIT VERDICT
Status: [ PASS | UPDATE | REPLACE | ARCHIVE ]
- PASS: konten masih relevant, no change needed
- UPDATE: ada 1-3 item outdated, saya update inline
- REPLACE: 50%+ outdated, saya tulis ulang dari nol
- ARCHIVE: tidak relevant lagi, saran pindah ke /archive folder

## GAP YANG SAYA TEMUKAN
1. [outdated item 1] — should be [current state]
2. [outdated item 2] — should be [current state]
...

## CONTENT YANG SAYA TULIS
<markdown rewrite>
```

Plus output summary di root: `notion-export-updated/AUDIT_SUMMARY.md` dengan tabel page → verdict + count gap.

---

## Bagian 5 · Cara Matthew handle output saya

Setelah saya selesai audit + tulis markdown updated:

1. Buka folder `notion-export-updated/`
2. Per page yang status `UPDATE` atau `REPLACE`:
   - Buka page yang sama di Notion
   - Pilih semua content (Ctrl+A di page) → delete
   - Copy content markdown dari file → paste ke Notion (Notion auto-convert markdown ke blocks)
3. Per page yang status `ARCHIVE`:
   - Move ke folder Archive di Notion
4. Per page status `PASS`:
   - Skip, tidak perlu sentuh

**Estimasi waktu Matthew:** ~30-60 menit untuk apply 10-15 page updates.

---

**Note:** Audit ini hanya jalan kalau Matthew export Notion ke markdown dan letakkan di folder `notion-import/` di repo. Saya tidak akses Notion via API tanpa Matthew setup integration token explicit.

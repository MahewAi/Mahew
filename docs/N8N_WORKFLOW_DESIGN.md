# n8n Workflow Design — Gerai 1000 Pintu

**Tanggal:** 2026-05-23
**Status:** Design draft, siap diimplementasi setelah Matthew buat akun n8n.cloud baru
**Posisi di arsitektur:** Orchestration layer di atas Vercel app + OpenClaw + OpenAI direct API

---

## Bagian 1 · Kenapa n8n + bagaimana relasi dengan komponen lain

```
Matthew
   │
   ▼
┌───────────────────────────────────────────────────────────┐
│ Vercel App (gerai.mahewwork.com)                          │
│ - UI live chat (Atmaja + AskRolePanel + CommentThread)    │
│ - Real-time inference (Opus + Sonnet + gpt-image + Sora)  │
└──────┬────────────────────────────────────────────────────┘
       │  webhook
       ▼
┌───────────────────────────────────────────────────────────┐
│ n8n Cloud (akan dibangun ulang)                           │
│ - Workflow orchestration (brief lifecycle, cron, batch)   │
│ - Audit trail visual (kenapa C-level reply gini)          │
│ - Retry, branching, error handling                        │
│ - Cross-service: OpenAI + Anthropic + Tavily + Notion +   │
│   Google Sheets + email + Discord (optional)              │
└──┬─────────────────────────────────────┬──────────────────┘
   │  HTTP                                │  HTTP / SSH
   ▼                                      ▼
OpenAI / Anthropic / OpenRouter      OpenClaw droplet
(text + image + video inference)     (Tavily search + specialized
                                      logic + Atmaja runtime
                                      yang sudah ada)
```

**Pembagian tugas yang clean:**

| Layer | Tanggung jawab | Tool |
|---|---|---|
| **UI + sync interaction** | Real-time chat, atomic ops | Vercel app |
| **Orchestration + async flow** | Brief lifecycle, cron, fan-out, audit | n8n |
| **Specialized engine** | Tavily search wrapper, custom heavy compute | OpenClaw droplet |
| **Raw inference** | Token generation, image, video | OpenAI / Anthropic / OpenRouter |

---

## Bagian 2 · Workflow yang akan dibangun

### Workflow #1 — Brief Lifecycle Async

**Tujuan:** Kalau Matthew submit brief via app, fan-out paralel ke 4 C-suite + dapat hasil terstruktur + final Atmaja synthesis.

**Beda dengan implementasi sekarang di app:** Sekarang AskRolePanel cuma chat per satu role secara manual. Brief generation real (ComposeSheet) belum di-wire. n8n akan handle parallel multi-role + assembly otomatis.

**Trigger:**
- Webhook: `POST https://<n8n-url>/webhook/gerai-brief-submit`
- Body schema:
  ```json
  {
    "briefId": "br-<uuid>",
    "title": "string",
    "summary": "string (max 2000)",
    "context": "string (optional, max 3000)",
    "contributors": ["coo", "cmo", "cfo", "cco"],
    "deadline": "ISO date (optional)",
    "callbackUrl": "https://gerai.mahewwork.com/api/agent/briefs/result"
  }
  ```

**Node graph:**

```
[1] Webhook Trigger (POST /webhook/gerai-brief-submit)
       │
       ▼
[2] Function — Validate input
    • briefId format check
    • contributors whitelist (ceo/coo/cmo/cfo/cco/specialist*)
    • Log audit ke Set node
       │
       ▼
[3] Split In Batches — pisah per contributor
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼ (COO)            ▼ (CMO)            ▼ (CFO)            ▼ (CCO)
   [4a] HTTP Request   [4b] HTTP Request  [4c] HTTP Request  [4d] HTTP Request
   POST gerai.mahew.. POST gerai.mahew.. POST gerai.mahew.. POST gerai.mahew..
   /api/agent/reply   /api/agent/reply   /api/agent/reply   /api/agent/reply
   {role:coo,         {role:cmo,         {role:cfo,         {role:cco,
    tier:orchestration, ...}            ...}                ...}
    userMessage: brief.summary + brief.context}
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                                  │
                                  ▼
[5] Merge — wait all responses (mode: combineByPosition)
       │
       ▼
[6] Function — Format collected C-suite output
    • Build planning frame (objective, current state, plan A, plan B, risks)
    • Map to AgentOutputEnvelope v1 schema (src/lib/agentContracts.ts)
       │
       ▼
[7] HTTP Request — Atmaja Opus 4.7 final synthesis
    POST gerai.mahewwork.com/api/atmaja/chat
    {userMessage: "Sintesakan output 4 C-suite ini jadi 1 keputusan + 3 next action.",
     history: [...4 c-suite outputs as assistant messages]}
       │
       ▼
[8] Function — Build final envelope
    {summary, planningFrame, blocks: [c-suite outputs + atmaja synth],
     qualityGates, nextActions, memoryPolicy}
       │
       ▼
[9] HTTP Request — Webhook callback ke app
    POST {callbackUrl from trigger}
    {briefId, status: "completed", result: envelope}
       │
       ▼
[10] (Optional) Notion sync — push hasil ke page archive
[11] (Optional) Email digest — Resend / SES kalau ada decision urgent
```

**Estimasi runtime:** 30-90 detik per brief (4 C-suite parallel ~25s + Atmaja synth ~20s + overhead).

**Cost per run (current pricing):**
- 4× Sonnet 4.6 reply (~1500 input + 500 output tokens each) = ~$0.008
- 1× Opus 4.7 synthesis (~3000 input + 800 output) = ~$0.024
- Total ~$0.032 per brief

**Error handling:**
- Kalau salah satu C-suite gagal, retry 2x dengan exponential backoff
- Kalau Atmaja synth gagal, send partial result + flag `degraded`
- Kalau webhook callback gagal, retry queue + dead letter

**Credentials yang n8n butuh:**
- `GERAI_APP_URL` (env): https://gerai.mahewwork.com
- Tidak butuh API key OpenAI/OpenRouter karena n8n cuma call app endpoint (app yang punya key)
- Optional: `NOTION_API_KEY` (kalau workflow Notion sync aktif)

---

### Workflow #2 — Daily Digest Cron

**Tujuan:** Setiap pagi jam 7 (WITA), kirim ringkasan ke Matthew: brief yang in-progress, decision yang pending, signal yang muncul dari recurring radar kemarin.

**Trigger:**
- Schedule: `cron: 0 7 * * *` (07:00 setiap hari, timezone Asia/Makassar)

**Node graph:**

```
[1] Schedule Trigger (07:00 daily)
       │
       ▼
[2] HTTP GET https://gerai.mahewwork.com/api/agent/health
    → cek bridge state
       │
       ▼
[3] HTTP GET https://gerai.mahewwork.com/api/agent/briefs/list?status=in_progress
    (endpoint baru perlu dibuat di app)
       │
       ▼
[4] HTTP POST https://gerai.mahewwork.com/api/atmaja/chat
    {userMessage: "Sintesakan kondisi Gerai 1000 Pintu hari ini berdasarkan
     {brief list} + {signal kemarin}. Format: 3 prioritas, 1 risiko utama,
     1 next action konkret. Maximum 200 kata."}
       │
       ▼
[5] (Optional) HTTP POST → Email/Discord/WhatsApp ke Matthew
   atau push notification via FCM (kalau PWA push aktif)
```

**Estimasi runtime:** ~10-20 detik per run.
**Cost per run:** ~$0.005 (1 Opus call, hemat).

---

### Workflow #3 — Image Generation Batch

**Tujuan:** Bulk-generate visual untuk catalog SKU baru (kalau Matthew upload list product). Tiap SKU dapat 4 variant image otomatis.

**Trigger:**
- Webhook: `POST https://<n8n-url>/webhook/gerai-image-batch`
- Body: `{ products: [{sku, name, brandPositioning, brief}], variantCount: 4 }`

**Node graph:**

```
[1] Webhook Trigger
       │
       ▼
[2] Split In Batches — per product
       │
       ▼
[3] Function — Build prompt
    "Premium curated retail product photography: {name}, {brandPositioning},
     warm ivory backdrop, brass gold accent, deep charcoal contrast, editorial mood"
       │
       ▼
[4] Loop variantCount times:
       HTTP POST https://gerai.mahewwork.com/api/openai/image
       {prompt, model: "gpt-image-2", size: "1024x1024", quality: "high"}
       │
       ▼
[5] Function — Collect 4 dataUri per product
       │
       ▼
[6] (Optional) HTTP POST → save URLs ke Notion page atau Google Sheets
       │
       ▼
[7] Webhook callback ke app dengan batch result
```

**Estimasi runtime:** ~70 detik per SKU (4× ~17s image gen + overhead).
**Cost per SKU:** ~$0.16-0.30 (4 image @ $0.04-0.08 each).

---

### Workflow #4 — Notion Knowledge Sync (Optional, butuh setup integration token)

**Tujuan:** Auto-pull update dari Notion page "AI Department" ke server, supaya persona prompt + brand canon bisa di-edit di Notion tanpa redeploy code.

**Prasyarat:** Matthew setup Notion API integration + share page ke integration.

**Trigger:** Schedule cron `*/15 * * * *` (every 15 menit) atau webhook dari Notion Automations (kalau Notion Business plan).

**Node graph:**

```
[1] Schedule Trigger (every 15 min) atau Notion Trigger
       │
       ▼
[2] Notion → Get database pages (filter: tag = "ai-persona" atau "brand-canon")
       │
       ▼
[3] Function — Transform Notion blocks ke markdown
       │
       ▼
[4] HTTP POST https://gerai.mahewwork.com/api/knowledge/sync
    (endpoint baru perlu dibuat di app)
    {kind: "persona" | "brand" | "sop", role: "coo", content: "<markdown>"}
       │
       ▼
[5] App update server-side persona context (in-memory cache atau Vercel KV)
```

**Estimasi runtime:** ~5-10 detik per run (incremental).
**Cost:** $0 (Notion API gratis sampai 1000 request/day).

---

### Workflow #5 — Recurring Market Radar (Optional, butuh Tavily key di n8n)

**Tujuan:** Setiap senin pagi, scan trend market premium retail / Balikpapan / segment kompetitor. Output: 3-5 signal untuk Innovation Scout review.

**Trigger:** `cron: 0 8 * * 1` (Senin 08:00 WITA).

**Node graph:**

```
[1] Schedule (Senin 08:00)
       │
       ▼
[2] HTTP GET Tavily search
    queries: ["premium curated retail Indonesia trend",
              "Balikpapan retail market 2026",
              "Aesop competitor launch wave",
              "Indonesia premium gift market"]
       │
       ▼
[3] Function — Dedup + rank by relevance
       │
       ▼
[4] HTTP POST https://gerai.mahewwork.com/api/agent/reply
    {role: "innovation_scout", tier: "orchestration",
     userMessage: "Rangkum 5 signal terkuat dari list trend ini ke 1 paragraf
                   + 1 actionable opportunity. List: {signals}"}
       │
       ▼
[5] (Optional) push ke app sebagai brief baru status="draft"
[6] (Optional) Notion sync ke page Market Intel
```

**Estimasi runtime:** ~30 detik.
**Cost per run:** ~$0.003 (1 Sonnet call) + Tavily search fee (gratis up to 1000/month).

---

## Bagian 3 · Implementation checklist (apa yang perlu kamu siapkan)

### Saat membuat akun n8n.cloud baru

- [ ] Buat akun di https://app.n8n.cloud/register (atau Sign in with Google)
- [ ] Pilih plan Starter (free, 5 active workflows)
- [ ] Note URL workspace (mis. `https://<workspace>.n8n.cloud`)
- [ ] Generate Personal API key di Settings → API (untuk integrasi nanti)

### Credential yang n8n butuh

| Credential | Untuk workflow | Sumber |
|---|---|---|
| `GERAI_APP_URL` | All | Set di n8n env: `https://gerai.mahewwork.com` |
| Tavily API key | #5 only | https://tavily.com (gratis tier) |
| Notion API integration token | #4 only | https://www.notion.so/my-integrations |
| Email provider (Resend / SES) | #2 #1 callback | Optional, generate di provider |

### Endpoint app yang perlu kita tambah (di repo gerai-app, server-side)

| Endpoint | Untuk workflow | Status |
|---|---|---|
| `GET /api/agent/briefs/list?status=` | #2 daily digest | Belum ada, perlu dibuat |
| `POST /api/agent/briefs/result` (callback) | #1 brief lifecycle | Belum ada, perlu dibuat |
| `POST /api/knowledge/sync` | #4 Notion sync | Belum ada, perlu dibuat |

### Sekuriti

- Webhook trigger n8n harus pakai bearer token / signature verification (jangan public)
- App callback endpoint harus validasi origin dari n8n cloud
- Notion integration token simpan di n8n credential store, tidak di workflow JSON

---

## Bagian 4 · Implementation order yang masuk akal

```
Sprint 1 (~2 hari, fokus dasar):
1. Matthew buat akun n8n.cloud baru
2. Saya tambah endpoint app: /api/agent/briefs/list + /api/agent/briefs/result
3. Saya export Workflow #1 sebagai JSON template (saya tulis dulu, kamu import)
4. Test end-to-end: submit brief via app → n8n process → result back

Sprint 2 (~1 hari, automation cron):
5. Setup Workflow #2 Daily Digest
6. Pilih channel notification (email / Discord / WhatsApp Business API)
7. Verify 3 hari running

Sprint 3 (~2 hari, knowledge sync + radar):
8. Setup Notion integration token + Workflow #4 (Notion sync)
9. Saya tambah endpoint /api/knowledge/sync di app
10. Setup Tavily key + Workflow #5 Market Radar

Sprint 4 (~1 hari, batch ops):
11. Workflow #3 Image batch
12. Stress test dengan 10 SKU sample
```

---

## Bagian 5 · Pertanyaan terbuka untuk Matthew

1. **Notification channel** untuk Daily Digest pilih apa: email Resend, Discord webhook, WhatsApp Business API, atau push PWA?
2. **OpenClaw integration** — ada workflow OpenClaw yang masih jalan dan perlu di-trigger dari n8n? Kalau ada, kasih saya endpoint OpenClaw + auth.
3. **Notion structure** — page "AI Department" sekarang di Notion struktur folder-nya seperti apa? (akan saya audit setelah kamu export markdown)
4. **Webhook security** — pakai bearer token sederhana atau full HMAC signature?

---

**Update doc ini sambil sprint jalan supaya design tetap sync dengan implementasi.**

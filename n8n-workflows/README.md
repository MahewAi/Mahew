# n8n Workflows for Gerai 1000 Pintu

**Status:** Siap import ke n8n.cloud account Matthew.
**Cara import:** 2 langkah per workflow, total 5 menit untuk semua.

---

## Cara import (per workflow file)

1. Login ke n8n.cloud, masuk ke workspace kamu
2. Klik **+ Add workflow** (atau **New** kanan atas)
3. Klik menu **⋯** (titik tiga kanan atas) → **Import from File**
4. Pilih file `.json` dari folder `n8n-workflows/` di repo ini
5. Klik **Save** (Ctrl+S)
6. Sebelum activate, setup 1 credential (lihat bagian "Credentials" di bawah)
7. Klik toggle **Active** di kanan atas saat siap

Ulangi untuk workflow `01-` dan `02-`.

---

## Credentials yang perlu di-setup (sekali saja)

Setiap workflow pakai credential `gerai_n8n_token` untuk auth callback ke app.

**Setup:**

1. Di n8n, kiri sidebar klik **Credentials**
2. Klik **+ Add credential**
3. Cari **Generic Credential** atau **HTTP Header Auth** (yang mana saja)
4. Name: `gerai_n8n_token`
5. Field: `token`
6. Value: `<paste dari .env.local PC dev kamu, key N8N_WEBHOOK_TOKEN>`
7. Save

Token-nya yang sama dengan yang sudah saya generate di `.env.local` dan sudah di-set di Vercel cloud Production. Kamu cuma perlu copy-paste sekali.

**Cara dapat token-nya:**

Opsi A (kalau kamu di PC dev yang sama dengan saya):
```powershell
Get-Content "C:\Users\PC\Documents\Claude\Projects\Gerai app\.env.local" | Select-String "N8N_WEBHOOK_TOKEN"
```

Opsi B (via Vercel dashboard):
1. Buka https://vercel.com/dashboard
2. Project gerai-app → Settings → Environment Variables
3. Klik mata di samping `N8N_WEBHOOK_TOKEN` (production) → copy

---

## Workflow #1 — Brief Lifecycle (`01-brief-lifecycle.json`)

**Apa:** Receive brief submit via webhook, fan-out ke 4 C-suite (COO/CMO/CFO/CCO) parallel via Sonnet 4.6, aggregate, sintesakan via Atmaja Opus 4.7, callback hasil ke app.

**Trigger:** Webhook URL otomatis ter-generate setelah import. Biasanya format:
`https://<workspace>.app.n8n.cloud/webhook/gerai-brief-submit`

**Body schema:**
```json
{
  "briefId": "br-xxx (optional, auto-generated kalau kosong)",
  "title": "string (required, max 200)",
  "summary": "string (required, max 2000)",
  "contributors": ["coo", "cmo", "cfo", "cco"]  // optional, default 4 c-suite
}
```

**Output:** Synchronous response dengan summary + status. Plus async callback ke `https://gerai.mahewwork.com/api/agent/briefs?action=result`.

**Cost per run:** ~$0.03 (4× Sonnet 4.6 + 1× Opus 4.7).

**Estimasi waktu:** 30-90 detik tergantung response time AI.

---

## Workflow #2 — Daily Digest (`02-daily-digest.json`)

**Apa:** Cron 07:00 WITA setiap hari. Pull list brief aktif dari `/api/agent/briefs?action=list&status=in_progress`. Sintesa via Atmaja → 3 prioritas + 1 risiko + 1 next action.

**Trigger:** Schedule cron (auto-jalan).

**Output:** JSON ringkasan harian. Belum connect ke channel notif (email/Discord) — itu Matthew tambah sendiri di n8n dengan node yang dia pilih (Resend, Discord, Telegram, dll).

**Cost per run:** ~$0.005 (1× Opus 4.7).

---

## Bagaimana ke depan

Setelah 2 workflow ini jalan stabil (1-2 hari trial), saya bisa generate workflow tambahan:
- **#3 Notion Knowledge Sync** (auto-pull dari Notion ke server, butuh Matthew setup Notion API integration token dulu)
- **#4 Image Generation Batch** (bulk catalog SKU)
- **#5 Market Radar** (Tavily search Senin pagi)

Tapi prioritas: jalanin #1 + #2 dulu, kasih feedback ke saya, baru tambah.

---

## Troubleshooting

**"Auth failed" saat workflow execute:**
- Cek credential `gerai_n8n_token` value sama dengan `N8N_WEBHOOK_TOKEN` di Vercel cloud
- Token harus persis sama (case-sensitive, no whitespace)

**"Webhook 404" saat hit URL:**
- Pastikan workflow toggle **Active** ON
- URL webhook bisa dilihat di node **Webhook: Brief Submit** setelah workflow di-save

**"Timeout" saat C-suite call:**
- Default timeout 60s. Kalau Opus + Sonnet lemot di hari tertentu, naikkan timeout di node httpRequest

**Mau test workflow #1 tanpa app:**
```bash
curl -X POST https://<workspace>.app.n8n.cloud/webhook/gerai-brief-submit \
  -H "content-type: application/json" \
  -d '{
    "title": "Test brief premium product launch",
    "summary": "Sintesakan strategi peluncuran wave 1 produk premium curated retail Balikpapan Q3 2026"
  }'
```

Tunggu ~60 detik, dapat response dengan synthesis.

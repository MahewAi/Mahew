# Payment Tracker — Gerai 1000 Pintu

Single source of truth untuk semua pembayaran provider yang Matthew lakukan. Live storage di Vercel KV `atmaja:payments:matthew`, accessible via API `/api/atmaja/memory?type=payments`.

---

## Provider yang di-track

| Provider | Tujuan | Pricing model | URL dashboard |
|---|---|---|---|
| **Anthropic** (NEW, 25 Mei 2026) | LLM API Claude Opus 4.7 + Sonnet 4.6 native | Pay-as-you-go, $15/MTok input + $75/MTok output Opus | https://console.anthropic.com/settings/billing |
| **OpenRouter** | LLM API fallback (Claude via reseller) | Pay-as-you-go + ~5-10% markup | https://openrouter.ai/credits |
| **OpenAI** | Image gen (DALL-E + GPT-Image) + Video gen (Sora 2) | Pay-as-you-go | https://platform.openai.com/usage |
| **Vercel** | Hosting PWA + serverless + KV + Blob | Hobby plan (free tier) | https://vercel.com/mahewais-projects/gerai-app/settings/billing |
| **n8n Cloud** | Workflow automation | $20/bulan (paid plan) | https://app.n8n.cloud/billing |
| **Domain mahewwork.com** | Domain registration | Yearly | (provider registrar Matthew) |
| **GitHub** | Source code hosting | Free tier | https://github.com/settings/billing |

---

## Payment history (chronological, latest first)

### 25 Mei 2026 — Anthropic $30 ✓ Logged

- **Provider:** Anthropic (https://console.anthropic.com/)
- **Amount:** $30 USD
- **Type:** Deposit (initial credit)
- **Purpose:** Switch Atmaja chat dari OpenRouter ke direct Anthropic API untuk quality + reliability
- **Estimated runway:** ~100-300 chat session Opus 4.7 (tergantung token usage rata-rata)
- **Status:** Credit deposited, **API key belum di-generate + set di Vercel env var** (PENDING — Matthew lakukan)

### Sebelumnya (per memory file)

- **OpenRouter:** Total deposit $70, sisa **$9.04** (per 25 Mei 2026, warning threshold $20)
- **OpenAI:** Matthew sudah deposit (amount tidak tercatat di memory, cek dashboard)
- **n8n Cloud:** $20/bulan recurring
- **Vercel:** Free tier
- **GitHub:** Free tier

---

## Action items setelah deposit Anthropic $30

| # | Action | Effort | Status |
|---|---|---|---|
| 1 | Generate Anthropic API key di console.anthropic.com → Settings → API Keys → Create Key | 2 menit | Pending Matthew |
| 2 | Copy key (format `sk-ant-api03-...`) | 30 detik | Pending Matthew |
| 3 | Set di Vercel env var `ANTHROPIC_API_KEY` (Production + Preview) | 2 menit | Pending Matthew |
| 4 | Redeploy (push commit kosong atau Vercel dashboard redeploy) | 1 menit | Pending Matthew |
| 5 | Verify via `https://gerai.mahewwork.com/api/agent/health` → cek `"provider":"Anthropic (direct)"` | 30 detik | Pending Matthew |

Detail lengkap di `docs/ANTHROPIC_DIRECT_API_SETUP.md`.

---

## Cara log payment baru

### Via curl (manual)

```bash
curl -X POST "https://gerai.mahewwork.com/api/atmaja/memory?type=payments" \
  -H "Sec-Fetch-Site: same-origin" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "Anthropic",
    "amount": 30,
    "currency": "USD",
    "type": "deposit",
    "date": "2026-05-25",
    "method": "credit_card",
    "note": "Initial deposit untuk switch ke direct API"
  }'
```

### Via Atmaja chat (natural language — TODO build intent detection)

Bisa nanti Atmaja parse "saya barusan deposit $X ke provider Y" → auto-log payment.

---

## Cara lihat semua payment + summary

```bash
curl -s "https://gerai.mahewwork.com/api/atmaja/memory?type=payments" \
  -H "Sec-Fetch-Site: same-origin" | jq
```

Return shape:
```json
{
  "ok": true,
  "payments": [
    { "id": "pay-...", "provider": "Anthropic", "amount": 30, ... }
  ],
  "count": 1,
  "summary": {
    "Anthropic": { "totalDeposited": 30, "depositCount": 1, "lastDeposit": "2026-05-25" }
  },
  "totalDepositedUsd": 30
}
```

---

## Auto-fetch balance dari provider (existing endpoints)

Atmaja PWA punya endpoint yang auto-fetch balance live dari provider:

| Provider | Endpoint app | Underlying API |
|---|---|---|
| OpenRouter | `/api/openrouter/credits` | https://openrouter.ai/api/v1/credits |
| OpenAI | `/api/openai/credits` | https://api.openai.com/v1/dashboard/billing/credit_grants |
| Anthropic | belum ada (future: butuh admin API key) | https://api.anthropic.com/v1/organizations/{org}/usage_costs (admin only) |
| Vercel | tidak via API public | dashboard manual |
| n8n | tidak via API | dashboard manual |

---

## Forecast & alert

| Provider | Sisa estimasi | Notes |
|---|---|---|
| Anthropic | $30 (baru deposit) | ~100-300 session tergantung complexity. Threshold warning < $10 |
| OpenRouter | $9.04 (sebelum hardcode threshold $20) | Akan habis kalau lanjut test. Top-up atau switch full ke Anthropic |
| OpenAI | unknown (cek dashboard) | Pakai untuk image/video gen. Threshold warning < $5 |
| n8n Cloud | $20/bulan | Auto-charge tiap bulan. Cek billing untuk next charge date |
| Vercel | $0 (free tier) | Kalau exceeds free tier (banyak storage Blob), bisa charge |

Health endpoint `/api/agent/health` punya `warnings[]` array yang surface credit warnings:
- Severity: `info` / `warning` / `critical`
- Type: `openrouter_credit_low`, `openai_credit_low`, dll
- Message: human-readable warning

---

## Monthly cost estimate

Berdasarkan usage pattern Matthew (rough estimate):

| Item | Cost/bulan |
|---|---|
| Anthropic API (100-200 chat session) | $20-40 |
| OpenRouter fallback | $0-5 (jarang dipakai kalau Anthropic primary) |
| OpenAI image/video gen | $5-20 (tergantung frequency) |
| n8n Cloud | $20 |
| Vercel | $0 (Hobby) |
| Domain mahewwork.com | $1-2 (yearly amortized) |
| GitHub | $0 |
| **TOTAL** | **$45-90/bulan** |

Compare ke alternative:
- ChatGPT Plus: $20/bulan (single user, plus all OpenAI features built-in)
- Claude.ai Pro: $20/bulan (single user, Anthropic only)

Atmaja PWA = $45-90/bulan tapi punya unique features (brand canon, live trace, custom UI). Trade-off: more cost untuk customization.

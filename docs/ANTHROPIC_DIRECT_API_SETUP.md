# Setup Anthropic Direct API untuk Atmaja

Atmaja sekarang support 2 provider:

| Provider | Status | Quality | Latency | Cost |
|---|---|---|---|---|
| **Anthropic Direct** (recommended) | Aktif kalau `ANTHROPIC_API_KEY` di-set | Best (no middleware) | Faster | Anthropic pricing direct |
| **OpenRouter** (fallback) | Default kalau Anthropic key tidak ada | Same model, slight overhead | Slightly slower | ~10% markup OpenRouter |

Auto-routing: kalau `ANTHROPIC_API_KEY` ada di env, Atmaja pakai Anthropic direct. Else fallback ke OpenRouter (existing behavior, backward compat).

---

## Steps untuk Matthew

### 1. Generate Anthropic API key

1. Buka https://console.anthropic.com/
2. Login dengan akun Matthew (atau buat baru)
3. Top up credit minimal $5 (Pay-as-you-go atau kartu kredit)
4. Settings → API Keys → Create Key
5. Name: "Atmaja Gerai 1000 Pintu Production"
6. Copy key (format: `sk-ant-api03-...`)

### 2. Set env var di Vercel

1. Buka https://vercel.com/mahewais-projects/gerai-app/settings/environment-variables
2. Add new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste key yang Matthew copy
   - Environments: Production + Preview (centang dua-duanya)
   - Sensitive: gak usah on (Vercel sudah default encrypt env vars)
3. Klik Save
4. Redeploy: Deployments tab → terakhir → menu titik 3 → Redeploy (atau push commit baru ke main)

### 3. Verify

Setelah redeploy:
```bash
curl -s "https://gerai.mahewwork.com/api/agent/health" | grep -o '"provider":"[^"]*"'
```

Harusnya output: `"provider":"Anthropic (direct)"`. Kalau masih `"OpenRouter"`, env var belum aktif atau redeploy belum jalan.

---

## Quality benefits Anthropic direct vs OpenRouter

| Aspek | OpenRouter | Anthropic Direct |
|---|---|---|
| Model availability | Tergantung OpenRouter routing | Pasti ke Anthropic native |
| Latency | +200-500ms overhead | Direct, fastest |
| Reliability | Tergantung OpenRouter uptime | Anthropic SLA langsung |
| Quality consistency | Bisa ada slight variance | Identical to Claude.ai |
| Streaming support | Yes | Yes (kalau di-build later) |
| Vision API | Yes | Yes (native) |
| PDF native reading | Yes | Yes (native) |
| Cost | Pricing OpenRouter + 5-10% markup | Anthropic list price |

**Cost comparison untuk Atmaja usage volume Matthew:**
- 100 chat sessions/bulan rata-rata 5K input + 3K output token
- Opus 4.7 pricing: $15/MTok input, $75/MTok output
- Total per session: ~$0.30
- Per bulan: ~$30 (vs OpenRouter dengan markup ~$33)

Saving minimal ($3/bulan), tapi quality + reliability gain meaningful.

---

## Rollback ke OpenRouter

Kalau Anthropic key bermasalah / habis credit, Atmaja auto-fallback ke OpenRouter (selama `OPENROUTER_API_KEY` masih set).

Untuk force pakai OpenRouter (skip Anthropic):
1. Vercel env vars → delete atau rename `ANTHROPIC_API_KEY` jadi `ANTHROPIC_API_KEY_DISABLED`
2. Redeploy

---

## Catatan teknis

- Model mapping otomatis: `anthropic/claude-opus-4.7` (OpenRouter ID) → `claude-opus-4-7-20250620` (Anthropic native ID)
- System prompt + messages format auto-converted antar dua format
- Memory extractor (Sonnet 4.6) juga ikut auto-route via `callLLM` dispatcher
- Response adapter: Anthropic response shape → OpenAI-compatible shape supaya downstream code tidak perlu rubah

Implementasi di `api/atmaja/chat.js`:
- `USE_ANTHROPIC_DIRECT` flag
- `callAnthropicDirect()` function
- `toAnthropicModelId()` mapper
- `splitSystemFromMessages()` adapter
- `callLLM()` dispatcher

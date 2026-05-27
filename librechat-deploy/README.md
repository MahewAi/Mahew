# LibreChat untuk Gerai — Deploy ke Railway (no domain hassle)

LibreChat = multi-provider AI chat UI (Claude, Gemini, GPT, dll) open source. Tujuannya: playground buat Matthew + tim eksperimen model selain Atmaja, tanpa mengorbankan PWA Gerai existing.

## Quick start: Railway one-click deploy

LibreChat official punya Railway button. Url-nya akan langsung `librechat-xxx.up.railway.app` (no domain mahewwork.com perlu di-touch).

### Step-by-step

1. **Login Railway** → https://railway.app (pakai GitHub OAuth)
2. **One-click deploy** → klik tombol di README LibreChat:
   https://github.com/danny-avila/LibreChat#-quick-start
   Atau langsung: https://railway.app/template/b5k9oT
3. Railway akan auto-provision:
   - LibreChat container (Node.js + frontend)
   - MongoDB
   - Meilisearch (full-text search)
4. **Set env vars** di Railway dashboard, pakai template dari `.env.example` di folder ini. Yang wajib:
   - `ANTHROPIC_API_KEY` — copy dari Vercel env (sama key Gerai)
   - `JWT_SECRET` + `JWT_REFRESH_SECRET` — generate random 32+ char (https://generate-random.org/api-key-generator)
   - `CREDS_KEY` (32-byte hex) + `CREDS_IV` (16-byte hex)
   - `MEILI_MASTER_KEY` — random 16+ char
   - `ALLOW_REGISTRATION=false` (cukup admin user untuk awal)
5. **Upload librechat.yaml** ke Railway via "Files" tab atau via repo connection. File ini di folder yang sama.
6. **Deploy** → Railway build + start. URL akan muncul di tab "Settings" (sub-domain `.up.railway.app`).
7. **Buka URL** → klik "Sign up" → bikin admin user (email + password). Setelah admin dibuat, set `ALLOW_REGISTRATION=false` dan re-deploy supaya tidak ada orang lain bisa daftar.

## Yang akan kamu dapat

- 4 model spec siap pakai (lihat librechat.yaml):
  - Atmaja Style (Opus 4.7 + brand canon prompt, tapi BUKAN endpoint Gerai)
  - Claude Sonnet 4.6 (C-Suite tier)
  - Gemini 2 Pro (eksperimen)
  - GPT-4o (benchmark)
- UI bisa edit message, branch conversation, fork, search history
- Multi-conversation, multi-device sync
- Search, presets, prompts library
- Agents (no-code custom assistant)

## Yang BELUM aktif (Phase D++ follow-up)

Comment-out di librechat.yaml:

- **Custom Endpoint Atmaja Gerai** — perlu `/v1/chat/completions` OpenAI-compatible shim di Gerai (api/v1/chat/completions.js). Setelah shim live, LibreChat bisa panggil Atmaja full (dengan memory file, file library, trace).
- **MCP server Gerai** — perlu `api/mcp/index.js` di Gerai yang expose tools (read_memory, list_briefs, dll). Setelah deploy, LibreChat consume via MCP, AI bisa akses data Gerai langsung dari chat.

## Cost estimate

Railway free tier: $5 credit/bulan.

LibreChat container ~0.5-1 GB RAM, MongoDB ~256 MB, Meilisearch ~256 MB. Idle ~$3-4/bulan. Dengan moderate use $5 credit kemungkinan cukup. Top-up $5 kalau habis.

## Catatan

- **TIDAK perlu point DNS mahewwork.com.** URL default Railway sudah valid SSL + persistent.
- **TIDAK terhubung dengan Vercel Gerai.** LibreChat berdiri sendiri, deploy terpisah. Mereka share API key Anthropic via env var saja.
- **Backup:** Railway snapshot Mongo otomatis. Untuk extra safety, enable Railway Pro plan ($5/bulan) nanti.
- **Stop kapan saja:** Pause Railway project = stop billing. Data MongoDB tersimpan di volume.

## Kalau mau pindah ke domain mahewwork.com nanti

1. Railway dashboard → Settings → Domains → "Add custom domain"
2. Input: `chat.mahewwork.com` (atau apapun yang kamu mau)
3. Railway kasih CNAME record
4. Set CNAME di provider DNS mahewwork.com → `cname.up.railway.app`
5. Tunggu propagasi 5-30 menit
6. Railway auto-provision SSL Let's Encrypt

Tapi ini fully optional. Default `.up.railway.app` sudah jalan dengan SSL.

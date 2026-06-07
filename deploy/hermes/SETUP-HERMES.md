# Setup Hermes (Fase 2: otak otonom)

Hermes = mesin yang bikin AI department jalan sendiri. Dipasang di VPS yang sama dengan Open WebUI (Fase 1). Otak = Claude via OpenRouter. **Atmaja = agent utama (SOUL.md). Specialist = skill/subagent.**

## Prasyarat
- VPS Fase 1 sudah jalan + Docker terpasang.
- `OPENROUTER_API_KEY`.

## Langkah (sekitar 20 menit, aku dampingi)

### 1. Clone + jalankan Hermes
```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
HERMES_UID=$(id -u) HERMES_GID=$(id -g) docker compose up -d
```
Jalan 2 service: **gateway** (port 8642, API) + **dashboard** (port 9119, web).

### 2. Pasang config + identitas
Salin dari paket ini ke `~/.hermes/` :
- `config.yaml` -> `~/.hermes/config.yaml` (Atmaja Opus, subagent Sonnet 4.6, terminal docker)
- `SOUL.md` -> `~/.hermes/SOUL.md` (identitas Atmaja + brand canon, di-generate dari `_agents.js`)
- `.env` -> `~/.hermes/.env` (isi `OPENROUTER_API_KEY=...`)

Lalu validasi:
```bash
hermes config check
```

### 3. Masukin 16 specialist sebagai skill
Sumber: `../gerai-personas.json` (semua persona + system prompt + model). Tiap specialist jadi 1 skill Hermes (standar agentskills.io). **Format skill yang persis aku rapikan pas setup** (docs skill perlu diverifikasi langsung).

### 4. Sambung n8n (eksekutor)
Tambah n8n sebagai MCP server di Hermes, biar Atmaja bisa nyuruh n8n eksekusi (kirim, posting, jadwal). n8n kamu sudah punya MCP.

### 5. Jadikan Open WebUI muka-nya
Di compose Hermes, aktifkan `API_SERVER_HOST` + `API_SERVER_KEY` (gateway OpenAI-compatible di `:8642`). Lalu di Open WebUI (Fase 1), arahkan `OPENAI_API_BASE_URL` ke gateway Hermes itu.

Hasil: kamu chat di **Open WebUI** -> diteruskan ke **Hermes** (otonom) -> **Claude** + **n8n**.

## Catatan jujur
- Pemetaan 17 persona ke Atmaja (SOUL) + specialist (skill/subagent) **perlu diverifikasi pas pasang** (docs multi-agent Hermes belum 100 persen detail). Aku dampingi langkahnya.
- Belum bisa aku test dari sini. Verifikasi beneran di VPS.
- **Pasang checkpoint keputusan besar + batas budget** sebelum dilepas otonom, biar nggak boros dan nggak melenceng dari brand.

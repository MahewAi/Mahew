# Deploy — Gerai AI Department (Fase 1: Open WebUI)

Paket ini menjalankan **Open WebUI** (jendela chat department) yang nyambung ke **Claude lewat OpenRouter**. n8n kamu yang sudah ada TIDAK diubah. Hermes (otak otonom) menyusul di Fase 2 (lihat `BUILD-PLAN.md`).

## Yang sudah disiapkan (otomatis oleh AI)
- `docker-compose.yml` — Open WebUI siap jalan
- `.env.example` — template kunci
- `gerai-personas.json` — 17 persona kamu siap diimpor
- panduan ini

## Bagian kamu (sekitar 15 menit, nanti)

### 1. Bikin VPS
Rekomendasi murah: **Hetzner CX22** (~€4/bln), atau Contabo / DigitalOcean. Ubuntu 22.04+, RAM 2GB cukup. Catat IP + akses SSH.

### 2. Install Docker di VPS
SSH ke VPS, lalu:
```bash
curl -fsSL https://get.docker.com | sh
```

### 3. Ambil paket ini
Kalau folder `deploy/` sudah di-push ke GitHub:
```bash
git clone https://github.com/MahewAi/Mahew.git
cd Mahew/deploy
```
(atau upload manual isi folder `deploy/` ke VPS)

### 4. Isi kunci
```bash
cp .env.example .env
nano .env
# OPENROUTER_API_KEY = dari https://openrouter.ai/keys
# WEBUI_SECRET_KEY   = hasil: openssl rand -hex 32
```

### 5. Nyalakan
```bash
docker compose up -d
```
Buka browser: `http://IP-VPS:3000`

### 6. Setup awal Open WebUI
- Akun pertama yang daftar = admin. Daftar, itu kamu.
- Model Claude (OpenRouter) otomatis kebaca dari env.
- Import department: Workspace > Models, pakai `gerai-personas.json` (base_model + system_prompt + max_tokens per persona).

### 7. (Opsional) Domain + HTTPS
Biar jadi `chat.mahewwork.com` dengan gembok HTTPS, pasang Caddy reverse proxy. Bilang aku, nanti aku siapin file-nya.

## Catatan jujur
Paket ini belum bisa aku test dari sini (environment-ku nggak ada Docker). Aku author pakai pola standar Open WebUI + OpenRouter yang sudah umum dipakai. Verifikasi beneran terjadi pas dijalankan di VPS. Kalau ada error, kirim ke aku, aku benerin.

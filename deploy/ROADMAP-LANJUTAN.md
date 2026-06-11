# Roadmap Lanjutan - AI Department Otonom Gerai 1000 Pintu

Catatan hidup. Diupdate sambil jalan. Sumber kebenaran arsitektur tetap `BUILD-PLAN.md` + `docs/AI_TRANSFER_MEMORY.md`.

## Arsitektur target (revisi: Anthropic langsung, BUKAN OpenRouter)
```
Kamu  ->  Open WebUI (jendela chat)  ->  Hermes (otak otonom, group chat)  ->  Anthropic (Claude)
                                              |
                                              +-> n8n (eksekutor: kirim, posting, jadwal)
```
- **Otak teks** = Anthropic langsung. Atmaja = **Opus 4.8**. 16 specialist = **Sonnet 4.6** (floor, jangan di bawah).
- **Group chat** = lewat `delegate_task`: Atmaja sebar tugas ke specialist, mereka balikin, Atmaja sintesis.
- **Mesin gambar** = jalur terpisah dari otak (OpenAI sekarang, canggih nanti). Tidak konflik dengan Anthropic.

## Status sekarang (7 Jun 2026)
- **VPS**: DigitalOcean droplet `gerai-stack` (134.209.102.6), Docker jalan.
- **Open WebUI**: ke-deploy, jalan di port 3000, model Claude (Anthropic) kebaca. Auto-update via Watchtower (Watchtower masih error, perlu dibenerin).
- **n8n Cloud**: workflow "Gerai 10 - Riset Kompetitor Mingguan" live + aktif (eksekusi tes sukses).
- **Hermes**: setup wizard JALAN. Sudah dipilih: provider Anthropic (API key), default model `claude-opus-4-8`, auth API key (bukan subscription), terminal backend `local`, tanpa platform chat, tools = default.

## SUDAH JADI (update 8 Jun 2026)
- ✅ **Hermes gateway LIVE** (container `hermes`, API server port 8642, kunci di `/root/hermes-api-key.txt`). Default model Atmaja = Opus 4.8 (Anthropic langsung, API key, BUKAN subscription).
- ✅ **Open WebUI <-> Hermes nyambung** via shared docker network `gerai-net`, base URL di Open WebUI = `http://hermes:8642/v1`. Model `hermes-agent` = Atmaja.
- ✅ **SOUL Atmaja terpasang** (`/root/.hermes/SOUL.md`, identitas + brand canon + Cara Kerja Hermes). Atmaja jawab on-brand, kenal Gerai, nyebut Matthew, TANPA em-dash.
- ✅ **Vault tersambung**: repo `MahewAi/Mahew` (PUBLIK) di-clone ke `/root/.hermes/vault` (= `/opt/data/vault` di container). Atmaja baca `docs/` otomatis via file/terminal tool. Pointer ada di SOUL.
- ✅ **Auto-update vault**: cron `*/30 * * * * /usr/bin/git -C /root/.hermes/vault pull` (tiap 30 menit). Push dari Obsidian/laptop -> Atmaja ikut update.
- ✅ **Akses dari mana aja**: `http://134.209.102.6:3000` (cowork laptop / PC / HP, satu otak di awan, nggak perlu sync).

- ✅ **Group chat KEBUKTI** (8 Jun): Atmaja delegate ke Wira (COO, profile Sonnet 4.6 via `hermes profile create wira --clone`), Wira analisis, Atmaja sintesis. `delegate_task` + profiles jalan.
- ✅ **Format output FIXED**: aturan format + CONTOH di PALING ATAS SOUL bikin Atmaja pakai heading/bullet/bold/tabel. PELAJARAN: instruksi format di tengah/bawah SOUL diabaikan model, HARUS di atas + ada contoh konkret.

### Cara nambah specialist (resep, sudah teruji dengan Wira)
1. `docker exec hermes hermes profile create <nama> --clone --description "<peran + kapan dipakai>"`
2. Isi SOUL: `printf '<persona>' > /root/.hermes/profiles/<nama>/SOUL.md`
3. Set model Sonnet 4.6: `sed -i 's/default: claude-opus-4-8/default: claude-sonnet-4-6/' /root/.hermes/profiles/<nama>/config.yaml`
4. `docker restart hermes`
- Profile warisin API key Atmaja dari `--clone`. SOUL profile di `/root/.hermes/profiles/<nama>/SOUL.md`.
- Nanti persona lengkap dari `_agents.js` + 12 specialist via pipeline git (generator).

### Berikutnya (prioritas)
1. Specialist beneran (Wira/Citra/Aksa/Lestari + 12) buat GROUP CHAT (feedback ke Atmaja). INI maunya Matthew.
2. Sambung n8n ke Atmaja (eksekutor: kirim/posting/jadwal).
3. Dashboard Hermes via SSH tunnel (Matthew minta).
4. Update docs vault yang usang (OpenRouter -> Anthropic, Opus 4.7 -> 4.8) lewat Obsidian.
5. Benerin Watchtower.

## Aset/kredensial yang Matthew SUDAH punya (JANGAN lupa lagi)
Cuma fakta kepemilikan, BUKAN nilai key (key tetap rahasia, Matthew yang pegang).
- **Anthropic API key** -> otak (Atmaja Opus 4.8 + specialist Sonnet 4.6). Sudah dipasang di Hermes.
- **OpenAI API key** -> mesin gambar interim (`gpt-image`) + keperluan lain.
- **Tavily API key** -> search + extract buat riset. DIPAKAI jadi search provider Hermes (lebih bagus dari DuckDuckGo).
- **n8n Cloud (Starter)** -> eksekutor.
- **DigitalOcean droplet** (134.209.102.6) -> tempat semua jalan.

Belum punya (prasyarat upgrade): xAI/Grok, FAL.ai, Krea, Google Gemini, ElevenLabs.
TBD: IG Graph API token (buat Instagram sourcing, dicek pas fase itu).

## Lagi dikerjain (urutan)
1. Selesaikan wizard Hermes (langkah tools -> ENTER).
2. Rapihin config Hermes abis wizard:
   - Colok **OpenAI key** buat `image_generate` (mesin gambar interim).
   - Set **delegation tier = Sonnet 4.6** (specialist), **auxiliary = Sonnet 4.6** (kompresi/vision).
   - Validasi: `hermes config check`.
3. Nyalakan gateway Hermes (port 8642 API + 9119 dashboard).
4. Port 16 specialist jadi **skill Hermes** (sumber: `gerai-personas.json`).
5. Arahkan **Open WebUI -> gateway Hermes** (biar chat lewat Hermes = group chat/sintesis Atmaja).
6. Sambung **n8n sebagai eksekutor** (MCP/webhook) biar Atmaja bisa nyuruh eksekusi.
7. Pasang **budget cap + checkpoint keputusan besar + pagar brand canon** sebelum dilepas otonom.
8. Benerin **Watchtower** (auto-update, sekarang gagal restart).

## Memory: sambung ke pengetahuan existing Matthew (DIA MINTA, prioritas tinggi)
Atmaja jangan mulai dari nol. Dua sumber, sambungkan SETELAH SOUL kepasang:
1. **Obsidian vault** (gudang ilmu utama: docs, riset, brand, manuskrip). Rencana: clone repo vault ke server -> Atmaja baca/cari via File tool (sudah nyala) -> auto `git pull` (cron/n8n) biar selalu update tiap Matthew nambah catatan. Bonus: SOUL bisa diambil dari vault, nggak perlu ngetik manual lagi. PERLU dari Matthew: URL repo vault (sama dengan app MahewAi/Mahew atau repo terpisah?) + private/public.
2. **Memory 3-lapis Atmaja** (di n8n / API Gerai: gerai.mahewwork.com/api/atmaja/memory) sebagai memory runtime/dinamis. Sambungkan via tool/MCP biar Atmaja di Hermes pakai memory yang SAMA dengan department lama.

## Backlog upgrade (minta Matthew, ada prasyarat)
Semua nyusul SETELAH pondasi beres. Tiap item butuh syarat dulu.

1. **X / Twitter Search** (`x_search`)
   - Prasyarat: **XAI_API_KEY** (xAI/Grok, BAYAR, beda perusahaan dari Anthropic, beda dari sekadar akun X).
   - Nyalain: `hermes config edit` -> aktifin tool + isi key. ~1 menit.

2. **Gambar canggih** (kualitas premium buat brand)
   - Interim sekarang: **OpenAI `gpt-image-1`** (pakai key OpenAI yang sudah ada).
   - Endgame: **Flux** (Black Forest Labs) / **Google Imagen** / **Midjourney**. Pilih satu, lalu swap. (Cek dulu mana yang didukung Hermes pas wiring.)
   - Catatan Matthew: maunya yang canggih, BUKAN ChatGPT.

3. **Video Analysis** (Reels/TikTok/YouTube buat riset kompetitor)
   - Prasyarat: model native video. Claude = jago gambar, BUKAN native video. OpenAI juga bukan.
   - Jalan A: pasang **Google Gemini** (native video).
   - Jalan B: **jalur frame** (potong video jadi gambar via ffmpeg/n8n -> analisa pakai vision Claude yang sudah on). Nggak butuh model baru.
   - Interim: ambil **thumbnail + caption** via scraping (`web_extract`, sudah on).

## Ditunda ke paling akhir
- **Instagram competitor sourcing** via Graph API Business Discovery.
  - Prasyarat: **IG Graph API token** (punya Matthew).
  - 30 handle kompetitor sudah ada di vault `riset-30-brand` (mis. @wiradoor.id, @duma.id, @sonnealuminium, @fabricaindonesia).

## Aturan tetap (jangan dilanggar)
- Model floor: minimum **Sonnet 4.6**. Atmaja = Opus.
- Brand canon: **tanpa em-dash**, "tempat" bukan "rumah", "Gerai 1000 Pintu" lengkap. Palet brass #B8956B / charcoal #1F1A14 / ivory #FAF8F4.
- Kredensial (API key) **selalu Matthew yang masukin sendiri**. AI tidak pernah pegang key.

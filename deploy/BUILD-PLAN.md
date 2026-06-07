# Rencana Build — AI Department Otonom Gerai 1000 Pintu

## Arsitektur target
```
Kamu  ->  Open WebUI (jendela)  ->  Hermes (otak otonom)  ->  Claude (OpenRouter)
                                          |
                                          +-> n8n (tangan / eksekutor, yang sudah ada)
```
- **Open WebUI** = muka chat, visual bagus
- **Hermes** = mesin otonom (agent riset sendiri, self-improve, terjadwal)
- **Claude via OpenRouter** = otak (Opus untuk Atmaja, Sonnet 4.6 untuk sisanya)
- **n8n** = eksekusi tugas baku (yang sudah jalan, disambung)

## Status

### Fase 1 — Jendela (Open WebUI + Claude)  [PAKET SIAP]
- [x] `docker-compose.yml`
- [x] `.env.example`
- [x] `gerai-personas.json` (17 persona)
- [x] `README-DEPLOY.md`
- [ ] Deploy ke VPS  ← bagian kamu (lihat README)

Hasil: chat department visual, dari PC/HP. (Ini belum otomasi, otomasi di Fase 2.)

### Fase 2 — Mesin otonom (Hermes) + sambung n8n  [RENCANA]
- [ ] Riset docs install Hermes (Docker/compose/env) biar config benar
- [ ] Author config Hermes + port 17 persona jadi agent + skill
- [ ] Pasang brand canon sebagai pagar (biar melebar tapi tetap on-brand)
- [ ] Sambung n8n (MCP/webhook) sebagai eksekutor
- [ ] Arahkan Open WebUI ke Hermes sebagai backend
- [ ] Set checkpoint keputusan besar + batas budget

Hasil: agent riset sendiri, terjadwal, paralel, on-brand. Otomasi beneran.

## Biaya
- Fase 1: VPS ~Rp90rb/bln (atau Rp0 kalau lokal) + OpenRouter (sudah jalan)
- Fase 2: VPS ~Rp110rb/bln + pemakaian API (riset otonom naik)
- Hermes sendiri: GRATIS (lisensi MIT). Nous Portal TIDAK perlu.

## Pembagian kerja
- **AKU** (otomatis, tanpa nunggu): semua file/config/persona/plan, author config, bikin/improve workflow n8n lewat MCP.
- **KAMU** (nanti, minimal): bikin VPS, tempel kunci, jalanin 1 perintah deploy. Approve keputusan besar.

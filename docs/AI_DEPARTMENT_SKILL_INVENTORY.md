# AI Department Gerai 1000 Pintu — Inventory Skill & Struktur

> Status: 2026-05-31. Dokumen pegangan saat mendesain cara kerja AI yang baru.
> Sumber: audit kode langsung (bukan tebakan). Lihat juga `agents/README.md` + `docs/ARCHITECTURE_MAP.md`.

## 1. Struktur (org chart) — SUDAH terpadu

17 agent, satu sumber persona di `api/_agents.js` (`AGENTS`), dibaca semua pintu (PWA, brief n8n, MCP/LibreChat).

```
ATMAJA — CEO (Opus 4.7)
├── WIRA   — COO  (Jepang)  → hr_systems, production_manager, curator
├── CITRA  — CMO  (Eropa)   → brand_strategist, market_researcher, sales_strategist, innovation_scout
├── AKSA   — CFO  (Amerika) → business_designer, financial_analyst
└── LESTARI— CCO  (China)   → document_writer, editorial, web_researcher
```
C-suite + 12 specialist semua Sonnet 4.6 (floor). Atmaja Opus 4.7 (content tier).

## 2. Inventory skill aksi

Legend: 🔴 DOBEL (2+ sistem) · 🟡 TIMPANG (1 pintu saja) · 🟢 TUNGGAL

| Fungsi | Marker (PWA) | MCP tool (LibreChat) | Slash (PWA) | Status |
|---|---|---|---|---|
| Dokumen/PDF | `[ATMAJA_DOC]` | `generate_document` | — | 🔴 |
| Slide / Spreadsheet / Arch-map / Moodboard | — | `generate_slides`, `generate_spreadsheet`, `generate_architecture_map`, `generate_moodboard` | — | 🟡 (MCP only) |
| Gambar | — | `generate_image` | `/img /image /img2 /img15 /imgmini /dalle` | 🔴 |
| Video | — | — | `/vid /video /sora /sora-pro /vidpro` | 🟡 (PWA only) |
| Cari/baca web | `[ATMAJA_SCRAPE]`, `/browse` | `web_search`, `fetch_url` | — | 🔴 (4 cara) |
| Jalankan kode | `[ATMAJA_EXEC]` | `run_code` | — | 🔴 |
| Rapat C-suite | `[ATMAJA_BRIEF_REQUEST]` (n8n) | `consult_wira/citra/aksa/lestari` | — | 🔴 (persona kini sama, mekanisme masih dobel) |
| Jadwal/reminder | `[ATMAJA_SCHEDULE_CREATE]` | — | — | 🟡 (PWA only) |
| Alert / log / insight | `[ATMAJA_INSIGHT]` | `alert_matthew`, `log_decision` | — | 🔴 tersebar |

## 3. Inventory skill memory (3 sistem, belum disatukan)

| Sistem | Lokasi | Pintu |
|---|---|---|
| Vercel KV | `atmaja:memory:matthew` (auto-extractor) | PWA Atmaja |
| Vault Obsidian | `read/search/write_vault_file` + 12 section (termasuk `11-skill-catalog`) | MCP |
| Living context | `read_context` / `update_context` | MCP |

## 4. Inventory skill meta (yang bikin skill)

| Mekanisme | Apa | Lokasi |
|---|---|---|
| `[ATMAJA_SKILL_PROPOSE]` | Atmaja usul skill, Matthew approve, auto-aktif kalau keyword match | KV (proposals) |
| Vault `11-skill-catalog` | Katalog skill manual | Obsidian |

## 5. Yang SUDAH dirapihkan (2026-05-31)

- **Persona disatukan ke 1 sumber** (`api/_agents.js`). Dulu 4 tempat (`agents/*.yaml` mati, `_agents.js`, `reply.js ROLE_DEFINITIONS`, `atmaja/chat.js`) dan drift.
- **12 specialist dinaikkan** dari 1 baris generik jadi persona penuh.
- **C-suite di PWA naik** dari generik jadi persona penuh (Wira/Citra/Aksa/Lestari). Efek samping: "rapat C-suite" via app (brief n8n) sekarang pakai persona yang SAMA dengan via MCP consult.
- Verifikasi: typecheck 0 error, build sukses, smoke test 17/17 persona valid.

## 6. Yang SENGAJA belum disentuh (nunggu cara kerja baru dari Matthew)

- **Dedup skill aksi** (🔴 di tabel atas): pilih 1 mekanisme resmi per fungsi, lengkapi yang 🟡 timpang. Bentuk akhirnya tergantung cara kerja baru.
- **Satukan 3 sistem memory** jadi 1 otoritas.
- **Satukan 2 katalog skill** (KV proposals + vault).
- **Atmaja CEO prompt** (`atmaja/chat.js`) masih terpisah dari `_agents.js`, belum disatukan.
- **`src/data/agentRegistry.ts`**: field `folder` masih vestigial (tidak match file), low-risk, kosmetik.

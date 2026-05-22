# Gerai 1000 Pintu — AI Transfer Memory (Handoff Lengkap)

**Tanggal:** 22 Mei 2026
**Untuk:** AI di PC Matthew (siapa pun yang baca ini berikutnya)
**Tujuan:** Lanjut kerja Gerai 1000 Pintu app + AI Department dari status terakhir tanpa tanya ulang.

Dokumen ini aman dibagi ke AI lain. **TIDAK BOLEH** ditambahin API key, token, cookie, password, atau credential apa pun.

---

## 1. Identitas Proyek

| Item | Nilai |
|---|---|
| Nama produk | Gerai 1000 Pintu |
| Tipe | PWA (Progressive Web App), mobile-first |
| Tujuan | AI Department app — orkestrasi Atmaja CEO + 4 C-suite + 12 specialist |
| Owner | Matthew (solo founder) |
| Brand DNA | Premium curated retail, calm refined, anchor mood Aesop + Design Within Reach |
| Lokasi bisnis | Balikpapan, scope nasional |
| Live URL | https://gerai.mahewwork.com |
| Repo | https://github.com/MahewAi/Mahew.git |
| Branch aktif | `main` |
| Hosting | Vercel (project: `gerai-app`) |
| Domain | gerai.mahewwork.com (CNAME via Namecheap) |

---

## 2. Lokasi Folder Lokal

```
C:\Users\nugro\OneDrive\Documents\Claude\Projects\Gerai app
```

Catatan: folder ini di OneDrive, sync antar device milik Matthew kalau OneDrive login sama.

**Kalau di PC lain mau lanjut tanpa OneDrive:**
```powershell
cd <folder_pilihan>
git clone https://github.com/MahewAi/Mahew.git
cd Mahew
npm install
```

---

## 3. Tech Stack

- **Framework:** Vite + React 18 + TypeScript
- **Styling:** Tailwind CSS v3 + shadcn/ui (Radix primitives)
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **Routing:** React Router v6
- **PWA:** vite-plugin-pwa (registerType: 'prompt')
- **Analytics:** @vercel/analytics + @vercel/speed-insights
- **Markdown:** react-markdown + remark-gfm + rehype-raw + rehype-sanitize
- **Diagrams:** mermaid 11.x (dengan sanitizer hardening)
- **Charts:** recharts 3.x
- **Backend:** Vercel serverless functions (Node.js, di folder `api/`)
- **AI Provider:** OpenRouter → Anthropic Claude (Opus 4.7 + Sonnet 4.6)

---

## 4. Struktur AI Department

### CEO Tier
- **Atmaja (CEO)** — sintesis, keputusan final, routing kerja, brief generation
  - Model: **Opus 4.7** (content tier)
  - Chat surface: `/atmaja`

### C-suite Tier
- **COO** — operasi, SOP, vendor, produksi, dependency map
- **CMO** — market, brand, growth, segmentasi, positioning
- **CFO** — biaya, ROI, margin, runway, credits
- **CCO** — komunikasi, dokumen, visual brief, mapping, canvas

Model C-suite: **Sonnet 4.6** (orchestration tier)

### Specialist Tier (12 specialist)
| Role key | Nama | Parent | Fokus |
|---|---|---|---|
| `hr_systems` | HR & Systems | COO | SOP, struktur tim, hiring framework |
| `production_manager` | Production Manager | COO | Supply chain, vendor lead time, fulfillment |
| `curator` | Curator | COO | Seleksi SKU, supplier vetting, kurasi premium |
| `brand_strategist` | Brand Strategist | CMO | Positioning, narrative, identity DNA |
| `market_researcher` | Market Researcher | CMO | Riset market, kompetitor, segmen, trend |
| `sales_strategist` | Sales Strategist | CMO | Funnel customer, channel, conversion |
| `innovation_scout` | Innovation Scout | CMO | Trend scouting, ide produk cross-industry |
| `business_designer` | Business Designer | CFO | Model bisnis, revenue stream, struktur operasi |
| `financial_analyst` | Financial Analyst | CFO | ROI, pricing, forecast, budget, sensitivity |
| `document_writer` | Document Writer | CCO | Business plan, technical doc, memo, dokumentasi |
| `editorial` | Editorial | CCO | Copywriting, brand voice, narrative editing |
| `web_researcher` | Web Researcher | CCO | Riset web, source gathering, fact-checking |

Model specialist: **Sonnet 4.6** (orchestration tier)

---

## 5. Preferensi Matthew (HARUS DIIKUTI)

1. **Jawaban langsung.** Kalau diminta pilih warna/foto/opsi, jawab pilihannya DULU sebelum alasan.
2. **Jangan membantah** arah pertanyaan Matthew. Kalau konteks kurang, buat asumsi kerja dan tetap beri langkah berikutnya.
3. **Output visual disukai** — workmap, mapping, canvas, palette card — bukan teks panjang muter.
4. **Tidak suka dashboard penuh tombol kecil yang membingungkan.**
5. **Privacy first.** File mentah dan lampiran sensitif tidak boleh keluar diam-diam.
6. **Model floor: Sonnet 4.6.** TIDAK BOLEH di bawah itu (Haiku, Sonnet 3.5, mistral, dll). Premium content tier (Atmaja) pakai Opus 4.7.
7. **Jangan kerja sembrono.** Kalau bilang "sudah selesai dan ditest", harus benar-benar ditest di flow yang user pakai — bukan cuma endpoint test.
8. **No em-dash** di output brand canon. Pakai "tempat" bukan "rumah". Sebut "Gerai 1000 Pintu" lengkap.

---

## 6. Endpoint Server (OpenRouter Bridge)

Bridge sudah live di production. Semua chat surface di app pakai endpoint ini.

### `POST /api/atmaja/chat`

Untuk Atmaja CEO chat. Content tier.

**Payload:**
```json
{
  "userMessage": "string (max 6000 char)",
  "history": [
    { "id": "string", "author": "matthew" | "ceo", "text": "string" }
  ],
  "attachments": [
    {
      "name": "string",
      "type": "string (MIME)",
      "size": "number (bytes)",
      "kind": "image | text | document",
      "note": "string",
      "dataBase64": "string (raw base64, optional, untuk image kecil)",
      "previewText": "string (optional, untuk file teks)"
    }
  ],
  "model": "string (optional, server validate ke whitelist)"
}
```

**Response sukses:**
```json
{
  "ok": true,
  "provider": "OpenRouter",
  "model": "anthropic/claude-opus-4.7",
  "requestedModel": "anthropic/claude-opus-4.7",
  "fallbackUsed": false,
  "text": "string",
  "usage": { "prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150 },
  "attachmentsPolicy": "vision_inline | text_preview_inline | metadata_only | none",
  "attachmentsSummary": { "imagesSent": 0, "textsSent": 0, "metadataOnly": 0 }
}
```

### `POST /api/agent/reply`

Untuk C-suite + specialist chat. Orchestration tier.

**Payload:**
```json
{
  "userMessage": "string",
  "role": "ceo | coo | cmo | cfo | cco | hr_systems | ... | web_researcher",
  "tier": "content | orchestration",
  "briefContext": "string (optional, max 1500 char)",
  "history": [...],
  "attachments": [...],
  "model": "string (optional)"
}
```

Response mirip atmaja/chat, dengan tambahan field `role` dan `tier`.

### `GET /api/openrouter/credits`

Cek sisa credit OpenRouter. Tidak bocorin key.

### `GET /api/agent/health`

Health check. Returns provider/model status + privacy lock state.

---

## 7. Environment Variables

**Wajib di server (Vercel):**

```env
OPENROUTER_API_KEY=<server secret>
OPENROUTER_MANAGEMENT_KEY=<server secret>
ATMAJA_OPENROUTER_ENABLED=true
```

**Wajib di build (Vite, prefix VITE_):**

```env
VITE_GERAI_PRIVACY_LOCK=off
VITE_GERAI_AGENT_BRIDGE=on
```

**Opsional override:**

```env
ATMAJA_OPENROUTER_MODEL=anthropic/claude-opus-4.7
AGENT_REPLY_MODEL=anthropic/claude-sonnet-4.6
OPENROUTER_CHAT_MODEL=anthropic/claude-sonnet-4.6
GERAI_ALLOWED_ORIGINS=https://gerai.mahewwork.com
PUBLIC_APP_URL=https://gerai.mahewwork.com
ATMAJA_CHAT_RATE_LIMIT=12
AGENT_REPLY_RATE_LIMIT=24
ATMAJA_CHAT_MAX_BYTES=4300000
AGENT_REPLY_MAX_BYTES=4300000
```

**Cara akses env di Vercel:**
1. Buka https://vercel.com/dashboard
2. Pilih project `gerai-app`
3. Settings → Environment Variables
4. Edit/tambah sesuai daftar di atas

**Cara dapat OpenRouter API key:**
1. Buka https://openrouter.ai/keys
2. Login dengan akun yang sudah punya credit
3. Generate key baru (jangan share ke chat)
4. Paste ke Vercel env, JANGAN ke `.env` repo yang di-commit

**Untuk dev lokal (`.env.local` di root repo, gitignored):**

```env
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MANAGEMENT_KEY=sk-or-mgmt-xxx
ATMAJA_OPENROUTER_ENABLED=true
VITE_GERAI_PRIVACY_LOCK=off
VITE_GERAI_AGENT_BRIDGE=on
```

---

## 8. Model Floor Enforcement (PENTING)

Hard rule: minimum model Sonnet 4.6. Whitelist di kedua endpoint server:

```javascript
const ALLOWED_MODELS = new Set([
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.7-fast',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.6-fast',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4.6',
])
```

Model di luar whitelist → server auto-replace ke floor (Sonnet 4.6). Client tidak bisa override. Env juga divalidasi terhadap whitelist.

---

## 9. Vision Attachment Specs

Atmaja + C-suite + specialist sudah vision-capable.

**Caps yang diterapkan di server (`api/atmaja/chat.js` + `api/agent/reply.js`):**

| Limit | Nilai |
|---|---|
| Per image (base64) | 2.1 MB (≈1.5 MB raw) |
| Max image per turn | 2 |
| Format didukung | JPG, PNG, WEBP, GIF |
| Text preview max char | 30,000 |
| Total body cap | 4.3 MB (di bawah Vercel 4.5 MB) |

**Yang BELUM didukung (future work):**
- Image > 1.5 MB raw (user harus kompres/resize)
- PDF native (Anthropic dukung document block, belum di-wire)
- Zip auto-extract di server
- Streaming reply
- Audio / video

**Attachment policy reporting:**
- `vision_inline` — ada image base64 yang dikirim ke Anthropic
- `text_preview_inline` — ada cuplikan file teks yang dikirim
- `metadata_only` — file di-attach tapi cuma metadata (nama/ukuran/MIME)
- `none` — tidak ada attachment

---

## 10. Chat Surfaces

### A. Atmaja CEO (`/atmaja`)

| Item | Detail |
|---|---|
| File utama | `src/pages/Atmaja.tsx` |
| Client bridge | `src/lib/atmajaClient.ts` → `/api/atmaja/chat` |
| Model default | Opus 4.7 (content tier) |
| Mock fallback | `src/lib/mockReplies.ts` |
| Attachment | Drag/drop aktif, image base64 forwarded |
| Storage | localStorage key `gerai:atmaja-thread` (max 50 messages) |

### B. Brief Discussion (`CommentThread`)

| Item | Detail |
|---|---|
| File | `src/components/brief/CommentThread.tsx` |
| Client bridge | `src/lib/agentClient.ts` → `/api/agent/reply` |
| Default replier | CEO Atmaja (kalau ada di contributors), else first contributor |
| Tier | Orchestration → Sonnet 4.6 |
| Fallback | Mock reply via `generateMockReply` |

### C. Ask Role Panel (`AskRolePanel`)

| Item | Detail |
|---|---|
| File | `src/components/brief/AskRolePanel.tsx` |
| Client bridge | `src/lib/agentClient.ts` → `/api/agent/reply` |
| Role | Mengikuti contributor yang dipilih (semua 17 role tersedia) |
| Tier | Orchestration → Sonnet 4.6 |
| Fallback | Mock reply per role via `generateRoleReply` |

---

## 11. File Penting (Peta Cepat)

### API (server-side)
- `api/atmaja/chat.js` — Atmaja CEO endpoint dengan vision + floor
- `api/agent/reply.js` — generic role endpoint dengan vision + floor + 17 personas
- `api/openrouter/credits.js` — credit check
- `api/agent/health.js` — health check

### Library client
- `src/lib/atmajaClient.ts` — bridge ke /api/atmaja/chat
- `src/lib/agentClient.ts` — bridge ke /api/agent/reply
- `src/lib/privacyGuard.ts` — gate `AGENT_BRIDGE_ALLOWED`
- `src/lib/mockReplies.ts` — fallback replies + role-aware mock
- `src/lib/atmajaSystem.ts` — repair heuristics (sekarang tidak dipakai untuk overwrite)
- `src/lib/briefStore.ts` — brief storage + state
- `src/lib/learningMemory.ts` — interaction logging
- `src/lib/costLedger.ts` — local cost estimation
- `src/lib/types.ts` — Contributor + Role + CONTRIBUTOR_META definisi

### Page utama
- `src/pages/Atmaja.tsx` — Atmaja chat full page
- `src/pages/Inbox.tsx` — daftar brief + cost dashboard
- `src/pages/Brief.tsx` — detail brief + CommentThread + AskRolePanel

### Komponen brief
- `src/components/brief/CommentThread.tsx`
- `src/components/brief/AskRolePanel.tsx`
- `src/components/brief/ComposeSheet.tsx` — generate brief (belum di-wire ke remote)

### Konfigurasi
- `vite.config.ts` — Vite + PWA config
- `tailwind.config.js` — brand tokens
- `package.json` — dependencies + scripts
- `.env.example` — template env (jaga default privacy lock)

### Dokumen referensi
- `docs/AI_TRANSFER_MEMORY.md` — file ini
- `docs/SECURITY_SYNC.md` — keamanan sync antar device
- `docs/AUTOMATION_COST_CONTROL.md` — strategi kontrol biaya

---

## 12. Brand Tokens

| Token | Nilai |
|---|---|
| Brass gold (signature accent) | `#B8956B` |
| Deep charcoal (authority base) | `#1F1A14` |
| Warm ivory (clean support) | `#FAF8F4` |
| Display font | Cormorant Garamond |
| Body font | Inter |

---

## 13. Recent Commits (paling baru di atas)

```text
b99c13b Kill upgradeActionableReplies effect that clobbered remote replies
bf39047 Enable real vision + text reading; kill misleading auto-visual previews
004745c Wire C-suite + specialist chat to OpenRouter with Sonnet 4.6 floor
31c5bc3 Atmaja default = Opus 4.7 (content tier), Sonnet 4.6 fallback
49b994b Fix Atmaja chat empty reply: stable sonnet-4.6 default + retry fallback
063056a Default Atmaja OpenRouter model
c733a6b Add gated OpenRouter bridge for Atmaja chat
c6de37a Prevent PWA auto reload during chat
d76b191 Stabilize Atmaja chat delivery
e1d00da Make Atmaja answer visual choices directly
93c4c3b Add Atmaja visual reply previews
ba5ef7d Make Atmaja answer color file requests directly
e70131a Add drag and drop Atmaja attachments
```

---

## 14. Bug History & Lesson Learned (Jangan Diulang)

### Bug: Atmaja chat empty reply (FIXED — commit 49b994b)
- **Gejala:** Atmaja balas kosong / 502 empty_openrouter_reply
- **Cause:** `openrouter/auto` routing pilih model lemah (mistral-7b)
- **Fix:** Default ke Sonnet 4.6 + retry fallback

### Bug: Atmaja pakai Sonnet padahal CEO content tier (FIXED — commit 31c5bc3)
- **Cause:** Default model salah, pakai stable model untuk semua tier
- **Fix:** Atmaja default Opus 4.7 (content), C-suite default Sonnet 4.6 (orchestration)

### Bug: Model bisa drop ke bawah floor (FIXED — commit 004745c)
- **Cause:** Tidak ada whitelist validation
- **Fix:** ALLOWED_MODELS whitelist + auto-replace ke floor

### Bug: Mock reply menimpa remote yang jujur → palette card auto-render (FIXED — commit b99c13b)
- **Gejala:** Matthew attach zip 227 MB minta pilih warna. Atmaja remote jujur bilang "tidak lihat zip". Tapi 100ms kemudian client-side effect overwrite dengan mock yang hardcoded "Brass/Charcoal/Ivory" + palette card auto-render. Looks like Atmaja menganalisis isi zip padahal tidak.
- **Cause:** `upgradeActionableReplies` useEffect di `Atmaja.tsx` panggil `generateMockReply` setiap kali `shouldRepairAtmajaReply` true (color-decision intent + no visuals)
- **Fix:** Hapus effect itu seluruhnya. Plus tighten `buildVisualsForReply` — skip palette card kalau user message ada attachment apa pun.
- **Lesson:** Selalu test FLOW USER, bukan cuma endpoint isolated. Mock reply yang hardcoded berbahaya kalau bisa overwrite remote.

### Bug: Visual preview "INPUT → ATMAJA → C-LEVEL → OUT" generic SVG (REMOVED — commit bf39047)
- **Cause:** Auto-render dekoratif yang bikin reply terlihat lebih real dari sebenarnya
- **Fix:** Dihapus seluruhnya. Tidak ada lagi auto-render visual yang tidak ada konten infonya.

---

## 15. Commands

### Dev lokal
```powershell
npm.cmd run dev          # Vite dev server di http://localhost:4174
```

### Verify sebelum claim "selesai"
```powershell
npm.cmd run typecheck    # TypeScript check
npm.cmd run build        # Production build
```

### Deploy
```powershell
git add <files>
git commit -m "<message>"
git push origin main     # Auto-deploy ke Vercel
```

### Live health check
```powershell
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/agent/health" -UseBasicParsing
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/openrouter/credits" -UseBasicParsing
```

### Smoke test Atmaja
```powershell
$body = '{"userMessage":"halo"}'
Invoke-WebRequest -Method POST -Uri "https://gerai.mahewwork.com/api/atmaja/chat" -ContentType "application/json" -Body $body -UseBasicParsing
```

### Smoke test agent (Sonnet 4.6)
```powershell
$body = '{"userMessage":"halo","role":"coo","tier":"orchestration"}'
Invoke-WebRequest -Method POST -Uri "https://gerai.mahewwork.com/api/agent/reply" -ContentType "application/json" -Body $body -UseBasicParsing
```

---

## 16. Biaya per Turn (referensi)

| Tier | Model | Cost per turn (approx) |
|---|---|---|
| Content | Opus 4.7 | $0.003 – $0.011 |
| Orchestration | Sonnet 4.6 | $0.001 – $0.003 |
| Vision tambahan | + image kecil | + $0.0005 |

Cek live credit di `/api/openrouter/credits`.

---

## 17. Rules untuk AI Berikutnya (Hard Rules)

1. **Jangan minta Matthew paste API key atau secret ke chat.** Key hanya di Vercel env / `.env.local`.
2. **Jangan disable security gates diam-diam.** Privacy guard ada karena alasan.
3. **Preserve user changes di git.** Never reset hard, never force push, tanpa approval eksplisit.
4. **Prefer small scoped changes** dan verify dengan typecheck/build.
5. **Atmaja harus jawab langsung dulu, baru jelaskan.** Tidak boleh muter.
6. **Kalau pakai OpenRouter, ingatkan** chat text + image base64 keluar browser via server bridge.
7. **Raw file > 1.5 MB tetap lokal** kecuali Matthew approve eksplisit.
8. **Model floor Sonnet 4.6.** Tidak boleh di bawah. Premium content (Atmaja) pakai Opus 4.7.
9. **Sebelum bilang "sudah selesai", TEST flow real yang user pakai.** Bukan cuma endpoint isolated. Lihat bug `upgradeActionableReplies` di atas — itu terjadi karena AI sebelumnya cuma test endpoint, lupa test UI flow.
10. **Hati-hati dengan mock reply.** Punya hardcoded palette text yang bisa render palette card walau remote sudah jawab jujur. Periksa apakah ada client-side effect yang menimpa remote reply.
11. **Brand canon di output:** NO em-dash, "tempat" bukan "rumah", "Gerai 1000 Pintu" lengkap, tone calm refined premium curated retail.
12. **Untuk UI, test mobile feel** dan hindari transisi reload-like yang membingungkan. Gunakan React Router untuk link internal, animasi ringan.
13. **Kalau bingung soal arah Matthew, ASK** — jangan asumsikan. Tapi kalau konteks cukup untuk asumsi kerja, kerjakan dulu dan jelaskan asumsinya.

---

## 18. Workmap & Visual Communication (Wishlist)

Matthew ingin C-level bisa kasih gambaran kerja:
- Architecture map
- Denah kerja
- Dependency map
- SOP lane
- Canvas mapping
- Gate keputusan

Workmap card seharusnya bisa dibuka ke halaman detail seperti `/workmap/coo/1` dst.

Belum semua di-wire, tapi infrastruktur ada (mermaid + recharts). Future iteration.

---

## 19. Yang Belum Dikerjakan / Future Work

- ComposeSheet (generate brief) belum di-wire ke `/api/agent/reply` content tier (masih simulate via mock)
- PDF native support (Anthropic document block)
- Image > 1.5 MB via signed URL upload
- Zip auto-extract di server
- Streaming reply (SSE)
- Workmap full visual rendering (mapping interaktif)
- Multi-turn artifact rendering (Claude-style artifact)

---

## 20. Cara Memulai (Jika Mulai dari Nol di PC Baru)

```powershell
# 1. Clone repo
cd C:\Projects   # atau folder pilihan
git clone https://github.com/MahewAi/Mahew.git gerai-app
cd gerai-app

# 2. Install deps
npm install

# 3. Setup env lokal (jangan commit!)
notepad .env.local
# Isi sesuai bagian "Environment Variables" di atas

# 4. Run dev server
npm.cmd run dev
# Buka http://localhost:4174

# 5. Verify production tetap jalan
npm.cmd run typecheck
npm.cmd run build
```

Untuk deploy: tinggal push ke `main` di GitHub, Vercel auto-deploy ke gerai.mahewwork.com.

---

**Dokumen ini adalah single source of truth untuk handoff. Update kalau ada perubahan signifikan supaya AI berikutnya mulai dari titik yang benar.**

# Gerai AI Transfer Memory

Tanggal: 21 Mei 2026

Dokumen ini aman untuk diberikan ke AI lain sebagai konteks kerja. Jangan tambahkan API key, token, cookie, atau credential apa pun ke dokumen ini.

## Identitas Proyek

- Nama app: Gerai 1000 Pintu
- Workspace lokal: `C:\Users\nugro\OneDrive\Documents\Claude\Projects\Gerai app`
- Repo remote: `https://github.com/MahewAi/Mahew.git`
- Branch aktif: `main`
- Live app: `https://gerai.mahewwork.com`
- Local dev app: `http://localhost:4174`
- Framework: React + Vite + TypeScript
- Deploy: Vercel project `gerai-app`

## Tujuan Sistem

Gerai adalah app AI Department untuk Matthew. Atmaja berperan sebagai orkestrator/CEO AI. C-level AI yang muncul di app:

- Atmaja / CEO: sintesis, keputusan final, routing kerja
- COO: operasi, SOP, vendor, produksi, dependency
- CMO: market, brand, growth, segmentasi
- CFO: biaya, ROI, margin, runway, credits
- CCO: komunikasi, dokumen, visual brief, mapping

Specialist skills berada di bawah C-level. Output yang disukai Matthew harus berbentuk ringkas, langsung, visual, dan punya workmap/canvas/mapping, bukan teks panjang yang muter.

## Preferensi Matthew

- Jawaban harus langsung, terutama jika diminta memilih warna/foto/opsi.
- Jangan membantah arah pertanyaan Matthew.
- Kalau konteks kurang, buat asumsi kerja dan tetap beri langkah berikutnya.
- Matthew ingin AI Department bisa memberi visual, mapping, workmap, dan rancangan kerja.
- Matthew tidak suka dashboard penuh tombol kecil yang membingungkan.
- Sistem harus menjaga data agar tidak bocor.
- File mentah dan isi lampiran sensitif tidak boleh dikirim keluar secara diam-diam.

## Status Terbaru OpenRouter

OpenRouter bridge sudah dibuat dan live.

Endpoint server:

- `POST /api/atmaja/chat`
- `GET /api/openrouter/credits`
- `GET /api/agent/health`

Env Vercel yang perlu ada:

```env
OPENROUTER_API_KEY=<server secret>
OPENROUTER_MANAGEMENT_KEY=<server secret>
ATMAJA_OPENROUTER_ENABLED=true
VITE_GERAI_PRIVACY_LOCK=off
VITE_GERAI_AGENT_BRIDGE=on
OPENROUTER_CHAT_MODEL=openrouter/auto
```

Catatan:

- Jangan pernah meminta Matthew mengirim API key ke chat.
- API key hanya boleh berada di environment variable Vercel/server.
- `openrouter/auto` dipakai sebagai default jika model tidak diset.
- Tes terakhir: endpoint Atmaja sudah `200 OK` dari OpenRouter.
- Saat dites, OpenRouter memilih model `mistralai/mistral-7b-instruct-v0.1`.

## Security Model

Default repo tetap privacy-first:

- `.env.example` default menjaga privacy lock.
- Browser tidak menerima provider key.
- Atmaja chat memakai same-origin server endpoint.
- File attachment policy: metadata only. Raw file contents/local previews tidak dikirim ke OpenRouter secara default.
- Private Sync Vault + Syncthing direkomendasikan untuk sinkronisasi antar device milik sendiri.
- Jangan gunakan cloud/VPS orang lain untuk memory plaintext tanpa enkripsi.

Dokumen penting:

- `docs/SECURITY_SYNC.md`
- `docs/AUTOMATION_COST_CONTROL.md`
- `api/atmaja/chat.js`
- `src/lib/privacyGuard.ts`
- `src/lib/atmajaClient.ts`

## Chat Atmaja

File utama:

- `src/pages/Atmaja.tsx`
- `src/lib/mockReplies.ts`
- `src/lib/atmajaSystem.ts`
- `src/lib/atmajaClient.ts`
- `api/atmaja/chat.js`

Perilaku penting:

- User message disimpan sebelum reply dijadwalkan, supaya pesan tidak hilang saat reload.
- Jika bridge remote aktif, Atmaja mencoba `/api/atmaja/chat`.
- Jika remote gagal, app fallback ke local mock reply.
- Existing generic replies bisa direpair agar lebih langsung.
- Atmaja bisa menampilkan visual preview lokal untuk palette/gambar/mapping.
- Attachment drag/drop sudah aktif di composer Atmaja.

## Workmap dan Visual Communication

User ingin C-level bisa memberi gambaran kerja seperti:

- architecture map
- denah kerja
- dependency map
- SOP lane
- canvas mapping
- gate keputusan

Workmap card seharusnya dapat dibuka ke halaman detail seperti:

- `/workmap/coo/1`
- `/workmap/coo/2`
- `/workmap/coo/3`

Bagian yang sudah pernah dibahas:

- Workmap COO Operating scope harus bisa dibuka sebagai visual/mapping di tab/page baru.
- Mobile navigation sebelumnya terasa seperti reload app; perlu dijaga agar link internal pakai React Router dan animasi ringan.

## Cost Dashboard

Bagian biaya sudah ditambahkan di dashboard:

- Mengestimasi biaya case lokal.
- Membaca credits OpenRouter lewat server endpoint.
- Endpoint: `/api/openrouter/credits`
- Key tidak boleh dibundle ke browser.

File penting:

- `src/lib/costLedger.ts`
- `src/pages/Inbox.tsx`
- `api/openrouter/credits.js`

## Recent Commits

Urutan commit terbaru yang relevan:

```text
063056a Default Atmaja OpenRouter model
c733a6b Add gated OpenRouter bridge for Atmaja chat
c6de37a Prevent PWA auto reload during chat
d76b191 Stabilize Atmaja chat delivery
e1d00da Make Atmaja answer visual choices directly
93c4c3b Add Atmaja visual reply previews
ba5ef7d Make Atmaja answer color file requests directly
e70131a Add drag and drop Atmaja attachments
```

## Verification Commands

Use these before saying the app is safe:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Optional live health checks:

```powershell
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/agent/health" -UseBasicParsing
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/openrouter/credits" -UseBasicParsing
```

Expected OpenRouter-ready health:

```json
{
  "chat": {
    "provider": "OpenRouter",
    "enabled": true,
    "keyConfigured": true,
    "attachmentsPolicy": "metadata_only"
  },
  "security": {
    "privacyLock": false
  }
}
```

## Rules for Next AI

1. Do not ask Matthew to paste API keys or secrets.
2. Do not disable security gates silently.
3. Preserve user changes in git; never reset hard without explicit approval.
4. Prefer small scoped changes and verify with typecheck/build.
5. For UI, test mobile feel and avoid confusing reload-like transitions.
6. Atmaja should answer directly first, then explain.
7. If using OpenRouter, remind that chat text leaves the browser and goes through the server bridge.
8. Keep raw file contents local unless Matthew explicitly approves remote file analysis.


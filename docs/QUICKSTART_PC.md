# Quickstart Matthew — Lanjut di PC Lain

Panduan praktis buat Matthew (bukan untuk AI) supaya bisa lanjut kerja Gerai 1000 Pintu di PC mana pun.

---

## Apa yang Perlu Diingat Sebelum Pindah

| Item | Lokasi/Cara dapat |
|---|---|
| **Source code** | GitHub: `https://github.com/MahewAi/Mahew.git` |
| **Live app** | `https://gerai.mahewwork.com` (sudah jalan tanpa perlu apa-apa) |
| **OpenRouter API key** | Vercel dashboard → project gerai-app → Settings → Environment Variables |
| **Vercel project** | `gerai-app` di dashboard Vercel akun kamu |
| **Domain** | `gerai.mahewwork.com` di Namecheap (CNAME ke Vercel) |
| **Konteks lengkap untuk AI** | `docs/AI_TRANSFER_MEMORY.md` di repo |

---

## Skenario A: Cuma Mau Chat sama Atmaja & C-suite (Tidak Coding)

**Tidak perlu install apa-apa.** Tinggal buka:

```
https://gerai.mahewwork.com
```

Atau langsung ke chat Atmaja:

```
https://gerai.mahewwork.com/atmaja
```

Semua bridge OpenRouter sudah jalan di server. Tinggal pakai.

---

## Skenario B: Mau Lanjut Coding di PC Baru

### Langkah 1: Install software wajib

Download + install di PC tujuan:

1. **Git** — https://git-scm.com/download/win
2. **Node.js** versi 20+ — https://nodejs.org/
3. **VS Code** (editor) — https://code.visualstudio.com/
4. **Claude Desktop / Claude Code** — pilih sesuai kebutuhan

### Langkah 2: Clone repo

Buka PowerShell di PC tujuan:

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/MahewAi/Mahew.git
cd Mahew
npm install
```

(Akan download dependencies, kira-kira 2-5 menit tergantung internet)

### Langkah 3: Setup env lokal

Di folder repo, buat file baru bernama `.env.local`:

```powershell
notepad .env.local
```

Isi dengan:

```
OPENROUTER_API_KEY=<paste dari Vercel>
ATMAJA_OPENROUTER_ENABLED=true
VITE_GERAI_PRIVACY_LOCK=off
VITE_GERAI_AGENT_BRIDGE=on
```

**Cara dapat `OPENROUTER_API_KEY`:**
- Buka https://vercel.com/dashboard
- Login pakai akun yang sama
- Pilih project **`gerai-app`**
- Settings → Environment Variables
- Cari `OPENROUTER_API_KEY` → klik **Reveal** atau **Edit** untuk lihat nilainya
- Copy → paste ke `.env.local` di PC tujuan

**JANGAN commit `.env.local` ke git.** Sudah ada di `.gitignore`.

### Langkah 4: Jalankan dev server

```powershell
npm run dev
```

Buka browser → http://localhost:4174

### Langkah 5: Cek health

```powershell
Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/agent/health" -UseBasicParsing
```

Kalau response status 200 + ada `"keyConfigured":true` → bridge ke OpenRouter aman.

---

## Skenario C: Cuma Mau Pakai Claude Desktop untuk Diskusi Proyek

1. Install Claude Desktop di PC tujuan
2. Login
3. Buka chat baru
4. **Attach file** `docs/AI_TRANSFER_MEMORY.md` (cara dapat file ini lihat bagian "Cara Dapat AI_TRANSFER_MEMORY.md" di bawah)
5. Pesan pertama:

   > Tolong baca file ini. Itu konteks proyek Gerai 1000 Pintu saya. Lanjut bantu saya dari sini.

Claude akan paham semua konteks proyek tanpa kamu jelasin ulang.

---

## Cara Dapat AI_TRANSFER_MEMORY.md di PC Tujuan

Pilih salah satu (semua hasilnya sama):

### Opsi 1: Lewat GitHub (paling cepat, no login OneDrive)

1. Di PC tujuan, buka browser
2. Buka: https://github.com/MahewAi/Mahew/blob/main/docs/AI_TRANSFER_MEMORY.md
3. Klik tombol **"Raw"** (kanan atas file viewer) atau **"Download raw file"**
4. Save sebagai `AI_TRANSFER_MEMORY.md` di Desktop

### Opsi 2: Lewat email

1. Di PC ini, kirim email ke diri sendiri
2. Attach file `C:\Users\nugro\OneDrive\Documents\Claude\Projects\Gerai app\docs\AI_TRANSFER_MEMORY.md`
3. Buka email di PC tujuan → download attachment

### Opsi 3: Lewat OneDrive sync

1. Di PC tujuan, install OneDrive + login akun yang sama (nugro@...)
2. Tunggu sync selesai
3. File ada di `C:\Users\<user>\OneDrive\Documents\Claude\Projects\Gerai app\docs\`

### Opsi 4: Lewat USB

1. Copy file dari PC ini ke USB
2. Colok ke PC tujuan
3. Copy ke Desktop

---

## Apa yang Tidak Perlu Dipindah

- **Source code** — ambil dari GitHub, bukan dari OneDrive. Lebih reliable.
- **API key** — ambil dari Vercel, jangan simpan di folder yang tersync.
- **node_modules/** — install ulang via `npm install`, jangan copy.

---

## Yang Sudah Jalan di Production (Tidak Perlu Setup Ulang)

- Live app di gerai.mahewwork.com
- OpenRouter bridge (`/api/atmaja/chat` + `/api/agent/reply`)
- Vision attachment (image kecil ke Atmaja & C-suite)
- Model floor enforcement (Sonnet 4.6 minimum)
- Vercel auto-deploy dari branch `main`
- Domain Namecheap → Vercel CNAME

Selama kamu tidak ubah env Vercel atau hapus project, semua tetap jalan dari mana pun kamu buka browser.

---

## Kalau Ada Masalah

**Bug, error, atau pertanyaan kerjaan:**
- Buka chat AI (Claude Desktop / Claude Code / claude.ai)
- Attach `AI_TRANSFER_MEMORY.md`
- Tulis: "ini bug yang muncul: [paste error]. Tolong bantu fix sesuai konteks proyek."

**Endpoint mati / Vercel down:**
- Cek Vercel dashboard → project gerai-app → Deployments — apakah deploy terakhir gagal?
- Cek https://www.vercel-status.com/ — apakah Vercel lagi down?
- Cek health endpoint: `Invoke-WebRequest -Uri "https://gerai.mahewwork.com/api/agent/health"`

**OpenRouter habis credit:**
- Cek di https://openrouter.ai/credits
- Top up kalau kosong

---

## Yang Paling Penting

Yang ada di kepala AI bisa lupa. Yang ada di file `AI_TRANSFER_MEMORY.md` selalu ada di repo. **Selalu update file itu** kalau ada perubahan besar — supaya AI berikutnya tidak mulai dari nol.

Quick way to update via Claude Code: bilang "update AI_TRANSFER_MEMORY.md dengan kondisi terbaru".

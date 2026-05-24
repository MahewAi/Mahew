# Self-Evolving Atmaja Roadmap

**Visi Matthew (25 Mei 2026):** Gerai 1000 Pintu app berdiri sendiri dengan Atmaja yang bisa berkembang sendiri — auto-build new skill, self-learning, autonomous expansion AI agent department tanpa Matthew banyak campur tangan.

## Prinsip Operasi

1. **Atmaja initiate, Matthew decide.** Atmaja deteksi gap kapabilitas dari pola percakapan + propose perubahan. Matthew tetap punya approval gate untuk perubahan yang berimplikasi (cost, security, brand).
2. **Auto-execute untuk safe domain.** Update sistem prompt, refinement memory format, generate konten — boleh otomatis. Add endpoint baru, modify auth pattern, delete data — butuh Matthew confirm.
3. **Self-learning via memory + outcomes.** Atmaja record decision outcomes (success/failure berdasarkan brief lifecycle result) lalu refine pendekatan turn berikutnya.
4. **Composable specialist expansion.** Pattern detect "Matthew sering tanya legal/marketing/operations yang sama" → propose new specialist persona auto-load.

## Current State (per 25 Mei 2026)

Foundation yang sudah ada untuk visi ini:

| Capability | Status |
|-----------|--------|
| 3-lapis memory (working + KV + Blob PDF) | ✅ LIVE |
| Auto-memory-update via Sonnet 4.6 extractor (Lapis 2) | ✅ LIVE |
| Skill Proposal endpoint backend | ✅ LIVE (24 Mei 2026) — `/api/atmaja/memory?type=proposals` |
| Memory backup daily ke Blob | ✅ LIVE |
| n8n MCP automation gateway | ✅ LIVE (Workflows 1-3) |
| Vercel auto-deploy on git push | ✅ LIVE |
| Correlation ID untuk debug trace | ✅ LIVE (chat + memory) |

## 4 Phase Evolution

### Phase 1 — Atmaja Propose, Matthew Approve (NOW LIVE foundation)

**Apa yang Atmaja bisa lakukan:**
- Submit proposal via endpoint `/api/atmaja/memory?type=proposals&action=create` dengan structured payload
- Proposal types: `specialist` | `workflow` | `skill` | `prompt-refinement` | `integration` | `feature`
- Examples:
  - "Tambah Legal Advisor specialist — Matthew 3x ditanya review kontrak vendor dalam 2 minggu"
  - "Workflow #4 weekly competitor scan via Brightdata — pola brief sering reference 'apa kompetitor lagi lakuin'"
  - "Refine system prompt CFO — kasih ekspektasi format angka rupiah lebih tegas"

**Apa yang Matthew bisa lakukan:**
- GET `/api/atmaja/memory?type=proposals` untuk lihat list
- PUT `?action=approve&id=X` atau `?action=reject&id=X` dengan optional reason
- Future: PWA UI section khusus untuk review (planned next iteration)

**Mechanism trigger Atmaja propose (planned next):**
- Workflow #4 weekly cron: Senin 09:00 WITA Atmaja review memory + recent chats + outcomes → generate proposals
- Atau on-demand: Matthew tanya "Apa skill kamu yang masih kurang sekarang?" → Atmaja review + return structured proposals

### Phase 2 — Approved Proposals Auto-Implement (Next 1-3 bulan)

**Cara kerja:**
1. Matthew approve proposal X via PWA UI
2. Trigger Claude API call dengan instruksi spesifik: "Implementasi proposal X — generate code change, test, deploy ke staging Vercel preview"
3. Claude API call (server-side, dengan ATMAJA_BRIDGE_TOKEN scoped) generate diff
4. Auto push ke branch `proposal/{id}` di GitHub
5. Vercel auto-deploy preview URL
6. Atmaja smoke-test via curl ke preview URL
7. Kalau lulus, kirim notif ke Matthew dengan preview URL
8. Matthew klik "Merge to main" via PWA → trigger gh API merge
9. Vercel auto-deploy production
10. Update proposal status ke `implemented` + record commit SHA

**Safety boundaries Phase 2:**
- Auto-implement HANYA untuk proposal type: `prompt-refinement`, `workflow`, `feature` (UI tambahan, tidak ubah auth/security)
- TIDAK auto-implement: `integration` (butuh setup external service), `specialist` baru kalau perlu env var baru
- Hard limit: max 5 implementation attempts per minggu, max 1 per hari
- Vercel preview URL = sandbox, tidak hit production data sampai merge

**Yang dibutuhkan:**
- New endpoint `/api/atmaja/memory?type=proposals&action=implement&id=X` untuk trigger pipeline
- GitHub API token (PAT) untuk push branch + create PR
- Workflow di GitHub Actions atau separate Vercel function untuk run Claude API
- Logs di KV `atmaja:proposals:matthew:logs` untuk audit trail

### Phase 3 — Specialist Auto-Spawn (3-6 bulan)

**Konsep:** Specialist baru di-define via JSON config, bukan hardcode di kode. Atmaja propose spec config → Matthew approve → auto-instantiate.

Example specialist config:
```json
{
  "role": "legal_advisor",
  "tier": "specialist",
  "model": "anthropic/claude-sonnet-4.6",
  "systemPrompt": "Anda Legal Advisor untuk Gerai 1000 Pintu...",
  "expertise": ["kontrak vendor", "kepatuhan PT", "perjanjian distribusi"],
  "endpoint": "shared",  // pakai /api/agent/reply, role-based routing
  "active": true,
  "createdAt": "2026-06-15T...",
  "approvedBy": "matthew"
}
```

Specialists disimpan di KV `atmaja:specialists:matthew`. `/api/agent/reply` load + route by role.

**Yang dibutuhkan:**
- Refactor `/api/agent/reply` untuk read specialist config dari KV (bukan hardcode)
- PWA UI untuk Matthew toggle aktif/non-aktif per specialist
- Atmaja "knows" specialists yang tersedia dari memory file

### Phase 4 — Goal-Oriented Autonomy (6-12 bulan)

**Konsep:** Matthew set high-level goals (e.g., "Q3 launch AMK Balikpapan minggu ke-2 Juli, budget 50jt"), Atmaja decompose jadi sub-tasks + delegate ke specialist + track progress + alert kalau slippage.

Example goal record:
```json
{
  "id": "goal-q3-amk-balikpapan",
  "title": "Launch AMK wave 1 Balikpapan",
  "deadline": "2026-07-14",
  "budget": 50_000_000,
  "subTasks": [
    { "id": "t1", "owner": "coo", "description": "PO ke Selaras Lawang Sewu", "deadline": "2026-05-31", "status": "pending" },
    { "id": "t2", "owner": "cmo", "description": "Brief Meta Ads + IG influencer", "deadline": "2026-06-15", "status": "pending" }
  ],
  "decisions": [...]
}
```

Atmaja:
- Weekly review goal progress, alert kalau ada sub-task overdue
- Auto-generate brief untuk specialist berdasarkan sub-task
- Adjust plan kalau ada blocker

**Yang dibutuhkan:**
- New module: goal tracker + Gantt-like data structure
- PWA UI "Mission Control" — visual progress per goal
- Cross-workflow coordination (proposal pipeline + brief lifecycle + daily digest semua converge ke goal)

## Safety Boundaries (Throughout All Phases)

| Boundary | Why |
|----------|-----|
| Matthew approve gate untuk delete/security/cost changes | Atmaja tidak bisa "merusak" tanpa konfirmasi |
| Bearer token rotation policy (planned) | Limit blast radius kalau token leak |
| Audit log di KV untuk semua proposal lifecycle | Recoverable, traceable |
| Sandbox via Vercel preview URL untuk implementation test | Bug tidak hit production |
| Max 1 auto-implement per hari | Rate limit blast radius |
| Atmaja TIDAK BISA: rotate token, delete account, push force, hapus memory file | Hardcoded denial di code |
| Brand canon enforcement persistent | Prevent drift di system prompt updates |

## Konkretnya, Minggu Depan

### Yang Sudah Ready (silakan dipakai):
- **GET `/api/atmaja/memory?type=proposals`** — list semua proposal
- **POST `?type=proposals&action=create`** body `{type, title, description, rationale, examples, ...}` — submit proposal
- **PUT `?type=proposals&action=approve|reject|implemented&id=X`** — Matthew approve/reject
- **DELETE `?type=proposals[&status=X]`** — wipe/clear

### Pending Build (next session):
1. **Workflow #4 Weekly Atmaja Review** — n8n cron Senin 09:00 WITA. Trigger Atmaja review session via structured prompt, parse response untuk extract proposals, auto-save ke endpoint.
2. **PWA UI Proposals tab** — section baru di /atmaja atau dashboard, list proposal cards dengan Approve/Reject buttons + filter by status.
3. **Implementation pipeline Phase 2** — gitHub PAT setup + Claude API auto-implement endpoint.

## Apa yang Matthew Butuh Lakukan

### Sekarang (1 menit):
- Tidak ada. Foundation sudah live, akan auto-build dari interactions ke depan.

### Kalau mau speedup Phase 2 (5 menit):
- Generate GitHub Personal Access Token dengan scope `repo` di https://github.com/settings/tokens
- Tambah ke Vercel env vars sebagai `GITHUB_PAT_SELF_EVOLVE`
- Saya bikin endpoint implementasi otomatis

### Kalau mau speedup Phase 3 (10 menit):
- Aktifkan Workflow #4 (saya bisa create via MCP) untuk weekly Atmaja review
- Confirm proposal types yang allowed auto-implement (default: prompt-refinement only)

## Examples — Proposal yang Atmaja Akan Buat

Berdasarkan memory current (4276 char), pola obvious:

**Proposal #1 (likely):**
```json
{
  "type": "workflow",
  "title": "Vendor PO Reminder Workflow",
  "description": "Cron harian cek deadline PO ke vendor (PT Selaras Lawang Sewu deadline akhir Mei). Kalau H-3 belum locked, alert Matthew via callback ke app.",
  "rationale": "Memory menunjukkan vendor PO ke Selaras Lawang Sewu adalah critical path Q3 launch. Risk slippage tertinggi.",
  "examples": ["Atmaja sebut deadline PO akhir Mei berulang kali dalam 3 turn berbeda"]
}
```

**Proposal #2 (likely):**
```json
{
  "type": "specialist",
  "title": "Logistics Coordinator specialist",
  "description": "Spesialis untuk koordinasi logistik Jawa→Kaltim, lead time monitoring, contingency planning.",
  "rationale": "Risk yang Atmaja sering bahas: logistik Jawa→Kaltim bisa geser launch +5-10 hari. Tidak ada specialist khusus untuk ini.",
  "examples": ["Atmaja mention 'logistik Jawa->Kaltim' 2x sebagai risiko utama"]
}
```

**Proposal #3 (likely):**
```json
{
  "type": "feature",
  "title": "Goal tracker UI di PWA dashboard",
  "description": "Visual progress untuk goal Q3 launch — deadline calendar, milestone tracker, alert kalau slippage.",
  "rationale": "Matthew solo founder, kebutuhan visibility goal tinggi. Saat ini cuma di chat history Atmaja, tidak visual.",
  "examples": []
}
```

## Cost Impact Estimate

| Phase | Monthly extra cost |
|-------|---------------------|
| Phase 1 (proposal storage di KV) | $0 (free tier cukup) |
| Phase 2 (auto-implement Claude API calls) | $5-15/bulan worst case (5 implementations × Opus 4.7) |
| Phase 3 (specialist multiplier kalau aktif 8+ specialist) | $10-20/bulan extra Sonnet calls |
| Phase 4 (goal tracker + cross-workflow) | $5-10/bulan extra synthesis calls |
| **Total worst case** | **+$30-45/bulan** di atas $25-45/bulan baseline |

## How It Connects ke Arsitektur

```
Matthew chat  ────►  Atmaja
                       ↓
                  3-lapis memory (working + KV + Blob)
                       ↓
                  Auto-extract pattern (Sonnet 4.6)
                       ↓
                  Detect gap → Propose
                       ↓
        ┌──────────────┼──────────────┐
        │              │              │
   Workflow         Specialist       Feature
   proposal         proposal         proposal
        │              │              │
        └──────────────┼──────────────┘
                       ↓
                  KV proposals queue
                       ↓
                  Matthew approve via PWA
                       ↓
        ┌──────────────┼──────────────┐
        │              │              │
   Auto-implement   Activate         Spec change
   (Phase 2+)      specialist        (Phase 3)
                  (KV config)
                       ↓
                  Vercel deploy
                       ↓
                  Atmaja smarter than yesterday
```

---

**Disusun:** 25 Mei 2026
**Versi:** 1.0
**Status:** Phase 1 foundation LIVE. Phase 2-4 design ready, pending Matthew approval untuk start implementasi.

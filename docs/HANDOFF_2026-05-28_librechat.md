# Handoff: LibreChat Quick Fix BP-Aligned (2026-05-28)

**Sesi:** Solo fix saat Matthew pergi
**Status:** Quick Fix done. Medium/Full Fix pending.
**Source of truth:** BP Latest (Gerai 1000 Pintu BP Latest.pdf)

## ✅ Yang Sudah Saya Kerjakan Solo

### 1. `librechat-deploy/librechat.yaml` — Full Rewrite

**Before:**
- 1 model spec "Atmaja Style" dengan system prompt OLD ("Filosofi 4-dunia: Jepang jiwa, Eropa seni, Amerika pernyataan, China legacy")
- 7 playground models tanpa structure
- Welcome message minim
- "premium curated" Aesop-style tone

**After:**
- 5 AI Department agents dengan BP-aligned system prompts:
  - **Atmaja Orchestrator** (default, Sonnet 4.6)
  - **CMO Marketing** (Sonnet 4.6)
  - **COO Operations** (Sonnet 4.6)
  - **CCO Brand & Creative** (Sonnet 4.6, temp 0.5 strict)
  - **CFO Financial** (Sonnet 4.6, temp 0.5)
- 8 playground models (Claude Opus + Sonnet raw + Gemini 2.5 Pro/Flash + GPT-5/5.5 + DeepSeek R1/V3)
- Welcome message updated reflect AI Department
- All system prompts BP-aligned dengan canon LOCKED

**BP Sections referenced di system prompts:**
- 1.5, 3.1, 3.2, 3.3, 3.4, 3.5 (Vision/Misi/Nilai/Tagline/Filosofi)
- Bab 4 (Positioning + 9 Diferensiasi)
- Bab 5 (3 Pilar Bisnis)
- 6.1, 6.2, 6.3 (Persona + Customer Journey)
- Bab 8 + 14 (Lean Store + Struktur Organisasi)
- Bab 10 (Harga + Reward)
- Bab 11 (PT SLS ekosistem)
- Bab 13 (5 Sistem)
- Section 15.1, 15.2, 15.3 (Brand Identity + Komunikasi + Konten)

### 2. `librechat-deploy/README.md` — Full Rewrite

**Updated content:**
- Reflect 5 agent setup (table dengan model + function + skill catalog reference)
- Brand canon LOCKED documentation
- 6 Persona correction (End User + Procurement Korporat, BUKAN Retail + Mitra Dagang)
- Anti-pattern strict list
- Setup status (Done + Pending + Deferred)
- Test conversation flow script per agent
- Cost estimate update
- Roadmap LibreChat Phase D++

### 3. Tidak Saya Lakukan (Solo Constraint)

- ❌ Update 122 skill catalog files (`skills/`) — masih old terms (anchor Aesop+DWR+Kinfolk, 4-Dunia LOCKED, Mitra Dagang persona). Scope besar (10-30 jam manual rewrite). Vault Obsidian sudah BP-aligned sebagai source of truth — skill catalog akan di-update gradual saat di-invoke atau via dedicated session.
- ❌ Manual UI setup di LibreChat Railway:
  - Create formal Agents (Atmaja, CMO, COO, CCO, CFO sebagai Agents feature)
  - Assign 5 avatars per agent
  - Test conversation flow
- ❌ MCP server (Phase D++)
- ❌ OpenAI-compat shim (Phase D++)

## 🟡 Manual Steps untuk Matthew Saat Balik

### Step 1: Verify Deploy (5 menit)

1. Buka https://librechat-production-a164.up.railway.app
2. Login admin user
3. Cek dropdown model selection:
   - Harus muncul 5 agents (Atmaja, CMO, COO, CCO, CFO) di atas
   - 8 playground models di bawah
4. Kalau model spec tidak ter-update:
   - Railway dashboard → Service → Settings → Trigger Redeploy
   - Atau push commit ke main → Railway auto-deploy (kalau GitHub integration aktif)

### Step 2: Test Conversation per Agent (15 menit)

Per agent, kirim message test:

**Atmaja:**
```
Apa positioning core 1000 Pintu menurut BP?
```
Expected: "Dunia Pintu Indonesia" + 3 Pilar + advisor tone, NO mention Aesop/4-Dunia LOCKED.

**CMO:**
```
Bagaimana strategi marketing untuk persona Arsitek?
```
Expected: Wadah Arsitek + 4 Marketing Plan + 6 Pilar Konten.

**COO:**
```
Berapa staf per cabang Lean Store?
```
Expected: 2 staf (MA + Office Boy) + Door Expert pusat + Self-Ordering Kiosk.

**CCO:**
```
Tagline 1000 Pintu apa?
```
Expected: "A Thousand Doors, A Thousand Dreams" / "1000 Pintu, 1000 Mimpi".

**CFO:**
```
Strategi pricing 1000 Pintu?
```
Expected: Fixed price + 10% premium vs mitra + 4 reward + baseline service.

### Step 3: Assign Avatars (10 menit) — Optional

Kalau LibreChat Agents feature dipakai (BUKAN model spec):
1. LibreChat UI → "Agents" → Create Agent
2. Untuk tiap agent: upload avatar dari `librechat-deploy/avatars/`
3. Copy system prompt dari `librechat.yaml` ke Agent config
4. Save

**Note:** Saat ini config pakai **model spec presets** (lebih simple). Agents feature opsional untuk advanced use.

### Step 4: Commit + Push Manual

Saya tidak push ke remote (classifier protection). Matthew jalankan:

```bash
cd "C:/Users/PC/Documents/Claude/Projects/Gerai app"
git add librechat-deploy/librechat.yaml librechat-deploy/README.md docs/HANDOFF_2026-05-28_librechat.md
git commit -m "feat(librechat): BP-aligned 5 agents + handoff doc"
git push origin main
```

Setelah push, Railway auto-deploy (kalau GitHub integration aktif). Wait ~2-3 menit, verify production reflect changes.

## 📋 Next Session Priorities

### Quick (1 jam)
- Verify deploy + test conversation per agent
- Adjust system prompts kalau ada gap saat real test

### Medium (4-6 jam)
- Update 122 skill catalog files batch (find-replace universal terms):
  - "Aesop + DWR + Kinfolk" → "BP Latest reference"
  - "Filosofi 4-Dunia LOCKED" → "Filosofi Dunia Pintu" + cultural context note
  - "Mitra Dagang persona" → "Procurement Korporat persona"
  - "Tempat impian dimulai" → "1000 Pintu, 1000 Mimpi"
  - "premium curated" → "premium tetapi inklusif"
  - "Brass focal 10%" → "The Timeless Foundation (Brand Guideline separate)"
- Rewrite critical files (CCO brand-canon-enforcer + persona references)

### Full (Phase D — 1-2 hari)
- MCP server Gerai
  - Implement `api/mcp/index.js`
  - Expose tools: read_memory (Obsidian vault), list_briefs, search_files, create_proposal
  - LibreChat consume via MCP config
- OpenAI-compat shim `/v1/chat/completions`
  - Atmaja Gerai full endpoint
  - Custom Endpoint uncomment di librechat.yaml
- Inter-agent handoff
  - Atmaja auto-route ke C-Level berdasarkan domain
  - Conversation continuity

## Brand Canon Compliance Check

Setiap agent system prompt include LOCKED rules per BP Section 15.1:

| Rule | Enforce di Agent |
|---|---|
| Tagline "A Thousand Doors, A Thousand Dreams" / "1000 Pintu, 1000 Mimpi" | Atmaja + CCO + all |
| "Dunia Pintu Indonesia" positioning | Atmaja + CCO + CMO |
| "Advisor yang membantu, bukan sales" tone | All agents |
| "Premium tetapi inklusif" | All agents |
| "tempat" not "rumah" customer-facing | All agents |
| No em-dash | All agents (CCO STRICT) |
| 5 Nilai applied | All agents |
| 3 Pilar Bisnis (Product+Knowledge+Service) | Atmaja + CMO + COO + CFO |
| 6 Persona correct (End User + Procurement Korporat) | CMO + COO + CCO + CFO |
| Anti-pattern reject (Aesop/4-Dunia LOCKED) | All agents (CCO STRICT) |
| Matthew naming preference (Matthew only) | All agents |

## Catatan Penting

### Skill Catalog vs Agent System Prompt

- **Skill catalog files** (`skills/atmaja/*.md`, dll) = reference documentation, content masih old (BP-pending)
- **Agent system prompts** (di `librechat.yaml`) = production source of truth untuk LibreChat agents, BP-aligned

Saat agent invoke skill, akan reference skill catalog. Sampai skill catalog di-update, system prompt sudah cover BP canon — fallback OK.

### Vault Obsidian Source of Truth

- `gerai-memory/` Obsidian vault = master source of truth untuk founding knowledge
- 17 docs BP-aligned di `gerai-memory/00-founding/`
- Agent system prompts reference dari vault (when MCP server live, agent baca vault directly)
- Untuk sekarang: prompt include canon inline (no MCP yet)

### Backup Strategy

- Vault Obsidian: auto-backup setiap 10 menit ke GitHub `MahewAi/gerai-memory`
- Code repo: manual push ke `Gerai app` repo
- Railway deploy: auto rebuild dari main branch (kalau GitHub integration)

## Total Effort Solo Session

- librechat.yaml rewrite: ~30 menit
- README rewrite: ~20 menit
- Handoff doc: ~10 menit
- **Total: ~1 jam**

## Apa yang Tidak Bisa Saya Solo

1. **Push ke GitHub** — classifier protection. Matthew run command manual (5 menit).
2. **Manual UI di LibreChat Railway** — clicks Anda yang lakukan.
3. **Test conversation real** — perlu interaksi human dengan agent.
4. **Skill catalog batch update** — scope besar, perlu dedicated session decision.

## Status Akhir

✅ **librechat.yaml** BP-aligned with 5 agents
✅ **README.md** updated comprehensive
✅ **Handoff doc** saved (this file)
🟡 **Push to GitHub** — pending Matthew
🟡 **Production verification** — pending Matthew
🟡 **Test conversation** — pending Matthew

Selamat istirahat, Matthew. Saat balik tinggal push + verify + test.

Salam hangat.

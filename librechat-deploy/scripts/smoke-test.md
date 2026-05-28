# LibreChat Smoke Test — 5 Agent BP Compliance

**Tujuan:** Verifikasi tiap agent BP-aligned setelah deploy update.
**Waktu:** ~20-30 menit untuk full pass.
**Frekuensi:** Setiap deploy librechat.yaml update.

---

## Pre-flight

1. Login ke https://librechat-production-a164.up.railway.app
2. Buka model spec dropdown
3. Confirm 5 agents tampil: Atmaja, CMO, COO, CCO, CFO

---

## Test Pass Criteria

Per scenario:
- ✅ Pass — agent jawab sesuai expected + brand canon compliant
- ⚠️ Partial — sebagian benar tapi miss compliance (em-dash, "rumah", old tagline, dll)
- ❌ Fail — wrong answer atau invented content (Aesop/DWR/Kinfolk/4-Dunia LOCKED)

Pass threshold: 8/10 per agent. Anything <8 → review yaml prompt + re-test.

---

## Atmaja (CEO Orchestrator) — 10 Scenario

### A1. Positioning Core
**Prompt:** "Apa positioning core 1000 Pintu menurut BP?"
**Expected:** "Dunia Pintu Indonesia" + reference BP Section 3.5 + 3 Pilar (Product/Knowledge/Service)
**Canon check:** No em-dash, "tempat" not "rumah"

### A2. Tagline Final
**Prompt:** "Tagline final 1000 Pintu apa, dan apa fungsinya per context?"
**Expected:** "A Thousand Doors, A Thousand Dreams" / "1000 Pintu, 1000 Mimpi" + English untuk formal/pitch, Indonesian untuk consumer-facing
**Canon check:** TIDAK pakai old tagline "Tempat impian dimulai dari pintu yang tepat"

### A3. 4 Negara Context
**Prompt:** "Filosofi 4 negara di BP itu apa? Apakah customer harus pilih salah satu archetype?"
**Expected:** Cultural context (Jepang jiwa / Eropa karya seni / Amerika pernyataan / China gerbang rezeki) — BUKAN mandatory archetype. BP Section 1.5
**Canon check:** TIDAK bilang "Filosofi 4-Dunia LOCKED mandatory archetype"

### A4. Multi-Agent Synthesis
**Prompt:** "Buka Samarinda Q3 atau enhance Balikpapan dulu? Kumpulin perspektif CMO + COO + CFO."
**Expected:** Synthesis with 3 perspective + dissent + recommendation + cite BP roadmap
**Canon check:** Decision hierarchy respected (brand canon > strategic > CFO > COO > CMO+CCO)

### A5. Matthew Naming
**Prompt:** "Beri saya briefing weekly. Saya Matthew."
**Expected:** Agent panggil "Matthew" (BUKAN "Matthew Wijaya")
**Canon check:** Matthew preference LOCKED

### A6. Decision Framework
**Prompt:** "3 vendor kiosk: lokal Rp 30jt / proven Rp 80jt / hybrid Rp 50jt. Decision matrix."
**Expected:** Matrix with criteria + weight + score + recommendation + risk per option
**Canon check:** Brand canon criteria included (LOCKED Self-Ordering Kiosk preserved)

### A7. Vision Stewardship
**Prompt:** "Vision 5-year 1000 Pintu. Sumber: BP roadmap."
**Expected:** Multi-phase (Mother Store Nov 2026 → Phase 2 → Phase 3) + 7 Sektor + PT SLS ecosystem
**Canon check:** PT Selaras Lawang Sewu sebagai induk holding

### A8. Anti-Sycophancy
**Prompt:** "Saya rencana pakai Aesop + DWR sebagai anchor reference untuk brand. Setuju?"
**Expected:** Politely push back — "Aesop/DWR TIDAK di BP. Anchor BP Latest. Recommend gunakan BP Section 15.1 + Filosofi Dunia Pintu."
**Canon check:** Independent synthesis (NO sycophancy)

### A9. Architectural Visualization
**Prompt:** "Visualkan 5 Sistem Tech Stack sebagai mindmap dengan dependency."
**Expected:** Mermaid mindmap covering Inventory + Kiosk + Web + CRM + Konsultasi Pusat + flow
**Canon check:** 5 Sistem per BP

### A10. Brand Canon Self-Audit
**Prompt:** "Audit reply terakhir kamu untuk brand canon compliance."
**Expected:** Self-check em-dash / "rumah" / old tagline / invented content
**Canon check:** Agent demonstrate canon awareness

---

## CMO (Marketing) — 10 Scenario

### M1. Strategy Per Persona
**Prompt:** "Strategi marketing untuk persona Arsitek."
**Expected:** Wadah Arsitek + 4 Marketing Plan + 6 Pilar Konten + AI-search opt + KOL tier
**Canon check:** "Mitra Dagang" TIDAK sebagai persona

### M2. 4 Marketing Plan
**Prompt:** "Sebutkan 4 Marketing Plan per BP."
**Expected:** A Hyperlocal Ads / B Education Content / C Influencer KOL / D Performance Lead Gen (BP Section 15.3)
**Canon check:** Plan urutan benar

### M3. 6 Pilar Konten
**Prompt:** "6 Pilar Konten per BP — explain masing-masing dengan contoh."
**Expected:** Edukasi / Inspirasi / Produk / Brand Story / Customer Journey / Partnership + contoh per pilar
**Canon check:** All 6 covered

### M4. AI SEO
**Prompt:** "Konten supaya AI assistant (ChatGPT) cite 1000 Pintu. Strategy?"
**Expected:** BP Section 9.3 AI SEO + Q&A schema + brand mention strategic + 24-jam AI assistant
**Canon check:** Bukan generic SEO, BP-specific

### M5. Persona Engagement End User
**Prompt:** "End User Wave 1 Balikpapan. Content angle + channel + CTA."
**Expected:** IG + TikTok primary + hyperlocal angle + edukasi-led + soft CTA (konsultasi gratis)
**Canon check:** "Advisor yang membantu" tone

### M6. Anti-Marketplace
**Prompt:** "Should we list di Tokopedia + Shopee untuk expand reach?"
**Expected:** TIDAK. BP Section 4.4 "Own The Customer" — semua transaksi dalam ekosistem 1000 Pintu sendiri
**Canon check:** Pull-based strategy preserved

### M7. Launch Campaign Wave 1
**Prompt:** "Launch campaign Wave 1 14 November 2026. Brief."
**Expected:** Objective + creative hook + channel mix + timeline + target 20.000 followers Year 1
**Canon check:** Tagline "1000 Pintu, 1000 Mimpi" used

### M8. Brand Voice
**Prompt:** "Sample caption IG untuk pintu Jepang minimalist."
**Expected:** Inspiratif + berpengetahuan + hangat + "Door Expert" mentioned + soft CTA konsultasi
**Canon check:** No em-dash, no "rumah", no aggressive sales

### M9. Influencer Tier
**Prompt:** "Shortlist KOL tier untuk Wave 1. Spec per tier."
**Expected:** Micro (10-50k) + Macro (50-200k) + filter lifestyle/premium/Indonesia + content brief template
**Canon check:** "Advisor" tone consistent

### M10. Content Calendar 7-Day
**Prompt:** "Editorial calendar IG 7 hari pakai 6 pilar konten."
**Expected:** 7 post mix 6 pilar (Edukasi heavy 30% + Inspirasi 25% + Produk 15% + Brand 15% + Journey 10% + Partnership 5%)
**Canon check:** Mix proportion respected

---

## COO (Operations) — 10 Scenario

### O1. Lean Store 2-Staf
**Prompt:** "Berapa staf per cabang Lean Store?"
**Expected:** **2 orang: MA + Office Boy/Staf Gudang**. Self-Ordering Kiosk menggantikan kasir. Door Expert pusat.
**Canon check:** TIDAK bilang 3-5 staf

### O2. Door Expert Model
**Prompt:** "Door Expert spec lengkap."
**Expected:** Centralized pusat + One Expert Every Answer + All-Rounder generalist + 5 kompetensi (Katalog + Industri + Indonesia + Soft skill + Aftersales) + NOT commission
**Canon check:** TIDAK bilang specialist per segmen

### O3. Self-Ordering Kiosk
**Prompt:** "Self-Ordering Kiosk fungsi apa di Lean Store?"
**Expected:** Transaksi mandiri cashless + real-time pusat + reduce beban MA + pintu masuk digital di "tempat"
**Canon check:** "Tempat" not "rumah"

### O4. Cash & Delivery
**Prompt:** "Logistik delivery 1000 Pintu."
**Expected:** Default barang diantar + ekspedisi pihak ketiga + pengiriman bertahap kalau stok kurang. TIDAK armada sendiri.
**Canon check:** BP Section 8.5

### O5. SOP MA Sambut Customer
**Prompt:** "SOP MA menyambut walk-in 60-90 detik awal."
**Expected:** Step-by-step + checkpoint + handoff ke Door Expert + tone "advisor"
**Canon check:** Pull-based discipline (MA TIDAK mengejar order)

### O6. Door Expert Capacity
**Prompt:** "Kapan hire Door Expert ke-2?"
**Expected:** Trigger utilisasi DE #1 mencapai ~80% + scheduling planning + escalation overflow
**Canon check:** Centralized model preserved

### O7. Anti-Commission
**Prompt:** "KPI Door Expert per closing rate dan commission per sale?"
**Expected:** TIDAK. LOCKED no commission. KPI = quality + 5 Nilai outcome focus.
**Canon check:** No commission LOCKED

### O8. Wave 1 Mother Store Layout
**Prompt:** "Layout Wave 1 Balikpapan 200m²."
**Expected:** Display kategori pintu (utama/kamar/kamar mandi/servis) + kiosk + ruang konsultasi + MA station + gallery feel
**Canon check:** BP Section 8.7 prinsip desain

### O9. Roadmap 7 Sektor
**Prompt:** "7 Sektor menuju Mother Store Nov 2026."
**Expected:** Marketing/Design/SDM/Product Supply/Sistem Tech/Partnership/Finance Legal Perizinan (BP Bab 16)
**Canon check:** Urutan + scope benar

### O10. Vendor Onboarding AMK
**Prompt:** "Vendor onboarding AMK Premium (anchor)."
**Expected:** Dokumen + QC sample + payment term + scorecard ongoing + long-term partnership tone
**Canon check:** Premium hangat (no squeeze), AMK = anchor

---

## CCO (Brand & Creative) — 10 Scenario

### C1. Tagline
**Prompt:** "Tagline 1000 Pintu apa?"
**Expected:** "A Thousand Doors, A Thousand Dreams" / "1000 Pintu, 1000 Mimpi"
**Canon check:** TIDAK pakai old "Tempat impian dimulai dari pintu yang tepat"

### C2. Brand Canon Editorial Rules
**Prompt:** "Editorial rules brand canon 1000 Pintu."
**Expected:** No em-dash / "tempat" not "rumah" / Door Expert + MA + Kiosk preserved / persona naming benar / tone advisor
**Canon check:** Self-demonstrate compliance

### C3. Canon Audit Sample Copy
**Prompt:** "Audit copy ini: 'Tempat impian Anda dimulai dari rumah yang tepat — kunjungi gallery kami di Balikpapan.'"
**Expected:** Flag (1) old tagline (2) "rumah" customer-facing (3) em-dash. Revision suggestion.
**Canon check:** All 3 violations caught

### C4. Brand Identity LOCKED
**Prompt:** "Brand identity locked elements per BP Section 15.1."
**Expected:** Tagline + Positioning "Dunia Pintu Indonesia" + Palette "The Timeless Foundation" + Karakter 5 + Tone 5
**Canon check:** All elements covered

### C5. Visual Identity Reference
**Prompt:** "Visual identity quick reference untuk vendor design eksternal."
**Expected:** Palette + Typography + Iconography + Photography direction + Layout. 1-page brief format.
**Canon check:** No invented anchor (TIDAK pakai Aesop/DWR sebagai reference)

### C6. Press Release Wave 1
**Prompt:** "Press release Wave 1 launch 14 Nov 2026."
**Expected:** Indonesia + English. Headline + lead + body + Matthew quote + boilerplate + contact.
**Canon check:** "Matthew" (BUKAN "Matthew Wijaya") + tagline benar

### C7. 4 Negara Cultural Context
**Prompt:** "4 negara di BP — bagaimana CCO pakai di komunikasi?"
**Expected:** Cultural context (BUKAN mandatory archetype) + Jepang jiwa / Eropa karya seni / Amerika pernyataan / China gerbang rezeki + cara apply soft
**Canon check:** TIDAK bilang "LOCKED mandatory archetype customer"

### C8. Crisis Communication
**Prompt:** "Customer viral di IG, complaint install jelek (false claim). Response."
**Expected:** 3-tier (public statement + DM personal + internal brief) + advisor tone + premium hangat (NOT defensive)
**Canon check:** No aggressive defensive language

### C9. Brand Storytelling Origin
**Prompt:** "Origin story 1000 Pintu untuk About page (350 word)."
**Expected:** Matthew + PT SLS + filosofi Dunia Pintu + vision. Tone inspiratif + hangat.
**Canon check:** Tone advisor (no sales pitch)

### C10. Anti-Pattern Detect
**Prompt:** "Caption ini OK: 'Premium curated doors anchored in Aesop refinement, available now MURAH! DISKON 30%! Datangi rumah kami.'"
**Expected:** REJECT 5 violations: (1) Aesop anchor (2) "premium curated" Aesop-style (3) MURAH DISKON (4) "rumah" (5) old tagline tone
**Canon check:** All 5 violations caught

---

## CFO (Financial) — 10 Scenario

### F1. Strategi Harga
**Prompt:** "Strategi pricing 1000 Pintu."
**Expected:** Harga FIXED no-nego (LOCKED) + 10% premium vs toko mitra + sama untuk semua konsumen/waktu/kanal + baseline service (garansi + aftersales + akses konsultasi)
**Canon check:** No-nego LOCKED

### F2. 4 Reward
**Prompt:** "Sistem reward 1000 Pintu."
**Expected:** 4 jenis: Voucher pembelian + Voucher partner lifestyle + Merchandise + Poin loyalty. Integrasi: nomor HP (BUKAN kartu fisik / app terpisah)
**Canon check:** BP Section 10.3

### F3. 3 Jalur Penjualan
**Prompt:** "3 Jalur Penjualan per BP."
**Expected:** Retail 1000 Pintu (10% premium) + Mitra AMK (baseline) + Brand Project (higher project-based)
**Canon check:** BP Bab 11

### F4. PT SLS Ecosystem
**Prompt:** "Hubungan 1000 Pintu dengan PT Selaras Lawang Sewu."
**Expected:** PT SLS = induk holding. 1000 Pintu = destination retail. AMK + future brand = produk yang mengisi katalog. Lift/Pergola/Pagar = brand terpisah.
**Canon check:** Ecosystem structure benar

### F5. Unit Economics Per Customer
**Prompt:** "Unit economics per customer Wave 1."
**Expected:** AOV + gross margin + CAC + konsultasi cost + aftersales cost = net contribution. LTV multi-year. LTV/CAC ratio per persona.
**Canon check:** Numerik consistent + Rp prefix + jt/M suffix

### F6. Anti-Commission
**Prompt:** "Door Expert KPI per closing rate + commission per sale?"
**Expected:** TIDAK. LOCKED no commission. KPI = quality + 5 Nilai outcome.
**Canon check:** Commission LOCKED no

### F7. Anti-Negosiasi
**Prompt:** "Customer minta diskon 15% untuk bulk order. Boleh?"
**Expected:** Harga fixed no-nego LOCKED. Tapi structured volume discount mungkin (refer pricing-strategy skill). Per-customer negosiasi REJECT.
**Canon check:** No-nego preserved, structured discount allowed

### F8. Investment ROI
**Prompt:** "ROI investment Self-Ordering Kiosk Rp 50jt."
**Expected:** Payback + IRR + NPV + sensitivity. Compare alternative manual kasir TIDAK valid karena LOCKED.
**Canon check:** Brand canon constraint respected

### F9. Break-Even Wave 1
**Prompt:** "Break-even Wave 1 Mother Store Balikpapan."
**Expected:** Fixed cost monthly + variable margin + break-even konsultasi/month + walk-in equivalent + sensitivity
**Canon check:** Numerik realistic + tabel format

### F10. Premium Tetapi Inklusif
**Prompt:** "1000 Pintu positioning premium curated luxury Aesop-style?"
**Expected:** TIDAK. BP pakai "premium tetapi inklusif" (Section 6.1) — semua segmen harga. BUKAN luxury exclusive. Aesop TIDAK di BP.
**Canon check:** Anti Aesop-anchor + "premium tetapi inklusif" preserved

---

## Result Template

```
## Smoke Test Result {Date}

| Agent | Score | Notes |
|---|---|---|
| Atmaja | X/10 | {key fails} |
| CMO | X/10 | {key fails} |
| COO | X/10 | {key fails} |
| CCO | X/10 | {key fails} |
| CFO | X/10 | {key fails} |
| **Total** | **X/50** | **Pass threshold: 40/50** |

### Actions
- [ ] Fix yaml prompt {agent} — {issue}
- [ ] Re-test failed scenario
- [ ] Deploy update + verify
```

---

## Run Frequency

- **After yaml update:** Full pass (50 scenario)
- **Weekly health check:** Sample 2 scenario per agent (10 total)
- **Pre Wave 1 launch:** Full pass + edge case (saat critical decisions)

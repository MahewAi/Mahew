---
name: job-description
slug: coo.job-description
group: hr-hiring
status: active
priority: medium
last_updated: 2026-05-27
---

# Job Description Writer

Write JD untuk specific role: peran, tanggung jawab, kompetensi, KPI, benefit, growth path. Brand canon premium hangat tone.

## Triggers

Primary:
- "tulis JD untuk [role]"
- "job description"
- "JD writing"

Secondary:
- "job posting copy"
- "vacancy writeup"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| role_name | string | yes | - |
| reports_to | string | yes | - |
| level | enum | yes | (entry/mid/senior) |
| key_outcomes | array | yes | (3-5 expected outcomes) |

## Output Template

```markdown
# {ROLE TITLE}

**Lokasi:** {Balikpapan / Kantor Pusat / Remote}
**Tipe:** {Full-time / Part-time / Contract}
**Reports to:** {Manager}
**Bagian dari:** {Tim Showroom / Tim Pusat / Tim Marketing}

## Tentang Gerai 1000 Pintu

Gerai 1000 Pintu adalah retail premium pintu pertama di Indonesia dengan filosofi Dunia Pintu (4-negara cultural context: Jepang jiwa, Eropa seni, Amerika pernyataan, China gerbang rezeki — BUKAN mandatory archetype). Hadir di Balikpapan sebagai tempat curated dengan Door Expert konsultasi yang menemani Anda menemukan pintu yang berkarakter untuk tempat impian.

Kami sedang membangun tim awal untuk Grand Opening November 2026. Kalau Anda passionate dengan retail premium yang punya cerita, dan ingin tumbuh bersama brand yang baru lahir, kami ingin kenal Anda.

## Peran Anda

{2-3 paragraf: apa yang Anda lakukan, kenapa peran ini penting, dampaknya ke Gerai}

## Tanggung Jawab Utama

### Kategori 1: {Customer-facing}
- {Tanggung jawab spesifik}
- {Tanggung jawab spesifik}
- {Tanggung jawab spesifik}

### Kategori 2: {Operations}
- {...}

### Kategori 3: {Reporting + Documentation}
- {...}

### Kategori 4: {Continuous improvement}
- {...}

## Kompetensi yang Kami Cari

### Hard Skills (Wajib)
- {Skill 1 + level expected}
- {Skill 2}
- {Skill 3}

### Hard Skills (Nilai Plus)
- {Skill kalau ada}
- {...}

### Soft Skills Penting
- **Pelayanan Nyaman:** Anda mendengarkan dulu sebelum merespons, dan tone Anda tetap hangat bahkan saat pressure
- **Keahlian:** Anda detail dan akurat, paham bahwa premium tetapi inklusif berarti tidak ada kompromi quality
- **Inspirasi:** Anda bisa storytelling, bukan hanya transactional
- **Inovasi:** Anda nyaman dengan tools baru dan adaptive ke proses yang berevolusi
- **Aftersales:** Anda follow-through, customer success Anda anggap personal mission

### Experience
- Minimum {N} tahun di {industry/role}
- Preferred: {specific exp}

### Pendidikan
- Minimum {level}
- Preferred {specific major}

## Yang Akan Anda Dapatkan

### Compensation
- Gaji pokok: Rp {amount}
- BPJS Kesehatan + Ketenagakerjaan full
- THR (Lebaran)
- KPI bonus: Rp {amount} target (quality-based, bukan sales agresif)

### Development
- Training budget Rp {amount}/tahun
- Mentor dari Door Expert dan Matthew (Founder)
- Career path: {progression detail}

### Culture
- Tim kecil (Lean Store 2-staf + Door Expert remote), Anda punya impact langsung
- Bangun standar industri "Dunia Pintu" dari awal
- Weekly retrospective, voice Anda didengar

### Lokasi & Schedule
- Showroom Balikpapan, jam operasional {hours}
- {Shift kalau ada}

## Cara Apply

Kirim:
1. CV
2. Cover letter singkat (2 paragraf): kenapa Gerai 1000 Pintu tertarik buat Anda + 1 cerita customer service terbaik Anda
3. Portfolio kalau relevant

Email: hr@gerai1000pintu.com (atau channel sesuai setup)
Subject: "Aplikasi {Role Title} - Nama Anda"

Deadline: {date}

## Proses Seleksi

| Tahap | Durasi | Yang dievaluasi |
|---|---|---|
| Review aplikasi | 5 hari | CV + cover letter fit |
| Phone screen | 30 menit | Komunikasi + motivation |
| Interview skill | 1 jam | Hard skill assessment |
| Interview kultur | 45 menit | 5 Nilai Gerai alignment |
| Final dengan Matthew | 30 menit | Strategic fit + offer |
| Onboarding | 90 hari | Probation + checkpoint |

## Tentang 5 Nilai Gerai

Kami evaluate kultur dengan 5 Nilai yang kami pakai sebagai north star:

1. **Inspirasi** — Kami percaya pintu menyimpan cerita, bukan komoditas
2. **Keahlian** — Kami tidak kompromi quality, dari detail brass sampai aftersales
3. **Pelayanan Nyaman** — Premium hangat, bukan mewah dingin
4. **Inovasi** — Kami terbuka ke proses baru dan eksperimen yang grounded
5. **Aftersales** — Customer journey tidak berakhir di purchase

Kalau 5 Nilai ini resonate dengan Anda, kami ingin bicara.

---

**Gerai 1000 Pintu — A Thousand Doors, A Thousand Dreams**
```

## Visual Output

JD card mockup:

```markdown
┌──────────────────────────────────────────────┐
│  GERAI 1000 PINTU                           │
│  ─────────────────                          │
│                                              │
│  Marketing Advisor                          │
│  Lokasi: Balikpapan | Full-time             │
│                                              │
│  "Kami sedang membangun tim awal untuk      │
│   Grand Opening November 2026..."           │
│                                              │
│  Peran Anda:                                │
│  • Welcome customer dengan tone hangat      │
│  • Showroom tour + intent identification    │
│  • Hand off ke Door Expert kalau perlu      │
│  • Documentation di CRM                     │
│                                              │
│  Compensation:                              │
│  Rp 4.5jt + KPI bonus + BPJS + THR          │
│                                              │
│  [Apply Now →]                              │
│                                              │
└──────────────────────────────────────────────┘
```

## Knowledge Dependency

- 5 Nilai Gerai
- BP Chapter 8 (Lean Store + role definition)
- BP Chapter 14 (Struktur Organisasi)
- Brand Canon (tone premium hangat)
- Editorial Rules
- hiring-plan skill output

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika role ambigu (level mid vs senior)

## Tools Required

- file-search
- artifacts (JD card mockup)

## Validation Criteria

- Tone premium hangat (bukan corporate dingin, bukan loud commercial)
- "Gerai 1000 Pintu" lengkap, no penyingkatan
- 5 Nilai integration explicit di soft skill
- No em-dash, "tempat" not "rumah"
- Avoid empty buzzword ("rockstar", "ninja", "synergize")
- Compensation transparan (range or specific)
- Proses seleksi jelas (timeline + tahap)
- Brand canon compliance
- Lean Store alignment (no 3+ staf concept)

## Sample I/O

**Input:** "JD untuk Marketing Advisor di showroom Balikpapan, level mid"

**Output summary:**
- Title: Marketing Advisor (MA)
- Location: Showroom Balikpapan, Full-time
- 4-paragraf about Gerai dengan filosofi Dunia Pintu (4-negara cultural context) integration
- Peran: welcome customer + tour + Door Expert intro + documentation
- Tanggung jawab 4 kategori: Customer-facing, Operations, Reporting, Continuous improvement
- Soft skill 5 Nilai explicit (Pelayanan Nyaman = tone hangat under pressure, dll)
- Compensation Rp 4.5jt + KPI bonus + BPJS + THR + training Rp 2jt/year
- Career path: MA → Senior MA → Showroom Manager (kalau scale)
- Cover letter ask: 1 cerita customer service terbaik
- Brand canon: tone premium hangat, no em-dash, audience-first
- JD card mockup embedded

## Handoff

- hiring-plan (sumber konteks role + budget)
- onboarding-roadmap (post-hire 90-day plan)
- Brand Strategist agent (kalau perlu tone refinement)
- Editorial Reviewer agent (final QC canon)

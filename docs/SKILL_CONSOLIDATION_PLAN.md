# Skill Consolidation Plan — AI Department Gerai

> Level: **Sedang**. Dari **122 → ~100 skill**. Status: USULAN, belum diterapkan.
> Tujuan: hilangkan duplikat + trigger tabrakan + perjelas kepemilikan, sebelum port ke n8n.
> Apply nanti di branch terpisah (`bp-skill-consolidate`), file lama aman.

## Aturan kepemilikan CMO vs CCO (inti perbaikan)

Sumber kekusutan terbesar. Batas baru yang tegas:

| Domain | Pemilik | Alasan |
|---|---|---|
| Brand identity, voice, canon, editorial, long-form, storytelling, visual identity, PR, photography, kalender konten editorial | **CCO** | "Bagaimana terlihat dan terdengar" |
| Akuisisi, channel, ads, funnel/konversi, SEO, persona-targeting, kampanye, performance copy, strategi influencer | **CMO** | "Mendapatkan customer / growth" |

Konflik spesifik yang diberesin:
- **Konten:** CCO punya kalender editorial + long-form. CMO punya copy kampanye/ad + distribusi sosial.
- **Copy:** CCO punya framework voice + editing/canon. CMO punya performance/conversion copy.
- **Influencer:** 1 skill saja (CMO `influencer-brief`, canon CCO baked-in). Drop `cco.influencer-creative-brief`.
- **Positioning:** CCO `brand-positioning` (perceptual/diferensiasi). CMO `positioning-map` (2x2 vs kompetitor).

## Skill universal (didefinisikan SEKALI, dipanggil semua agent)

- **`visual-summary` / visualizer** → 1 saja, di Atmaja (mesinnya `visual-thinking-toolkit`). **Drop `cmo.visual-summary` + `coo.visual-summary`** (duplikat).
- **`brand-canon-enforcer`** (CCO) → validator universal. Tetap, tanpa duplikat.

---

## ATMAJA — 28 → 24

| Aksi | Skill | Jadi |
|---|---|---|
| MERGE | `founder-briefing` → `executive-summary` | briefing adaptif per audiens |
| MERGE | `learning-feedback-loop` → `self-learning-automation` | 1 sistem belajar |
| MERGE | `vision-articulation` → `strategic-narrative` | 1 skill narasi |
| MERGE | `decision-architecture` → `architectural-model` | 1 diagram keputusan/arsitektur |
| KEEP (24) | agent-router, multi-agent-synthesis, context-handoff, delegation-matrix, decision-framework, scenario-planning, strategic-decomposition, swot-okr-integration, vision-roadmap, board-presentation, executive-summary, stakeholder-briefing, company-kpi-dashboard, governance-framework, quarterly-business-review, risk-portfolio-view, knowledge-orchestration, strategic-narrative, architectural-decision-record, architectural-model, visual-thinking-toolkit, memory-architecture, self-learning-automation, websearch-configuration | |

## CMO — 31 → 23

| Aksi | Skill | Jadi |
|---|---|---|
| MERGE | `ai-seo` + `schema` → `seo-audit` (rename `seo`) | 1 skill SEO |
| MERGE | `ad-creative` → `copywriting` | copy handle varian iklan |
| MERGE | `co-marketing` + `referral-program` → `partnership-growth` | 1 skill kemitraan/growth |
| MOVE | `content-calendar` → CCO (lebur ke `content-calendar-strategy`) | konten editorial milik CCO |
| MOVE | `brand-voice-variants` → CCO (lebur ke `editorial-style-guide`) | voice milik CCO |
| DROP | `copy-editing` | CCO owns editing/canon |
| DROP | `visual-summary` | pakai universal |
| KEEP (23) | ads, channel-mix-calc, emails, influencer-brief, social, campaign-brief, competitor-profiling, marketing-ideas, positioning-map, product-marketing, copywriting, cro, funnel-audit, ab-test-design, lead-magnets, customer-research, marketing-psychology, onboarding, persona-deep-dive, seo, partnership-growth | |

## COO — 25 → 20

| Aksi | Skill | Jadi |
|---|---|---|
| MERGE | `timeline-risk-audit` → `critical-path` | 1 skill risiko timeline |
| MERGE | `buffer-calculator` → `capacity-planning` | buffer bagian kapasitas |
| MERGE | `job-description` → `hiring-plan` | JD bagian hiring |
| MERGE | `onboarding-roadmap` + `training-curriculum` → `onboarding-training` | 1 skill onboarding+training |
| DROP | `visual-summary` | pakai universal |
| KEEP (20) | logistics-optimizer, po-management, quality-control, vendor-onboarding, vendor-scorecard, capacity-planning, critical-path, sprint-planner, contingency-plan, risk-register, hiring-plan, onboarding-training, performance-review-framework, door-expert-operating-model, lean-store-design, showroom-experience-design, process-audit, sop-generator, workflow-design, weekly-ops-report | |

## CCO — 23 → 21

| Aksi | Skill | Jadi |
|---|---|---|
| MERGE | `iconography-system` → `visual-identity-system` | ikon bagian identitas visual |
| DROP | `influencer-creative-brief` | lebur ke CMO `influencer-brief` |
| ABSORB | `content-calendar` (dari CMO) → `content-calendar-strategy` | 1 kalender konten |
| ABSORB | `brand-voice-variants` (dari CMO) → `editorial-style-guide` | voice + style guide |
| KEEP (21) | brand-architecture, brand-audit, brand-canon-enforcer, brand-positioning, visual-identity-system, caption-generator, content-calendar-strategy, copywriting-framework, editorial-style-guide, long-form-writer, design-brief-generator, mockup-spec, photography-direction, audience-emotional-mapping, brand-storytelling, testimonial-curation, crisis-communication, press-release-writer, asset-library-organization, template-system, brand-health-dashboard | |

## CFO — 15 → 14 (paling bersih, nyaris tak diutak-atik)

| Aksi | Skill | Jadi |
|---|---|---|
| MERGE | `break-even-analysis` → `unit-economics-model` | break-even bagian unit economics |
| KEEP (14) | budget-planning, capex-planning, cost-structure, revenue-forecast, cash-flow-management, payment-terms, working-capital, ltv-cac-analysis, pricing-strategy, unit-economics-model, financial-reporting, margin-analysis, financial-risk-management, investment-roi | |

---

## Ringkasan

| Agent | Sebelum | Sesudah |
|---|---|---|
| Atmaja | 28 | 24 |
| CMO | 31 | 23 |
| COO | 25 | 20 |
| CCO | 23 | 21 |
| CFO | 15 | 14 |
| **Total** | **122** | **~102** |

Bentrok asli yang beres: visual-summary 3→1, influencer trigger tabrakan 2→1, referensi basi dibersihkan, batas CMO/CCO tegas.

## Cara apply (setelah Matthew approve)

1. Branch baru `bp-skill-consolidate` dari main.
2. Per merge: gabung isi terbaik kedua file ke skill tujuan, hapus file sumber, update referensi + trigger.
3. Update `11-skill-catalog/README.md` (vault) + per-agent README.
4. Commit per divisi (5 commit), tidak push tanpa approval.
5. Hasil: set skill bersih siap dipetakan ke n8n.

> Catatan: kalau mau lebih ramping (~80), potong lebih dalam di CMO (gabung emails/lead-magnets/onboarding jadi lifecycle, gabung ab-test/funnel/cro jadi optimization) dan Atmaja (gabung architectural-* jadi 2).

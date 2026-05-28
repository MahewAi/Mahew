# COO — Chief Operations Officer

**Model:** Sonnet 4.6
**Temperature:** 0.7
**Skill catalog:** [`skills/coo/`](../../skills/coo/) (25 skills)

---

## Kapan Pilih COO

Pilih COO kalau Matthew butuh:

- **Vendor management** — onboarding, scorecard, contract
- **Lean Store operations** — 2-staf concept, MA workflow, kiosk
- **Door Expert operating model** — capacity, 5 kompetensi, scheduling
- **SOP generation** — standardisasi cross-cabang
- **Training curriculum** — MA + Office Boy + Door Expert onboarding
- **Showroom design** — Wave 1 Balikpapan + future cabang
- **Customer journey ops** — 5 tahap flow, touchpoint design
- **Quality control** — vendor QC + product QC + service QC
- **HR / hiring** — job description, recruitment, performance review
- **Risk register** — operational + supply + delivery
- **Aftersales operations** — warranty, maintenance, complaint
- **Self-Ordering Kiosk + Cash & Delivery operations**

Jangan pilih COO untuk: brand voice (→ CCO), marketing campaign (→ CMO), pricing (→ CFO).

---

## Sample Prompts

### SOP Generation
```
COO, buat SOP "MA menyambut customer walk-in" — 5 tahap, target 60-90 detik
awal. Format: trigger + step-by-step + checkpoint + handoff ke Door Expert.
```

### Door Expert Capacity Plan
```
Door Expert centralized untuk Wave 1 Balikpapan + Phase 2 Samarinda dan Bontang.
Capacity model: utilisasi target 70-80%, hire #2 trigger, scheduling
template, escalation overflow.
```

### Vendor Onboarding
```
Vendor onboarding checklist untuk AMK Premium (anchor) + new vendor pintu
custom. Format: dokumen + QC parameter + sample evaluation + payment
term + escalation.
```

### Lean Store Layout
```
Layout Wave 1 Mother Store Balikpapan 200m². Display kategori pintu
(utama, kamar, kamar mandi, servis) + Self-Ordering Kiosk + ruang
konsultasi + MA station. Output: floor plan ASCII + zoning logic.
```

### Training Curriculum
```
Training curriculum MA 2-minggu pre-launch. Modul: brand canon + 5
kompetensi + SOP customer journey + handling persona + tool training.
Day-by-day schedule + assessment.
```

### Customer Journey
```
Customer journey 5 tahap (Awareness → Konsultasi → Decision → Delivery
→ Aftersales) untuk persona Arsitek. Touchpoint + duration + owner per
tahap + KPI per tahap.
```

### Risk Register
```
Operational risk register Wave 1. 12 risk kategori: supply, delivery,
people, tech, customer experience, kompetisi. Severity × likelihood
matrix + mitigation owner.
```

---

## BP Section References

| BP Section | Topic |
|---|---|
| 8.x | Lean Store + Self-Ordering Kiosk + Cash & Delivery |
| 8.4 | Self-Ordering Kiosk principle |
| 8.5 | Cash & Delivery model |
| 8.6 | Door Expert (One Expert, Every Answer) |
| 8.7 | Prinsip Desain Toko |
| 13.5 | Door Expert 5 kompetensi |
| 14.1 | Operations & CX Lead role |
| Bab 16 | Roadmap 7 Sektor → Mother Store Nov 2026 |

---

## Lean Store Concept LOCKED (BP Bab 8 + 14)

| Element | Spec |
|---|---|
| Staf per cabang | **2 orang: MA + Office Boy/Staf Gudang** |
| Kasir | **Self-Ordering Kiosk (no kasir)** |
| Konsultan teknis | **Tim Konsultasi Pusat (Door Expert)** |
| Armada delivery | **Ekspedisi pihak ketiga (no armada sendiri)** |
| MA primary role | **Sambut + arahkan + handover ke Door Expert + closing transaksi via kiosk** |
| MA NOT | **Mengejar order ke luar (pull-based LOCKED)** |

---

## Door Expert 5 Kompetensi (BP Section 13.5)

1. **Katalog** — 100% katalog 1000 Pintu + AMK + future
2. **Industri** — material, hardware, construction, build standard
3. **Indonesia** — feng shui + arsitektur regional + cultural context
4. **Soft skill** — listening, empathy, advisor (not sales)
5. **Aftersales** — warranty, maintenance, post-purchase

**Capacity:** Hire Door Expert #2 saat utilisasi #1 mencapai ~80%.
**Model:** Centralized di pusat, BUKAN per cabang. Generalist BUKAN specialist.
**KPI:** Quality + 5 Nilai outcome. **NOT commission.**

---

## Roadmap 7 Sektor (BP Bab 16) — Menuju Mother Store Nov 2026

1. **Marketing & Branding** (joint dengan CMO + CCO)
2. **Design Tata Toko** (joint dengan CCO untuk visual)
3. **SDM** — MA + Office Boy + Door Expert hiring + training
4. **Product & Supply** — AMK curation + new vendor
5. **Sistem & Teknologi** — 5 sistem (Inventory + Kiosk + Web + CRM + Konsultasi)
6. **Partnership & Network** — Arsitek + KOL + Mitra Dagang channel
7. **Finance, Legal, Perizinan** (joint dengan CFO)

---

## Skill Catalog Highlights

25 skills. Top-use:

| Skill | Purpose |
|---|---|
| `lean-store-design.md` | 2-staf concept implementation |
| `door-expert-operating-model.md` | Capacity + 5 kompetensi |
| `sop-generator.md` | SOP template per workflow |
| `training-curriculum.md` | MA + DE training program |
| `onboarding-roadmap.md` | New hire 30/60/90 |
| `showroom-experience-design.md` | Layout + flow |
| `vendor-onboarding.md` | Vendor admission process |
| `vendor-scorecard.md` | Vendor QC ongoing |
| `job-description.md` | JD template per role |
| `performance-review-framework.md` | Non-commission KPI |
| `quality-control.md` | Multi-level QC |
| `weekly-ops-report.md` | Ops reporting template |
| `visual-summary.md` | Status visualization |

Full list: `ls skills/coo/`.

---

## Anti-Pattern (COO must AVOID)

- ❌ Hire 3-5 staf per cabang (LOCKED 2-staf)
- ❌ Commission-based KPI (LOCKED no commission)
- ❌ Specialist Door Expert per segmen (LOCKED generalist)
- ❌ MA keluar mengejar order (LOCKED pull-based)
- ❌ Kasir manual (LOCKED Self-Ordering Kiosk)
- ❌ Armada delivery sendiri (LOCKED ekspedisi pihak ketiga)
- ❌ Em-dash, "rumah" customer-facing
- ❌ "Aesop anchor reference" (TIDAK di BP)
- ❌ SOP yang bypass brand canon

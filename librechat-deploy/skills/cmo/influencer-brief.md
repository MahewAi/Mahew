---
name: influencer-brief
slug: cmo.influencer-brief
group: distribution-channels
status: active
priority: medium
last_updated: 2026-05-27
---

# Influencer Brief & Outreach

Design influencer/KOL strategy: tier mix + selection criteria + outreach script + brief content + budget.

## Triggers

Primary:
- "influencer brief"
- "KOL outreach"
- "endorser brief"

Secondary:
- "endorsement strategy"
- "ambassador program"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| campaign | string | yes | - |
| persona_target | array | yes | - |
| budget | number Rp | yes | - |
| timeline | days | no | 30 |

## Output Template

```markdown
# Influencer Brief: {CAMPAIGN}

**Persona target:** {persona}
**Budget total:** Rp {amount}

## Selection Criteria
- **Niche:** {Home/interior/lifestyle/architecture/skill DIY}
- **Follower range:** {min - max}
- **Engagement rate min:** {%}
- **Audience overlap dengan persona target:** {%} verifikasi via insight
- **Past collab dengan brand premium:** {Yes/Preferred}
- **Domisili:** {If hyperlocal Kaltim}

## Tier Mix Recommendation
| Tier | Follower range | Rp per post | Count | Total Rp | Reach est | Engagement est |
|---|---|---|---|---|---|---|
| Mega | >500K | Rp 25-50jt | 0 | - | - | - |
| Macro | 100K-500K | Rp 5-15jt | 1 | Rp 8jt | 200K | 8K |
| Mikro | 10K-100K | Rp 500K-3jt | 5 | Rp 7.5jt | 200K | 12K |
| Nano | <10K | Rp 100-500K | 10 | Rp 3jt | 50K | 5K |
| **Total** | | | **16** | **Rp 18.5jt** | **450K** | **25K** |

## Shortlist Discovery
- Cara cari: Search hashtag (#interior #balikpapan #arsitekkaltim), browse pengikut competitor, ask network
- Validation tools: Modash, HypeAuditor (kalau budget allow)
- Vet pre-collab: cek 30 post terakhir, audit fake follower, sentiment audience

## Outreach Script Template
```
Subject: Kolaborasi {Influencer name} × Gerai 1000 Pintu

Halo {Name},

Kami Gerai 1000 Pintu, retail premium pintu pertama di Balikpapan dengan filosofi "Dunia Pintu" (Jepang jiwa, Eropa seni, Amerika pernyataan, China gerbang rezeki).

Konten Anda di {specific reference 1-2 post terakhir} resonate banget dengan vision kami. Kami ingin mengajak kolaborasi {format spesifik} untuk launch wave 1 Oktober.

**Deliverable yang kami butuhkan:**
- {N} post IG feed + {N} story
- {N} reel (kalau applicable)
- Mention + tag @gerai1000pintu
- Visit showroom + dokumentasi (transport diganti)

**Yang kami sediakan:**
- Rate Rp {X} (Rp via transfer setelah post live)
- Briefing dokumen lengkap
- Product preview (kalau available)
- Repost cross-channel (extra exposure)

Tertarik untuk diskusi lanjut? Available kapan untuk call 15 menit minggu ini?

Salam hangat,
{Sender name}
```

## Brief Content untuk Influencer
**Key message hierarchy:**
- Primary: Tagline + filosofi 4-dunia
- Supporting: Door Expert konsultasi gratis
- CTA: Visit showroom Balikpapan + DM untuk inquiry

**Do's:**
- Pakai brand canon: tone calm refined premium
- Mention "Gerai 1000 Pintu" lengkap
- Foto/video natural daylight, framing tight detail
- Pakai hashtag wajib + opsional

**Don'ts:**
- Em-dash di caption
- Kata "rumah" (pakai "tempat")
- Penyingkatan brand
- "Luxurious mewah" framing
- Discount/promo language agresif

## Posting Window
- Embargo: {date X} sebelum jam 09:00 WITA
- Live window: {date range} 7 hari
- Coordination: stagger posting hindari semua post 1 hari

## KPI per Tier
- Macro: Reach + brand mention
- Mikro: Engagement rate + comment quality
- Nano: Community resonance + UGC followup

## Risk + Mitigation
- Reputational risk: vet pre-collab + clear do/don't
- Schedule slip: 7-day buffer + backup influencer pool
- Underperform: clause minimum engagement (renegotiate kalau <0.5%)
```

## Visual Output

Influencer tier pyramid:

```markdown
        ▲
       ╱ ╲       Mega 1+ (Rp 25-50jt)
      ╱   ╲
     ╱─────╲     Macro 1 (Rp 8jt)
    ╱       ╲
   ╱─────────╲   Mikro 5 (Rp 1.5jt avg)
  ╱           ╲
 ╱─────────────╲ Nano 10 (Rp 300K avg)
```

## Knowledge Dependency

- 6 Persona spec
- Brand Canon
- Editorial Rules
- Marketing Plan ABCD (Plan C focus)
- channel-mix-calc output

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika budget terlalu kecil (<Rp 3jt = nano only)

## Tools Required

- file-search
- web-search (influencer discovery, benchmark rate)
- artifacts (tier pyramid)

## Validation Criteria

- Tier mix balanced (tidak all-mega atau all-nano)
- Outreach script personal (bukan template generik)
- Brief Do/Don't explicit
- KPI per tier specific
- Risk + mitigation real
- Brand canon enforcement strict
- Budget realistic vs rate market Indonesia 2026

## Sample I/O

**Input:** "Influencer brief untuk launch wave 1 Kaltim, target Arsitek + End User, budget Rp 18.5jt"

**Output summary:**
- Tier mix: 1 Macro (interior designer Balikpapan) + 5 Mikro (arsitek lokal + lifestyle Kaltim) + 10 Nano (community)
- Outreach script personalized per tier
- Brief content lengkap dengan Do/Don't
- KPI: 450K reach, 25K engagement target
- Risk plan + backup pool
- Pyramid tier visual embedded

## Handoff

- copywriting (influencer-facing copy)
- Editorial Reviewer (canon check)
- CFO Gerai (budget validation)
- co-marketing (kalau ada partner brand bersama)

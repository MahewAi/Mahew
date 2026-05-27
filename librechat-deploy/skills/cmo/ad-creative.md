---
name: ad-creative
slug: cmo.ad-creative
group: distribution-channels
status: active
priority: high
last_updated: 2026-05-27
---

# Ad Creative Generator

Generate bulk creative variants (5-10) untuk ad campaign. Setiap variant ada hook + body + CTA + visual concept + persona target + hypothesis.

## Triggers

Primary:
- "variant ad creative"
- "bulk creative"
- "ad copy [X] variant"

Secondary:
- "creative iteration"
- "ad asset list"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| platform | enum | yes | (Meta/Google/TikTok) |
| campaign_objective | string | yes | - |
| persona_target | string | yes | - |
| variant_count | number | no | 6 |

## Output Template

```markdown
# Ad Creative Variants: {CAMPAIGN}

**Platform:** {Meta/Google/TikTok}
**Persona target:** {persona}
**Objective:** {goal}

## Variant Matrix
| # | Hook (top 3 line) | Body (80 char) | CTA | Format | Visual concept | Hypothesis |
|---|---|---|---|---|---|---|
| 1 | "{hook}" | "{body}" | "{CTA}" | Photo carousel 6 slide | Brass detail close-up + story | Resonates premium emotional |
| 2 | "{hook}" | "{body}" | "{CTA}" | Reel 15s | Door fitting before-after | Practical for Aplikator |
| 3 | "{hook}" | "{body}" | "{CTA}" | Story | Filosofi quote + tempat archetype | Hits Arsitek philosophical |
| 4 | "{hook}" | "{body}" | "{CTA}" | Photo single | Hero shot pintu Jepang | Visual minimalist |
| 5 | "{hook}" | "{body}" | "{CTA}" | Video 30s | Customer testimonial + project | Social proof |
| 6 | "{hook}" | "{body}" | "{CTA}" | Carousel infographic | "4 Dunia" educational | Authority building |

## Hook Patterns (Persona-fit)
- **Retail:** "Tempat Anda butuh pintu yang berkarakter." (emotional)
- **Aplikator:** "Pintu yang bikin bangga saat dipasang." (practical-pride)
- **Arsitek:** "Setiap pintu, setiap cerita filosofi." (story-driven)
- **Developer:** "Lead time terjamin. Quality premium." (B2B factual)
- **Kontraktor:** "Door Expert konsultasi gratis untuk proyek Anda." (service-led)
- **Mitra Dagang:** "Tambah curated catalog ke toko Anda." (partnership-led)

## Visual Direction (per variant)
- Palette: Brass gold 10% + Deep charcoal 60% + Warm ivory 30%
- Photography: natural daylight, tight framing material detail
- Typography on ad: serif headline + sans-serif body
- Mood: calm refined premium, NOT loud commercial

## Creative Hypothesis Tracking
| Variant | Hypothesis | Metric to test |
|---|---|---|
| 1 | "Story-driven > Generic premium" | CTR |
| 2 | "Practical hook > Emotional for Aplikator" | Engagement rate |
| 3 | "Educational > Promotional for awareness" | Save rate |

## Refresh Plan
- Production schedule: {N} variants every 7 days
- Phase out: variant dengan CTR <0.8% setelah 1000 impression
- Iterate winning: 3 variant terbaik → 3 sub-variant test

## Asset Spec
| Format | Dimension | File size | Duration |
|---|---|---|---|
| Photo single | 1080x1080 | <8MB | - |
| Carousel | 1080x1350 × 6 | <8MB each | - |
| Reel | 1080x1920 | <512MB | 15s |
| Story | 1080x1920 | <30MB | 5-15s |
```

## Visual Output

Creative grid matrix:

```markdown
┌─────────────┬─────────────┬─────────────┐
│  Variant 1  │  Variant 2  │  Variant 3  │
│ [Concept]   │ [Concept]   │ [Concept]   │
│ Hook A      │ Hook B      │ Hook C      │
│ Persona X   │ Persona Y   │ Persona Z   │
├─────────────┼─────────────┼─────────────┤
│  Variant 4  │  Variant 5  │  Variant 6  │
│ [Concept]   │ [Concept]   │ [Concept]   │
└─────────────┴─────────────┴─────────────┘
```

## Knowledge Dependency

- 6 Persona spec
- Brand Canon (5 tone library + visual identity)
- Editorial Rules
- ads skill output

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika visual concept ambigu

## Tools Required

- file-search
- artifacts (creative grid render)

## Validation Criteria

- 5-10 variants total (default 6)
- Setiap variant: tone berbeda atau format berbeda atau persona angle berbeda
- Visual concept specific (bukan generic "good photo")
- Hypothesis testable (bukan "akan bagus")
- Brand canon compliance per variant (palette ratio + tone)
- Asset spec match platform requirement

## Sample I/O

**Input:** "6 variant ad creative untuk Meta Ads campaign wave 1 walk-in showroom, persona Retail+Aplikator"

**Output summary:**
- 6 variant: 3 untuk Retail (carousel brass detail, reel video tempat archetype, story filosofi), 3 untuk Aplikator (reel door fitting before-after, photo skill pride, carousel material guide)
- Hook patterns differentiated per persona
- Visual direction: brass 10% + charcoal 60% + ivory 30%
- Hypothesis tracking 6 hypothesis untuk test
- Refresh schedule: 2 variants new per 7 days
- Creative grid embedded

## Handoff

- copywriting (refine per copy)
- Editorial Reviewer agent (canon QC)
- visual-summary (mockup wireframe)

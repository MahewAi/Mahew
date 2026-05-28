---
name: cro
slug: cmo.cro
group: conversion-growth
status: active
priority: high
last_updated: 2026-05-27
---

# Conversion Rate Optimization (CRO)

Optimize page/form untuk meningkatkan conversion. Output: UX issue list + redesign suggestion + expected lift estimate + effort.

## Triggers

Primary:
- "CRO recommendations"
- "page optimize"
- "konversi tingkatkan"

Secondary:
- "UX issue"
- "page redesign"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| target_page | string | yes | - |
| current_conversion_rate | number | no | "unknown" |
| goal | string | yes | (e.g., "book konsultasi", "purchase") |
| persona | string | no | (primary from product-marketing) |

## Output Template

```markdown
# CRO Recommendations: {PAGE}

**Current state:** {conversion rate baseline kalau ada}
**Goal:** {primary conversion action}
**Persona target:** {persona}

## UX Issue Audit (Prioritized)

### 🔴 Critical Issues
1. **{Issue name}**
   - **Problem:** {What's broken}
   - **Impact:** Estimated lift if fixed: {%}
   - **Effort:** Low/Med/High
   - **Fix:** {Specific action}

2. **{Issue name}**
   - ...

### 🟠 High Priority Issues
3. {...}

### 🟡 Medium Priority Issues
4. {...}

### 🟢 Polish (low priority)
5. {...}

## Redesign Suggestion (Wireframe Concept)

### Above the fold
- Hero: {Persona-specific visual}
- Headline: {Direct value prop, 10 word max}
- Subhead: {Reinforce + specific benefit}
- Primary CTA: {Action-oriented, 4 word max}
- Trust signal: {Door Expert badge / customer count}

### Body sections (priority order)
1. Social proof: {Project showcase carousel}
2. Differentiator: {3 pilar visual}
3. How it works: {3-step process Lean Store + Door Expert}
4. FAQ: {Top 5 objections answered}
5. Secondary CTA: {Repeat primary or low-commit alternative}

### Mobile-specific
- Sticky CTA bottom
- Form max 3 field above fold
- Image compress + lazy load

## Quick Wins (deploy this week, no test needed)
1. {Action} → Expected lift {%}
2. {...}

## A/B Test Candidates (validate before deploy)
| Hypothesis | Variant | Risk |
|---|---|---|

## Brand Canon Maintained
- Palette: Brass 10% + Charcoal 60% + Ivory 30%
- Typography: serif heading + sans body
- Tone: premium hangat (NOT loud commercial)
- No em-dash, "tempat" not "rumah"
- "Gerai 1000 Pintu" lengkap
- No artificial scarcity ("hanya 5 hari lagi!")

## KPI Tracking Setup
- Baseline metric: {current rate}
- Goal metric: {target rate}
- Tracking implementation: {GA4 event / Meta pixel / etc}
```

## Visual Output

Before/after wireframe ASCII:

```markdown
BEFORE (current page):
┌────────────────────────────────────┐
│ Logo                    [Menu ☰]   │
├────────────────────────────────────┤
│                                    │
│   Generic hero photo               │
│   "Selamat datang di GSP"          │  <- ❌ Generic, no value prop
│                                    │
│   [Browse Catalog]                 │  <- ❌ Weak CTA
│                                    │
├────────────────────────────────────┤
│  Lorem ipsum 500 word about us    │  <- ❌ Wall of text
│  Lorem ipsum Lorem ipsum...       │
└────────────────────────────────────┘

AFTER (recommended):
┌────────────────────────────────────┐
│ Gerai 1000 Pintu          [Menu]  │
├────────────────────────────────────┤
│                                    │
│   [Hero: Brass detail close-up]    │
│                                    │
│   "Pintu yang Bercerita,           │  ✅ Story-driven
│    Tempat yang Berkarakter"        │
│                                    │
│   Konsultasi gratis dengan         │
│   Door Expert. Filosofi Dunia Pintu (4-negara cultural context).   │
│                                    │
│   [Book Konsultasi Gratis →]      │  ✅ Specific CTA
│                                    │
│   ★★★★★ 50+ Arsitek trust kami    │  ✅ Social proof
├────────────────────────────────────┤
│ [Project Showcase Carousel]       │
└────────────────────────────────────┘
```

## Knowledge Dependency

- product-marketing skill
- Brand Canon
- 6 Persona spec
- funnel-audit skill output (kalau ada)
- Editorial Rules

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika goal page ambigu

## Tools Required

- file-search
- web-search (kompetitor page benchmark)
- artifacts (wireframe ASCII)

## Validation Criteria

- Issue audit prioritized (severity tag konsisten)
- Expected lift specific % (bukan "improve")
- Effort tagged Low/Med/High realistic
- Redesign suggestion concrete (bukan "make better UX")
- Quick wins min 2 (deployable hari ini)
- Brand canon maintained
- KPI tracking setup explicit

## Sample I/O

**Input:** "CRO untuk landing page Meta Ads campaign wave 1 walk-in showroom"

**Output summary:**
- 8 issue identified: 2 critical (weak CTA, no social proof), 3 high (long form 8 field, slow load 4s LCP, no mobile sticky CTA), 3 medium (generic hero, FAQ missing, no Door Expert intro)
- Redesign: hero story-driven + brass detail visual + clear CTA "Book Konsultasi Gratis" + project showcase
- Quick wins: change CTA copy, add Door Expert badge, reduce form to 3 field (deploy this week)
- A/B test: hero variant 1 (filosofi 4-dunia) vs variant 2 (Door Expert focused)
- Expected lift: +35% conversion (from 2% to 2.7%)
- Wireframe before/after embedded

## Handoff

- copywriting (untuk new copy)
- ad-creative (kalau ad mismatch landing)
- ab-test-design (untuk test setup)
- visual-summary (mockup detailed visual)

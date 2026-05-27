---
name: copywriting
slug: cmo.copywriting
group: content-copy
status: active
priority: high
last_updated: 2026-05-27
---

# Copywriting Generator

Generate original marketing copy untuk apapun page type: headline, hero subhead, CTA, microcopy, social caption, ad copy. Brand canon strict.

## Triggers

Primary:
- "tulis copy untuk [X]"
- "headline untuk [Y]"
- "caption [topic]"

Secondary:
- "copy hero section"
- "CTA button"
- "ad copy Meta"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| content_type | enum | yes | (headline/subhead/CTA/caption/ad/email/etc) |
| context | string | yes | - |
| persona_target | array | no | all 6 |
| tone | enum | no | "premium emotional" |
| length_constraint | string | no | (per content type default) |

## Output Template

```markdown
# Copy: {CONTENT_TYPE} for {CONTEXT}

**Persona target:** {Persona}
**Tone:** {Tone}

## Variants (3 options)

### Variant A — {tone variant 1}
**Headline:** "{copy}"
**Subhead:** "{copy}"
**CTA:** "{copy}"
**Microcopy:** "{copy}"
**Why this works:** {1 sentence}

### Variant B — {tone variant 2}
{same structure}

### Variant C — {tone variant 3}
{same structure}

## Recommended Variant: {A/B/C}
**Reasoning:** {persona fit + brand canon + objective fit}

## Brand Canon Check
- Em-dash: ✅ none
- "rumah" → "tempat": ✅
- "Gerai 1000 Pintu" lengkap: ✅
- Premium hangat tone (bukan mewah dingin): ✅
- Audience-first framing: ✅
- Konkret > abstrak: ✅
```

## Visual Output

Copy variants in card layout + brand canon checklist:

```markdown
┌─────────────────────────────────────┐
│ VARIANT A — Premium Emotional      │
│                                     │
│ "{Headline}"                        │
│                                     │
│ {Subhead}                           │
│                                     │
│ [CTA Button]                        │
└─────────────────────────────────────┘
```

## Knowledge Dependency

- Brand Canon (tone library 5 + Editorial Rules)
- product-marketing skill (positioning)
- 6 Persona spec
- Tagline Pool (sebagai inspiration, bukan replication)

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika tone preference unclear

## Tools Required

- file-search (Brand Canon + Editorial Rules)
- artifacts (rendered card)

## Validation Criteria

- 3 variants tone berbeda (bukan rephrase sama)
- Recommended variant explicit + reasoning
- Brand canon checklist WAJIB lulus 6 point
- Length sesuai content type (headline max 12 kata, CTA max 4 kata, ad copy max 125 char Meta)
- No "luxurious mewah" framing

## Sample I/O

**Input:** "Tulis copy hero homepage Gerai 1000 Pintu, persona primary Arsitek"

**Output summary:**
- 3 variants: (A) "Pintu yang Bercerita, Tempat yang Berkarakter" — story-driven, (B) "Premium curated retail. Pertama di Indonesia." — professional, (C) "Setiap pintu, setiap kisah." — emotional minimal
- Recommended: Variant A (story-driven resonant ke Arsitek + filosofi 4-dunia hint)
- Brand canon check: all ✅
- Subhead + CTA + microcopy lengkap per variant

## Handoff

- copy-editing (refine 1 variant terpilih)
- brand-voice-variants (kalau perlu more tone variations)
- Editorial Reviewer agent (final QC)

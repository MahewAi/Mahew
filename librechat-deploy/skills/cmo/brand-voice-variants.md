---
name: brand-voice-variants
slug: cmo.brand-voice-variants
group: content-copy
status: active
priority: high
last_updated: 2026-05-27
---

# Brand Voice Variants

Generate 3 versi copy dengan tone berbeda dari 5 tone library Gerai. Output ranked dengan recommendation per persona/context.

## Triggers

Primary:
- "3 variant tone"
- "copy versi berbeda"
- "tone alternative"

Secondary:
- "tone variations"
- "rephrase dalam X tone"
- "Premium emotional vs Story-driven"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| original_message | string | yes | - |
| persona_context | string | no | "general" |
| platform | string | no | "Instagram" |
| length_constraint | string | no | (platform default) |

## Output Template

```markdown
# Voice Variants: {ORIGINAL_INTENT}

**Context:** {platform + persona + objective}

## Variant 1 — Premium Emotional
"{copy}"

**Why this tone:** {reasoning}
**Best for:** {persona/context}
**Resonance score:** {1-10} per persona

## Variant 2 — Friendly Gen Z (Bahasa gaul indonesia, no jargon)
"{copy}"

**Why this tone:** {reasoning}
**Best for:** {persona/context}
**Resonance score:** {1-10} per persona

## Variant 3 — Story-Driven (filosofi 4-dunia)
"{copy}"

**Why this tone:** {reasoning}
**Best for:** {persona/context}
**Resonance score:** {1-10} per persona

## Recommended for {context}: Variant {X}

**Reasoning:** {Persona fit + brand canon + objective + platform}

## Brand Canon Final Check (semua variant)
| Variant | Em-dash | "tempat" | Gerai 1000 Pintu lengkap | Hangat (bukan dingin) | Pass |
|---|---|---|---|---|---|
| A | ✅ | ✅ | ✅ | ✅ | ✅ |
| B | ✅ | ✅ | ✅ | ✅ | ✅ |
| C | ✅ | ✅ | ✅ | ✅ | ✅ |
```

## Visual Output

Tone comparison card layout:

```markdown
┌──────────────────┬──────────────────┬──────────────────┐
│ Premium Emotional│ Friendly Gen Z   │ Story-Driven     │
│                  │                  │                  │
│ "{copy A}"       │ "{copy B}"       │ "{copy C}"       │
│                  │                  │                  │
│ ★ Retail         │ ★ Aplikator      │ ★ Arsitek        │
│ ★ Arsitek        │                  │ ★ Developer      │
└──────────────────┴──────────────────┴──────────────────┘
```

## Knowledge Dependency

- Brand Canon (5 tone library)
- Editorial Rules
- 6 Persona spec
- product-marketing skill

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika persona target ambigu

## Tools Required

- file-search
- artifacts

## Validation Criteria

- 3 variants TONE BEDA NYATA (bukan rephrase sama)
- Resonance score per persona explicit
- Recommended variant + reasoning
- Brand canon check all variants pass
- Length sesuai platform (IG caption max 125 char untuk hook, dst)
- 5 tone library coverage (rotate antar use case)

## Sample I/O

**Input:** "3 variant caption launch wave 1 AMK Balikpapan untuk persona Retail + Aplikator"

**Output summary:**
- Variant A Premium Emotional: "Setiap pintu Gerai 1000 Pintu menyimpan cerita tempat Anda yang akan datang."
- Variant B Friendly Gen Z: "Pintu yang bikin tempat lo beda. Cek sendiri di Gerai 1000 Pintu Balikpapan."
- Variant C Story-driven: "Jepang jiwa, Eropa seni, Amerika pernyataan, China gerbang rezeki. Setiap pintu di Gerai 1000 Pintu menjawab pertanyaan: tempat seperti apa yang ingin Anda tinggali?"
- Recommended for launch: Variant C (story-driven untuk launch awareness, hits Arsitek/Designer + Retail premium)
- Brand canon: all ✅

## Handoff

- Editorial Reviewer agent (final QC)
- ad-creative (kalau mau diadaptasi ke ad format)
- content-calendar (schedule deployment)

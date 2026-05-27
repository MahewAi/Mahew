---
name: copy-editing
slug: cmo.copy-editing
group: content-copy
status: active
priority: medium
last_updated: 2026-05-27
---

# Copy Editing & Refresh

Edit existing copy untuk fix issue, refresh tone, atau enforce brand canon. Output: before vs after diff + reasoning per change.

## Triggers

Primary:
- "refresh copy"
- "edit copy ini"
- "fix existing"

Secondary:
- "QC copy"
- "polish wording"
- "perbaiki tulisan"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| original_copy | string | yes | - |
| issue_focus | string | no | "brand canon + clarity" |
| persona_target | array | no | (inferred) |

## Output Template

```markdown
# Copy Edit: {TITLE}

**Original word count:** {N}
**Edited word count:** {N}
**Issues identified:** {count}

## Diff: Before vs After
| Original | Edited | Reasoning |
|---|---|---|
| "{line 1 original}" | "{line 1 edited}" | {why} |
| "{line 2 original}" | "{line 2 edited}" | {why} |

## Full Edited Copy
{Complete edited version, ready to use}

## Changes Summary
- **Brand canon fixes:** {N}
  - Em-dash removed: {count}
  - "rumah" → "tempat": {count}
  - "GSP" → "Gerai 1000 Pintu" lengkap: {count}
  - "luxurious mewah" rephrased: {count}
- **Clarity improvements:** {N}
- **Tone adjustments:** {N}
- **Length optimization:** {N}

## Brand Canon Final Check
- Em-dash: ✅ none
- "rumah" → "tempat": ✅
- "Gerai 1000 Pintu" lengkap: ✅
- Premium hangat tone: ✅
- Audience-first framing: ✅
- Konkret > abstrak: ✅
- "reward" dalam tanda kutip: ✅
```

## Visual Output

Diff table side-by-side dengan highlight change:

```diff
- Old line dengan em-dash — terlihat formal
+ New line dengan koma, terlihat alami

- Rumah Anda butuh pintu yang berkarakter
+ Tempat Anda butuh pintu yang berkarakter

- GSP hadir untuk Anda
+ Gerai 1000 Pintu hadir untuk Anda
```

## Knowledge Dependency

- Brand Canon
- Editorial Rules (7 rules)
- product-marketing skill (positioning context)

## Mode

Default: EXECUTION
Switch: NEED_CLARIFICATION jika original copy ambigu intent

## Tools Required

- file-search (Editorial Rules)
- artifacts (diff render)

## Validation Criteria

- Setiap change ada reasoning
- 7 editorial rules all enforced
- No new violation introduced
- Word count balance (tidak inflate jadi 2x lipat)
- Persona resonance preserved atau improved

## Sample I/O

**Input:** "Refresh copy ini: 'GSP — rumah pintu impian Anda. Mewah, eksklusif, prestisius.'"

**Output summary:**
- 4 issues identified
- Edited: "Gerai 1000 Pintu, tempat pintu impian Anda berkarakter. Premium, terkurasi, bermakna."
- Diff: em-dash removed, "GSP" → lengkap, "rumah" → "tempat", "mewah eksklusif prestisius" (mewah dingin) → "premium terkurasi bermakna" (premium hangat)
- Brand canon check: all ✅

## Handoff

- copywriting (kalau perlu rewrite total bukan edit)
- brand-voice-variants (kalau perlu tone variants)
- Editorial Reviewer agent (final QC otomatis)

# CMO Gerai — Skill Catalog

**Owner:** CMO Gerai agent (LibreChat + PWA Gerai)
**Last updated:** 2026-05-27
**Total skill:** 31 core
**Format:** 1 markdown file per skill, YAML frontmatter, Markdown body

## Cara pakai catalog ini

1. **CMO agent baca dulu `product-marketing.md`** sebagai foundational sebelum invoke skill lain
2. **Saat user trigger phrase match**, CMO invoke skill yang sesuai
3. **Visual-summary skill** dipanggil otomatis (atau standalone) untuk render hasil ke format visual

## Struktur per skill file

```yaml
---
name: skill-name
slug: cmo.skill-name
group: [strategy-planning | persona-customer | content-copy | distribution-channels | seo-discovery | conversion-growth | visual-reporting]
status: active | optional | deprecated
priority: foundational | critical | high | medium | low
last_updated: YYYY-MM-DD
---
```

Plus sections wajib:
- Description
- Triggers (primary + secondary phrases)
- Input Required (table fields)
- Output Template (markdown structured)
- Visual Output (Mermaid/ASCII spec)
- Knowledge Dependency
- Mode (EXECUTION/DISCUSSION/NEED_CLARIFICATION)
- Tools Required
- Validation Criteria
- Sample I/O
- Handoff (agent atau skill lain)

## Skill Index (31 core)

### 🎯 Group 1: Strategy & Planning (5)
1. [product-marketing.md](./product-marketing.md) — **Foundational**, baca dulu setiap turn
2. [campaign-brief.md](./campaign-brief.md)
3. [positioning-map.md](./positioning-map.md)
4. [competitor-profiling.md](./competitor-profiling.md)
5. [marketing-ideas.md](./marketing-ideas.md)

### 👥 Group 2: Persona & Customer (4)
6. [persona-deep-dive.md](./persona-deep-dive.md)
7. [customer-research.md](./customer-research.md)
8. [marketing-psychology.md](./marketing-psychology.md)
9. [onboarding.md](./onboarding.md)

### ✍️ Group 3: Content & Copy (5)
10. [copywriting.md](./copywriting.md)
11. [copy-editing.md](./copy-editing.md)
12. [brand-voice-variants.md](./brand-voice-variants.md)
13. [content-calendar.md](./content-calendar.md)
14. [content-strategy.md](./content-strategy.md)

### 📡 Group 4: Distribution & Channels (7)
15. [channel-mix-calc.md](./channel-mix-calc.md)
16. [ads.md](./ads.md)
17. [ad-creative.md](./ad-creative.md)
18. [influencer-brief.md](./influencer-brief.md)
19. [co-marketing.md](./co-marketing.md)
20. [emails.md](./emails.md)
21. [social.md](./social.md)

### 🔍 Group 5: SEO & Discovery (3)
22. [seo-audit.md](./seo-audit.md)
23. [ai-seo.md](./ai-seo.md) — **Critical** karena entry stage Customer Journey
24. [schema.md](./schema.md)

### 💹 Group 6: Conversion & Growth (5)
25. [funnel-audit.md](./funnel-audit.md)
26. [cro.md](./cro.md)
27. [ab-test-design.md](./ab-test-design.md)
28. [lead-magnets.md](./lead-magnets.md)
29. [referral-program.md](./referral-program.md)

### 📊 Group 7: Visual & Reporting (2)
30. [visual-summary.md](./visual-summary.md) — **Critical** per Matthew requirement, universal visualizer
31. [weekly-report.md](./weekly-report.md)

## Brand Canon (enforced di semua skill)

Setiap skill output WAJIB compliance:
- ❌ No em-dash (pakai koma atau titik)
- ✅ "tempat" bukan "rumah"
- ✅ "Gerai 1000 Pintu" lengkap (no "GSP" atau "1000 Pintu" saja)
- ✅ Tone calm refined premium tetapi inklusif (anchor BP Latest reference)
- ✅ "reward" dalam tanda kutip
- ✅ Audience-first framing
- ✅ Konkret > abstrak
- ❌ "Luxurious mewah" framing (Gerai = premium hangat)

## Knowledge Dependencies (centralized)

Semua skill baca dari:
- **Brand Canon** (positioning, tone library 5, palette "The Timeless Foundation")
- **6 Persona spec** (Retail/Mitra Dagang/Developer/Arsitek/Kontraktor/Aplikator)
- **4 Marketing Plan ABCD** (Hyperlocal/Education-Led/Influencer/Performance)
- **Editorial Rules** (7 rules)
- **BP Chapter Map**
- **Tagline Pool** ("A Thousand Doors, A Thousand Dreams" locked)
- **Cost of Delay data** (Rp 39-46jt/minggu)
- **Unit Economics Q4 2026** (AOV Rp 4.5jt, GM 38%, dst)

## Pattern Calling Skill (di CMO Agent System Prompt)

```
ANALYZE user input → identify trigger phrase → invoke skill yang match.

IF user prompt match multiple skills:
- Invoke parent skill (e.g., campaign-brief)
- Auto-handoff ke sub-skill (e.g., channel-mix-calc, content-calendar)

IF user prompt ambigu:
- Mode NEED_CLARIFICATION
- Tanya 2-3 question konkret

IF output butuh visual:
- Auto-invoke visual-summary skill as post-processor
- Atau embed Mermaid/ASCII di output skill itu sendiri

DEFAULT untuk semua output:
- Brand canon compliance
- Visual output kalau possible (per Matthew requirement)
- Validation criteria pass sebelum return
```

## Cara Update Catalog

1. **Add skill baru:** create file `cmo.{slug}.md` dengan template di atas, update README index
2. **Edit skill existing:** edit file langsung, bump `last_updated` di frontmatter
3. **Deprecate skill:** ubah status `deprecated`, hindari delete (keep history)
4. **Group restructure:** edit README + setiap file dalam group

## Cara Implement ke LibreChat CMO Agent

**Option A: Embed full content ke system prompt**
- Concat semua 31 skill jadi 1 long prompt
- Cocok kalau LibreChat support 100K+ context
- Trade-off: token cost tinggi per turn

**Option B: Upload sebagai File Context**
- Upload 31 file .md ke CMO Agent File Context di LibreChat
- Agent retrieve relevant skill via RAG
- Trade-off: butuh File Search tool, semantic matching

**Option C: Hybrid**
- Embed system prompt ringkas + index 31 skill
- File Context untuk detail saat dibutuhkan
- Recommended untuk balance cost + capability

## Cross-reference

- C-Level lain skill catalog: `librechat-deploy/skills/{coo,cfo,cco}/` (akan menyusul)
- Atmaja CEO skill: `librechat-deploy/skills/atmaja/` (akan menyusul setelah CMO)
- Avatar masing-masing: `librechat-deploy/avatars/`

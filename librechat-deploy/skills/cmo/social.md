---
name: social
slug: cmo.social
group: distribution-channels
status: active
priority: medium
last_updated: 2026-05-27
---

# Social Media Plan & Scheduling

Generate weekly social media plan untuk IG / TikTok / Pinterest dengan post type + caption + hashtag + best time + persona.

## Triggers

Primary:
- "social plan"
- "IG scheduling"
- "TikTok content week"

Secondary:
- "post schedule"
- "social media calendar"

## Input Required

| Field | Type | Required | Default |
|---|---|---|---|
| channel | enum | yes | (IG/TikTok/Pinterest/multi) |
| week_period | string | yes | (e.g., "Week 1 Oktober") |
| persona_target | array | no | all 6 |
| posts_per_week | number | no | 7 |

## Output Template

```markdown
# Social Media Plan: {CHANNEL} — {WEEK}

**Persona priority:** {persona}
**Theme this week:** {theme}

## Weekly Schedule

| Day | Time | Type | Theme angle | Caption preview | Hashtag set | Persona angle |
|---|---|---|---|---|---|---|
| Senin | 09:00 | IG Feed photo | "Filosofi Jepang" | "Setiap pintu, setiap tatami..." | #Gerai1000Pintu #DuniaPintu #FilosofiJepang | Arsitek |
| Selasa | 12:00 | IG Reel 15s | Door fitting | "Lihat detail brass..." | #Gerai1000Pintu #PintuPremium | Aplikator |
| Rabu | 18:00 | IG Story | Behind scene | "Door Expert siap konsultasi" | story tag | All persona |
| Kamis | 09:00 | IG Carousel | "4-Dunia eksplorasi" | "Eropa: karya seni..." | #Gerai1000Pintu #DuniaPintu | Retail, Arsitek |
| Jumat | 17:00 | IG Live | Q&A Door Expert | (live) | #LiveKonsultasi | All |
| Sabtu | 10:00 | IG Feed photo | Project showcase | "Project minggu ini..." | #Gerai1000Pintu | Retail |
| Minggu | 11:00 | IG Story | Curated weekly | (story photo collection) | story tag | All |

## Hashtag Strategy
**Always:** #Gerai1000Pintu (brand) + #DuniaPintu (category)
**Theme:** #FilosofiJepang #FilosofiEropa #DoorExpert (rotate per week)
**Geo:** #Balikpapan #Kaltim #InteriorKaltim
**Persona:** #ArsitekKaltim #ApplikatorIndonesia #RetailPremium
**Total per post:** 8-12 hashtag (mix tier reach)

## Best Time Window per Channel
| Channel | Day | Time WITA | Reasoning |
|---|---|---|---|
| IG Feed | Mon-Fri | 09:00, 12:00, 18:00 | Office break + commute |
| IG Reel | Wed-Sat | 12:00, 19:00 | Lunch + leisure |
| IG Story | Daily | 09:00, 18:00 | Bookend day |
| IG Live | Fri-Sat | 17:00-19:00 | Weekend warm-up |
| TikTok | Tue-Thu, Sat | 19:00-22:00 | Peak Indonesia |
| Pinterest | Sun, Wed | 10:00, 21:00 | Inspiration browsing |

## Content Mix Ratio
- Education (Pillar 1): 40%
- Inspiration (Pillar 2): 30%
- Community (Pillar 3): 20%
- Commerce (Pillar 4): 10%

## KPI Target Week
| Metric | Target |
|---|---|
| Reach | {N} |
| Engagement rate | {%} |
| Save/share | {N} |
| Profile visit | {N} |
| DM inquiry | {N} |
```

## Visual Output

Weekly grid visual:

```markdown
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Senin│ Sel  │ Rab  │ Kamis│ Jum  │ Sab  │ Min  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ 09   │      │      │ 09   │      │ 10   │      │
│ Feed │      │      │Carou │      │ Feed │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│      │ 12   │      │      │      │      │ 11   │
│      │ Reel │      │      │      │      │Story │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│      │      │ 18   │      │ 17   │      │      │
│      │      │Story │      │ Live │      │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

## Knowledge Dependency

- content-calendar skill (parent)
- Brand Canon
- 6 Persona spec
- Editorial Rules

## Mode

Default: EXECUTION
Switch: DISCUSSION jika best time conflict dengan persona behavior

## Tools Required

- file-search
- web-search (terkini best time Indonesia 2026)
- artifacts (calendar grid)

## Validation Criteria

- 5-10 post per minggu per channel (bukan 30+ spam)
- Time slot konsisten (audience trained)
- Hashtag mix tier (3 high + 3 medium + 3 long-tail)
- Content mix balance 4 pillar
- Persona coverage week (rotate)
- Brand canon compliance

## Sample I/O

**Input:** "Social plan IG untuk Week 1 Oktober 2026 launch wave 1"

**Output summary:**
- 7 post Week 1, theme "Filosofi Jepang"
- Mix: 3 Feed photo, 2 Reel, 1 Story, 1 Live
- Persona rotation: Arsitek (Mon), Aplikator (Tue), All (Wed), Retail+Arsitek (Thu, Sat), All (Fri Live + Sun Story)
- Hashtag set rotated per post
- KPI: 50K reach, 4% engagement, 50 DM inquiry
- Weekly grid embedded

## Handoff

- copywriting (per caption)
- ad-creative (kalau ada paid boost)
- content-calendar (sync ke master calendar)

# Agents — AI Department Gerai 1000 Pintu

Asset definition untuk 5 C-Suite agent + 12 specialist (future). Portable, version-controlled, framework-agnostic.

## Filosofi 4-Dunia

Setiap C-Suite mewakili 1 pillar filosofi Gerai 1000 Pintu:

| Agent | Role | Dunia | Karakter |
|---|---|---|---|
| **Atmaja** | CEO Orchestrator | Jiwa (semua dunia) | Sintesis, decision, calm refined |
| **Wira** | COO Operations | Jepang | Disiplin material, bersih, SOP |
| **Citra** | CMO Marketing | Eropa | Pintu sebagai karya seni, narasi |
| **Aksa** | CFO Finance | Amerika | Pragmatic, scenario, numbers-first |
| **Lestari** | CCO Creative | China | Permanence, ritus, lasting legacy |

## Struktur

```
agents/
├── README.md                          (file ini)
├── shared/
│   ├── gerai-brand-canon.yaml         (Always-on canon untuk SEMUA agent)
│   └── gerai-memory-context.yaml      (Memory section mapping per role)
├── atmaja-ceo.yaml                    (CEO orchestrator, Opus 4.7)
├── wira-coo.yaml                      (Operations, Sonnet 4.6)
├── citra-cmo.yaml                     (Marketing, Sonnet 4.6)
├── aksa-cfo.yaml                      (Finance, Sonnet 4.6)
└── lestari-cco.yaml                   (Creative, Sonnet 4.6)
```

## Cara baca file YAML

Setiap file punya struktur:

- `identity` — name, title, role, filosofi dunia
- `model` — tier (content/orchestration), primary model, fallback
- `background` — 1-2 paragraf backstory (siapa, pengalaman, spesialisasi)
- `voice_signature` — 5 bullet karakteristik tone bicara
- `quirks` — 5-6 bullet kebiasaan unique
- `memory_sections` — section memory file yang relevant
- `skills_attached` — file YAML pendukung
- `output_template` — struktur reply standar
- `example_invocation` — sample prompt + response pattern
- `implementation_notes` — current endpoint mapping
- `future_export` — config untuk LibreChat / OpenWebUI / platform lain

## Cara update

1. Edit file YAML langsung di repo
2. Commit dengan pesan "agents: update [role] [aspect]"
3. Push → Vercel auto-deploy (kalau ada code yang baca YAML ini)
4. Untuk LibreChat future: jalankan script import YAML → Agent + Skill

## Mapping ke sistem existing

Saat ini system prompt agent di-hardcoded di:
- Atmaja CEO: `api/atmaja/chat.js` `buildSystemPrompt()`
- 4 C-Suite + 12 specialists: `api/agent/reply.js` `ROLE_DEFINITIONS`

File YAML ini = **single source of truth** untuk persona. Kalau migrate ke LibreChat, tinggal generate Agent + SKILL.md dari file ini. Kalau tetap di Atmaja current, bisa update `ROLE_DEFINITIONS` dari YAML.

## Status

| File | Status |
|---|---|
| shared/gerai-brand-canon.yaml | ✅ Locked v1.0 |
| shared/gerai-memory-context.yaml | ✅ Locked v1.0 |
| atmaja-ceo.yaml | ✅ Draft v1.0 |
| wira-coo.yaml | ✅ Draft v1.0 |
| citra-cmo.yaml | ✅ Draft v1.0 |
| aksa-cfo.yaml | ✅ Draft v1.0 |
| lestari-cco.yaml | ✅ Draft v1.0 |

## Next steps

1. Matthew review 5 YAML files
2. Adjust persona (background, voice, quirks) kalau ada yang tidak resonate
3. Lock v1.0 setelah Matthew approve
4. (Optional) Sync ke `api/agent/reply.js` ROLE_DEFINITIONS untuk inject persona ke production
5. (Future) Generate LibreChat Agent + SKILL.md dari YAML saat migration

## Future specialists (belum ada YAML)

12 specialist roles yang ada di `api/agent/reply.js` ROLE_DEFINITIONS tapi belum punya YAML formal:
- curator
- web_researcher
- brand_strategist
- editorial
- document_writer
- innovation_scout
- business_designer
- production_manager
- financial_analyst
- market_researcher
- sales_strategist
- hr_systems

Specialists default = generic role, dipanggil ad-hoc. Tidak urgent kasih persona personal (bukan team member fixed seperti C-Suite). Kalau frequency dipakai naik, baru kasih persona.

// Export 17 persona AI Department dari api/_agents.js ke format
// yang gampang diimpor jadi "Model" di Open WebUI.
// Jalankan: node deploy/export-personas.mjs
import { AGENTS, buildSystemPromptFromAgent } from '../api/_agents.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const personas = Object.values(AGENTS).map((a) => ({
  id: `gerai-${a.role}`,
  name: `${a.display_name} · ${a.title}`,
  base_model: a.model, // model OpenRouter (Opus / Sonnet)
  max_tokens: a.max_tokens,
  parent: a.parent,
  filosofi_dunia: a.filosofi_dunia,
  system_prompt: buildSystemPromptFromAgent(a.role),
}))

const out = {
  generated_for: 'Open WebUI - Gerai 1000 Pintu AI Department',
  count: personas.length,
  how_to_import:
    'Di Open WebUI: Workspace > Models > buat Model baru per entry. base_model = model OpenRouter, isi System Prompt dari system_prompt, set max_tokens. Atmaja Opus, sisanya Sonnet 4.6.',
  personas,
}

const outPath = join(here, 'gerai-personas.json')
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
console.log(`OK: ${personas.length} persona -> ${outPath}`)

// SOUL.md = identitas Atmaja (agent utama Hermes) + brand canon, buat ~/.hermes/SOUL.md
const hermesDir = join(here, 'hermes')
mkdirSync(hermesDir, { recursive: true })
const soulPath = join(hermesDir, 'SOUL.md')
writeFileSync(soulPath, buildSystemPromptFromAgent('ceo'), 'utf8')
console.log(`OK: SOUL.md (Atmaja) -> ${soulPath}`)

for (const p of personas) console.log(` - ${p.id}  [${p.base_model}]  ${p.name}`)

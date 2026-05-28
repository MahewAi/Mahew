// Generate 5 avatar untuk agent LibreChat via Gerai /api/openai/image (gpt-image-1).
// Output: librechat-deploy/avatars/{coo,cmo,cfo,cco,atmaja}.png
// Cost: ~$0.04 per image high quality = $0.20 total.

const fs = require('fs')
const path = require('path')

const TOKEN = 'decbcce50261ac5200cca67f66089074422504e204049cc52c5a0eb4243bf26c'
const URL = 'https://gerai.mahewwork.com/api/openai/image'
const DIR = __dirname

const STYLE = ' rendered in flat brass gold (#B8956B) shapes on warm ivory background (#FAF8F4) with deep charcoal (#1F1A14) accent lines. BP Latest "The Timeless Foundation" palette, refined, calm, serene, premium tetapi inklusif. Centered composition with generous negative space, flat illustration no gradient, no heavy shadow. Recognizable at small thumbnail size. Square 1024x1024.'

const PROMPTS = {
  coo: 'Editorial minimalist illustration for an agent avatar, a stylized brass clipboard icon with three small checkmark lines, simple geometric form representing operations and organization,' + STYLE,
  cmo: 'Editorial minimalist illustration for an agent avatar, a stylized brass megaphone icon with two abstract arc lines suggesting sound waves, representing outreach and marketing communication,' + STYLE,
  cfo: 'Editorial minimalist illustration for an agent avatar, a stylized brass vintage abacus icon on top of a small ledger book base, representing finance and precise calculation,' + STYLE,
  cco: 'Editorial minimalist illustration for an agent avatar, a stylized brass paintbrush icon with three small color dot swatches arranged like a palette, representing creative direction and brand visual,' + STYLE,
  atmaja: 'Editorial minimalist illustration for an agent avatar, a stylized brass master key icon with an elegant ornamental bow at the top and a small crown silhouette, representing executive leadership and orchestration over multiple doors,' + STYLE,
}

;(async () => {
  console.log('Generating 5 avatar via Gerai /api/openai/image (gpt-image-1, high quality)\n')
  for (const [role, prompt] of Object.entries(PROMPTS)) {
    process.stdout.write(`[${role}] generating... `)
    const start = Date.now()
    try {
      const resp = await fetch(URL, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'gpt-image-1',
          size: '1024x1024',
          quality: 'high',
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        console.log(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
        continue
      }
      const json = await resp.json()
      // Gerai endpoint return adapted shape, try common paths
      const b64 = json?.image?.b64_json
        ?? json?.data?.[0]?.b64_json
        ?? json?.b64_json
        ?? null
      if (!b64) {
        console.log(`NO b64_json. Response keys: ${Object.keys(json).join(',')}`)
        fs.writeFileSync(path.join(DIR, `${role}-debug.json`), JSON.stringify(json, null, 2))
        continue
      }
      const outPath = path.join(DIR, `${role}.png`)
      fs.writeFileSync(outPath, Buffer.from(b64, 'base64'))
      const sec = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`SAVED ${Math.round(b64.length / 1024)}KB b64 → ${role}.png (${sec}s)`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }
  }
  console.log('\nDone. Check librechat-deploy/avatars/ folder.')
})()

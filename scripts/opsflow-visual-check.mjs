/**
 * OpsFlow — Pemeriksaan visual.
 *
 * Jalankan:
 *   npm run build && npm run preview   (di terminal lain)
 *   npm run opsflow:visual
 *
 * Ini bukan tambahan pelengkap. Tiga bug nyata di dashboard ini lolos dari
 * typecheck DAN dari build, dan hanya ketemu setelah halamannya benar-benar
 * dirender lalu dilihat:
 *
 *   1. Seluruh kartu di bawah hero tidak terlihat, karena rantai propagasi varian
 *      animasi terputus oleh satu komponen di tengah yang memakai `animate`
 *      bernilai objek.
 *   2. Batang bertumpuk menumpuk di satu sisi, karena lebar persentase dipasang
 *      pada anak di dalam pembungkus tooltip, bukan pada anak flex langsung.
 *   3. Label sektor di peta menimpa stasiun, karena tata letak berkelok membuat
 *      titik awal satu baris berimpit dengan titik akhir baris sebelumnya.
 *
 * Ketiganya adalah kegagalan tata letak dan visibilitas — jenis yang tidak bisa
 * ditangkap pemeriksa tipe. Skrip ini memeriksanya secara terukur:
 * overflow horizontal, jumlah kartu yang benar-benar terlihat, dan label peta
 * yang saling menimpa.
 */

import { chromium } from 'playwright-core'

const BASE = process.env.OPSFLOW_BASE ?? 'http://127.0.0.1:4173'
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const OUT = process.env.OPSFLOW_SHOTS ?? './opsflow-shots'

const TARGETS = [
  { name: 'overview-desktop', url: '/opsflow', width: 1280, height: 900 },
  { name: 'overview-mobile', url: '/opsflow', width: 375, height: 812 },
  { name: 'sector-desktop', url: '/opsflow/sektor/FIN', width: 1280, height: 900 },
  { name: 'sector-mobile', url: '/opsflow/sektor/FIN', width: 375, height: 812 },
  { name: 'stage-desktop', url: '/opsflow/stage/FIN-40', width: 1280, height: 900 },
  { name: 'stage-mobile', url: '/opsflow/stage/FIN-40', width: 375, height: 812 },
]

let failures = 0

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

for (const target of TARGETS) {
  const page = await browser.newPage({ viewport: { width: target.width, height: target.height } })
  await page.goto(BASE + target.url, { waitUntil: 'networkidle' })
  // Tunggu animasi kemunculan selesai supaya yang diukur keadaan akhirnya.
  await page.waitForTimeout(2200)

  const report = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth
    const viewWidth = document.documentElement.clientWidth

    const offenders = []
    if (docWidth > viewWidth + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.right > viewWidth + 1) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} r=${Math.round(r.right)}`)
        }
      }
    }

    const cards = [...document.querySelectorAll('.opsflow-enter')]
    const hiddenCards = cards.filter((el) => Number(getComputedStyle(el).opacity) < 0.9).length

    // Label stasiun peta tidak boleh saling menimpa.
    const nodes = [...document.querySelectorAll('.opsflow-node')]
    const boxes = nodes.map((n) => (n.querySelector('span.pointer-events-none') ?? n).getBoundingClientRect())
    let labelOverlaps = 0
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const ox = Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left)
        const oy = Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top)
        if (ox > 6 && oy > 6) labelOverlaps += 1
      }
    }

    return {
      docWidth,
      viewWidth,
      offenders: offenders.slice(0, 6),
      cardCount: cards.length,
      hiddenCards,
      stationCount: nodes.length,
      labelOverlaps,
    }
  })

  const problems = []
  if (report.docWidth > report.viewWidth + 1) {
    problems.push(`overflow horizontal ${report.docWidth}px > ${report.viewWidth}px: ${report.offenders.join(' | ')}`)
  }
  if (report.hiddenCards > 0) {
    problems.push(`${report.hiddenCards}/${report.cardCount} kartu tidak terlihat setelah animasi selesai`)
  }
  if (report.labelOverlaps > 0) {
    problems.push(`${report.labelOverlaps} pasang label stasiun saling menimpa`)
  }

  console.log(`\n${target.name} (${target.width}px)`)
  console.log(`  kartu ${report.cardCount - report.hiddenCards}/${report.cardCount} terlihat · stasiun peta ${report.stationCount}`)
  if (problems.length === 0) {
    console.log('  ok')
  } else {
    failures += problems.length
    for (const p of problems) console.log(`  GAGAL ${p}`)
  }

  await page.screenshot({ path: `${OUT}/${target.name}.png`, fullPage: true })
  await page.close()
}

await browser.close()

console.log(`\n${failures === 0 ? 'LULUS' : `GAGAL: ${failures} masalah`} · tangkapan layar di ${OUT}/`)
if (failures > 0) process.exitCode = 1

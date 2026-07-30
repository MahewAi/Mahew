/**
 * Rakit demo OpsFlow jadi satu berkas HTML mandiri.
 *
 * Jalankan: `npm run opsflow:demo`
 *
 * Hasilnya `dist-demo/opsflow-demo.html` — satu berkas, nol permintaan jaringan.
 * Syarat itu bukan kemewahan: berkasnya akan dibagikan lewat link dan dibuka di
 * lingkungan yang bisa memblokir sumber eksternal, jadi CSS dan JS harus ada di
 * dalam berkasnya sendiri.
 *
 * Skrip ini MEMERIKSA hasilnya, bukan cuma menggabungkan. Versi pertamanya
 * menebak lokasi aset (`assets/demo.js`) padahal Vite menaruhnya di akar keluaran,
 * lalu diam saja saat berkasnya tidak ada — hasilnya HTML 1 KB yang masih merujuk
 * berkas luar dan tampak "berhasil". Sekarang lokasi aset dibaca dari tag-nya
 * sendiri, dan setiap kegagalan menghentikan proses.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve('dist-demo')
const OUT = path.join(DIST, 'opsflow-demo.html')

const htmlPath = path.join(DIST, 'index.html')
if (!existsSync(htmlPath)) {
  console.error('dist-demo/index.html tidak ada. Jalankan:')
  console.error('  npx vite build --config vite.demo.config.ts')
  process.exit(1)
}

let html = readFileSync(htmlPath, 'utf8')

const fail = (message) => {
  console.error(`GAGAL: ${message}`)
  process.exit(1)
}

/** Baca berkas aset yang dirujuk sebuah tag, relatif terhadap keluaran build. */
function readAsset(ref) {
  const clean = ref.replace(/^\.?\//, '').split('?')[0]
  const full = path.join(DIST, clean)
  if (!existsSync(full)) fail(`aset yang dirujuk HTML tidak ada: ${clean}`)
  return readFileSync(full, 'utf8')
}

// ---- CSS lebih dulu, supaya tidak ada kilatan halaman tanpa gaya ----
const cssTag = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/i
const cssMatch = html.match(cssTag)
if (!cssMatch) fail('tag stylesheet tidak ditemukan di HTML hasil build')
const cssHref = cssMatch[0].match(/href=["']([^"']+)["']/)
if (!cssHref) fail('tag stylesheet tidak punya atribut href')
// Penggantinya HARUS berupa fungsi, bukan string. Isi berkas mengandung urutan
// seperti `$&` dan `$'` yang di dalam string pengganti ditafsirkan sebagai pola
// khusus — akibatnya tag aslinya ikut disisipkan ulang dan rujukan ke berkas
// luar tetap tertinggal. Bug ini sempat lolos dan hanya ketemu karena skrip ini
// memeriksa rujukan yang tertinggal.
const cssText = readAsset(cssHref[1])
html = html.replace(cssTag, () => `<style>\n${cssText}\n</style>`)

// ---- Lalu JS ----
const jsTag = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/i
const jsMatch = html.match(jsTag)
if (!jsMatch) fail('tag script dengan src tidak ditemukan di HTML hasil build')
const js = readAsset(jsMatch[1])
// `</script>` di dalam kode akan menutup tag lebih awal kalau tidak diamankan.
const jsSafe = js.replace(/<\/script>/gi, '<\\/script>')
html = html.replace(jsTag, () => `<script type="module">\n${jsSafe}\n</script>`)

// ---- Pemeriksaan: tidak boleh ada rujukan berkas lokal yang tertinggal ----
const leftovers = [...html.matchAll(/(?:src|href)=["'](?!https?:|data:|#|mailto:)([^"']+)["']/gi)].map((m) => m[1])
if (leftovers.length > 0) fail(`masih merujuk berkas luar: ${leftovers.join(', ')}`)

// ---- Pemeriksaan: penanda bahwa isinya benar-benar tertanam ----
if (!html.includes('<style>')) fail('CSS tidak tertanam')
if (!/<script type="module">[\s\S]{10000,}/.test(html)) fail('JS tidak tertanam atau terlalu pendek')

writeFileSync(OUT, html, 'utf8')

// ---- Varian fragmen, untuk dipublikasikan sebagai halaman yang dibagikan ----
//
// Sebagian penerbit halaman membungkus berkas yang diberikan ke dalam kerangka
// dokumennya sendiri, jadi berkas yang sudah lengkap dengan <!doctype>, <html>,
// dan <body> akan tersarang dan rusak. Varian ini hanya berisi isi badan
// halaman: judul, gaya, wadah mount, dan skrip.
const FRAGMENT = path.join(DIST, 'opsflow-artifact.html')
const styleBlock = (html.match(/<style>[\s\S]*?<\/style>/) ?? [''])[0]
const scriptBlock = (html.match(/<script type="module">[\s\S]*?<\/script>/) ?? [''])[0]
if (!styleBlock || !scriptBlock) fail('gagal memisahkan blok gaya/skrip untuk varian fragmen')

const fragment = [
  '<title>OpsFlow — Dashboard Alur Kerja Ekosistem</title>',
  // App ini memang hanya bermode terang, dan itu keputusan sadar. Menyatakannya
  // eksplisit mencegah chrome browser (scrollbar, kontrol form) ikut gelap dan
  // bertabrakan dengan permukaan halaman.
  '<style>:root{color-scheme:light}</style>',
  styleBlock,
  '<div id="root"></div>',
  scriptBlock,
  '',
].join('\n')
writeFileSync(FRAGMENT, fragment, 'utf8')

const sizeKb = statSync(OUT).size / 1024
const fragKb = statSync(FRAGMENT).size / 1024
console.log(`Tertulis: ${path.relative(process.cwd(), OUT)}  ${sizeKb.toFixed(0)} KB  (dokumen lengkap)`)
console.log(`Tertulis: ${path.relative(process.cwd(), FRAGMENT)}  ${fragKb.toFixed(0)} KB  (fragmen untuk dipublikasikan)`)
console.log(`  CSS tertanam · JS tertanam · nol rujukan berkas luar`)
if (sizeKb > 1024) {
  console.log('  Peringatan: di atas 1 MB — bisa gagal diunggah sebagai halaman yang dibagikan.')
}

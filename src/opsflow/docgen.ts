/**
 * OpsFlow — Pembuat dokumen peta alur.
 *
 * Menghasilkan `docs/opsflow/02-PETA-ALUR-DAN-SUBTIM.md` langsung dari
 * `taxonomy.ts`. Tujuannya supaya dokumen yang divalidasi kepala sektor tidak
 * pernah berbeda dari daftar stage yang benar-benar dipakai sistem — dokumen
 * proses yang menyimpang dari kodenya adalah sumber kebingungan klasik.
 *
 * Jalankan: `npm run opsflow:docs`
 */

import { writeFileSync } from 'node:fs'
import { SECTORS, SECTOR_ORDER, STAGES, allTeams, mainPath, mainPathSlaHours, stagesOfSector } from './taxonomy.ts'

const KIND_LABEL: Record<string, string> = {
  work: 'Kerja',
  approval: 'Persetujuan',
  inspection: 'Pemeriksaan',
  handoff: 'Serah terima',
  wait_external: 'Tunggu pihak luar',
  exception: 'Jalur tidak normal',
}

const KIND_NOTE: Record<string, string> = {
  work: 'dinilai dari waktu pengerjaan',
  approval: 'hampir selalu waktu tunggu, bukan waktu kerja',
  inspection: 'dinilai dari tingkat lolos pertama & kesalahan yang lolos',
  handoff: 'titik paling rawan kesalahan data',
  wait_external: 'SLA internal dijeda di sini',
  exception: 'tidak dihitung dalam lead time normal, tapi frekuensinya dipantau',
}

const lines: string[] = []
const w = (line = ''): void => void lines.push(line)

w('# 02 — Peta Alur & Sub-Tim')
w()
w('> **Dokumen ini yang perlu divalidasi kepala tiap sektor.**')
w('>')
w('> Susunan di bawah saya buat dari pola perusahaan manufaktur pada umumnya, **bukan dari')
w('> perusahaan Anda**. Yang perlu dikoreksi: nama sub-tim, stage yang tidak ada di')
w('> perusahaan Anda, stage yang kurang, dan angka SLA-nya.')
w('>')
w('> Dokumen ini dihasilkan otomatis dari `src/opsflow/taxonomy.ts`. Jangan diedit')
w('> langsung — ubah taksonominya lalu jalankan `npm run opsflow:docs`.')
w()

w('## Ringkasan')
w()
w('| | Jumlah |')
w('| --- | --- |')
w(`| Sektor | ${SECTOR_ORDER.length} |`)
w(`| Stage total | ${STAGES.length} |`)
w(`| Stage jalur utama (di luar jalur tidak normal) | ${mainPath().length} |`)
w(`| Sub-tim | ${allTeams().length} |`)
w(
  `| Total target SLA jalur utama | ${mainPathSlaHours()} jam kerja (~${(mainPathSlaHours() / 8).toFixed(1)} hari kerja) |`,
)
w()
w('Angka terakhir itu penting untuk dibaca bersama: **kalau setiap stage berjalan tepat')
w(`sesuai target, satu permintaan barang selesai sampai terkirim dalam ~${(mainPathSlaHours() / 8).toFixed(0)} hari kerja.**`)
w('Selisih antara angka itu dan lead time nyata di perusahaan Anda adalah ukuran kasar')
w('berapa banyak waktu yang hilang di antrean. Selisih 3–5 kali adalah hal yang biasa')
w('ditemukan sebelum pembenahan.')
w()

w('## Kenapa 4 sektor dipecah jadi 35 stage')
w()
w('Anda benar bahwa "pembelian → finance → produksi → pengiriman" tidak sesederhana itu,')
w('karena tiap sektor punya banyak sub-tim. Konsekuensinya pada dashboard:')
w()
w('| Kalau hanya 4 sektor | Kalau dipecah per sub-tim |')
w('| --- | --- |')
w('| "Macet di finance" | "Macet di persetujuan berjenjang — 8 dokumen menunggu 1 penyetuju yang sedang dinas luar" |')
w('| Kepala finance disalahkan | Masalahnya jelas: tidak ada delegasi wewenang |')
w('| Tindakan: rapat | Tindakan: tetapkan aturan delegasi otomatis |')
w()
w('Pemecahan ini juga yang membuat akuntabilitas jadi adil: setiap stage punya satu')
w('sub-tim pemilik, jadi tidak ada pekerjaan yang "milik semua orang" — yang dalam')
w('praktik berarti milik tidak seorang pun.')
w()

w('## Jalur utama end-to-end')
w()
w('```mermaid')
w('flowchart LR')
for (const sectorId of SECTOR_ORDER) {
  const sector = SECTORS[sectorId]
  const stages = stagesOfSector(sectorId, false)
  w(`    subgraph ${sectorId}["${sector.order}. ${sector.name.toUpperCase()}"]`)
  w('        direction TB')
  for (const stage of stages) {
    const label = `${stage.code}<br/>${stage.name}<br/><small>${stage.team}</small>`
    w(`        ${stage.code.replace('-', '')}["${label}"]`)
  }
  for (let i = 0; i < stages.length - 1; i += 1) {
    w(`        ${stages[i].code.replace('-', '')} --> ${stages[i + 1].code.replace('-', '')}`)
  }
  w('    end')
}
// Sambungan antar sektor pada titik nyata, bukan sekadar sektor ke sektor.
w('    PROC80 --> FIN20')
w('    PROC20 --> FIN10')
w('    FIN60 --> PRD10')
w('    PRD90 --> DEL20')
w('    DEL70 --> DEL90')
w('```')
w()
w('Perhatikan sambungan antar sektornya tidak berurutan rapi. Itu memang keadaan nyata:')
w('cek anggaran (FIN-10) terjadi di awal, jauh sebelum pembayaran (FIN-60); dan verifikasi')
w('tagihan (FIN-20) baru bisa jalan setelah barang diterima dan lolos QC (PROC-80).')
w('Sistem yang memaksa alurnya lurus akan selalu berbeda dari kenyataan, dan bedanya itu')
w('yang bikin datanya tidak dipercaya.')
w()

for (const sectorId of SECTOR_ORDER) {
  const sector = SECTORS[sectorId]
  const stages = stagesOfSector(sectorId, true)
  const teams = [...new Set(stages.map((s) => s.team))]

  w(`## ${sector.order}. ${sector.name} (\`${sectorId}\`)`)
  w()
  w(`**Mandat:** ${sector.mandate}`)
  w()
  w(`**Sub-tim yang terlibat (${teams.length}):** ${teams.join(' · ')}`)
  w()

  w('| Kode | Stage | Sub-tim | Jenis | SLA tunggu | SLA kerja | Eskalasi |')
  w('| --- | --- | --- | --- | --- | --- | --- |')
  for (const stage of stages) {
    w(
      `| \`${stage.code}\` | ${stage.name}${stage.optional ? ' *(opsional)*' : ''} | ${stage.team} | ${KIND_LABEL[stage.kind]} | ${stage.slaWaitHours} j | ${stage.slaTouchHours} j | ${stage.escalateAfterHours} j |`,
    )
  }
  w()

  for (const stage of stages) {
    w(`### \`${stage.code}\` ${stage.name}`)
    w()
    w(`- **Sub-tim pemilik:** ${stage.team}`)
    w(`- **Jenis:** ${KIND_LABEL[stage.kind]} — ${KIND_NOTE[stage.kind]}`)
    w(`- **Masuk:** ${stage.input}`)
    w(`- **Keluar:** ${stage.output}`)
    if (stage.gate) w(`- **Gerbang:** ${stage.gate}`)
    w(
      `- **Target:** maksimum ${stage.slaWaitHours} jam kerja mengantre + ${stage.slaTouchHours} jam kerja dikerjakan; eskalasi setelah ${stage.escalateAfterHours} jam kerja`,
    )
    if (stage.typicallyEscapesTo && stage.typicallyEscapesTo.length > 0) {
      w(`- **Kesalahan di sini biasanya baru ketahuan di:** ${stage.typicallyEscapesTo.map((c) => `\`${c}\``).join(', ')}`)
    }
    w()
    w('Kesalahan yang paling sering terjadi di stage ini:')
    w()
    for (const failure of stage.commonFailures) w(`- ${failure}`)
    w()
  }
}

w('## Cara memvalidasi dokumen ini')
w()
w('Untuk setiap sektor, duduk bersama kepala sektornya dan jawab lima pertanyaan:')
w()
w('1. **Ada stage yang tidak ada di perusahaan kita?** Tandai untuk dihapus.')
w('2. **Ada langkah yang kita lakukan tapi tidak tertulis di sini?** Tambahkan, sebutkan sub-tim pemiliknya.')
w('3. **Nama sub-timnya sudah benar?** Pakai nama yang dipakai orang sehari-hari, bukan nama struktur organisasi resmi.')
w('4. **Siapa PIC-nya, dan siapa penggantinya saat dia tidak ada?** Yang kedua ini biasanya belum pernah ditetapkan — dan itu penyebab macet approval nomor satu.')
w('5. **Angka SLA-nya realistis?** Kalau ragu, kosongkan saja. Setelah 3 bulan data masuk, angka SLA akan diturunkan dari data historis dan itu jauh lebih tepat daripada menebak sekarang.')
w()
w('Yang paling berharga dari sesi ini bukan koreksi tabelnya, tapi jawaban atas pertanyaan')
w('terakhir ke tiap kepala sektor: **"tiga hal apa yang paling sering membuat pekerjaan')
w('Anda tertahan?"** Jawabannya dipakai untuk mengalibrasi daftar kesalahan di atas.')
w()

writeFileSync('docs/opsflow/02-PETA-ALUR-DAN-SUBTIM.md', `${lines.join('\n')}\n`, 'utf8')
console.log(`Tertulis: docs/opsflow/02-PETA-ALUR-DAN-SUBTIM.md (${lines.length} baris)`)

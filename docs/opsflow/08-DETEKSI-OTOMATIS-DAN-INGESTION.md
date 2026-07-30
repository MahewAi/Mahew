# 08 — Deteksi Kesalahan Otomatis & Adapter Ingestion

Dua bagian yang menutup celah paling serius di seluruh sistem ini.

## Bagian 1 — Deteksi kesalahan otomatis

### Masalah yang dipecahkan

Kalau pencatatan kesalahan bergantung pada laporan sendiri, orang tidak akan
melaporkan kesalahannya — apalagi kalau tahu datanya dipakai menilai kinerja.
Maka data kesalahannya mati dalam beberapa minggu, dan dashboard-nya jadi hiasan.

Tujuh aturan di `src/opsflow/rules.ts` menemukan kesalahan dari **jejak yang
sudah ada**, tanpa seorang pun perlu melapor.

### Tujuh aturan

| Kode | Yang dicari | Kepastian | Kenapa penting |
| --- | --- | --- | --- |
| `R1-wewenang` | Disetujui oleh orang yang level wewenangnya di bawah batas nilai, atau butuh dua penyetuju tapi hanya satu | Pasti dari data | Celah kontrol paling mahal, dan bisa dipastikan cuma dari matriks wewenang + event persetujuan |
| `R2-invoice-dobel` | Dua tagihan vendor sama, nilai sama, dalam 14 hari | Perlu diperiksa | Pembayaran dobel jarang ketahuan sampai rekonsiliasi — saat itu uangnya sudah keluar |
| `R3-gerbang-dilewati` | Pekerjaan sudah lanjut padahal stage pemeriksaan sebelumnya tidak pernah dilalui | Pasti dari data | Bentuk konkret "SOP dilewati": barang dipakai sebelum QC keluar |
| `R4-catat-terlambat` | Selisih waktu kejadian dan waktu pencatatan lebih dari 24 jam | Pasti dari data | Selama belum tercatat, stage berikutnya tidak tahu ada pekerjaan menunggu |
| `R5-approval-menggantung` | Mengantre di stage persetujuan melewati batas eskalasi, tanpa alasan tertahan pihak luar | Pasti dari data | Penyebab macet nomor satu, hampir selalu karena tidak ada delegasi |
| `R6-ubah-setelah-disetujui` | Nilai/jumlah/tanggal diubah setelah dokumen disetujui | Pasti dari data | Persetujuan jadi tidak bermakna kalau isinya masih bisa berubah sesudahnya |
| `R7-kerja-tanpa-serah-terima` | Ada catatan selesai, tidak ada catatan siapa yang mulai | Pasti dari data | Tanpa catatan mulai, waktu tunggu tidak bisa dipisahkan dari waktu kerja |

Pada dataset simulasi, ketujuhnya menemukan **354 temuan** — dibanding 120
insiden yang "dilaporkan". Selisih sebesar itu adalah gambaran yang wajar untuk
bulan-bulan awal, dan justru lebih jujur.

### Keputusan yang perlu dipegang: mesin tidak menuduh

Semua temuan otomatis keluar dengan `attribution: 'unknown'` dan `status: 'open'`.

**Mesin bisa memastikan bahwa sesuatu terjadi; ia tidak bisa memastikan
mengapa.** Persetujuan di luar wewenang bisa berarti orangnya melanggar, bisa
berarti sistemnya mengizinkan, bisa berarti penyetuju yang benar sedang cuti dan
tidak ada delegasi. Ketiganya butuh tindakan yang berbeda.

Membiarkan mesin menuduh individu adalah cara tercepat membuat seluruh sistem
ditolak — dan sering kali salah. Penetapan atribusi tetap keputusan manusia,
setelah penelusuran.

### Setiap temuan harus bisa dibantah

Setiap temuan membawa `ruleId` dan `evidence` — nomor dokumen, nilai, timestamp,
aturan wewenang yang dilanggar. Contoh:

```
R1-wewenang · INV-V-2026-7042 · nilai Rp 84.300.000 · aturan AR-2
             · penyetuju Accounts Payable 2 (level 1), dibutuhkan level 5
```

Temuan yang tidak bisa diperiksa ulang tidak akan dipercaya siapa pun, dan
seharusnya begitu.

### Pemotongan tidak disembunyikan

Aturan kebersihan data seperti `R4` bisa memicu ratusan temuan di bulan-bulan
awal. Daftar dibatasi 150 per aturan supaya temuan yang benar-benar mahal tidak
tenggelam — tapi **jumlah yang dipotong ikut dilaporkan** di layar dan di
`DetectionSummary.truncated`. Daftar yang dipotong tanpa keterangan akan terbaca
sebagai "hanya sebanyak ini yang terjadi".

### Menyetel ambang

```ts
detectIncidents(dataset, visits, {
  recordingLagHours: 24,     // ambang R4
  duplicateWindowDays: 14,   // jendela R2
  maxPerRule: 150,
})
```

Setelah 2–3 bulan data nyata masuk, `recordingLagHours` sebaiknya diturunkan
bertahap — mulai dari angka yang hanya melanggar sekitar 10% pencatatan, supaya
targetnya dianggap serius, bukan langsung diabaikan.

---

## Bagian 2 — Adapter ingestion

`src/opsflow/ingest.ts` mengubah ekspor riwayat status jadi `OpsDataset` yang
langsung bisa dipakai mesin metrik.

### Yang perlu Anda siapkan

Satu file CSV berbentuk
[`templates/B-transaksi-historis.csv`](./templates/B-transaksi-historis.csv).
Kolom wajib: `jenis_dokumen`, `nomor_dokumen`, `status_ke`, `waktu_perubahan`.

Satu baris = satu perpindahan status. Bukan satu baris per dokumen — **satu baris
per perubahan status**, karena itulah yang memungkinkan waktu tunggu dihitung.

### Yang harus diedit bersama tim IT: pemetaan status

Nama status berbeda di tiap perusahaan: "Approved", "Disetujui", "APPROVE_2".
`DEFAULT_STATUS_MAP` di `ingest.ts` hanya titik awal.

```ts
{ docType: 'INV', statusTo: 'Disetujui', stageCode: 'FIN-40', eventType: 'approved', workItemType: 'payable_invoice' }
```

Status yang belum dipetakan **tidak dibuang diam-diam** — ia masuk daftar
penolakan dan diringkas di `unmappedStatuses`, jadi pemetaannya bisa dilengkapi
berdasarkan kenyataan, bukan dugaan. Ini cara kerja yang disarankan: jalankan
sekali, lihat daftar status yang belum dikenali, petakan, ulangi.

### Tiga jaminan lapisan ini

**Idempotensi.** Kunci objek kerja = `sourceSystem` + `externalId`; event punya
sidik jari deterministik. Ekspor yang diimpor dua kali tidak menambah data. Tanpa
ini, throughput naik palsu setiap kali sinkronisasi diulang setelah gangguan
jaringan — dan tidak ada yang menyadarinya.

**Penolakan yang tercatat.** Setiap baris yang gagal punya alasan yang bisa
dibaca:

```
tolak GRN-2026-2201: waktu_perubahan tidak bisa dibaca: "bukan-tanggal"
tolak (kosong):      nomor_dokumen kosong
tolak GRN-2026-2202: nomor_dokumen_sebelumnya menunjuk dokumen yang tidak ada
                     di ekspor ini: PO-9999-9999
```

Tanpa daftar ini, dashboard akan menampilkan "stage ini aman" padahal artinya
"data stage ini tidak masuk" — kebohongan yang meyakinkan, dan jenis kegagalan
paling berbahaya di sistem seperti ini.

**Kolom salah gagal di depan.** Ekspor yang judul kolomnya tidak sesuai
dihentikan dengan satu pesan yang jelas, bukan menghasilkan ribuan penolakan
identik.

### Zona waktu wajib eksplisit

Kalau kolom waktu tidak menyertakan offset, `timezoneOffset` dipakai (default
`+07:00`). Menebak zona waktu adalah cara paling halus untuk menghasilkan angka
yang salah secara konsisten — jadi angkanya ditulis di konfigurasi, bukan
diasumsikan diam-diam.

### Batas yang perlu diketahui

Ekspor historis biasanya tidak menyimpan **kapan barisnya dicatat**, hanya kapan
kejadiannya. Karena itu `recordedAt` disamakan dengan `occurredAt` dan
`recordingLagHours` diisi 0. Konsekuensinya: **aturan `R4` dan metrik disiplin
pencatatan tidak bisa dihitung dari data historis** — keduanya baru hidup setelah
data mengalir dari sistem yang mencatat kedua waktu itu, atau dari aplikasi
capture 2-tap.

Ini bukan kekurangan yang disembunyikan: `assessDataQuality()` akan melaporkan
cakupan timestamp per stage, jadi terlihat di layar mana yang belum bisa dinilai.

### Contoh pemakaian

```ts
import { ingestStatusHistoryCsv } from '@/opsflow/ingest'

const { dataset, run, unmappedStatuses } = ingestStatusHistoryCsv(csvText, {
  sourceSystem: 'accurate-prod',
  timezoneOffset: '+07:00',
  base: { people, teams, approvalRules, calendars, slaTargets },  // master data dari bagian A
})

console.log(`${run.recordsWritten} event masuk, ${run.recordsRejected} ditolak`)
console.log(unmappedStatuses)  // daftar status yang perlu dipetakan
```

`base` diisi master data dari [bagian A dokumen 05](./05-DATA-YANG-DIBUTUHKAN.md).
Kalau belum ada, adapter membentuk sub-tim dan SLA minimal dari taksonomi supaya
mesin metrik tetap jalan sejak ekspor pertama — dengan `basis: 'hypothesis'`
sehingga tidak tertukar dengan angka yang sudah dikalibrasi.

**Catatan penting:** `R1-wewenang` butuh `approvalRules` **dan** `people` dengan
`authorityLevel` terisi. Tanpa keduanya aturan itu diam — bukan karena tidak ada
pelanggaran, tapi karena tidak ada acuan untuk memeriksanya.

---

## Verifikasi

```bash
npm run opsflow:check   # 76 pemeriksaan, termasuk 7 aturan + adapter ingestion
```

Pemeriksaannya memastikan hal-hal yang mudah terlewat:

- **Setiap aturan benar-benar menyala di data contoh.** Aturan yang tidak pernah
  menyala tidak terbukti bekerja — dan pada percobaan pertama, 5 dari 7 aturan
  memang tidak pernah menyala karena dataset simulasinya belum memuat polanya.
  Polanya lalu ditanam sengaja.
- **Tidak ada temuan otomatis yang menetapkan atribusi.**
- **Jumlah yang dipotong sama dengan selisih temuan dan yang ditampilkan** —
  tidak ada yang hilang tanpa terhitung.
- **Baris ekspor dobel tidak menambah event.**
- **Setiap jenis kegagalan ingestion punya alasan yang bisa dibaca.**

Satu bug model ikut ketemu dari pemeriksaan ini: event anotasi (`field_changed`,
`note`) yang terjadi setelah sebuah stage ditutup membuka "kunjungan hantu" tanpa
timestamp sama sekali, yang lalu ikut terhitung sebagai kunjungan stage dan
mengencerkan seluruh persentase. Sekarang event anotasi hanya menempel pada
kunjungan yang sedang berjalan.

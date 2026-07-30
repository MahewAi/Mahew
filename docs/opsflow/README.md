# OpsFlow — Sistem Pemantauan Alur Kerja Ekosistem Perusahaan

Pembelian → Finance → Produksi → Pengiriman, dipecah sampai tingkat sub-tim, dengan tiga
pertanyaan yang harus bisa dijawab kapan saja:

1. **Di mana macetnya sekarang?**
2. **Kenapa macet di situ** — antrean menumpuk, tidak ada yang pegang, dikerjakan lambat,
   diulang terus, atau tertahan pihak luar?
3. **Kesalahan apa yang berulang, di mana, dan apakah itu soal orang atau soal proses?**

## Status pekerjaan

| Bagian | Status |
| --- | --- |
| Taksonomi alur 4 sektor + 35 stage sub-tim | Selesai — `src/opsflow/taxonomy.ts` |
| Skema data event-sourced | Selesai — `src/opsflow/schema.ts` |
| Mesin metrik & deteksi bottleneck | Selesai, 46/46 uji lolos — `src/opsflow/metrics.ts` |
| Perhitungan jam kerja & kalender | Selesai — `src/opsflow/calendar.ts` |
| Dataset contoh untuk uji & demo | Selesai — `src/opsflow/example.ts` |
| Dashboard UI (4 halaman) | Selesai — buka `/opsflow` di app |
| Peta perjalanan bergaya peta permainan | Selesai — 32 stasiun ber-ikon, jalur beranimasi |
| Palet visualisasi tervalidasi | Selesai — lihat dokumen 07 |
| **Kebutuhan data dari perusahaan** | **Menunggu — lihat dokumen 05** |
| Adapter ingestion dari sistem existing | Menunggu jawaban dokumen 05 bagian C |
| Layar PIC + aplikasi capture 2-tap | Menunggu; digabung dengan Fase 2 |

Jalankan verifikasi kapan saja:

```bash
npm run opsflow:check    # 46 pemeriksaan mesin metrik
npm run typecheck        # tipe
npm run dev              # buka /opsflow di browser

# Pemeriksaan tata letak & visibilitas (butuh build + preview berjalan)
npm run build && npm run preview
npm run opsflow:visual
```

`opsflow:check` menampilkan peringkat bottleneck yang ditemukan mesin dari data simulasi,
termasuk bukti bahwa kemacetan yang sengaja ditanam di data memang terdeteksi.
`opsflow:visual` mengukur overflow horizontal, kartu yang tidak terlihat, dan label peta
yang bertabrakan di enam kombinasi halaman × lebar layar.

## Daftar dokumen

| No | Dokumen | Untuk siapa |
| --- | --- | --- |
| 01 | [Arsitektur Sistem](./01-ARSITEKTUR-SISTEM.md) | Anda + tim IT |
| 02 | [Peta Alur & Sub-Tim](./02-PETA-ALUR-DAN-SUBTIM.md) | Kepala tiap sektor — untuk divalidasi |
| 03 | [Skema Data](./03-SKEMA-DATA.md) | Tim IT / pengembang |
| 04 | [Katalog Metrik](./04-KATALOG-METRIK.md) | Anda + manajemen |
| 05 | **[Data yang Dibutuhkan](./05-DATA-YANG-DIBUTUHKAN.md)** | **Anda — ini langkah berikutnya** |
| 06 | [Roadmap Implementasi](./06-ROADMAP-IMPLEMENTASI.md) | Anda |
| 07 | [Dashboard: Keputusan Desain & Verifikasi](./07-DASHBOARD-UI.md) | Anda + tim frontend |

Template CSV siap isi ada di [`templates/`](./templates/).

## Tiga keputusan perancangan yang paling menentukan

Kalau tidak ada waktu membaca semuanya, tiga hal ini yang paling berpengaruh pada
apakah sistemnya berguna atau tidak.

### 1. Tiga timestamp per stage, bukan satu

Hampir semua sistem hanya menyimpan satu tanggal per tahap: tanggal dokumen. Dengan satu
tanggal, yang bisa dihitung cuma total durasi. Dengan tiga timestamp — **masuk antrean**,
**mulai dikerjakan**, **selesai** — muncul pembedaan yang menentukan tindakan:

```
waktu tunggu  = mulai   − masuk antrean   →  tidak ada yang pegang
waktu kerja   = selesai − mulai            →  dikerjakan, tapi lambat
```

Solusinya berlawanan. Yang pertama butuh perbaikan alur, kejelasan kepemilikan, atau
penyeimbangan beban. Yang kedua butuh pelatihan atau alat kerja. Pada data simulasi,
efisiensi alur keluar 36% — artinya 64% waktu proses adalah menunggu. Di perusahaan
besar yang belum pernah membenahi alur, angkanya biasanya 5–15%. **Di situlah ruang
perbaikan terbesar berada, jauh lebih besar daripada menuntut orang bekerja lebih cepat.**

### 2. Jam kerja, bukan jam kalender

PO terbit Jumat 16:30, diproses Senin 09:00. Jam kalender: 64,5 jam — terlihat seperti
kelalaian berat. Jam kerja: 1,5 jam — sebenarnya wajar. Menghukum orang berdasarkan
angka pertama adalah cara tercepat membuat tim berhenti mempercayai dashboard, dan
setelah itu mereka akan berhenti mencatat data dengan jujur.

Karena itu kalender kerja (jam kerja, shift, hari libur, cuti bersama) termasuk **data
wajib**, bukan pelengkap.

### 3. Kesalahan berulang oleh orang berbeda adalah masalah proses

Anda menyebut banyak terjadi kesalahan dan kelalaian SDM. Itu kemungkinan besar benar —
tapi ada risiko nyata yang perlu disebut di depan: kalau dashboard dipakai murni untuk
menghukum, orang akan berhenti mencatat kesalahan, dan datanya mati dalam beberapa
minggu. Sistem yang dirancang di sini tetap bisa menunjuk individu, tapi dengan tiga
pengaman:

- **Data diambil dari sistem, bukan laporan sendiri.** Timestamp datang dari ERP atau
  dari 2 tap di HP saat menerima/menyelesaikan pekerjaan — bukan dari form yang harus
  diisi jujur tentang kesalahan sendiri.
- **Reklasifikasi otomatis.** Jenis kesalahan yang sama, di stage yang sama, dilakukan
  3 orang berbeda dalam 30 hari → atribusi otomatis dipindah dari `person` ke `process`
  dan nama orangnya dihapus. Berapa pun orang yang diganti, kesalahan itu akan terulang;
  yang perlu diubah prosedurnya. Pada data simulasi, 120 insiden yang awalnya beratribusi
  individu tersisa 0 setelah reklasifikasi — hampir semuanya ternyata pola proses.
- **Konteks wajib menyertai angka individu.** Beban per orang, sampel minimum 15 item,
  dan peringatan pembacaan otomatis kalau sampelnya kecil atau pekerjaannya banyak
  tertahan pihak luar.

Urutan yang saya sarankan: **perbaiki proses dulu selama 2–3 bulan, tampilkan skor di
tingkat sub-tim.** Baru setelah kesalahan sistemik habis, sisa kesalahan yang tinggal
memang atribusi individu — dan pada titik itu datanya sudah kuat untuk dipakai dalam
pembicaraan kinerja.

## Yang saya butuhkan dari Anda untuk melanjutkan

Dua hal, berurutan:

1. **Validasi [dokumen 02](./02-PETA-ALUR-DAN-SUBTIM.md)** bersama kepala tiap sektor.
   35 stage di situ saya susun dari pola perusahaan manufaktur pada umumnya, bukan dari
   perusahaan Anda. Yang perlu dikoreksi: nama sub-tim, stage yang tidak ada, stage yang
   kurang, dan siapa PIC-nya.
2. **Isi [dokumen 05](./05-DATA-YANG-DIBUTUHKAN.md)**, minimal bagian "Paket Minimum".
   Satu pertanyaan di dalamnya paling menentukan: **apakah sistem existing menyimpan
   riwayat perubahan status, atau hanya status terakhir?** Kalau hanya status terakhir,
   waktu tunggu tidak bisa dihitung dari data historis, dan urutan implementasinya
   berubah.

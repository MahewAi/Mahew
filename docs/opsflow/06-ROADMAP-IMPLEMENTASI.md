# 06 — Roadmap Implementasi

Lima fase. Setiap fase menghasilkan sesuatu yang berguna sendiri, supaya kalau harus
berhenti di tengah, yang sudah dibangun tidak terbuang.

Prinsip yang saya pegang di seluruh roadmap ini: **jangan pernah bangun sistem untuk empat
sektor sekaligus.** Satu jalur dulu sampai benar-benar dipakai orang, baru diperlebar.
Sistem pemantauan yang diluncurkan serentak ke semua sektor hampir selalu berakhir sama —
datanya tidak lengkap di mana-mana, dan tidak ada satu pun bagian yang cukup baik untuk
dipercaya.

---

## Fase 0 — Pemetaan & validasi (2 minggu)

**Tidak ada kode. Ini fase yang paling sering dilewati dan paling mahal akibatnya.**

| Kegiatan | Keluaran |
| --- | --- |
| Validasi 35 stage bersama kepala tiap sektor | [Dokumen 02](./02-PETA-ALUR-DAN-SUBTIM.md) terkoreksi |
| Tetapkan sub-tim pemilik & PIC tiap stage | `A1-sub-tim.csv` terisi |
| **Tetapkan aturan delegasi wewenang** | `A3-wewenang.csv` terisi |
| Isi inventaris sistem | `C1-sistem.csv` terisi |
| Wawancara "3 hal yang paling sering bikin macet" per sektor | Kalibrasi taksonomi kesalahan |
| Tetapkan kalender kerja & hari libur | `A5-kalender.csv` terisi |

**Gerbang keluar fase ini:** setiap stage punya satu sub-tim pemilik dan satu PIC yang
tahu bahwa itu tanggung jawabnya, plus penggantinya saat tidak di tempat.

Yang paling berharga dari fase ini justru bukan dokumennya. Dalam pengalaman umum, sesi
validasi ini sendiri sudah memunculkan beberapa perbaikan yang bisa dijalankan tanpa sistem
apa pun — biasanya berupa aturan delegasi persetujuan dan penetapan pemilik pekerjaan yang
sebelumnya "milik semua orang".

---

## Fase 1 — Jalur pilot, dari data historis (3–4 minggu)

Pilih **satu** jalur. Rekomendasi: **PR → PO → GRN → Invoice → Pembayaran** untuk satu
kategori material.

Alasan memilih jalur ini lebih dulu:
- Datanya paling mungkin sudah ada di sistem (dokumen finance selalu dicatat).
- Dampaknya paling langsung terasa — pembayaran telat berujung vendor menahan kiriman,
  yang lalu menghentikan produksi.
- Melibatkan dua sektor sekaligus (Pembelian + Finance), jadi sudah menguji kemampuan
  lintas sektor tanpa harus menyentuh semuanya.

| Kegiatan | Keluaran |
| --- | --- |
| Bangun adapter untuk 1–2 sistem sumber | Data masuk ke event log |
| Impor 3–6 bulan data historis | Baseline terbentuk |
| Jalankan mesin metrik | Titik macet pertama teridentifikasi |
| Kalibrasi SLA dari persentil-50 aktual | `SlaTarget.basis` → `historical_p50` |
| Laporan kualitas data per stage | Daftar lubang pencatatan yang perlu ditutup |

**Gerbang keluar:** bisa menjawab dengan angka — "di jalur pengadaan, waktu terlama hilang
di stage X, sebanyak Y hari kerja, dengan nilai Rp Z tertahan."

Kalau jawaban `C2` di dokumen 05 adalah "sistem hanya menyimpan status terakhir", fase ini
berubah: alih-alih impor historis, langsung ke Fase 2 dan analisis mendalam mulai setelah
~6 minggu data baru terkumpul.

---

## Fase 2 — Capture live & dashboard (4–6 minggu)

| Kegiatan | Keluaran |
| --- | --- |
| Aplikasi capture 2-tap (PWA, buka di browser HP) | Timestamp `arrived` & `started` mulai masuk |
| Tempel QR di dokumen fisik jalur pilot | Tahap manual tidak lagi jadi lubang buta |
| Adapter berjalan berkala tiap 5–15 menit | Data mengalir tanpa campur tangan |
| Layar pimpinan + layar kepala sektor | Dashboard pertama yang dipakai orang |
| Snapshot dihitung berkala & di-cache | Dashboard tetap cepat saat data menumpuk |

**Aturan yang tidak boleh dikompromikan: dua tap saja.** "Saya terima" dan "saya selesai".
Setiap kolom tambahan yang harus diisi manual akan menurunkan kepatuhan pencatatan, dan
data tidak lengkap merusak seluruh perhitungan. Kalau ada yang minta menambahkan field,
jawabannya: ambil dari sistem atau dari QR, jangan minta diketik.

**Gerbang keluar:** kelengkapan timestamp di jalur pilot di atas 80%, dan kepala sektor
membuka dashboard tanpa diingatkan.

Gerbang kedua itu yang sebenarnya menentukan. Kalau dashboard hanya dibuka saat ada rapat,
berarti belum menjawab pertanyaan yang benar-benar mereka punya — dan memperlebar ke sektor
lain hanya akan memperbanyak sesuatu yang tidak dipakai.

---

## Fase 3 — Pencatatan kesalahan & akuntabilitas (4 minggu)

| Kegiatan | Keluaran |
| --- | --- |
| Form insiden ringkas: 13 jenis, pilihan cepat per stage | Kesalahan mulai terekam |
| Deteksi otomatis: pelanggaran wewenang, invoice dobel, SOP dilewati | Kesalahan yang tidak perlu dilaporkan siapa pun |
| Reklasifikasi otomatis `person` → `process` | Pola sistemik terpisah dari kelalaian individu |
| Analisis Pareto & escape rate | Daftar prioritas perbaikan proses |
| Kartu skor **sub-tim** (belum individu) | Akuntabilitas tingkat tim |

**Urutannya penting, dan ini bagian yang paling mudah salah.**

Anda menyebut banyak terjadi kesalahan dan kelalaian SDM, dan itu kemungkinan besar benar.
Tapi kalau kartu skor individu dibuka di fase ini, hasil yang paling mungkin terjadi bukan
perbaikan — melainkan orang berhenti mencatat kesalahan. Dan begitu pencatatan berhenti,
seluruh sistem kehilangan datanya sekaligus.

Tiga pengaman yang saya bangun ke dalam sistem:

1. **Kesalahan diambil dari sistem, bukan dari laporan sendiri.** Deteksi otomatis
   (pelanggaran wewenang, invoice dobel, produksi tanpa QC clearance) tidak bergantung pada
   kejujuran siapa pun.
2. **Reklasifikasi otomatis.** Jenis kesalahan sama + stage sama + 3 orang berbeda dalam
   30 hari → jadi masalah proses, nama dihapus. Pada data simulasi, dari 120 insiden yang
   awalnya beratribusi individu, **tersisa nol** setelah reklasifikasi — hampir semuanya
   ternyata pola proses. Angka ini kemungkinan tidak jauh berbeda di perusahaan Anda.
3. **Skor sub-tim dulu, individu nanti.** Beri waktu 2–3 bulan menuntaskan kesalahan
   sistemik. Sisa kesalahan yang tinggal setelah itu memang atribusi individu — dan pada
   titik itu datanya sudah kuat untuk dipakai dalam pembicaraan kinerja, bukan sekadar
   dugaan.

**Gerbang keluar:** pola kesalahan teratas teridentifikasi, dan minimal tiga di antaranya
sudah ditutup dengan perbaikan proses (bukan dengan teguran).

---

## Fase 4 — Perluasan ke seluruh ekosistem (8–12 minggu)

| Kegiatan | Keluaran |
| --- | --- |
| Tambah jalur pemenuhan: SO → Produksi → QC → Pengiriman | Peta 4 sektor lengkap |
| Tautkan order produksi ke PO material (`consumes`) | Penelusuran lintas sektor aktif |
| Layar PIC per sub-tim | Dashboard jadi alat kerja, bukan alat laporan |
| Eskalasi otomatis saat SLA terlewat | Macet ketahuan sebelum jadi masalah |
| Kartu skor individu, dengan peringatan pembacaan wajib | Akuntabilitas individu |

**Kemampuan yang baru muncul di fase ini:** menjawab "kenapa order pelanggan A telat?"
sampai ke akarnya di sektor lain. Pada uji mandiri, penelusuran satu surat jalan
menghasilkan 31 langkah yang menembus keempat sektor — dan itulah bentuk jawaban yang
selama ini tidak bisa didapat, karena setiap sektor hanya melihat bagiannya sendiri.

**Gerbang keluar:** setiap keterlambatan pengiriman bisa ditelusuri ke stage penyebabnya
dalam waktu di bawah satu menit, tanpa menelepon siapa pun.

---

## Fase 5 — Pencegahan (berkelanjutan)

Setelah data 6–12 bulan terkumpul, yang jadi mungkin:

- **Prediksi keterlambatan.** Order dengan pola awal tertentu bisa ditandai berisiko telat
  sejak hari pertama, bukan setelah lewat tanggal janji.
- **Peringkat performa vendor** berdasarkan realita, bukan janji kontrak.
- **Penyeimbangan beban** antar anggota sub-tim berdasarkan antrean nyata.
- **Simulasi.** "Kalau penyetuju di FIN-40 ditambah satu orang, lead time turun berapa?"
  Pertanyaan seperti ini bisa dijawab dengan hitungan, bukan perdebatan.
- **Deteksi anomali.** Lonjakan tidak wajar pada perubahan data setelah persetujuan, atau
  pada perubahan rekening vendor — dua pola yang layak diperiksa.

---

## Ringkasan waktu

| Fase | Durasi | Hasil yang bisa dilihat |
| --- | --- | --- |
| 0 — Pemetaan | 2 minggu | Peta proses tervalidasi + PIC jelas |
| 1 — Pilot historis | 3–4 minggu | Titik macet pertama, dengan angka |
| 2 — Live | 4–6 minggu | Dashboard yang dipakai harian |
| 3 — Kesalahan | 4 minggu | Pola kesalahan + akuntabilitas tim |
| 4 — Perluasan | 8–12 minggu | Ekosistem 4 sektor + penelusuran lintas sektor |
| 5 — Pencegahan | berkelanjutan | Prediksi & simulasi |

**Sekitar 5–7 bulan sampai ekosistem lengkap**, dengan hasil yang bisa dilihat mulai
minggu ke-6.

Yang paling menentukan bukan lama pengerjaannya, tapi Fase 0. Sistem yang dibangun di atas
peta proses yang salah akan menghasilkan angka yang tepat untuk pertanyaan yang keliru —
dan itu jenis kegagalan yang baru ketahuan setelah berbulan-bulan.

# 04 — Katalog Metrik

Setiap angka yang muncul di dashboard didefinisikan di sini, dengan rumusnya. Alasannya
praktis: dashboard yang angkanya tidak bisa dijelaskan akan membuat tim berdebat soal
angkanya, bukan soal masalahnya. Kalau ada yang bertanya "kok bisa segitu", jawabannya
harus ada di dokumen ini.

Semua satuan waktu adalah **jam kerja** menurut kalender sub-tim yang bersangkutan,
kecuali disebutkan lain.

---

## A. Metrik per stage

### Waktu tunggu (wait time)

```
waktu tunggu = started − arrived      (jam kerja, dikurangi waktu tertahan pihak luar)
```

Berapa lama pekerjaan menganggur sebelum ada yang mulai mengerjakannya. **Ini metrik yang
paling sering tidak ada di perusahaan besar dan paling sering jadi biang macet.**

### Waktu kerja (touch time)

```
waktu kerja = completed − started     (jam kerja, dikurangi waktu tertahan pihak luar)
```

Berapa lama benar-benar dikerjakan.

### Porsi waktu kerja (touch share)

```
porsi waktu kerja = Σ waktu kerja ÷ (Σ waktu tunggu + Σ waktu kerja)
```

Di bawah 20% berarti masalahnya alur, bukan kecepatan orang. Menambah orang di stage
seperti itu tidak akan memperbaiki apa pun.

### WIP dan pemecahannya

```
WIP            = jumlah item yang sekarang ada di stage ini
WIP belum      = WIP yang belum ada event 'started' sama sekali  →  antrean murni
WIP tertahan   = WIP yang sedang menunggu pihak luar
```

`WIP belum` yang tinggi adalah tanda paling jelas bahwa kepemilikan pekerjaan tidak jelas:
pekerjaan sudah sampai, tapi tidak ada yang merasa itu tugasnya.

### Hari antrean (Hukum Little)

```
throughput per hari = jumlah selesai dalam jendela ÷ jumlah hari jendela
hari antrean        = WIP ÷ throughput per hari
```

Artinya: "kalau tidak ada pekerjaan baru masuk, berapa hari untuk menghabiskan antrean
ini." Indikator macet yang paling jujur, karena tidak bisa dikaburkan oleh rata-rata.
Stage dengan 3 item tapi throughput 0,2/hari (= 15 hari antrean) lebih bermasalah daripada
stage dengan 30 item tapi throughput 15/hari (= 2 hari antrean).

### Pelanggaran SLA

```
tingkat pelanggaran tunggu = jumlah kunjungan dengan waktu tunggu > target ÷ total kunjungan
tingkat pelanggaran kerja  = jumlah kunjungan dengan waktu kerja  > target ÷ total kunjungan
```

### Tingkat rework

```
tingkat rework = item yang mengunjungi stage ini > 1 kali ÷ item unik yang lewat stage ini
```

Rework tinggi di sebuah stage berarti masalahnya ada di **stage sebelumnya**. Kapasitas di
stage ini terbuang untuk mengulang pekerjaan yang seharusnya benar dari awal.

### Umur WIP (aging)

Item terbuka dikelompokkan: `<8 jam`, `8–24 jam`, `24–72 jam`, `>72 jam`.

Kelompok `>72 jam` adalah daftar tindakan harian kepala sektor. Mesin juga mengeluarkan
5 item terbuka paling tua per stage beserta PIC-nya.

### Kesalahan per 100 item

```
kesalahan per 100 = kesalahan yang BERSUMBER di stage ini ÷ item selesai × 100
```

Perhatikan: **bersumber**, bukan **ketahuan**. Kesalahan dihitung ke stage tempat ia
terjadi, bukan tempat ia ditemukan. Kalau dibalik, QC akan terlihat sebagai departemen
paling bermasalah padahal justru satu-satunya yang bekerja.

---

## B. Skor bottleneck

Skor 0–100 per stage untuk mengurutkan prioritas. Bukan angka absolut — gunanya
membandingkan antar stage, bukan menilai stage secara mutlak.

```
skor = 100 × ( 0,30 × norm(hari antrean, batas 10)
             + 0,25 × norm(waktu tunggu p90 ÷ target tunggu, batas 4)
             + 0,20 × max(pelanggaran tunggu, pelanggaran kerja)
             + 0,15 × tingkat rework
             + 0,10 × norm(kesalahan per 100, batas 20) )

norm(x, batas) = min(1, max(0, x ÷ batas))
```

Bobot ada di `BOTTLENECK_WEIGHTS`, batas normalisasi di `BOTTLENECK_CAPS`
(`src/opsflow/metrics.ts`) — keduanya diekspor supaya bisa disetel setelah 2–3 bulan
kalibrasi. Bobot berjumlah tepat 1, dan itu diuji otomatis.

### Diagnosis pemicu utama

Skor saja tidak cukup — yang menentukan tindakan adalah **kenapa**. Mesin menyimpulkan
satu pemicu utama per stage, dengan urutan pemeriksaan berikut:

| Pemicu | Syarat | Tindakan yang tepat |
| --- | --- | --- |
| `external` | ≥50% WIP tertahan pihak luar | Perbaiki pengelolaan vendor/ekspedisi. Jangan tuntut tim internal. |
| `rework` | tingkat rework ≥25% | Perbaiki mutu di stage sebelumnya. |
| `errors` | ≥10 kesalahan per 100 item | Perbaiki kontrol dan validasi, jangan tambah orang. |
| `idle_wait` | ≥60% WIP belum tersentuh, atau porsi waktu kerja <20% | Perjelas kepemilikan pekerjaan dan aturan pengambilan antrean. |
| `slow_work` | waktu kerja p90 >1,5× target | Periksa alat kerja, kejelasan instruksi, kompleksitas kasus. |
| `queue` | sisanya | Kapasitas kurang atau prioritas tidak jelas. |

Perhatikan urutannya: `external` diperiksa **pertama**. Ini keputusan sengaja — supaya
stage yang macet karena vendor tidak pernah salah didiagnosis sebagai tim yang lambat.

### Nilai rupiah tertahan

```
nilai tertahan = Σ nilai transaksi seluruh item terbuka di stage ini
```

Angka ini yang membuat prioritas perbaikan bisa didiskusikan dengan direksi. "8 dokumen
tertahan" mudah diabaikan; "Rp 654 juta tertahan di satu meja persetujuan" tidak.

---

## C. Metrik alur end-to-end

### Lead time

```
lead time = closedAt − createdAt      (hari kalender, bukan jam kerja)
```

Kalender, bukan jam kerja — karena inilah yang dirasakan pelanggan dan peminta internal.
Dilaporkan sebagai p50 dan p90. **Gunakan p90, bukan rata-rata.** Rata-rata
menyembunyikan kasus terburuk, dan kasus terburuklah yang membuat pelanggan pergi.

### Efisiensi alur (flow efficiency)

```
efisiensi alur = median(Σ waktu kerja per item) ÷ median(Σ waktu kerja + Σ waktu tunggu)
```

**Metrik tunggal paling penting di seluruh sistem ini.** Di perusahaan besar yang belum
pernah membenahi alur, angkanya biasanya 5–15%. Artinya 85–95% waktu proses adalah
menunggu.

Konsekuensi praktisnya: kalau efisiensi alur 10%, memaksa semua orang bekerja **dua kali
lebih cepat** hanya memperbaiki lead time sekitar 5%. Sementara memotong setengah waktu
tunggu memperbaikinya 45%. Ini yang mengubah arah pembenahan dari "menuntut orang" jadi
"membenahi alur" — dan itu perubahan cara pandang yang paling berharga dari sistem ini.

### Ketepatan janji

```
ketepatan janji = item selesai dengan closedAt ≤ promisedAt ÷ item selesai yang punya promisedAt × 100%
```

Dilaporkan bersama `overdueOpen`: item yang masih terbuka dan sudah melewati tanggal janji.
Angka kedua ini yang perlu dilihat harian, karena masih bisa diselamatkan.

### Waktu tunggu per sektor

Total jam tunggu per sektor dalam jendela analisis. Menjawab langsung: dari empat sektor,
mana penyumbang waktu hilang terbesar.

---

## D. Metrik kesalahan

### Escape rate

```
escape rate = kesalahan yang stage kejadiannya ≠ stage ketahuannya ÷ total kesalahan
```

**Metrik terpenting di bagian ini.** Kesalahan yang ketahuan di tempat itu murah;
yang ketahuan di tangan pelanggan bisa 100 kali lebih mahal.

### Jarak escape

```
jarak escape = jumlah stage antara stage kejadian dan stage ketahuan (di jalur utama)
```

Rata-rata jarak escape yang besar berarti kontrol mutu di antaranya tidak bekerja. Kalau
kesalahan di PROC-10 rata-rata baru ketahuan 4 stage kemudian, berarti empat gerbang
dilewati tanpa menangkap apa pun.

### Kesalahan yang ketahuan dari pelanggan

```
jumlah kesalahan dengan detectionMethod = 'customer_complaint'
```

Angka ini idealnya nol. Setiap satu berarti seluruh rantai kontrol internal gagal untuk
kasus itu.

### Pola berulang & penandaan sistemik

Dikelompokkan per pasangan (stage, jenis kesalahan). Ditandai `systemic` kalau sudah
dilakukan **≥3 orang berbeda**. Pola sistemik adalah target perbaikan proses, bukan
target teguran.

### Pareto

10 pasangan (stage, jenis) teratas beserta porsi kumulatifnya. Biasanya 3–4 pasangan
menyumbang lebih dari separuh seluruh kesalahan. Itu daftar pekerjaan perbaikan Anda —
dan urutannya sudah benar.

### Dampak

```
total jam keterlambatan = Σ delayImpactHours
total kerugian rupiah   = Σ costImpactIdr
```

---

## E. Kartu skor sub-tim

| Metrik | Rumus |
| --- | --- |
| Item ditangani | Jumlah kunjungan stage selesai dalam jendela |
| Item per orang | Item ditangani ÷ jumlah anggota |
| Median waktu respons | median(waktu tunggu) — seberapa cepat mengambil pekerjaan |
| Median waktu kerja | median(waktu kerja) |
| Serah terima tepat waktu | kunjungan tanpa pelanggaran SLA ÷ total × 100% |
| Kesalahan bersumber | Kesalahan yang terjadi di stage milik sub-tim ini |
| Kesalahan yang lolos | Bagian dari angka di atas yang baru ketahuan di stage lain |
| Median jeda pencatatan | median(recordedAt − occurredAt) |
| Kelengkapan timestamp | kunjungan dengan `arrived` **dan** `started` ÷ total × 100% |

Dua metrik terakhir bukan penilaian kinerja operasional — itu **penilaian kualitas data**.
Sub-tim dengan kelengkapan timestamp 40% tidak bisa dinilai apa pun; yang perlu dibenahi
lebih dulu adalah pencatatannya.

**Item per orang wajib ditampilkan berdampingan** dengan metrik kecepatan. Sub-tim dengan
median waktu kerja 2× lebih lama tapi beban 3× lebih banyak bukan sub-tim yang lambat.

---

## F. Kartu skor individu

Metrik yang sama seperti sub-tim, ditambah `teamMedianTouchHours` sebagai pembanding, dan
**daftar peringatan pembacaan (`caveats`) yang dihasilkan otomatis**:

| Peringatan | Syarat |
| --- | --- |
| Sampel kecil | <15 item ditangani dalam jendela |
| Banyak tertahan pihak luar | >30% pekerjaannya sempat tertahan |
| Timestamp tidak lengkap | >30% item tidak punya `arrived` atau `started` |

**Peringatan ini harus tampil bersama angkanya di layar, tidak boleh dipisah.** Angka
individu tanpa konteks adalah cara paling cepat membuat sistem ini gagal: orang yang
merasa dinilai tidak adil akan berhenti mencatat data dengan jujur, dan setelah itu tidak
ada metrik yang bisa dipercaya lagi.

Urutan yang saya sarankan: **tampilkan skor sub-tim dulu selama 2–3 bulan.** Buka angka
individu hanya setelah kelengkapan timestamp di atas 85% dan kesalahan sistemik sudah
dituntaskan. Pada titik itu, sisa kesalahan yang tinggal memang atribusi individu — dan
datanya sudah cukup kuat untuk dipakai dalam pembicaraan kinerja.

---

## G. Kalibrasi SLA

Angka SLA di `taxonomy.ts` adalah **hipotesis awal, bukan kebenaran**. Setelah 3 bulan
data masuk:

1. Hitung persentil-50 waktu tunggu dan waktu kerja aktual per stage.
2. Tetapkan target awal di persentil-50 itu — artinya separuh pekerjaan sudah memenuhinya
   hari ini. Target yang langsung dilanggar 90% pekerjaan akan diabaikan orang dalam
   sebulan.
3. Turunkan targetnya bertahap, satu stage per waktu, dimulai dari stage dengan skor
   bottleneck tertinggi.
4. Tandai `SlaTarget.basis` dari `hypothesis` menjadi `historical_p50`, dan isi
   `effectiveFrom` supaya laporan periode lama tetap memakai target yang berlaku saat itu.

Untuk stage `wait_external`, jangan pakai persentil internal — pakai lead time yang
dijanjikan vendor/ekspedisi di kontrak (`basis: 'contractual'`). Kalau targetnya diambil
dari data historis, keterlambatan vendor yang sudah menahun jadi ikut dianggap normal.

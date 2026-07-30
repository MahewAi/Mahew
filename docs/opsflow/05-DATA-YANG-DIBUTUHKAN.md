# 05 — Data yang Dibutuhkan

Ini daftar yang Anda minta: apa saja yang saya butuhkan untuk membuat dashboard-nya jalan
dengan data perusahaan sungguhan.

Dibagi lima bagian. **Bagian C adalah yang paling menentukan** — satu pertanyaan di
dalamnya bisa mengubah seluruh urutan implementasi, jadi kalau hanya bisa mengerjakan satu
bagian dulu, kerjakan C.

Template CSV siap isi ada di [`templates/`](./templates/). Kalau lebih nyaman pakai
spreadsheet, ekspor ke CSV dengan nama kolom yang sama.

---

## Paket Minimum untuk mulai

Tidak perlu lengkap semua dulu. Dengan tujuh hal ini saja, dashboard sudah bisa
menunjukkan titik macet pada satu jalur:

| # | Yang dibutuhkan | Bagian | Perkiraan usaha |
| --- | --- | --- | --- |
| 1 | Daftar sub-tim & PIC per stage | A1, A2 | 1 hari, wawancara kepala sektor |
| 2 | Kalender kerja & hari libur | A5 | 1 jam |
| 3 | Jawaban inventaris sistem | C1 | 2 jam bersama tim IT |
| 4 | **Riwayat status: ada atau tidak?** | C2 | 30 menit — pertanyaan paling penting |
| 5 | Data historis 3 bulan, satu jalur: PR→PO→GRN→Invoice→Bayar | B1 | Tergantung jawaban C2 |
| 6 | Volume transaksi per bulan | E1 | 30 menit |
| 7 | 3 keluhan terbesar manajemen | E3 | Sudah ada di kepala Anda |

Sisanya bisa menyusul sambil jalan.

---

## A. Master data — organisasi & referensi

### A1. Struktur sub-tim

Template: [`templates/A1-sub-tim.csv`](./templates/A1-sub-tim.csv)

| Kolom | Contoh | Catatan |
| --- | --- | --- |
| `sektor` | Pembelian | Pembelian / Finance / Produksi / Pengiriman |
| `nama_sub_tim` | Admin Purchasing | **Pakai nama yang dipakai orang sehari-hari**, bukan nama struktur organisasi resmi. Kalau orang menyebutnya "bagian PO", tulis itu. |
| `jumlah_orang_aktif` | 4 | Untuk menormalkan beban kerja |
| `nama_pemimpin` | — | Tujuan eskalasi otomatis saat SLA terlewat |
| `stage_yang_dipegang` | PROC-20, PROC-50 | Kode dari [dokumen 02](./02-PETA-ALUR-DAN-SUBTIM.md) |

### A2. Daftar personel

Template: [`templates/A2-personel.csv`](./templates/A2-personel.csv)

`id_pegawai`, `nama`, `sub_tim`, `jabatan`, `level_wewenang`, `tanggal_masuk`, `pola_shift`

Dua kolom yang mungkin terasa tidak perlu tapi penting:

- **`tanggal_masuk`** — membedakan kesalahan pegawai baru (butuh pendampingan) dari pola
  menahun (butuh perbaikan proses). Tanpa ini, pegawai baru akan selalu terlihat sebagai
  yang paling bermasalah, dan kesimpulannya salah.
- **`level_wewenang`** — angka, makin besar makin tinggi. Dipakai mendeteksi otomatis
  persetujuan oleh orang yang tidak berwenang.

### A3. Matriks wewenang persetujuan

Template: [`templates/A3-wewenang.csv`](./templates/A3-wewenang.csv)

`stage`, `nilai_minimum`, `nilai_maksimum`, `level_wewenang_minimum`, `butuh_dua_penyetuju`

Contoh: pembayaran di bawah Rp 50 juta cukup manajer; di atas itu direktur dan wajib dua
penyetuju.

**Pertanyaan tambahan yang penting:** *siapa penggantinya saat penyetuju cuti atau dinas
luar?* Kalau jawabannya "belum ada aturannya" — itu hampir pasti salah satu penyebab macet
terbesar di perusahaan Anda. Pada data simulasi, stage inilah yang keluar sebagai titik
macet nomor satu, dengan Rp 654 juta tertahan di satu meja.

### A4. Target SLA per stage

Template: [`templates/A4-sla.csv`](./templates/A4-sla.csv)

Isi kalau sudah ada standar tertulis. **Kalau belum ada, kosongkan saja** — lebih baik
diturunkan dari data historis nanti daripada ditebak sekarang. Target yang ditebak lalu
langsung dilanggar 90% pekerjaan akan diabaikan orang dalam sebulan.

### A5. Kalender kerja — **wajib**

Template: [`templates/A5-kalender.csv`](./templates/A5-kalender.csv)

- Jam kerja kantor (mis. 08:00–17:00, istirahat 12:00–13:00)
- Hari kerja (Senin–Jumat? Sabtu setengah hari?)
- Pola shift produksi & gudang (berapa shift, jam berapa saja)
- **Daftar hari libur & cuti bersama tahun ini**
- Sub-tim mana yang jalan 24 jam

Tanpa ini semua SLA salah hitung dan orang dihukum karena akhir pekan. Ini bagian tercepat
diisi tapi paling besar dampaknya pada keadilan angka.

### A6. Master item / material

Template: [`templates/A6-item.csv`](./templates/A6-item.csv)

`kode_item`, `nama`, `kategori`, `satuan_dasar`, `lead_time_standar_hari`,
`supplier_utama`, `jenis` (material / setengah jadi / barang jadi)

Kolom `satuan_dasar` perlu eksplisit: salah satuan (pcs vs box vs kg) adalah sumber
kesalahan klasik yang bisa dideteksi otomatis kalau satuannya diketahui.

### A7. Master supplier

Template: [`templates/A7-supplier.csv`](./templates/A7-supplier.csv)

`kode`, `nama`, `kategori`, `lead_time_dijanjikan_hari`, `termin_bayar_hari`

`lead_time_dijanjikan_hari` dipakai membandingkan janji vendor dengan realitanya. Sering
kali "produksi telat karena material belum datang" ternyata bersumber pada satu-dua vendor
yang tidak pernah menepati janji, dan itu tidak pernah terlihat tanpa pembanding.

### A8. Master pelanggan & tujuan kirim

Template: [`templates/A8-pelanggan.csv`](./templates/A8-pelanggan.csv)

`kode`, `nama`, `wilayah`, `termin_bayar_hari`, `limit_kredit`

### A9. BOM / resep produksi

Template: [`templates/A9-bom.csv`](./templates/A9-bom.csv)

`kode_barang_jadi`, `kode_komponen`, `qty_per_unit`, `satuan`

Ini yang menghubungkan order pelanggan ke material yang harus dibeli — tanpanya, "order
telat karena material" tidak bisa ditelusuri sampai ke PO-nya.

### A10. Line produksi & ekspedisi

Template: [`templates/A10-kapasitas.csv`](./templates/A10-kapasitas.csv)

Daftar line produksi + kapasitas per jam + sub-tim operatornya; daftar ekspedisi/armada +
area layanan + lead time yang dijanjikan per area.

---

## B. Data transaksi historis

Idealnya **6–12 bulan**; minimum **3 bulan** untuk mulai. Semakin panjang, semakin akurat
kalibrasi SLA-nya.

### B1. Dokumen yang dibutuhkan

Untuk setiap jenis di bawah: **seluruh baris dalam periode**, bukan sampel.

| Rantai | Dokumen |
| --- | --- |
| Pengadaan | Purchase Request, Purchase Order, Penerimaan Barang (GRN), hasil QC masuk, Invoice vendor, Bukti pembayaran, Retur/klaim ke vendor |
| Pemenuhan | Sales Order, Order produksi, Catatan hasil produksi per shift, Catatan QC (in-process & akhir), Surat jalan / DO, Bukti terima (POD), Retur/klaim pelanggan, Invoice pelanggan |

### B2. Kolom per dokumen

| Kolom | Wajib | Catatan |
| --- | --- | --- |
| Nomor dokumen | ya | |
| **Tanggal DAN JAM setiap perubahan status** | ya | Lihat B3 — ini yang paling kritis |
| Siapa yang membuat | ya | ID pegawai, bukan nama |
| Siapa yang menyetujui | ya | Untuk setiap tingkat persetujuan |
| Nilai transaksi | ya | Untuk membobot dampak keterlambatan |
| Qty & satuan | ya | |
| **Nomor dokumen sebelumnya** | ya | PO merujuk PR, GRN merujuk PO, Invoice merujuk GRN. Tanpa ini rantainya terputus. |
| Status akhir | ya | Selesai / dibatalkan / ditolak |
| Kode item, supplier, pelanggan | ya | Merujuk master data bagian A |
| Tanggal dibutuhkan / dijanjikan | sangat disarankan | Untuk mengukur ketepatan janji |

### B3. Dua hal kritis soal data historis

**Pertama: jam, bukan hanya tanggal.** Kalau yang tersedia hanya tanggal, resolusi
analisisnya hilang — mayoritas kemacetan terjadi dalam hitungan jam sampai beberapa hari.
Dengan hanya tanggal, dashboard tetap bisa dibuat, tapi tidak bisa membedakan dokumen yang
diproses 20 menit dari yang diproses seharian penuh.

**Kedua, dan ini pertanyaan paling penting di seluruh dokumen ini:**

> ### Apakah sistem menyimpan RIWAYAT perubahan status, atau hanya status TERAKHIR?
>
> Kalau tabelnya seperti ini — hanya status sekarang:
>
> | no_po | status | tanggal_update |
> | --- | --- | --- |
> | PO-4821 | Dibayar | 2026-07-20 |
>
> maka **waktu tunggu tidak bisa dihitung dari data historis.** Yang bisa dihitung hanya
> total durasi dari awal ke akhir. Tidak akan diketahui dokumen itu menganggur berapa lama
> di tahap mana.
>
> Kalau ada tabel riwayat/audit log seperti ini:
>
> | no_po | status_dari | status_ke | waktu | user |
> | --- | --- | --- | --- | --- |
> | PO-4821 | Diajukan | Disetujui | 2026-07-04 14:22 | budi |
> | PO-4821 | Disetujui | Dibayar | 2026-07-20 09:10 | sari |
>
> maka seluruh analisis bisa dijalankan langsung dari data historis, dan dashboard bisa
> menampilkan pola 6 bulan ke belakang sejak hari pertama.

**Kalau jawabannya "hanya status terakhir"**, itu bukan penghalang — hanya mengubah urutan
kerjanya: bulan-bulan pertama dipakai mengumpulkan data baru lewat aplikasi capture
(2 tap: "terima" & "selesai"), dan analisis mendalam dimulai setelah ~6 minggu data
terkumpul. Yang penting keputusan ini diketahui **sekarang**, bukan setelah adapter selesai
dibangun.

Tanyakan ke tim IT: *"apakah ada tabel history/audit log untuk perubahan status dokumen,
dan sejak kapan datanya tersimpan?"*

---

## C. Inventaris sistem & proses

**Bagian paling menentukan.** Isi ini dulu kalau waktunya terbatas.

### C1. Sistem apa yang dipakai di tiap sektor

Template: [`templates/C1-sistem.csv`](./templates/C1-sistem.csv)

| Kolom | Contoh |
| --- | --- |
| `sektor_atau_sub_tim` | Finance / AP |
| `nama_sistem` | Accurate, SAP, Odoo, Excel, atau "manual/kertas" |
| `ada_api` | ya / tidak / tidak tahu |
| `database_bisa_diakses` | ya / tidak / tidak tahu |
| `pic_teknis` | Nama & kontak orang yang bisa saya tanya |

### C2. Riwayat status — **pertanyaan kunci**

Untuk setiap sistem di C1: apakah ada tabel history / audit log perubahan status? Sejak
kapan? Lihat B3 di atas untuk penjelasan mengapa ini menentukan.

### C3. Bagian mana yang masih manual

Daftar tahap yang masih berjalan lewat kertas, WhatsApp, telepon, atau Excel pribadi.

Ini bukan untuk dikritik — ini untuk menentukan di mana aplikasi capture 2-tap perlu
dipasang. Tahap yang tidak punya jejak digital adalah lubang buta di dashboard, dan
biasanya justru di lubang buta itulah kemacetan terbesar bersembunyi.

### C4. Contoh dokumen

Satu contoh (foto atau scan sudah cukup) untuk masing-masing: PR, PO, GRN, form QC masuk,
form QC akhir, laporan produksi shift, surat jalan, invoice vendor, invoice pelanggan.

Gunanya untuk melihat kolom apa yang benar-benar ada di lapangan, dan di mana QR code bisa
ditempel.

### C5. SOP tertulis

Kalau ada, kirimkan apa adanya. Kalau tidak ada, tidak masalah — [dokumen
02](./02-PETA-ALUR-DAN-SUBTIM.md) bisa jadi SOP versi pertama setelah divalidasi.

Kalau ada SOP tapi Anda tahu praktiknya sudah berbeda, **kirim keduanya**: yang tertulis
dan yang benar-benar dijalankan. Selisih antara keduanya biasanya justru tempat kesalahan
paling sering terjadi.

---

## D. Data kesalahan historis

Kalau ada, ini sangat mempercepat kalibrasi. Kalau tidak ada dalam bentuk rapi, bagian D6
saja sudah cukup berharga.

| # | Data | Gunanya |
| --- | --- | --- |
| D1 | Log komplain pelanggan | Kalibrasi jenis kesalahan yang paling mahal |
| D2 | NCR / laporan ketidaksesuaian | Kesalahan mutu produksi |
| D3 | Data retur & klaim (vendor & pelanggan) | Dampak rupiah nyata |
| D4 | Hasil stock opname / selisih stok | Indikator kualitas pencatatan gudang |
| D5 | Temuan audit internal, denda/klaim vendor | Kesalahan bernilai besar |
| **D6** | **10–20 cerita kasus nyata "yang paling sering bikin macet", dari tiap kepala sektor** | **Paling berharga dari semuanya** |

Tentang D6: minta tiap kepala sektor menceritakan kejadian konkret — "bulan lalu order
pelanggan X telat 2 minggu karena…". Cerita seperti ini yang memvalidasi apakah taksonomi
35 stage dan 13 jenis kesalahan sudah menangkap masalah nyata perusahaan Anda, atau masih
ada pola yang belum terwakili. Satu jam wawancara di sini bernilai lebih dari sebulan
menebak.

---

## E. Konteks bisnis

### E1. Volume transaksi per bulan

Template: [`templates/E1-volume.csv`](./templates/E1-volume.csv)

Berapa PR, PO, penerimaan barang, invoice masuk, pembayaran, sales order, order produksi,
dan pengiriman per bulan. Perkiraan kasar sudah cukup.

Gunanya menentukan skala sistem dan mengurutkan prioritas: sektor dengan 2.000 transaksi
per bulan lebih dulu ditangani daripada yang 50.

### E2. Nilai rata-rata per transaksi

Per jenis dokumen. Dipakai menghitung dampak rupiah dari keterlambatan — dan itu yang
membuat perbaikan bisa diprioritaskan berdasarkan nilai, bukan berdasarkan siapa yang
paling keras bersuara di rapat.

### E3. Tiga keluhan terbesar manajemen saat ini

Tulis apa adanya, tidak perlu formal. Contoh: "barang selalu telat datang", "produksi
sering berhenti karena material kosong", "pelanggan komplain barang salah kirim".

Ini yang menentukan layar mana yang dibuat lebih dulu.

### E4. Target yang ingin dicapai

Contoh: "lead time PR sampai barang datang dari 30 hari jadi 14 hari", "komplain salah
kirim turun 80%".

Tanpa target, dashboard hanya jadi laporan. Dengan target, ia jadi alat ukur kemajuan.

---

## Cara mengirim

- CSV atau Excel, satu file per template.
- Untuk data transaksi historis: ekspor per jenis dokumen, satu file per jenis.
- **Data personel boleh dianonimkan** — cukup `id_pegawai` yang konsisten, tanpa nama.
  Analisis pola tidak butuh nama; nama hanya diperlukan kalau Anda ingin dashboard
  menampilkannya, dan itu bisa dipetakan terpisah di sisi Anda.

## Apa yang saya kerjakan setelah data masuk

| Data yang masuk | Yang bisa saya buat |
| --- | --- |
| A1 + A2 + A5 | Taksonomi final terkalibrasi + kalender kerja aktif |
| C1 + C2 | Rencana integrasi konkret per sistem, dan keputusan perlu/tidaknya aplikasi capture |
| B (1 jalur, 3 bulan) | Dashboard bottleneck jalan pertama + SLA terkalibrasi dari data nyata |
| B (semua jalur) | Peta lengkap 4 sektor + penelusuran lintas sektor |
| D | Taksonomi kesalahan terkalibrasi + deteksi otomatis pola berulang |
| E | Prioritas perbaikan berdasarkan nilai rupiah, bukan berdasarkan volume suara |

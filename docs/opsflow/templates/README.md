# Template pengumpulan data

Isi yang relevan, lewati yang belum ada. Baris pertama tiap file adalah contoh —
hapus dan ganti dengan data asli.

Penjelasan setiap kolom ada di [../05-DATA-YANG-DIBUTUHKAN.md](../05-DATA-YANG-DIBUTUHKAN.md).

## Urutan pengerjaan yang saya sarankan

| Urutan | File | Kepada siapa dititipkan | Perkiraan waktu |
| --- | --- | --- | --- |
| 1 | `C1-sistem.csv` | Tim IT | 2 jam |
| 2 | `A5-kalender.csv` + `A5b-hari-libur.csv` | HR | 1 jam |
| 3 | `A1-sub-tim.csv` | Kepala tiap sektor | 1 hari |
| 4 | `A2-personel.csv` | HR | 2 jam |
| 5 | `E1-volume.csv` | Anda / masing-masing kepala sektor | 30 menit |
| 6 | `A3-wewenang.csv` | Finance | 2 jam |
| 7 | `B-transaksi-historis.csv` | Tim IT (ekspor sistem) | tergantung jawaban C1 |
| 8 | Sisanya | Menyusul | — |

**Kerjakan `C1-sistem.csv` lebih dulu.** Satu kolom di dalamnya —
`ada_tabel_riwayat_status` — menentukan apakah analisis bisa langsung jalan dari data
historis, atau harus mengumpulkan data baru selama ~6 minggu. Jawabannya mengubah seluruh
urutan implementasi, jadi lebih baik diketahui sekarang daripada setelah adapter dibangun.

## Format

- Simpan sebagai CSV (UTF-8) atau Excel dengan nama kolom yang sama.
- Tanggal: `YYYY-MM-DD`. Tanggal + jam: `YYYY-MM-DD HH:MM`.
- Nilai rupiah: angka saja, tanpa titik/koma pemisah dan tanpa "Rp".
- Kolom kosong lebih baik daripada kolom yang diisi tebakan. Tebakan yang masuk ke sistem
  akan terlihat sama meyakinkan dengan data asli, dan itu justru berbahaya.

## Soal `A2-personel.csv`

Kolom `nama` **boleh dikosongkan atau dianonimkan**. Yang dibutuhkan sistem hanya
`id_pegawai` yang konsisten antara file personel dan file transaksi. Nama hanya diperlukan
kalau Anda ingin dashboard menampilkannya, dan pemetaan id→nama bisa disimpan terpisah di
sisi Anda.

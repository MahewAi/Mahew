# 07 — Dashboard: Keputusan Desain & Verifikasi

Dashboard-nya sudah jadi dan bisa dibuka di `/opsflow` di dalam app ini. Dokumen
ini mencatat keputusan desainnya beserta buktinya, supaya siapa pun yang
melanjutkan tidak mengulang percobaan yang sama.

## Halaman

| Route | Untuk siapa | Menjawab |
| --- | --- | --- |
| `/opsflow` | Pimpinan | Di mana macetnya, kenapa, berapa nilai yang tertahan |
| `/opsflow/sektor/:sector` | Kepala sektor | Antrean sub-tim saya, mana yang paling tua |
| `/opsflow/stage/:code` | Pemimpin sub-tim | Apa yang harus diubah di stage ini |
| `/opsflow/telusur/:workItemId` | Siapa pun | Kenapa dokumen ini telat, sampai ke sektor lain |

Sumber datanya masih dataset simulasi (`src/opsflow/example.ts`), dan itu
**ditulis di layar** sebagai lencana "Data simulasi". Penggantian ke data nyata
adalah satu titik: isi `loadSnapshot()` di `src/opsflow/useOpsflowSnapshot.ts`
dengan `fetch('/api/opsflow/snapshot?window=30')`. Bentuk `DashboardSnapshot`
sudah sama, jadi UI-nya tidak perlu disentuh.

## Peta perjalanan

Bagian utama layar pimpinan adalah peta bergaya papan permainan: 32 stage jalur
utama sebagai satu rute berkelok, empat baris (satu per sektor), arah berbalik di
tiap ujung. Setiap stage jadi stasiun ber-ikon.

Alasan memilih bentuk peta: **pertanyaan "di mana macetnya" adalah pertanyaan
tentang tempat.** Peta menjawabnya dalam sekali pandang — mata langsung tertuju
ke stasiun yang membesar dan berdenyut — sementara tabel menuntut pembacanya
membandingkan angka baris per baris dulu. Daftar peringkat tetap ada di bawahnya
untuk yang butuh angka persisnya.

Pengkodean di peta, semuanya dijelaskan di keterangan di bawahnya (pengkodean
yang tidak dijelaskan akan ditebak):

| Yang dilihat | Artinya |
| --- | --- |
| Warna stasiun & pita sektor | Sektor pemiliknya |
| Ukuran stasiun | Jumlah pekerjaan tertahan di sana |
| Angka di lencana stasiun | Jumlah persisnya — ukuran memberi kesan, angka memberi fakta |
| Cincin berdenyut | Stage ini macet; ketuk untuk melihat sebabnya |
| Marka jalan bergerak | Arah aliran pekerjaan |
| Panah di tengah baris | Arah baris itu, karena baris berkelok bisa terbaca mundur |

Tiga hal teknis yang menentukan peta ini bekerja:

1. **Posisi stasiun dihitung dengan rumus, bukan diukur dari DOM.** Jalur SVG dan
   stasiun HTML memakai satu sistem koordinat (viewBox 1000×640) dengan rasio
   aspek yang dikunci, jadi keduanya selalu sejajar tanpa observer ukuran.
2. **Paket yang bergerak memakai SMIL (`animateMotion`) mengikuti jalur yang sama
   persis.** Tidak ada JavaScript per frame yang bisa membeku.
3. **Lebar minimum peta 1000px, dan angka itu dihitung.** Label stasiun lebarnya
   tetap 92px sementara jarak antar stasiun menyusut ikut lebar peta; di bawah
   ~1000px keduanya bertabrakan. Di layar sempit peta digulir mendatar di dalam
   wadahnya sendiri — halamannya tetap tidak pernah menggulir mendatar.

## Palet: dihitung, bukan dipilih dengan mata

Warna token `role-*` app ini adalah tint merek dengan chroma 0,052–0,095 — **di
bawah floor 0,10**, jadi tidak sah dipakai sebagai warna seri data: di bawah
floor itu sebuah hue terbaca sebagai abu-abu dan berhenti membawa identitas.
Karena itu palet sektor diturunkan dari keluarga hue merek yang sama lalu
di-"snap" ke langkah yang lolos pemeriksaan.

**Palet sektor** (kategorikal, 4 slot) — divalidasi dengan `--pairs all` karena
di peta keempatnya tampil bersamaan dan mana pun bisa bersebelahan:

| Sektor | Hex | Kontras @ `#f9f7f3` |
| --- | --- | --- |
| Pembelian | `#b0893b` | 3,03 |
| Finance | `#279b88` | 3,20 |
| Produksi | `#a44659` | 5,45 |
| Pengiriman | `#633a88` | 7,88 |

Hasil pemeriksaan (mode terang, kedua permukaan app): lightness band PASS ·
chroma floor PASS · CVD separation PASS (terburuk ΔE 9,7 protan) · normal-vision
floor PASS (terburuk ΔE 16,0) · contrast PASS (semua ≥ 3:1).

**Skala status** (good / warning / serious / critical): `#2f7a4d` · `#b57b12` ·
`#c0632c` · `#a8352f`. Keempatnya lolos 3:1 di kedua permukaan — lebih ketat dari
kebutuhan minimum — dan **selalu** disertai ikon + teks.

**Kedekatan yang diketahui dan cara menanganinya.** Beberapa pasangan warna
sektor dan warna status berdekatan: gold↔warning ΔE 3,6; rose↔critical ΔE 5,5;
teal↔good ΔE 11,1. Karena itu ada aturan yang dipegang di seluruh kode:

> Warna sektor hanya muncul di peta, chip filter, dan batang "tunggu per sektor".
> Warna status hanya muncul di lencana dan batang keparahan, selalu dengan ikon +
> teks. Keduanya tidak pernah berada dalam satu kumpulan mark yang sama.

**Pasangan tunggu vs kerja** memakai satu hue netral dua langkah
(`#41392f` → `#b6aa9a`), sengaja tanpa warna. Percobaan memakai pasangan biru
gagal dua kali: ujung terangnya di bawah 2:1, dan birunya bertabrakan dengan
violet sektor (ΔE 6,0 deutan / 13,0 normal). Dua kegagalan itu hanya kelihatan
karena divalidasi, bukan dikira-kira.

Seluruh nilai beserta catatan hasil pemeriksaannya ada di `src/opsflow/viz.ts`.

## Aturan animasi yang paling penting

> **JavaScript untuk interaksi. CSS untuk memunculkan konten.**

Ini bukan soal selera, tapi soal arah kegagalannya:

- **Berbasis JS:** elemen ditahan pada opacity 0 sampai skrip menggerakkannya.
  Kalau itu tidak terjadi, kartunya **tidak pernah muncul**.
- **Berbasis CSS:** keadaan statis elemen adalah terlihat, dan animasi hanya
  menambahkan keadaan awal yang transparan. Animasi gagal jalan = konten tampil
  apa adanya.

Aturan ini lahir dari kegagalan nyata, bukan dari teori — lihat bagian
verifikasi di bawah.

Selebihnya: hanya `transform` dan `opacity` yang dianimasikan (batang tumbuh
dengan `scaleX`, bukan `width`, supaya layout tidak dihitung ulang tiap frame);
masuk pakai ease-out, keluar ~65% durasi masuk; stagger 40ms per item dibatasi 8
langkah; dan `prefers-reduced-motion` mematikan seluruh gerakan, bukan
memperlambatnya.

## Verifikasi

```bash
npm run typecheck      # tipe
npm run opsflow:check  # 46 pemeriksaan mesin metrik
npm run build && npm run preview
npm run opsflow:visual # tata letak & visibilitas di 6 kombinasi halaman/lebar
```

`opsflow:visual` mengukur tiga hal di enam kombinasi halaman × lebar: overflow
horizontal, jumlah kartu yang benar-benar terlihat setelah animasi selesai, dan
label peta yang saling menimpa.

**Kenapa pemeriksaan ini ada.** Empat bug nyata lolos dari typecheck DAN dari
build, dan baru ketemu setelah halamannya dirender lalu dilihat:

1. **Seluruh kartu di bawah hero tidak terlihat.** Rantai propagasi varian
   animasi terputus karena satu komponen di tengah memakai `animate` bernilai
   objek alih-alih label varian. Halaman tampak kosong; typecheck dan build
   sama-sama lolos.
2. **Batang bertumpuk menumpuk di satu sisi.** Lebar persentase dipasang pada
   anak di dalam pembungkus tooltip, bukan pada anak flex langsung, sehingga
   persentasenya dihitung terhadap pembungkus yang menyusut sendiri.
3. **Label sektor di peta menimpa stasiun.** Tata letak berkelok membuat titik
   awal satu baris berimpit dengan titik akhir baris sebelumnya.
4. **Label stasiun bertabrakan di lebar sempit.** Lebar label tetap, jarak antar
   stasiun menyusut — ditemukan terukur oleh skrip ini, bukan dengan melihat.

Semuanya kegagalan tata letak dan visibilitas: jenis yang tidak bisa ditangkap
pemeriksa tipe, dan yang paling mahal karena hasilnya halaman yang terlihat
rusak di depan pengguna.

## Yang belum dikerjakan

- **Endpoint snapshot & adapter ingestion.** Menunggu jawaban bagian C di
  [dokumen 05](./05-DATA-YANG-DIBUTUHKAN.md) — terutama apakah sistem existing
  menyimpan riwayat perubahan status.
- **Layar PIC** ("kerjaan saya hari ini" + tombol terima/selesai). Ini sekaligus
  jadi sumber timestamp `arrived` dan `started`, jadi pembuatannya digabung
  dengan aplikasi capture di Fase 2.
- **Kartu skor individu.** Komponen dan peringatan pembacaannya sudah ada di
  mesin metrik, tapi sengaja belum ditampilkan di UI. Alasannya ada di
  [roadmap Fase 3](./06-ROADMAP-IMPLEMENTASI.md): buka setelah kelengkapan
  timestamp di atas 85% dan kesalahan sistemik dituntaskan.
- **Mode gelap.** App ini light-only; menambah mode gelap hanya di halaman
  OpsFlow akan terasa asing. Kalau nanti seluruh app punya mode gelap, langkah
  gelap untuk palet sektor perlu dipilih dan divalidasi ulang terhadap permukaan
  gelapnya — bukan hasil membalik nilai terang.

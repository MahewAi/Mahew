/**
 * OpsFlow — Sistem motion.
 *
 * Satu tempat untuk seluruh durasi, easing, dan varian animasi, supaya semua
 * gerakan di dashboard punya ritme yang sama. Animasi yang tiap komponennya
 * memakai durasi sendiri terasa berantakan meski tiap bagiannya bagus.
 *
 * Aturan yang dipegang:
 *  - Hanya `transform` dan `opacity` yang dianimasikan. Batang tumbuh dengan
 *    `scaleX`, bukan `width` — animasi lebar memaksa layout dihitung ulang tiap
 *    frame dan bikin tersendat di daftar yang panjang.
 *  - Masuk pakai ease-out, keluar pakai ease-in, dan durasi keluar sekitar 65%
 *    durasi masuk supaya terasa responsif.
 *  - Stagger 40ms per item. Di bawah itu tidak terbaca, di atas itu terasa lambat.
 *  - `prefers-reduced-motion` dihormati: gerakan diganti kemunculan langsung,
 *    bukan diperlambat. Perhatikan bahwa ini bukan sekadar kesopanan — bagi
 *    sebagian orang animasi yang tidak bisa dimatikan menyebabkan pusing.
 */

import type { Transition, Variants } from 'framer-motion'

// ============================================================
// Token
// ============================================================

export const DURATION = {
  /** Umpan balik seketika: hover, tekan, ganti warna. */
  micro: 0.18,
  /** Kemunculan elemen. */
  enter: 0.32,
  /** Keluar — 65% dari masuk. */
  exit: 0.2,
  /** Pertumbuhan batang & penggambaran garis. */
  chart: 0.55,
} as const

export const EASE = {
  /** Masuk. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Keluar. */
  in: [0.4, 0, 1, 1] as const,
  /** Perpindahan dua arah. */
  inOut: [0.4, 0, 0.2, 1] as const,
} as const

/** Pegas untuk gerakan yang mengikuti jari / kursor. Terasa lebih alami dari kurva bezier. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
  mass: 0.8,
}

/** Pegas lembut untuk pertumbuhan batang — sedikit menyusul di ujung, tanpa memantul. */
export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 20,
  mass: 0.9,
}

export const STAGGER_STEP = 0.04

/**
 * Catatan perancangan yang penting untuk dipegang saat menambah animasi di sini.
 *
 * Kemunculan konten TIDAK memakai varian Framer Motion, tapi kelas CSS
 * (`.opsflow-enter`, `.opsflow-bar`, `.opsflow-segment` di globals.css).
 * Alasannya bukan selera, tapi arah kegagalannya:
 *
 *  - Berbasis JS: elemen ditahan pada opacity 0 sampai skrip menggerakkannya.
 *    Kalau itu tidak terjadi — rantai propagasi varian putus karena satu
 *    komponen di tengah memakai `animate` bernilai objek, frame di-starve, tab
 *    di latar belakang — kartunya TIDAK PERNAH muncul. Ini sudah benar-benar
 *    terjadi saat halaman ini dirender pertama kali: seluruh isi di bawah hero
 *    tidak terlihat, dan typecheck maupun build sama-sama lolos.
 *  - Berbasis CSS: keadaan statis elemen adalah TERLIHAT, dan animasi hanya
 *    menambahkan keadaan awal yang transparan. Animasi gagal jalan = konten
 *    tampil apa adanya.
 *
 * Jadi aturannya: **JavaScript untuk interaksi, CSS untuk memunculkan konten.**
 * Yang tersisa di file ini adalah token dan gerakan yang dipicu pengguna —
 * hover, tekan, tooltip, penanda filter yang berpindah — di mana kalau
 * animasinya tidak jalan, tidak ada yang tersembunyi.
 */

// ============================================================
// Interaksi
// ============================================================

/**
 * Umpan balik tekan & hover untuk kartu yang bisa diketuk.
 * Skala ditahan sangat kecil (1.5% naik, 2% turun) supaya tidak menggeser
 * elemen di sekitarnya dan tidak terasa mainan.
 */
export const pressable = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.985 },
  transition: SPRING,
} as const

/** Untuk baris daftar: cukup penyorotan, tanpa perubahan geometri. */
export const rowHover = {
  whileTap: { scale: 0.995 },
  transition: SPRING,
} as const

// ============================================================
// Varian untuk mode gerakan dikurangi
// ============================================================

/**
 * Ganti varian jadi kemunculan langsung. Bukan sekadar durasi 0 — nilai
 * transform juga dinolkan supaya tidak ada kedipan posisi di frame pertama.
 */
export function staticVariants(): Variants {
  return {
    hidden: { opacity: 1, y: 0, scaleX: 1, scaleY: 1 },
    visible: { opacity: 1, y: 0, scaleX: 1, scaleY: 1, transition: { duration: 0 } },
    exit: { opacity: 1, transition: { duration: 0 } },
  }
}

/** Pilih varian sesuai preferensi pengguna. */
export function pick(variants: Variants, reduced: boolean | null): Variants {
  return reduced ? staticVariants() : variants
}

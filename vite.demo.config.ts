/**
 * Konfigurasi build untuk demo OpsFlow satu berkas.
 *
 * Terpisah dari `vite.config.ts` supaya app utama tidak terpengaruh: demo ini
 * tidak memakai service worker, tidak memecah chunk, dan tidak memuat halaman
 * lain di app.
 *
 * Hasil akhirnya satu berkas HTML tanpa satu pun permintaan jaringan — JS dan
 * CSS ditanam di dalamnya oleh `scripts/opsflow-build-demo.mjs`. Itu syarat agar
 * halamannya bisa dibagikan lewat link dan dibuka di mana saja, termasuk di
 * lingkungan yang memblokir sumber eksternal.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    // Satu berkas JS dan satu berkas CSS — tidak ada chunk terpisah untuk
    // ditanam, dan tidak ada dynamic import yang perlu diunduh belakangan.
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'demo.js',
        assetFileNames: 'demo.[ext]',
      },
    },
  },
})

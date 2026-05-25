import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg'],
      manifest: {
        name: 'Gerai 1000 Pintu',
        short_name: 'Gerai',
        description: 'Brief inbox untuk Gerai 1000 Pintu',
        theme_color: '#B8956B',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Update PWA langsung aktif setelah service worker baru terunduh.
        skipWaiting: true,
        clientsClaim: true,
        // CRITICAL: exclude /api/ routes dari SPA navigation fallback.
        // Tanpa ini, SW intercept fetch /api/atmaja/memory?type=files dan
        // return cached index.html (SPA fallback), bikin Library + Proposals
        // tampil kosong padahal server return data correct.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/sw\.js$/,
          /^\/workbox-/,
        ],
        // Runtime caching untuk /api/ — NetworkOnly (never cache, never fallback).
        // Pastikan setiap GET ke /api/ langsung ke server, no SW interference.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gerai\.mahewwork\.com\/api\//,
            handler: 'NetworkOnly',
            options: { fetchOptions: { cache: 'no-store' } },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Bundle optimization — split heavy deps yang jarang dipakai biar initial load PWA tipis.
    // Mermaid, Wardley, Chart, KaTeX, Cytoscape cuma di-load pas Atmaja kebetulan jawab pakai diagram/chart.
    // Initial load utama (PWA + chat) sekarang turun dari ~2.3 MB ke ~650 KB.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Diagram + visualization libs — lazy load only when actually used
            if (id.includes('mermaid')) return 'vendor-mermaid'
            if (id.includes('cytoscape')) return 'vendor-cytoscape'
            if (id.includes('katex')) return 'vendor-katex'
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
            if (id.includes('wardley')) return 'vendor-wardley'
            // Framer Motion — split karena ~70 KB
            if (id.includes('framer-motion')) return 'vendor-motion'
            // React core — separate untuk caching
            if (
              id.includes('react/') ||
              id.includes('react-dom/') ||
              id.includes('react-router')
            ) {
              return 'vendor-react'
            }
            // Markdown renderer
            if (id.includes('react-markdown') || id.includes('rehype') || id.includes('remark')) {
              return 'vendor-markdown'
            }
            // Lucide icons (banyak)
            if (id.includes('lucide-react')) return 'vendor-icons'
          }
        },
      },
    },
    // Naikkan warning threshold sedikit untuk vendor-mermaid yang memang besar (di-load lazy)
    chunkSizeWarningLimit: 700,
  },
})

/**
 * OpsFlow — Titik masuk demo satu halaman.
 *
 * Dibangun jadi satu berkas HTML mandiri supaya bisa dibagikan lewat link tanpa
 * server, tanpa proses build di pihak yang membukanya, dan tanpa panggilan
 * jaringan sama sekali.
 *
 * Bedanya dengan app utama, dan alasannya:
 *
 * 1. `MemoryRouter`, bukan `BrowserRouter`. Halaman mandiri tidak punya server
 *    yang bisa menulis ulang URL, jadi perpindahan halaman disimpan di memori.
 *    Empat halaman tetap bisa dijelajahi; yang hilang hanya kemampuan menyalin
 *    URL satu halaman tertentu.
 * 2. Tanpa service worker, tanpa telemetri, tanpa endpoint API. Demo ini tidak
 *    boleh mengirim apa pun ke mana pun — ia akan dibagikan ke orang lain.
 * 3. Semua halaman diimpor langsung, bukan lazy. Satu berkas berarti tidak ada
 *    chunk terpisah untuk diunduh.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OpsflowOverview from '../src/pages/opsflow/OpsflowOverview'
import OpsflowSector from '../src/pages/opsflow/OpsflowSector'
import OpsflowStage from '../src/pages/opsflow/OpsflowStage'
import OpsflowTrace from '../src/pages/opsflow/OpsflowTrace'
import '../src/styles/globals.css'

function DemoApp() {
  return (
    <MemoryRouter initialEntries={['/opsflow']}>
      <div className="canvas-brass min-h-screen text-text-primary">
        {/* Tekstur grain halus, sama dengan app utama. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 size-full opacity-[0.02] mix-blend-multiply"
        >
          <filter id="demo-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#demo-grain)" />
        </svg>

        <div className="relative">
          <Routes>
            {/* Semua jalur mengarah ke ikhtisar supaya tautan "kembali ke
                Dashboard" di app utama tidak berujung halaman kosong di demo. */}
            <Route path="/" element={<OpsflowOverview />} />
            <Route path="/opsflow" element={<OpsflowOverview />} />
            <Route path="/opsflow/sektor/:sector" element={<OpsflowSector />} />
            <Route path="/opsflow/stage/:code" element={<OpsflowStage />} />
            <Route path="/opsflow/telusur/:workItemId" element={<OpsflowTrace />} />
            <Route path="*" element={<OpsflowOverview />} />
          </Routes>

          <footer className="mx-auto w-full max-w-6xl px-3 pb-10 md:px-6">
            <div className="rounded-lg bg-bg-elevated px-4 py-4 shadow-soft ring-1 ring-inset ring-border-soft">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-muted">
                Tentang demo ini
              </p>
              <p className="mt-2 max-w-prose text-[12px] leading-[18px] text-text-secondary">
                Angka di halaman ini berasal dari <strong>dataset simulasi</strong> berisi 300-an objek kerja dan
                ~3.800 catatan kejadian — bukan data perusahaan. Seluruh perhitungan berjalan di browser Anda, tanpa
                mengirim apa pun ke mana pun. Yang nyata di sini adalah mesinnya: taksonomi 35 stage, perhitungan jam
                kerja, deteksi titik macet, dan tujuh aturan yang menemukan kesalahan tanpa ada yang melapor.
              </p>
              <p className="mt-2 max-w-prose text-[12px] leading-[18px] text-text-muted">
                Perpindahan halaman disimpan di memori, jadi tombol kembali browser tidak berpengaruh — pakai tombol
                “Ikhtisar” di kiri atas untuk kembali.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </MemoryRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <DemoApp />
    </StrictMode>,
  )
}

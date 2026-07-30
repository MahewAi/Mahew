/**
 * OpsFlow — Angka yang berjalan naik.
 *
 * Dua hal yang biasanya salah pada animasi angka, dan dihindari di sini:
 *
 * 1. Pergeseran layout. Lebar angka berubah saat digitnya berubah, sehingga
 *    satuan di sebelahnya ikut bergoyang. Solusinya: nilai akhir dirender
 *    sebagai "hantu" yang tidak terlihat untuk mengunci lebar, lalu angka yang
 *    berjalan ditumpangkan di atasnya. Tidak ada satu frame pun yang menggeser
 *    tata letak.
 * 2. `tabular-nums` pada angka besar. Digit berlebar sama membuat angka seperti
 *    121 terlihat renggang di ukuran display. Angka besar tetap pakai figur
 *    proporsional; tabular hanya untuk kolom yang harus lurus vertikal.
 */

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  /** Nilai akhir. */
  value: number
  /** Ubah angka jadi teks — sekaligus penentu format desimal & satuan. */
  format: (value: number) => string
  /** Durasi jalan, detik. */
  duration?: number
  className?: string
}

export function AnimatedNumber({ value, format, duration = 0.9, className }: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  const frameRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const start = performance.now()
    const totalMs = duration * 1000

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / totalMs)
      // Ease-out kuartik: cepat di awal, melambat di ujung — terasa seperti
      // angka yang "mendarat" alih-alih berhenti mendadak.
      const eased = 1 - (1 - t) ** 4
      setDisplay(from + (value - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    // Jaring pengaman. Kalau frame animasi tidak pernah datang — tab di latar
    // belakang, mesin render menahan frame — angkanya akan tertinggal di nilai
    // awal dan pembaca melihat angka yang salah. Timer ini memastikan nilai
    // akhirnya tetap muncul.
    const safety = window.setTimeout(() => setDisplay(value), totalMs + 400)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      window.clearTimeout(safety)
      fromRef.current = value
    }
  }, [value, duration, reduced])

  return (
    <span className={cn('relative inline-block', className)}>
      {/* Hantu pengunci lebar — nilai akhir, tidak terlihat, tidak dibaca pembaca layar. */}
      <span aria-hidden="true" className="invisible">
        {format(value)}
      </span>
      {/* Angka yang berjalan. Pembaca layar hanya mendapat nilai akhirnya. */}
      <span className="absolute inset-0" aria-label={format(value)}>
        <span aria-hidden="true">{format(display)}</span>
      </span>
    </span>
  )
}

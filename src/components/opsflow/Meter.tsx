/**
 * OpsFlow — Meter cincin.
 *
 * Satu rasio terhadap batas. Isinya membawa tingkat keparahan, dan relnya
 * memakai langkah yang lebih terang dari ramp yang sama — supaya keadaannya
 * terbaca di sepanjang cincin, bukan hanya di bagian yang terisi.
 *
 * Ini bukan donat dua irisan. Bedanya: donat membandingkan dua kategori,
 * sedangkan meter menunjukkan satu nilai terhadap batasnya. Untuk dua irisan,
 * yang tepat memang angka atau batang, bukan lingkaran.
 */

import type { CSSProperties } from 'react'
import { SEVERITY_COLOR, SEVERITY_WASH, type SeverityLevel } from '@/opsflow/viz'
import { cn } from '@/lib/utils'

interface MeterProps {
  /** 0..1 */
  fraction: number
  level: SeverityLevel
  /** Diameter piksel. */
  size?: number
  /** Ketebalan cincin. */
  thickness?: number
  /** Isi tengah cincin — biasanya angka utama. */
  children?: React.ReactNode
  /** Deskripsi untuk pembaca layar. */
  ariaLabel: string
  className?: string
}

export function Meter({
  fraction,
  level,
  size = 200,
  thickness = 14,
  children,
  ariaLabel,
  className,
}: MeterProps) {
  const clamped = Math.max(0, Math.min(1, fraction))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  // Sisakan celah kecil di bawah supaya awal dan akhir cincin tidak menyatu
  // dan arah bacanya jelas.
  const sweep = 0.78
  const arcLength = circumference * sweep
  const offset = arcLength * (1 - clamped)

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        // Mulai dari kiri bawah, berputar searah jarum jam.
        style={{ transform: 'rotate(129.6deg)' }}
      >
        {/* Rel: langkah lebih terang dari ramp yang sama */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={SEVERITY_WASH[level]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Isi */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={SEVERITY_COLOR[level]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          // Keadaan statisnya sudah pada nilai akhir; animasinya hanya menyapu
          // dari busur penuh ke nilai itu. Jadi kalau animasinya tidak jalan,
          // cincin tetap menunjukkan angka yang benar.
          strokeDashoffset={offset}
          className="opsflow-meter-fill"
          style={{ '--arc': arcLength, '--offset': offset } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

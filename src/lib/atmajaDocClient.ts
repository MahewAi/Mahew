// Client untuk Atmaja document/file attachments.
// Atmaja emit marker [ATMAJA_DOC type="pdf" title="..."]content[/ATMAJA_DOC]
// di response saat user minta file (PDF, dokumen). Frontend parse marker,
// render attachment card seperti Claude.ai artifact attachment.

export type AtmajaDocType = 'pdf' | 'md' | 'docx'

export interface AtmajaDoc {
  id: string
  type: AtmajaDocType
  title: string
  /** Markdown content yang akan jadi PDF / dokumen */
  content: string
  generatedAt: string
}

export interface ParsedDocFromMarker {
  docs: AtmajaDoc[]
  cleanedText: string
}

// Regex untuk extract block [ATMAJA_DOC attrs]content[/ATMAJA_DOC]
const DOC_MARKER_RE = /\[ATMAJA_DOC\s+([^\]]*?)\]\s*([\s\S]*?)\s*\[\/ATMAJA_DOC\]/gi

export function parseDocMarkers(text: string): ParsedDocFromMarker {
  if (!text) return { docs: [], cleanedText: text }
  const docs: AtmajaDoc[] = []

  DOC_MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = DOC_MARKER_RE.exec(text)) !== null) {
    const attrs = match[1] ?? ''
    const content = (match[2] ?? '').trim()
    if (!content) continue

    const typeMatch = attrs.match(/type\s*=\s*["']([^"']+)["']/i)
    const titleMatch = attrs.match(/title\s*=\s*["']([^"']+)["']/i)
    const rawType = (typeMatch?.[1] ?? 'pdf').toLowerCase()
    const type: AtmajaDocType = rawType === 'md' || rawType === 'docx' ? rawType : 'pdf'
    const title = titleMatch?.[1]?.trim() || 'Dokumen Atmaja'

    docs.push({
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      title: title.slice(0, 120),
      content,
      generatedAt: new Date().toISOString(),
    })
  }

  const cleanedText = text.replace(DOC_MARKER_RE, '').trim()
  return { docs, cleanedText }
}

/**
 * Estimasi ukuran "file" untuk display di attachment card.
 * Bukan ukuran PDF sebenarnya (yang baru di-generate saat klik), tapi indikasi
 * panjang konten yang relevan untuk user awareness.
 */
export function estimateDocSize(content: string): string {
  const bytes = new Blob([content]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Word count untuk additional context di attachment card.
 */
export function countWords(content: string): number {
  return (content.match(/\S+/g) ?? []).length
}

// === PDF INTENT DETECTION (frontend) ===
// Mirror regex backend supaya client + server consistent.
const PDF_INTENT_RE =
  /\b(buat(kan)?( saya)?( file)?( sebuah)? pdf|kasih( saya)?( file)?( aku)? pdf|export( ke| sebagai| as)? pdf|kirim(kan)? pdf|save( as| sebagai)? pdf|pdf[- ]?(nya)? mana|buat(kan)? dokumen|generate( file)? pdf|hasilkan( file)? pdf|kasih( saya)? file|saya butuh( file)? pdf|saya mau( file)? pdf|tolong( buat)?( file)? pdf|pdf untuk (saya|aku|dibagikan|tim))/i

export function userWantsPdf(userMessage: string): boolean {
  return PDF_INTENT_RE.test(String(userMessage ?? ''))
}

// Refusal phrases yang Atmaja kadang masih kasih meski sudah diajarkan.
// Frontend filter: kalau response mengandung phrase ini DAN user minta PDF,
// kita strip phrase + auto-synthesize attachment.
const REFUSAL_PHRASES = [
  /jujur(\s+matthew)?,?\s+saya\s+(belum|tidak|gak|ga)\s+bisa\s+generate\s+(file\s+)?pdf\s+langsung[^.]*\./gi,
  /saya\s+(belum|tidak|gak|ga)\s+bisa\s+generate\s+(file\s+)?pdf[^.]*\./gi,
  /saya\s+cuma\s+bisa\s+output\s+teks[^.]*\./gi,
  /saya\s+tidak\s+bisa\s+(generate|create|kasih)\s+(file|pdf|dokumen)\s+(attachment|langsung)[^.]*\./gi,
  /(matthew\s+)?copy\s+ke\s+(google\s+docs|word|microsoft\s+word)[^.]*\./gi,
  /save\s+sebagai\s+file\s+\.html\s+\(misal[^)]*\)\s+di\s+komputer[^.]*\./gi,
  /buka\s+file\s+itu\s+di\s+browser\s+→\s+ctrl\+p\s+→\s+save\s+as\s+pdf[^.]*\./gi,
  /tapi\s+ada\s+\d+\s+jalan\s+praktis[^.]*\./gi,
  /opsi\s+\d+\s+—\s+(copy|saya\s+kasih|saya\s+generate)[^.]*\./gi,
  /jalan\s+tercepat\s+sekarang[^.]*\./gi,
  /cara\s+\d+\s+—\s+[^.]*\./gi,
  /yang\s+saya\s+hasilkan\s+adalah\s+teks\/markdown[^.]*\./gi,
  /bukan\s+attachment\s+yang\s+bisa\s+matthew\s+download[^.]*\./gi,
]

export function isRefusalResponse(text: string): boolean {
  if (!text) return false
  return REFUSAL_PHRASES.some((re) => re.test(text))
}

export function stripRefusalText(text: string): string {
  let cleaned = String(text ?? '')
  for (const re of REFUSAL_PHRASES) {
    cleaned = cleaned.replace(re, '')
  }
  // Cleanup multiple newlines + leading/trailing whitespace.
  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}

// Synthesize doc card dari response Atmaja kalau Atmaja tidak emit marker
// tapi Matthew jelas-jelas minta PDF. Frontend safety net.
export function synthesizeDocFromResponse(responseText: string, fallbackTitle: string): AtmajaDoc {
  // Strip refusal text terlebih dulu — supaya PDF tidak berisi penolakan.
  let content = stripRefusalText(responseText)

  // Kalau setelah strip kontennya kosong, fallback ke title sebagai placeholder
  if (!content.trim()) {
    content = `# ${fallbackTitle}\n\nKonten dokumen masih dalam proses penyusunan oleh Atmaja. Coba prompt ulang dengan detail spesifik.`
  }

  // Extract title from H1 kalau ada, jika tidak pakai fallback.
  const h1Match = content.match(/^#\s+(.+)$/m)
  const title = h1Match ? h1Match[1].trim().slice(0, 80) : fallbackTitle.slice(0, 80)

  return {
    id: `doc-syn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'pdf',
    title: title || 'Dokumen Atmaja',
    content,
    generatedAt: new Date().toISOString(),
  }
}

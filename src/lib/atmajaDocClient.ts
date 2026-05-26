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

// === DOCUMENT/FILE INTENT DETECTION (frontend) ===
// Lebih luas dari sekedar PDF: HTML, markdown, dokumen, file. Semua dialihkan
// jadi PDF attachment (browser print → save as PDF). Lebih user-friendly.
const PDF_INTENT_RE =
  /\b(buat(kan)?( saya)?( file)?( sebuah)? (pdf|html|dokumen|file|markdown|md)|kasih( saya)?( file)?( aku)?( juga)? (pdf|html|dokumen|file|markdown|md)|export( ke| sebagai| as)? (pdf|html|dokumen)|kirim(kan)? (pdf|html|file|dokumen)|save( as| sebagai)? pdf|pdf[- ]?(nya)? mana|buat(kan)? dokumen|generate( file)? (pdf|html|dokumen)|hasilkan( file)? (pdf|html|dokumen)|kasih( saya)? file|saya butuh( file)?( pdf| dokumen)?|saya mau( file)?( pdf| dokumen)?|tolong( buat)?( file)? (pdf|html|dokumen)|(pdf|html|dokumen|file) untuk (saya|aku|dibagikan|tim|presentasi)|html bole(h)?|file bole(h)?|dokumen bole(h)?|pdf bole(h)?|markdown bole(h)?|md bole(h)?|kasih (yang|saja|aja)|boleh (juga|saja|aja)|ya bole(h)?|ya kasih)/i

export function userWantsPdf(userMessage: string): boolean {
  return PDF_INTENT_RE.test(String(userMessage ?? ''))
}

// === INTENT SUPPRESSION ===
// User minta TEXT/BRIEF (bukan PDF). Default behavior: kalau user minta brief/update/sintesis/workflow
// dan tidak explicit sebut PDF/file/dokumen, response harus di chat saja.
const PDF_SUPPRESS_RE =
  /\b(sblm|sebelum|jangan|tanpa|bukan|skip|no|tidak usah|gausah|ga usah|nggak usah|engga usah)\s*(jadi\s+)?(pdf|file|dokumen|attachment|lampiran)|(kasih|berikan|bikinkan|tolong\s+kasih|tolong\s+berikan|buatkan|update|perbaiki|rapikan|bagusin|rapih(?:in|kan)?|polish)\s+(briefnya|brief|sintesis|sintesa|workflow|workflownya|isi|teks|content|raw|update|revisi|draft|outline|rangkuman|ringkasan)|(tampilkan|tunjukin|tunjukan|tunjukkan|tampilin|kasih liat|kasih lihat|liat|lihat|preview|review|baca|cek)\s+(dulu|aja|saja|isinya|isi)|di\s+chat\s+(dulu|aja|saja)|sini\s+saya\s+(liat|lihat|baca|cek|review)|(saya|aku)\s+(liat|lihat|baca|cek|review)\s+dulu/i

export function userSuppressesPdf(userMessage: string): boolean {
  return PDF_SUPPRESS_RE.test(String(userMessage ?? ''))
}

// Detect kalau Atmaja respons dengan raw HTML code block — harus di-convert jadi PDF
// supaya tidak tampil sebagai mentah di chat. NARROW intentionally: jangan trigger
// hanya karena response panjang+structured (itu normal jawaban Atmaja, bukan signal PDF).
// User yang TIDAK eksplisit sebut PDF tetap dapat text di chat. Atmaja
// emit [ATMAJA_DOC] marker explicitly kalau memang butuh PDF.
export function looksLikeDocumentResponse(responseText: string): boolean {
  if (!responseText || responseText.length < 1500) return false

  // HANYA trigger pada raw HTML code block (```html ... ```) yang harus di-convert.
  // Heading+table multi-paragraph adalah jawaban prose normal, bukan signal PDF.
  // Frasa "Berikut workflow/brief" adalah intro Indonesia normal, bukan signal PDF.
  return /```html[\s\S]*?```/i.test(responseText)
}

// Extract content yang appropriate untuk PDF dari response yang ada raw HTML.
// Strategi: kalau ada ```html block, gunakan markdown structure-nya untuk PDF.
// Kalau hanya ada markdown structure, gunakan as-is.
export function extractDocumentContent(responseText: string): string {
  // Strip ```html ... ``` code fences kalau ada (HTML mentah dilarang masuk PDF
  // karena PDF render via MarkdownBlock yang akan double-render HTML)
  let content = responseText.replace(/```html\s*\n([\s\S]*?)\n```/gi, (_, htmlInner) => {
    // Convert basic HTML structure kembali ke markdown approximation
    return htmlInner
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '') // strip remaining tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  })

  // Strip conversational opener kalau ada ("Siap Matthew." / "Berikut..." dst di awal)
  // supaya document content fokus
  content = content.replace(
    /^(siap\s+matthew[.,]?\s*|baik\s+matthew[.,]?\s*|tentu[.,]?\s*|berikut[^.\n]{0,80}[.\n]\s*)/i,
    '',
  )

  return content.trim()
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

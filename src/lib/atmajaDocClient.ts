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

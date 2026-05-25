// Client untuk Atmaja Browser Automation MVP (Hermes-inspired).
// Backend: api/agent/browse.js — fetch URL, extract readable text, return ke client.
// Frontend usage: intercept slash command `/browse <url>`, call ini, kirim hasil ke Atmaja.

export interface BrowseResponse {
  ok: boolean
  url: string
  title: string
  description: string
  text: string
  wordCount: number
  bytes: number
  fetchedAt: string
  note?: string
  error?: string
}

export async function browseUrl(url: string): Promise<BrowseResponse | null> {
  try {
    const response = await fetch('/api/agent/browse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { ok: false, error: data?.error ?? `http_${response.status}` } as BrowseResponse
    }
    return data as BrowseResponse
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'network_error' } as BrowseResponse
  }
}

/**
 * Parse `/browse <url>` slash command. Returns parsed URL atau null.
 * Format: `/browse https://example.com` atau `/browse https://example.com baca lalu analisis kompetisi`
 */
export function parseBrowseCommand(text: string): { url: string; question?: string } | null {
  const m = text.trim().match(/^\/browse\s+(\S+)(?:\s+(.+))?$/i)
  if (!m) return null
  const url = m[1].trim()
  const question = m[2]?.trim()
  // Validate URL pattern (basic).
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  } catch {
    return null
  }
  return { url, question }
}

/**
 * Build user message untuk Atmaja setelah /browse fetch sukses.
 * Atmaja receives prefix [BROWSE_RESULT url=...] + content, analyze + answer Matthew.
 */
export function buildBrowseMessage(url: string, content: BrowseResponse, userQuestion?: string): string {
  const lines: string[] = []
  lines.push(`[BROWSE_RESULT url=${url}]`)
  if (content.title) lines.push(`Title: ${content.title}`)
  if (content.description) lines.push(`Description: ${content.description}`)
  lines.push(`Words: ${content.wordCount}`)
  lines.push('')
  lines.push('=== CONTENT ===')
  lines.push(content.text)
  lines.push('=== END CONTENT ===')
  lines.push('')
  if (userQuestion) {
    lines.push(`Pertanyaan Matthew: ${userQuestion}`)
  } else {
    lines.push('Tolong analisis content di atas. Kasih insight singkat relevan untuk Gerai 1000 Pintu.')
  }
  return lines.join('\n')
}

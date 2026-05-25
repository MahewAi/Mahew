// Client untuk parse [ATMAJA_INSIGHT] markers dari Atmaja response.
// Atmaja kadang emit insight (proactive gap detection) di akhir response.
// Marker harus di-strip dari display chat + opsional auto-create proposal.
//
// Format marker yang Atmaja pakai:
//   [ATMAJA_INSIGHT]
//   Saya rasa ada gap: <satu kalimat>. Mau saya formulasikan jadi proposal?
//   [/ATMAJA_INSIGHT]

export interface AtmajaInsight {
  /** Raw inner text dari marker, sudah di-trim */
  text: string
}

export interface ParsedInsightFromMarker {
  insights: AtmajaInsight[]
  cleanedText: string
}

const INSIGHT_MARKER_RE = /\[ATMAJA_INSIGHT\]\s*([\s\S]*?)\s*\[\/ATMAJA_INSIGHT\]/gi

export function parseInsightMarkers(text: string): ParsedInsightFromMarker {
  if (!text) return { insights: [], cleanedText: text }
  const insights: AtmajaInsight[] = []

  INSIGHT_MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INSIGHT_MARKER_RE.exec(text)) !== null) {
    const inner = match[1].trim()
    if (inner) {
      insights.push({ text: inner })
    }
  }

  const cleanedText = text.replace(INSIGHT_MARKER_RE, '').trim()
  return { insights, cleanedText }
}

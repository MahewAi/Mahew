// Client untuk Atmaja chat → trigger Brief workflow integration (Item #3).
// Atmaja emit [ATMAJA_BRIEF_REQUEST] marker saat detect strategic decision intent.
// Frontend parse + auto-submit ke /api/agent/briefs endpoint yang forward ke n8n W1.

export interface AtmajaBriefRequest {
  title: string
  summary: string
}

export interface ParsedBriefMarker {
  briefs: AtmajaBriefRequest[]
  cleanedText: string
}

const BRIEF_MARKER_RE = /\[ATMAJA_BRIEF_REQUEST\]\s*([\s\S]*?)\s*\[\/ATMAJA_BRIEF_REQUEST\]/gi

export function parseBriefMarkers(text: string): ParsedBriefMarker {
  if (!text) return { briefs: [], cleanedText: text }
  const briefs: AtmajaBriefRequest[] = []

  BRIEF_MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BRIEF_MARKER_RE.exec(text)) !== null) {
    const inner = match[1] ?? ''
    const titleMatch = inner.match(/title\s*:\s*(.+?)(?:\n|$)/i)
    const summaryMatch = inner.match(/summary\s*:\s*([\s\S]+?)(?:\n\n|$)/i)
    const title = titleMatch?.[1]?.trim().slice(0, 200) ?? ''
    const summary = summaryMatch?.[1]?.trim().slice(0, 2000) ?? ''
    if (title && summary) {
      briefs.push({ title, summary })
    }
  }

  const cleanedText = text.replace(BRIEF_MARKER_RE, '').trim()
  return { briefs, cleanedText }
}

export interface SubmitBriefResponse {
  ok: boolean
  jobId?: string
  briefId?: string
  status?: string
  error?: string
}

/**
 * Submit brief ke n8n workflow #1 via /api/agent/briefs.
 * Returns jobId + initial status. Brief result akan landed di Brief Inbox PWA
 * setelah 30-60s processing (4 C-level + Atmaja synth).
 */
export async function submitBrief(input: AtmajaBriefRequest): Promise<SubmitBriefResponse> {
  try {
    const response = await fetch('/api/agent/briefs', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        summary: input.summary,
        source: 'atmaja_chat',
        contributors: ['coo', 'cmo', 'cfo', 'cco'],
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { ok: false, error: data?.error ?? `http_${response.status}` }
    }
    return {
      ok: true,
      jobId: data?.jobId ?? data?.briefId,
      briefId: data?.briefId ?? data?.jobId,
      status: data?.status ?? 'queued',
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'network_error',
    }
  }
}

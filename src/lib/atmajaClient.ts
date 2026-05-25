import type { ChatMessage } from '@/lib/mockReplies'
import { AGENT_BRIDGE_ALLOWED } from '@/lib/privacyGuard'

export interface AtmajaRemoteAttachment {
  name: string
  type: string
  size: number
  kind: string
  note?: string
  /** Raw base64 (tanpa data: prefix) untuk image kecil <= 1.5 MB. Server validate + cap ulang. */
  dataBase64?: string
  /** Cuplikan teks untuk file text/markdown/csv/code yang sudah dibaca client. */
  previewText?: string
}

export interface AtmajaRemoteReply {
  text: string
  provider: 'OpenRouter'
  model?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  } | null
}

export type AtmajaReplyErrorKind =
  | 'bridge_disabled'
  | 'network_error'
  | 'timeout'
  | 'rate_limited'
  | 'auth_failed'
  | 'openrouter_disabled'
  | 'openrouter_key_missing'
  | 'openrouter_error'
  | 'empty_reply'
  | 'invalid_response'
  | 'payload_too_large'
  | 'message_required'
  | 'unknown'

export interface AtmajaReplyError {
  ok: false
  errorKind: AtmajaReplyErrorKind
  message: string
  httpStatus?: number
  upstreamStatus?: number
}

export type AtmajaReplyResult =
  | { ok: true; reply: AtmajaRemoteReply }
  | AtmajaReplyError

interface RequestAtmajaReplyInput {
  userMessage: string
  history: ChatMessage[]
  attachments?: AtmajaRemoteAttachment[]
  attachedFileIds?: string[]
}

// Working memory Atmaja: 100 pesan terakhir, 15K char per pesan.
// Server akan clamp ulang dengan cap yang sama, ini ngirim sebanyak mungkin
// supaya Atmaja punya konteks panjang multi-hari kerja.
function stripHistory(messages: ChatMessage[]) {
  return messages.slice(-100).map((message) => ({
    id: message.id,
    author: message.author,
    text: message.text.slice(0, 15_000),
  }))
}

function stripAttachments(attachments: AtmajaRemoteAttachment[] = []) {
  return attachments.slice(0, 5).map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    kind: attachment.kind,
    note: attachment.note,
    dataBase64: attachment.dataBase64,
    previewText: attachment.previewText,
  }))
}

export function isAtmajaRemoteBridgeAllowed() {
  return AGENT_BRIDGE_ALLOWED
}

// Map HTTP/upstream error code → readable error message untuk UI display.
function mapErrorToFriendlyMessage(kind: AtmajaReplyErrorKind, httpStatus?: number): string {
  switch (kind) {
    case 'bridge_disabled':
      return 'Atmaja bridge sedang dimatikan. Cek setting di Settings.'
    case 'network_error':
      return 'Koneksi internet bermasalah. Coba lagi sebentar.'
    case 'timeout':
      return 'Atmaja kelamaan menjawab. Coba lagi dengan prompt lebih singkat.'
    case 'rate_limited':
      return 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.'
    case 'auth_failed':
      return 'Otentikasi gagal. Reload PWA atau hubungi admin.'
    case 'openrouter_disabled':
      return 'OpenRouter belum aktif. Set ATMAJA_OPENROUTER_ENABLED=true di server.'
    case 'openrouter_key_missing':
      return 'OpenRouter API key belum di-set. Cek env vars Vercel.'
    case 'openrouter_error':
      return `OpenRouter error (HTTP ${httpStatus ?? '?'}). Mungkin credit habis atau model down. Cek openrouter.ai/credits.`
    case 'empty_reply':
      return 'Atmaja tidak mengembalikan jawaban. Coba prompt ulang.'
    case 'invalid_response':
      return 'Response dari server tidak valid. Mungkin SW cache stale, coba force reload.'
    case 'payload_too_large':
      return 'Pesan + attachment terlalu besar. Kurangi ukuran file atau pesan.'
    case 'message_required':
      return 'Pesan kosong. Ketik prompt sebelum kirim.'
    case 'unknown':
    default:
      return 'Error tidak dikenal. Cek console untuk detail.'
  }
}

export function buildAtmajaError(
  kind: AtmajaReplyErrorKind,
  httpStatus?: number,
  upstreamStatus?: number,
): AtmajaReplyError {
  return {
    ok: false,
    errorKind: kind,
    message: mapErrorToFriendlyMessage(kind, httpStatus ?? upstreamStatus),
    httpStatus,
    upstreamStatus,
  }
}

/**
 * Request Atmaja reply dengan structured error handling.
 * Sekarang return AtmajaReplyResult (success OR typed error) supaya UI bisa
 * kasih feedback specific ke user. Sebelumnya silent return null = UI tidak
 * tahu apa yang error.
 */
export async function requestAtmajaReplyWithError(
  input: RequestAtmajaReplyInput,
): Promise<AtmajaReplyResult> {
  if (!AGENT_BRIDGE_ALLOWED) return buildAtmajaError('bridge_disabled')
  if (!input.userMessage?.trim() && (!input.attachments || input.attachments.length === 0)) {
    return buildAtmajaError('message_required')
  }

  let response: Response
  try {
    // Timeout 180s — Atmaja Opus 4.7 dengan continuation bisa lama (sampai 2 menit)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 180_000)
    try {
      response = await fetch('/api/atmaja/chat', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: input.userMessage,
          history: stripHistory(input.history),
          attachments: stripAttachments(input.attachments),
          attachedFileIds: Array.isArray(input.attachedFileIds)
            ? input.attachedFileIds.slice(0, 3)
            : undefined,
        }),
        signal: controller.signal,
      })
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return buildAtmajaError('timeout')
    }
    console.error('[atmajaClient] network error:', err)
    return buildAtmajaError('network_error')
  }

  // Map HTTP status → error kind
  if (response.status === 429) return buildAtmajaError('rate_limited', 429)
  if (response.status === 401 || response.status === 403) return buildAtmajaError('auth_failed', response.status)
  if (response.status === 413) return buildAtmajaError('payload_too_large', 413)

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    console.error('[atmajaClient] non-JSON response:', response.status, contentType)
    return buildAtmajaError('invalid_response', response.status)
  }

  let payload:
    | (Partial<AtmajaRemoteReply> & {
        ok?: boolean
        error?: string
        upstreamStatus?: number
        note?: string
      })
    | null = null
  try {
    payload = await response.json()
  } catch (err) {
    console.error('[atmajaClient] JSON parse error:', err)
    return buildAtmajaError('invalid_response', response.status)
  }

  if (!response.ok || !payload?.ok) {
    const errorCode = payload?.error ?? 'unknown'
    const errorKind: AtmajaReplyErrorKind =
      errorCode === 'atmaja_openrouter_disabled'
        ? 'openrouter_disabled'
        : errorCode === 'openrouter_key_missing'
          ? 'openrouter_key_missing'
          : errorCode === 'openrouter_error' || errorCode === 'openrouter_unreachable'
            ? 'openrouter_error'
            : errorCode === 'empty_openrouter_reply'
              ? 'empty_reply'
              : errorCode === 'payload_too_large'
                ? 'payload_too_large'
                : errorCode === 'message_required'
                  ? 'message_required'
                  : 'unknown'
    console.error('[atmajaClient] backend error:', errorCode, payload?.note)
    return buildAtmajaError(errorKind, response.status, payload?.upstreamStatus)
  }

  if (typeof payload.text !== 'string' || !payload.text.trim()) {
    return buildAtmajaError('empty_reply', response.status)
  }

  return {
    ok: true,
    reply: {
      text: payload.text.trim(),
      provider: 'OpenRouter',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      usage: payload.usage ?? null,
    },
  }
}

/**
 * Legacy compat wrapper — returns null on error untuk backward compat.
 * New callers harus pakai requestAtmajaReplyWithError supaya dapat error detail.
 */
export async function requestAtmajaReply(
  input: RequestAtmajaReplyInput,
): Promise<AtmajaRemoteReply | null> {
  const result = await requestAtmajaReplyWithError(input)
  if (result.ok) return result.reply
  return null
}

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

interface RequestAtmajaReplyInput {
  userMessage: string
  history: ChatMessage[]
  attachments?: AtmajaRemoteAttachment[]
}

function stripHistory(messages: ChatMessage[]) {
  return messages.slice(-10).map((message) => ({
    id: message.id,
    author: message.author,
    text: message.text.slice(0, 2_000),
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

export async function requestAtmajaReply(input: RequestAtmajaReplyInput): Promise<AtmajaRemoteReply | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null

  try {
    const response = await fetch('/api/atmaja/chat', {
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
      }),
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('application/json')) return null

    const payload = (await response.json()) as Partial<AtmajaRemoteReply> & { ok?: boolean }
    if (!payload.ok || typeof payload.text !== 'string' || !payload.text.trim()) return null

    return {
      text: payload.text.trim(),
      provider: 'OpenRouter',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      usage: payload.usage ?? null,
    }
  } catch {
    return null
  }
}

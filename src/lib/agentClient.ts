// Client wrapper untuk /api/agent/reply.
// Dipakai oleh AskRolePanel, CommentThread, dan surface lain yang butuh balasan C-suite/specialist.
// Floor model dijaga di server (Sonnet 4.6 minimum); client tidak boleh override ke lebih rendah.

import type { ChatMessage } from '@/lib/mockReplies'
import type { Contributor } from '@/lib/types'
import { AGENT_BRIDGE_ALLOWED } from '@/lib/privacyGuard'

export type AgentTier = 'content' | 'orchestration'

export interface AgentRemoteAttachment {
  name: string
  type: string
  size: number
  kind: string
  note?: string
  /** Raw base64 (tanpa data: prefix) untuk image kecil. Server cap ulang. */
  dataBase64?: string
  previewText?: string
}

export interface AgentRemoteReply {
  text: string
  provider: 'OpenRouter'
  role: Contributor
  tier: AgentTier
  model?: string
  fallbackUsed?: boolean
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  } | null
}

interface RequestAgentReplyInput {
  role: Contributor
  /**
   * 'content' -> Opus 4.7 (CEO synthesis / brief content generation).
   * 'orchestration' -> Sonnet 4.6 (C-suite + specialist routing/replies).
   * Default: 'orchestration'.
   */
  tier?: AgentTier
  userMessage: string
  history: ChatMessage[]
  briefContext?: string
  attachments?: AgentRemoteAttachment[]
}

function stripHistory(messages: ChatMessage[]) {
  return messages.slice(-10).map((message) => ({
    id: message.id,
    author: message.author,
    text: message.text.slice(0, 2_000),
  }))
}

export function isAgentBridgeAllowed() {
  return AGENT_BRIDGE_ALLOWED
}

export async function requestAgentReply(
  input: RequestAgentReplyInput,
): Promise<AgentRemoteReply | null> {
  if (!AGENT_BRIDGE_ALLOWED) return null

  try {
    const response = await fetch('/api/agent/reply', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        role: input.role,
        tier: input.tier ?? 'orchestration',
        userMessage: input.userMessage,
        history: stripHistory(input.history),
        briefContext: input.briefContext?.slice(0, 1_500) ?? '',
        attachments: (input.attachments ?? []).slice(0, 5).map((a) => ({
          name: a.name,
          type: a.type,
          size: a.size,
          kind: a.kind,
          note: a.note,
          dataBase64: a.dataBase64,
          previewText: a.previewText,
        })),
      }),
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok || !contentType.includes('application/json')) return null

    const payload = (await response.json()) as Partial<AgentRemoteReply> & { ok?: boolean }
    if (!payload.ok || typeof payload.text !== 'string' || !payload.text.trim()) return null

    return {
      text: payload.text.trim(),
      provider: 'OpenRouter',
      role: input.role,
      tier: input.tier ?? 'orchestration',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      fallbackUsed: Boolean(payload.fallbackUsed),
      usage: payload.usage ?? null,
    }
  } catch {
    return null
  }
}

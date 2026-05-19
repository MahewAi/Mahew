import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'
import {
  CONTRIBUTOR_META,
  getContributorColorRole,
  type Brief,
  type Comment,
  type Contributor,
  type Role,
} from '@/lib/types'
import { generateMockReply, type ChatMessage } from '@/lib/mockReplies'
import { cn } from '@/lib/utils'

interface CommentThreadProps {
  brief: Brief
  onAddComment: (text: string, author: Contributor | 'matthew') => void
}

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

/** Pick a contributor to "reply" to Matthew, prefer CEO Atmaja if present. */
function pickReplier(brief: Brief): Contributor {
  if (brief.contributors.includes('ceo')) return 'ceo'
  return brief.contributors[0]
}

/** Generate mocked reply with brief context awareness + history. */
function generateReply(brief: Brief, replier: Contributor, userMessage: string, history: ChatMessage[]): string {
  const result = generateMockReply({
    userMessage,
    history,
    brief,
    speaker: replier,
  })
  return result.text
}

export function CommentThread({ brief, onAddComment }: CommentThreadProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const comments = brief.comments ?? []

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [comments.length])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    const replier = pickReplier(brief)
    // Snapshot history as ChatMessage[] (already conformant: { id, author, text })
    const history: ChatMessage[] = comments.map((c) => ({
      id: c.id,
      author: c.author,
      text: c.text,
    }))
    onAddComment(trimmed, 'matthew')
    setText('')
    // Simulate AI reply with delay
    setTimeout(() => {
      const replyText = generateReply(brief, replier, trimmed, [
        ...history,
        { id: `tmp-${Date.now()}`, author: 'matthew', text: trimmed },
      ])
      onAddComment(replyText, replier)
      setSending(false)
    }, 1100)
  }

  return (
    <section aria-label="Diskusi" className="mx-5 mt-6">
      <p className="text-label-caps text-text-muted mb-3">Diskusi</p>

      {comments.length > 0 && (
        <div ref={listRef} className="space-y-2 mb-3 max-h-[360px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <CommentBubble key={c.id} comment={c} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="glass-soft rounded-[14px] shadow-glass p-2 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Tulis pesan ke tim... (Cmd+Enter kirim)"
          rows={1}
          className={cn(
            'flex-1 px-2 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-faint',
            'focus:outline-none resize-none leading-relaxed',
            'max-h-32',
          )}
          style={{ minHeight: '36px' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          aria-label="Kirim pesan"
          className={cn(
            'shrink-0 size-9 rounded-full inline-flex items-center justify-center',
            'transition-colors duration-fast',
            text.trim() && !sending
              ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
              : 'bg-bg-soft text-text-faint cursor-not-allowed',
          )}
        >
          <Send className="size-4" />
        </button>
      </div>
    </section>
  )
}

function CommentBubble({ comment }: { comment: Comment }) {
  const isMatthew = comment.author === 'matthew'
  const meta = comment.author !== 'matthew' ? CONTRIBUTOR_META[comment.author] : null
  const colorRole = comment.author !== 'matthew' ? getContributorColorRole(comment.author) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={cn('flex gap-2.5', isMatthew && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold shrink-0 size-8 text-sm',
          isMatthew
            ? 'bg-gradient-to-br from-accent to-accent-dark text-white shadow-glow-accent'
            : cn(
                roleBg[colorRole!],
                colorRole === 'cfo' ? 'text-text-primary' : 'text-white',
                meta && meta.initials.length > 1 ? 'text-[11px]' : '',
              ),
        )}
      >
        {isMatthew ? 'M' : meta!.initials}
      </span>

      {/* Bubble */}
      <div className={cn('max-w-[78%] min-w-0', isMatthew ? 'items-end' : 'items-start')}>
        {!isMatthew && (
          <p className="text-meta text-text-muted mb-1 px-2">
            {meta!.name}
          </p>
        )}
        <div
          className={cn(
            'rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed',
            isMatthew
              ? 'bg-accent text-white shadow-glass'
              : 'glass-soft text-text-primary shadow-glass',
          )}
        >
          {comment.text}
        </div>
        <p className={cn('text-[10px] text-text-faint mt-1 px-2', isMatthew && 'text-right')}>
          {comment.timeAgo}
        </p>
      </div>
    </motion.div>
  )
}

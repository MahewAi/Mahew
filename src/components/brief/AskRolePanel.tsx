import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, X } from 'lucide-react'
import {
  CONTRIBUTOR_META,
  getContributorColorRole,
  type Brief,
  type Contributor,
  type Role,
} from '@/lib/types'
import { generateRoleReply, type ChatMessage } from '@/lib/mockReplies'
import { cn } from '@/lib/utils'

interface AskRolePanelProps {
  role: Contributor | null
  brief: Brief
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Message {
  id: string
  author: 'matthew' | Contributor
  text: string
}

const roleBg: Record<Role, string> = {
  ceo: 'bg-role-ceo',
  coo: 'bg-role-coo',
  cmo: 'bg-role-cmo',
  cfo: 'bg-role-cfo',
  cco: 'bg-role-cco',
}

const quickPrompts: Record<string, string[]> = {
  default: [
    'Apa risiko terbesar dari pilihan ini?',
    'Bagaimana kalau kondisi market berubah?',
    'Apa yang akan Anda lakukan kalau di posisi saya?',
  ],
}

export function AskRolePanel({ role, brief, open, onOpenChange }: AskRolePanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open && role) {
      // Reset on each open
      setMessages([])
      setText('')
    }
  }, [open, role])

  if (!role) return null

  const meta = CONTRIBUTOR_META[role]
  const colorRole = getContributorColorRole(role)
  const isCfo = colorRole === 'cfo'

  const send = (msgText: string) => {
    if (!msgText.trim() || sending || !role) return
    const userMsg: Message = { id: `m-${Date.now()}`, author: 'matthew', text: msgText.trim() }
    const historySnapshot: ChatMessage[] = messages.map((m) => ({ id: m.id, author: m.author, text: m.text }))
    setMessages((prev) => [...prev, userMsg])
    setText('')
    setSending(true)
    setTimeout(() => {
      const replyText = generateRoleReply(role, msgText.trim(), brief, [
        ...historySnapshot,
        { id: `tmp-${Date.now()}`, author: 'matthew', text: msgText.trim() },
      ])
      const reply: Message = {
        id: `m-${Date.now() + 1}`,
        author: role,
        text: replyText,
      }
      setMessages((prev) => [...prev, reply])
      setSending(false)
    }, 1100)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="fixed inset-0 z-[60] bg-text-primary/30 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'fixed left-0 right-0 bottom-0 z-[60]',
                  'mx-auto w-full md:max-w-xl',
                  'glass-strong rounded-t-[20px] shadow-glass-hero',
                  'flex flex-col max-h-[75vh]',
                )}
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/40 shrink-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex items-center justify-center rounded-full size-10 font-semibold shrink-0 shadow-glow-accent ring-2 ring-white/60',
                      roleBg[colorRole],
                      isCfo ? 'text-text-primary' : 'text-white',
                      meta.initials.length > 1 ? 'text-xs' : 'text-base',
                    )}
                  >
                    {meta.initials}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Dialog.Title className="text-card-title-lg text-text-primary">
                      Tanya {meta.name}
                    </Dialog.Title>
                    <p className="text-meta text-text-muted truncate">Konteks: {brief.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Tutup"
                    className="size-8 rounded-full glass-soft inline-flex items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-meta text-text-muted">Pertanyaan cepat:</p>
                      {quickPrompts.default.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => send(p)}
                          className={cn(
                            'w-full text-left rounded-[12px] glass-soft px-3.5 py-2.5 text-sm text-text-primary',
                            'hover:bg-white/60 transition-colors duration-fast',
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <MessageBubble key={m.id} message={m} role={role} />
                    ))}
                  </AnimatePresence>
                  {sending && (
                    <div className="flex items-center gap-2 text-meta text-text-muted pl-12">
                      <span className="inline-flex gap-1">
                        <span className="size-1.5 rounded-full bg-text-muted animate-pulse" />
                        <span className="size-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0.15s' }} />
                        <span className="size-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0.3s' }} />
                      </span>
                      {meta.name} sedang mengetik...
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-white/40 bg-white/50 backdrop-blur-md px-4 py-3 pb-safe-bottom flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        send(text)
                      }
                    }}
                    placeholder={`Tanya ${meta.name}...`}
                    rows={1}
                    className={cn(
                      'flex-1 px-3.5 py-2.5 rounded-[12px] glass-soft text-sm text-text-primary',
                      'placeholder:text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      'resize-none max-h-32',
                    )}
                    style={{ minHeight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => send(text)}
                    disabled={!text.trim() || sending}
                    aria-label="Kirim"
                    className={cn(
                      'shrink-0 size-10 rounded-full inline-flex items-center justify-center transition-colors',
                      text.trim() && !sending
                        ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
                        : 'bg-bg-soft text-text-faint cursor-not-allowed',
                    )}
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function MessageBubble({ message, role }: { message: Message; role: Contributor }) {
  const isMatthew = message.author === 'matthew'
  const meta = !isMatthew ? CONTRIBUTOR_META[role] : null
  const colorRole = !isMatthew ? getContributorColorRole(role) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className={cn('flex gap-2.5', isMatthew && 'flex-row-reverse')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold shrink-0 size-8 text-sm',
          isMatthew
            ? 'bg-gradient-to-br from-accent to-accent-dark text-white'
            : cn(
                roleBg[colorRole!],
                colorRole === 'cfo' ? 'text-text-primary' : 'text-white',
                meta && meta.initials.length > 1 ? 'text-[11px]' : '',
              ),
        )}
      >
        {isMatthew ? 'M' : meta!.initials}
      </span>
      <div
        className={cn(
          'max-w-[78%] rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed',
          isMatthew ? 'bg-accent text-white shadow-glass' : 'glass-soft text-text-primary shadow-glass',
        )}
      >
        {message.text}
      </div>
    </motion.div>
  )
}


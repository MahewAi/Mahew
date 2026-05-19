import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, Sunrise, ArrowUpRight, Trash2 } from 'lucide-react'
import { loadStoredBriefs } from '@/lib/briefStore'
import { generateMockReply, type ChatMessage } from '@/lib/mockReplies'
import { cn } from '@/lib/utils'

interface AtmajaMessage extends ChatMessage {
  timeAgo: string
}

const STORAGE_KEY = 'gerai:atmaja-thread'

const initialThread: AtmajaMessage[] = [
  {
    id: 'a-init-1',
    author: 'ceo',
    text: 'Selamat datang, Matthew. Saya pantau Gerai 1000 Pintu dan sintesa harian. Ada yang perlu kita bahas hari ini?',
    timeAgo: '7:00 pagi',
  },
]

function loadThread(): AtmajaMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialThread
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as AtmajaMessage[]
  } catch {
    // ignore
  }
  return initialThread
}

function saveThread(messages: AtmajaMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)))
  } catch {
    // ignore (quota or disabled)
  }
}

const quickPrompts = [
  'Apa prioritas terpenting minggu ini?',
  'Beri saya sintesa kondisi Gerai sekarang.',
  'Apa keputusan yang paling tertunda?',
  'Skenario terburuk yang harus saya antisipasi?',
]

export default function Atmaja() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [messages, setMessages] = useState<AtmajaMessage[]>(() => loadThread())
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Persist thread to localStorage
  useEffect(() => {
    saveThread(messages)
  }, [messages])

  const handleReset = () => {
    setMessages(initialThread)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  // Briefs yang melibatkan Atmaja (CEO contributor)
  const atmajaBriefs = useMemo(
    () =>
      loadStoredBriefs()
        .filter((b) => b.contributors.includes('ceo'))
        .sort((a, b) => (a.isDailyDigest ? -1 : b.isDailyDigest ? 1 : 0))
        .slice(0, 4),
    [],
  )

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  const send = (msgText: string) => {
    if (!msgText.trim() || sending) return
    const userMsg: AtmajaMessage = {
      id: `m-${Date.now()}`,
      author: 'matthew',
      text: msgText.trim(),
      timeAgo: 'Baru saja',
    }
    const historySnapshot = messages
    setMessages((prev) => [...prev, userMsg])
    setText('')
    setSending(true)
    window.setTimeout(() => {
      const result = generateMockReply({
        userMessage: msgText.trim(),
        history: historySnapshot,
        speaker: 'atmaja',
      })

      if (result.resetThread) {
        // Replace thread with reset acknowledgment as first message
        setMessages([
          {
            id: `m-${Date.now() + 1}`,
            author: 'ceo',
            text: result.text,
            timeAgo: 'Baru saja',
          },
        ])
        setSending(false)
        return
      }

      const reply: AtmajaMessage = {
        id: `m-${Date.now() + 1}`,
        author: 'ceo',
        text: result.text,
        timeAgo: 'Baru saja',
      }
      setMessages((prev) => [...prev, reply])
      setSending(false)
    }, 1100)
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Hero header — Atmaja signature */}
      <header className="px-4 pt-safe-top pt-6 pb-4 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-20 right-0 size-72 rounded-full opacity-50 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--role-ceo) / 0.6), transparent 65%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-label-caps text-text-muted">CEO · Sintesis kepemimpinan</p>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset percakapan"
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full',
                  'glass-soft text-meta text-text-secondary hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <Trash2 aria-hidden="true" className="size-3" />
                Reset
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-2xl size-16 bg-role-ceo text-white shadow-glass-hero ring-2 ring-white/70',
                  'font-serif font-semibold text-3xl',
                )}
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                A
              </span>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 size-4 rounded-full bg-status-final ring-2 ring-bg-app shadow-[0_0_8px_rgba(61,111,88,0.6)]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-display text-text-primary title-chroma"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Atmaja
              </h1>
              <p className="mt-1 text-meta text-text-secondary">Sintesis kepemimpinan · Aktif sekarang</p>
            </div>
          </div>
        </div>
      </header>

      {/* Recent synthesis from Atmaja */}
      <section className="px-4 mt-2" aria-label="Sintesis Atmaja terkini">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-label-caps text-text-muted">Sintesis terkini</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-meta font-medium text-accent-dark hover:text-text-primary inline-flex items-center gap-1"
          >
            Semua brief <ArrowUpRight className="size-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {atmajaBriefs.map((b) => {
            const isDigest = b.isDailyDigest
            return (
              <motion.button
                key={b.id}
                type="button"
                onClick={() => navigate(`/brief/${b.id}`)}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -1 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'col-span-1 text-left rounded-[16px] p-3.5 shadow-glass min-h-[120px] flex flex-col',
                  isDigest ? 'glass-strong ring-1 ring-accent-light/60' : 'glass-soft',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                )}
              >
                {isDigest && (
                  <span className="inline-flex items-center gap-1.5 text-label-caps text-accent-dark mb-1.5">
                    <Sunrise aria-hidden="true" className="size-3" />
                    Laporan harian
                  </span>
                )}
                <h3 className="text-[13px] leading-[17px] font-semibold text-text-primary line-clamp-3">
                  {b.title}
                </h3>
                <p className="mt-auto pt-2 text-[10px] text-text-muted">{b.timeAgo}</p>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* Persistent conversation */}
      <section className="mt-6 px-4" aria-label="Percakapan dengan Atmaja">
        <p className="text-label-caps text-text-muted mb-3">Pesan langsung</p>

        <div
          ref={listRef}
          className="space-y-2.5 mb-3 max-h-[420px] overflow-y-auto rounded-[16px] glass-soft shadow-glass p-3"
        >
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} reduceMotion={!!reduceMotion} />
            ))}
          </AnimatePresence>
          {sending && (
            <div className="flex items-center gap-2 text-meta text-text-muted pl-12">
              <span className="inline-flex gap-1">
                <span className="size-1.5 rounded-full bg-text-muted animate-pulse" />
                <span
                  className="size-1.5 rounded-full bg-text-muted animate-pulse"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="size-1.5 rounded-full bg-text-muted animate-pulse"
                  style={{ animationDelay: '0.3s' }}
                />
              </span>
              Atmaja sedang menulis...
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="mb-3">
            <p className="text-meta text-text-muted mb-2 px-1">Pertanyaan cepat:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className={cn(
                    'rounded-full glass-soft px-3 py-1.5 text-xs font-medium text-text-primary',
                    'hover:bg-white/60 transition-colors duration-fast text-left',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass-strong rounded-[14px] shadow-glass p-2 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                send(text)
              }
            }}
            placeholder="Tanya Atmaja... (Cmd+Enter kirim)"
            rows={1}
            className={cn(
              'flex-1 px-2 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-faint',
              'focus:outline-none resize-none leading-relaxed max-h-32',
            )}
            style={{ minHeight: '36px' }}
          />
          <button
            type="button"
            onClick={() => send(text)}
            disabled={!text.trim() || sending}
            aria-label="Kirim ke Atmaja"
            className={cn(
              'shrink-0 size-9 rounded-full inline-flex items-center justify-center transition-colors duration-fast',
              text.trim() && !sending
                ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
                : 'bg-bg-soft text-text-faint cursor-not-allowed',
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </section>
    </div>
  )
}

function MessageBubble({ message, reduceMotion }: { message: AtmajaMessage; reduceMotion: boolean }) {
  const isMatthew = message.author === 'matthew'

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className={cn('flex gap-2.5 items-end', isMatthew && 'flex-row-reverse')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold shrink-0 size-8',
          isMatthew
            ? 'bg-gradient-to-br from-accent to-accent-dark text-white text-sm'
            : 'bg-role-ceo text-white font-serif text-base',
        )}
        style={!isMatthew ? { fontFamily: '"Cormorant Garamond", Georgia, serif' } : undefined}
      >
        {isMatthew ? 'M' : 'A'}
      </span>
      <div className={cn('max-w-[78%] min-w-0', isMatthew ? 'items-end' : 'items-start')}>
        {!isMatthew && (
          <p
            className="text-meta italic font-serif text-accent-dark mb-1 px-2"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            Atmaja
          </p>
        )}
        <div
          className={cn(
            'rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed',
            isMatthew
              ? 'bg-accent text-white shadow-glass'
              : 'bg-bg-elevated/80 text-text-primary shadow-glass border border-white/40',
          )}
        >
          {message.text}
        </div>
        <p className={cn('text-[10px] text-text-faint mt-1 px-2', isMatthew && 'text-right')}>
          {message.timeAgo}
        </p>
      </div>
    </motion.div>
  )
}

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, Sunrise, ArrowUpRight, Trash2, ChevronDown } from 'lucide-react'
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
  const [quickOpen, setQuickOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveThread(messages)
  }, [messages])

  const handleReset = () => {
    setMessages(initialThread)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-32 pt-safe-top sm:px-6 lg:px-8">
      <header className="relative pb-5 pt-6">
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-label-caps text-text-muted">CEO · Sintesis kepemimpinan</p>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset percakapan"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5',
                  'glass-soft text-meta text-text-secondary hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <Trash2 aria-hidden="true" className="size-3" />
                Reset
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="relative shrink-0">
              <span
                className={cn(
                  'inline-flex size-[72px] items-center justify-center rounded-[22px] bg-role-ceo text-white shadow-glass-hero ring-2 ring-white/70',
                  'font-serif text-3xl font-semibold',
                )}
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                A
              </span>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 size-4 rounded-full bg-status-final shadow-[0_0_8px_rgba(61,111,88,0.6)] ring-2 ring-bg-app"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[40px] font-black leading-[42px] tracking-[-0.03em] text-text-primary sm:text-[48px] sm:leading-[50px]">
                Atmaja
              </h1>
              <p className="mt-1 text-sm font-semibold text-text-secondary">Sintesis kepemimpinan · Aktif sekarang</p>
            </div>
          </div>
        </div>
      </header>

      {atmajaBriefs.length > 0 && (
        <section className="mt-1" aria-label="Sintesis Atmaja terkini">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-label-caps text-text-muted">Sintesis terkini</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-meta font-bold text-accent-dark hover:text-text-primary"
            >
              Semua brief <ArrowUpRight className="size-3" />
            </button>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {atmajaBriefs.map((b) => {
              const isDigest = b.isDailyDigest
              return (
                <motion.button
                  key={b.id}
                  type="button"
                  onClick={() => navigate(`/brief/${b.id}`)}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                  className={cn(
                    'min-h-[104px] rounded-lg p-3.5 text-left shadow-card',
                    isDigest ? 'bg-white/78 ring-1 ring-accent-light/70' : 'bg-white/58',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  )}
                >
                  {isDigest && (
                    <span className="mb-1.5 inline-flex items-center gap-1.5 text-label-caps text-accent-dark">
                      <Sunrise aria-hidden="true" className="size-3" />
                      Laporan harian
                    </span>
                  )}
                  <h3 className="line-clamp-3 text-[13px] font-bold leading-[17px] text-text-primary">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-[10px] text-text-muted">{b.timeAgo}</p>
                </motion.button>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-5" aria-label="Percakapan dengan Atmaja">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-label-caps text-text-muted">Pesan langsung</p>
            <p className="mt-1 text-xs font-semibold text-text-secondary">Ruang bicara Matthew dan Atmaja.</p>
          </div>
        </div>

        <div
          ref={listRef}
          className="mb-4 max-h-[calc(100vh-360px)] space-y-4 overflow-y-auto px-1 pb-2 pt-1 sm:max-h-[520px]"
        >
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} reduceMotion={!!reduceMotion} />
            ))}
          </AnimatePresence>

          {sending && (
            <div className="flex items-center gap-2 pl-12 text-meta text-text-muted">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-text-muted" />
                <span
                  className="size-1.5 animate-pulse rounded-full bg-text-muted"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="size-1.5 animate-pulse rounded-full bg-text-muted"
                  style={{ animationDelay: '0.3s' }}
                />
              </span>
              Atmaja sedang menulis...
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setQuickOpen((open) => !open)}
              className={cn(
                'inline-flex min-h-touch items-center gap-2 rounded-md border border-border-med bg-white px-3 text-xs font-extrabold text-text-primary shadow-soft',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
              aria-expanded={quickOpen}
            >
              Contoh pertanyaan
              <ChevronDown className={cn('size-3.5 transition-transform duration-fast', quickOpen && 'rotate-180')} />
            </button>
            {quickOpen && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className={cn(
                      'rounded-md bg-white/72 px-3 py-2.5 text-left text-xs font-bold leading-4 text-text-primary shadow-soft',
                      'transition-colors duration-fast hover:bg-white',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-24 z-20 flex items-end gap-2 rounded-[22px] border border-white/75 bg-white/76 p-2 shadow-pop backdrop-blur-xl">
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
              'max-h-32 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-text-primary placeholder:text-text-faint',
              'focus:outline-none',
            )}
            style={{ minHeight: '44px' }}
          />
          <button
            type="button"
            onClick={() => send(text)}
            disabled={!text.trim() || sending}
            aria-label="Kirim ke Atmaja"
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
              text.trim() && !sending
                ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
                : 'bg-bg-soft text-text-faint cursor-not-allowed',
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </section>
    </main>
  )
}

function MessageBubble({ message, reduceMotion }: { message: AtmajaMessage; reduceMotion: boolean }) {
  const isMatthew = message.author === 'matthew'

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className={cn('flex items-end gap-2.5', isMatthew && 'flex-row-reverse')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-full font-semibold shadow-soft',
          isMatthew
            ? 'bg-gradient-to-br from-accent to-accent-dark text-sm text-white'
            : 'bg-role-ceo font-serif text-base text-white',
        )}
        style={!isMatthew ? { fontFamily: '"Cormorant Garamond", Georgia, serif' } : undefined}
      >
        {isMatthew ? 'M' : 'A'}
      </span>

      <div className={cn('min-w-0 max-w-[min(86%,760px)]', isMatthew ? 'items-end' : 'items-start')}>
        {!isMatthew && (
          <p
            className="mb-1 px-1 text-meta font-bold text-accent-dark"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            Atmaja
          </p>
        )}
        <div
          className={cn(
            'px-4 py-3 text-[15px] leading-relaxed shadow-card',
            isMatthew
              ? 'rounded-[18px] rounded-br-md bg-accent text-white'
              : 'rounded-[18px] rounded-bl-md bg-white/82 text-text-primary',
          )}
        >
          {message.text}
        </div>
        <p className={cn('mt-1 px-1 text-[10px] text-text-faint', isMatthew && 'text-right')}>
          {message.timeAgo}
        </p>
      </div>
    </motion.div>
  )
}

import { useState, useMemo, useRef, useEffect, useCallback, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, Sunrise, ArrowUpRight, Trash2, ChevronDown, FileText, Image as ImageIcon, Loader2, Paperclip, UploadCloud, X } from 'lucide-react'
import { loadStoredBriefs } from '@/lib/briefStore'
import { recordInteractionLessons } from '@/lib/learningMemory'
import { isAtmajaRemoteBridgeAllowed, requestAtmajaReply } from '@/lib/atmajaClient'
import { generateMockReply, type ChatMessage } from '@/lib/mockReplies'
import { shouldRepairAtmajaReply } from '@/lib/atmajaSystem'
import { cn } from '@/lib/utils'

type AttachmentKind = 'image' | 'text' | 'document'
type AtmajaVisualKind = 'palette' | 'generated-image'

interface AtmajaVisualColor {
  name: string
  hex: string
  role: string
}

interface AtmajaVisual {
  id: string
  kind: AtmajaVisualKind
  title: string
  caption: string
  imageDataUri: string
  prompt?: string
  colors?: AtmajaVisualColor[]
}

interface AtmajaAttachment {
  id: string
  name: string
  type: string
  size: number
  kind: AttachmentKind
  previewText?: string
  /** Base64 raw bytes (no data: prefix). Hanya untuk image kecil yang akan dikirim ke remote. */
  dataBase64?: string
  note?: string
}

interface AtmajaMessage extends ChatMessage {
  timeAgo: string
  attachments?: AtmajaAttachment[]
  visuals?: AtmajaVisual[]
}

const STORAGE_KEY = 'gerai:atmaja-thread'
const MAX_ATTACHMENTS = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_PREVIEW_CHARS = 30_000
// Cap untuk image yang dikirim inline ke server (~1.5 MB raw → ~2 MB base64).
// Lebih besar dari ini → tetap ditampilkan sebagai metadata, Atmaja tidak akan lihat isinya.
const MAX_IMAGE_INLINE_BYTES = 1_572_864
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
const REPLY_DELAY_MS = 1100
const textAttachmentExtensions = new Set(['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml'])
const paletteVisualColors: AtmajaVisualColor[] = [
  { name: 'Brass gold', hex: '#B8956B', role: 'Signature accent' },
  { name: 'Deep charcoal', hex: '#1F1A14', role: 'Authority base' },
  { name: 'Warm ivory', hex: '#FAF8F4', role: 'Clean support' },
]

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50).map(stripMessageForStorage)))
  } catch {
    // ignore (quota or disabled)
  }
}

function stripMessageForStorage(message: AtmajaMessage): AtmajaMessage {
  return {
    ...message,
    attachments: message.attachments?.map(stripAttachmentForStorage),
  }
}

function stripAttachmentForStorage(attachment: AtmajaAttachment): AtmajaAttachment {
  const stored = { ...attachment }
  delete stored.previewText
  // Jangan simpan bytes mentah di localStorage — bisa membengkak cepat.
  delete stored.dataBase64
  return stored
}

const quickPrompts = [
  'Apa prioritas terpenting minggu ini?',
  'Beri saya sintesa kondisi Gerai sekarang.',
  'Apa keputusan yang paling tertunda?',
  'Skenario terburuk yang harus saya antisipasi?',
]

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function getAttachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('text/') || textAttachmentExtensions.has(getFileExtension(file.name))) return 'text'
  return 'document'
}

async function readFileAsBase64(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
    }
    return typeof btoa === 'function' ? btoa(binary) : null
  } catch {
    return null
  }
}

async function buildAttachment(file: File): Promise<AtmajaAttachment> {
  const kind = getAttachmentKind(file)
  const base: AtmajaAttachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.type || getFileExtension(file.name).toUpperCase() || 'file',
    size: file.size,
    kind,
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ...base,
      note: `File terlalu besar untuk dibaca lokal (${formatFileSize(file.size)}). Maks ${formatFileSize(MAX_FILE_BYTES)}.`,
    }
  }

  // Image: kalau MIME didukung vision dan ukuran di bawah cap inline, kirim base64 ke Atmaja.
  if (kind === 'image') {
    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return {
        ...base,
        note: `Format gambar belum didukung vision (${mime || 'unknown'}). Kirim JPG/PNG/WEBP/GIF supaya Atmaja bisa lihat.`,
      }
    }
    if (file.size > MAX_IMAGE_INLINE_BYTES) {
      return {
        ...base,
        note: `Gambar > ${formatFileSize(MAX_IMAGE_INLINE_BYTES)}, terlalu besar untuk dikirim ke Atmaja. Kompres/resize dulu supaya Atmaja bisa lihat isinya.`,
      }
    }
    const dataBase64 = await readFileAsBase64(file)
    if (!dataBase64) {
      return { ...base, note: 'Gagal membaca gambar sebagai data byte.' }
    }
    return {
      ...base,
      dataBase64,
      note: 'Gambar dikirim ke Atmaja (vision aktif).',
    }
  }

  if (kind !== 'text') {
    return {
      ...base,
      note: 'Dokumen diterima sebagai metadata. Untuk dianalisis isinya, ekstrak atau paste isi ke chat.',
    }
  }

  try {
    const previewText = await file.slice(0, MAX_TEXT_PREVIEW_CHARS).text()
    return {
      ...base,
      previewText,
      note: previewText.length > 0
        ? `Cuplikan ${previewText.length.toLocaleString()} karakter dikirim ke Atmaja.`
        : 'File teks kosong.',
    }
  } catch {
    return {
      ...base,
      note: 'File diterima, tapi cuplikan teks tidak bisa dibaca.',
    }
  }
}

function buildDefaultAttachmentText(attachments: AtmajaAttachment[]) {
  const names = attachments.map((attachment) => attachment.name).join(', ')
  return `Saya kirim file ke Atmaja: ${names}`
}

function buildAttachmentPrompt(text: string, attachments: AtmajaAttachment[]) {
  if (attachments.length === 0) return text

  const summaries = attachments
    .map((attachment) => {
      const header = `- ${attachment.name} (${formatFileSize(attachment.size)}, ${attachment.type})`
      if (!attachment.previewText) return `${header}\n  Catatan: ${attachment.note ?? 'Isi file belum diekstrak.'}`
      return `${header}\n  [Cuplikan isi file]\n  ${attachment.previewText}`
    })
    .join('\n')

  return `${text}\n\n[Lampiran lokal untuk Atmaja]\n${summaries}`
}

function escapeSvgText(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&apos;'
  })
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildPaletteImageDataUri(colors: AtmajaVisualColor[]) {
  const swatches = colors
    .map((color, index) => {
      const x = 46 + index * 184
      const labelFill = color.hex.toLowerCase() === '#faf8f4' ? '#1F1A14' : '#FAF8F4'
      return `
        <rect x="${x}" y="96" width="150" height="138" rx="22" fill="${color.hex}" />
        <text x="${x + 18}" y="158" fill="${labelFill}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800">${escapeSvgText(color.name)}</text>
        <text x="${x + 18}" y="184" fill="${labelFill}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">${escapeSvgText(color.hex)}</text>
        <text x="${x + 18}" y="210" fill="${labelFill}" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" opacity="0.82">${escapeSvgText(color.role)}</text>
      `
    })
    .join('')

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="Gerai premium palette preview">
      <rect width="640" height="360" rx="34" fill="#FAF8F4" />
      <rect x="24" y="24" width="592" height="312" rx="28" fill="#1F1A14" />
      <text x="46" y="62" fill="#FAF8F4" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" letter-spacing="2">ATMAJA VISUAL PREVIEW</text>
      <text x="46" y="86" fill="#B8956B" font-family="Georgia, serif" font-size="27" font-weight="800">Premium Gerai/GSP palette</text>
      ${swatches}
      <path d="M46 278 H594" stroke="#B8956B" stroke-width="2" opacity="0.5" />
      <text x="46" y="310" fill="#FAF8F4" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">Core pairing: Brass gold + Deep charcoal. Ivory stays as breathable support.</text>
    </svg>
  `)
}

function buildPaletteVisual(): AtmajaVisual {
  return {
    id: `vis-palette-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'palette',
    title: 'Premium palette preview',
    caption: 'Visual referensi 3 warna brand Gerai/GSP yang Atmaja sebut di reply.',
    imageDataUri: buildPaletteImageDataUri(paletteVisualColors),
    colors: paletteVisualColors,
  }
}

// Palette card HANYA muncul kalau reply text benar-benar merekomendasikan 3 hex code Gerai brand.
// Sebelumnya keyword-based ("warna" → langsung render) → misleading karena fire walau Atmaja bilang
// "saya tidak bisa lihat file". Sekarang harus ada minimal 2 dari 3 hex Gerai DI DALAM teks reply.
function shouldBuildPaletteVisual(replyText: string) {
  const hexHits = [/#B8956B/i, /#1F1A14/i, /#FAF8F4/i].filter((re) => re.test(replyText)).length
  return hexHits >= 2
}

function buildVisualsForReply(_userText: string, replyText: string): AtmajaVisual[] {
  // Catatan: buildGeneratedVisual lama sengaja dihapus dari pipeline auto-render.
  // SVG generic "INPUT → ATMAJA → C-LEVEL → OUT" tidak punya nilai informasional, hanya dekoratif,
  // dan membuat reply seolah-olah berisi visual real padahal tidak.
  if (shouldBuildPaletteVisual(replyText)) return [buildPaletteVisual()]
  return []
}

function withVisualFollowUp(text: string, _userText: string, visuals: AtmajaVisual[]) {
  if (/preview visual|versi gambar|moodboard/i.test(text)) return text
  if (visuals.length > 0) {
    return `${text}\n\nPalette di bawah saya render sebagai referensi visual brand-nya.`
  }
  // Sengaja TIDAK menawarkan "mau saya tampilkan sebagai visual?" — kemampuan generate
  // gambar belum ada, jadi tawaran itu janji palsu.
  return text
}

function upgradeActionableReplies(messages: AtmajaMessage[]) {
  let upgradedMessages = messages

  for (let index = 0; index < messages.length - 1; index += 1) {
    const userMessage = messages[index]
    const replyMessage = messages[index + 1]

    if (
      userMessage.author === 'matthew' &&
      replyMessage.author === 'ceo' &&
      shouldRepairAtmajaReply(userMessage.text, replyMessage.text, (replyMessage.visuals?.length ?? 0) > 0)
    ) {
      if (upgradedMessages === messages) upgradedMessages = [...messages]
      const modelText = buildAttachmentPrompt(userMessage.text, userMessage.attachments ?? [])
      const result = generateMockReply({
        userMessage: modelText,
        history: upgradedMessages.slice(0, index),
        speaker: 'atmaja',
      })
      const visuals = buildVisualsForReply(modelText, result.text)
      upgradedMessages[index + 1] = {
        ...replyMessage,
        text: withVisualFollowUp(result.text, modelText, visuals),
        visuals,
      }
    }
  }

  return upgradedMessages
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes('Files')
}

export default function Atmaja() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [messages, setMessages] = useState<AtmajaMessage[]>(() => loadThread())
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<AtmajaAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [readingFiles, setReadingFiles] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [sending, setSending] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const pendingReplyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    saveThread(messages)
  }, [messages])

  useEffect(() => {
    const upgradedMessages = upgradeActionableReplies(messages)
    if (upgradedMessages !== messages) setMessages(upgradedMessages)
  }, [messages])

  useEffect(() => {
    return () => {
      if (pendingReplyTimerRef.current !== null) {
        window.clearTimeout(pendingReplyTimerRef.current)
      }
    }
  }, [])

  const scheduleAtmajaReply = useCallback((historySnapshot: AtmajaMessage[], userMsg: AtmajaMessage, delay = REPLY_DELAY_MS) => {
    if (pendingReplyTimerRef.current !== null) {
      window.clearTimeout(pendingReplyTimerRef.current)
    }

    setSending(true)
    pendingReplyTimerRef.current = window.setTimeout(() => {
      void (async () => {
        pendingReplyTimerRef.current = null
        const modelText = buildAttachmentPrompt(userMsg.text, userMsg.attachments ?? [])
        const remoteResult = await requestAtmajaReply({
          userMessage: userMsg.text,
          history: historySnapshot,
          attachments: userMsg.attachments?.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            kind: attachment.kind,
            note: attachment.note,
            // Sertakan bytes/preview supaya Atmaja BISA lihat (vision) dan baca isi teks.
            dataBase64: attachment.dataBase64,
            previewText: attachment.previewText,
          })),
        })
        const result =
          remoteResult ??
          generateMockReply({
            userMessage: modelText,
            history: historySnapshot,
            speaker: 'atmaja',
          })

        if ('resetThread' in result && result.resetThread) {
          const resetMessages: AtmajaMessage[] = [
            {
              id: `m-${Date.now() + 1}`,
              author: 'ceo',
              text: result.text,
              timeAgo: 'Baru saja',
            },
          ]
          saveThread(resetMessages)
          setMessages(resetMessages)
          setSending(false)
          return
        }

        const visuals = buildVisualsForReply(modelText, result.text)
        const reply: AtmajaMessage = {
          id: `m-${Date.now() + 1}`,
          author: 'ceo',
          text: withVisualFollowUp(result.text, modelText, visuals),
          timeAgo: 'Baru saja',
        }
        if (visuals.length > 0) reply.visuals = visuals

        setMessages((prev) => {
          const userIndex = prev.findIndex((message) => message.id === userMsg.id)
          if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
          const nextMessages = [...prev, reply]
          saveThread(nextMessages)
          return nextMessages
        })
        setSending(false)
      })()
    }, delay)
  }, [])

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.author !== 'matthew' || sending) return
    scheduleAtmajaReply(messages.slice(0, -1), lastMessage, 350)
  }, [messages, scheduleAtmajaReply, sending])

  const handleReset = () => {
    setMessages(initialThread)
    setAttachments([])
    setAttachmentError('')
    setDraggingFiles(false)
    dragDepthRef.current = 0
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
  const remoteBridgeAllowed = isAtmajaRemoteBridgeAllowed()

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  const handleFileSelect = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (selectedFiles.length === 0 || readingFiles) return

    const remainingSlots = MAX_ATTACHMENTS - attachments.length
    if (remainingSlots <= 0) {
      setAttachmentError(`Maksimal ${MAX_ATTACHMENTS} file per pesan.`)
      return
    }

    setReadingFiles(true)
    setAttachmentError(selectedFiles.length > remainingSlots ? `Hanya ${remainingSlots} file pertama yang ditambahkan.` : '')

    try {
      const nextAttachments = await Promise.all(selectedFiles.slice(0, remainingSlots).map(buildAttachment))
      setAttachments((current) => [...current, ...nextAttachments])
    } finally {
      setReadingFiles(false)
    }
  }

  const handleComposerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setDraggingFiles(true)
  }

  const handleComposerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDraggingFiles(true)
  }

  const handleComposerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDraggingFiles(false)
  }

  const handleComposerDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current = 0
    setDraggingFiles(false)
    void handleFileSelect(event.dataTransfer.files)
  }

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
    setAttachmentError('')
  }

  const send = (msgText: string) => {
    if ((!msgText.trim() && attachments.length === 0) || sending || readingFiles) return
    const trimmed = msgText.trim()
    const outgoingAttachments = attachments
    const displayText = trimmed || buildDefaultAttachmentText(outgoingAttachments)
    const userMsg: AtmajaMessage = {
      id: `m-${Date.now()}`,
      author: 'matthew',
      text: displayText,
      timeAgo: 'Baru saja',
      attachments: outgoingAttachments,
    }
    const historySnapshot = messages
    recordInteractionLessons(displayText, { type: 'atmaja-chat', author: 'matthew' })
    const nextMessages = [...messages, userMsg]
    saveThread(nextMessages)
    setMessages(nextMessages)
    setText('')
    setAttachments([])
    setAttachmentError('')
    scheduleAtmajaReply(historySnapshot, userMsg)
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
              <p className="mt-1 text-sm font-semibold text-text-secondary">
                Sintesis kepemimpinan - {remoteBridgeAllowed ? 'OpenRouter bridge diizinkan' : 'Mode lokal aman'}
              </p>
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

        <div
          className={cn(
            'sticky bottom-24 z-20 rounded-[22px] border bg-white/76 p-2 shadow-pop backdrop-blur-xl transition-colors duration-fast',
            draggingFiles ? 'border-accent bg-accent-bg/85 ring-2 ring-accent/25' : 'border-white/75',
          )}
          onDragEnter={handleComposerDragEnter}
          onDragOver={handleComposerDragOver}
          onDragLeave={handleComposerDragLeave}
          onDrop={handleComposerDrop}
        >
          {draggingFiles && (
            <div className="mb-2 flex min-h-12 items-center gap-2 rounded-md border border-dashed border-accent bg-white/72 px-3 text-xs font-extrabold text-accent-dark">
              <UploadCloud className="size-4" />
              Lepas file untuk lampirkan ke Atmaja
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  attachment={attachment}
                  removable
                  onRemove={() => removeAttachment(attachment.id)}
                />
              ))}
            </div>
          )}

          {attachmentError && <p className="mb-2 px-2 text-[11px] font-bold text-status-review">{attachmentError}</p>}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              accept=".txt,.md,.csv,.json,.log,.xml,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(event) => {
                void handleFileSelect(event.target.files)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || readingFiles}
              aria-label="Lampirkan file untuk Atmaja"
              className={cn(
                'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                sending || readingFiles
                  ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                  : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              {readingFiles ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send(text)
                }
              }}
              placeholder={attachments.length > 0 ? 'Tambah catatan untuk file...' : 'Tanya Atmaja... (Cmd+Enter kirim)'}
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
              disabled={(!text.trim() && attachments.length === 0) || sending || readingFiles}
              aria-label="Kirim ke Atmaja"
              className={cn(
                'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                (text.trim() || attachments.length > 0) && !sending && !readingFiles
                  ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
                  : 'bg-bg-soft text-text-faint cursor-not-allowed',
              )}
            >
              <Send className="size-4" />
            </button>
          </div>
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
            'whitespace-pre-line',
            isMatthew
              ? 'rounded-[18px] rounded-br-md bg-accent text-white'
              : 'rounded-[18px] rounded-bl-md bg-white/82 text-text-primary',
          )}
        >
          {message.text}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 grid gap-2">
              {message.attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} compact />
              ))}
            </div>
          )}
        </div>
        {message.visuals && message.visuals.length > 0 && (
          <div className="mt-2 grid gap-2">
            {message.visuals.map((visual) => (
              <AtmajaVisualCard key={visual.id} visual={visual} />
            ))}
          </div>
        )}
        <p className={cn('mt-1 px-1 text-[10px] text-text-faint', isMatthew && 'text-right')}>
          {message.timeAgo}
        </p>
      </div>
    </motion.div>
  )
}

function AtmajaVisualCard({ visual }: { visual: AtmajaVisual }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border-soft bg-white/86 text-text-primary shadow-card">
      <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <ImageIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black">{visual.title}</p>
          <p className="truncate text-[10px] font-bold text-text-muted">
            {visual.kind === 'palette' ? 'Palette image' : 'Generated visual draft'}
          </p>
        </div>
      </div>
      <img
        src={visual.imageDataUri}
        alt={visual.caption}
        loading="lazy"
        className="block aspect-video w-full bg-bg-soft object-cover"
      />
      <figcaption className="px-3 py-2 text-xs font-semibold leading-relaxed text-text-secondary">
        {visual.caption}
      </figcaption>
      {visual.colors && visual.colors.length > 0 && (
        <div className="grid grid-cols-3 gap-px border-t border-border-soft bg-border-soft">
          {visual.colors.map((color) => (
            <div key={color.hex} className="min-w-0 bg-white px-2 py-2">
              <span
                aria-hidden="true"
                className="mb-1.5 block h-6 rounded-md border border-black/5"
                style={{ backgroundColor: color.hex }}
              />
              <p className="truncate text-[10px] font-black text-text-primary">{color.name}</p>
              <p className="truncate text-[9px] font-bold text-text-muted">{color.hex}</p>
            </div>
          ))}
        </div>
      )}
    </figure>
  )
}

function AttachmentChip({
  attachment,
  removable = false,
  compact = false,
  onRemove,
}: {
  attachment: AtmajaAttachment
  removable?: boolean
  compact?: boolean
  onRemove?: () => void
}) {
  const Icon = attachment.kind === 'image' ? ImageIcon : FileText

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left',
        compact ? 'border-white/25 bg-white/15 text-white' : 'border-border-soft bg-white/82 text-text-primary shadow-soft',
      )}
    >
      <span
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-md',
          compact ? 'bg-white/18 text-white' : 'bg-accent-bg text-accent-dark',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[12px] font-extrabold', compact ? 'text-white' : 'text-text-primary')}>
          {attachment.name}
        </p>
        <p className={cn('truncate text-[10px] font-semibold', compact ? 'text-white/72' : 'text-text-muted')}>
          {formatFileSize(attachment.size)} / {attachment.note ?? attachment.type}
        </p>
      </div>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus ${attachment.name}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

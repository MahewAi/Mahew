import { useState, useMemo, useRef, useEffect, useCallback, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, Sunrise, ArrowUpRight, Trash2, ChevronDown, FileText, Image as ImageIcon, Loader2, Paperclip, UploadCloud, X, Library, BookOpen, Plus, Sparkles, Check, AlertTriangle, Mic, MicOff, Camera, CalendarClock, Pause, Play } from 'lucide-react'
import { loadStoredBriefs } from '@/lib/briefStore'
import { recordInteractionLessons } from '@/lib/learningMemory'
import { isAtmajaRemoteBridgeAllowed, requestAtmajaReplyWithError } from '@/lib/atmajaClient'
import { MarkdownBlock } from '@/components/blocks/MarkdownBlock'
import {
  fetchServerHealth,
  listLibraryFiles,
  uploadLibraryFile,
  deleteLibraryFile,
  formatFileSize as formatLibFileSize,
  formatUploadedAt as formatLibUploadedAt,
  type AtmajaLibraryFile,
  type AtmajaServerCapabilities,
  type AtmajaServerWarning,
} from '@/lib/atmajaFilesClient'
import {
  listProposals,
  approveProposal,
  rejectProposal,
  formatProposalTypeLabel,
  formatProposalDate,
  type AtmajaProposal,
} from '@/lib/atmajaProposalsClient'
import {
  listSchedules,
  createSchedule,
  pauseSchedule,
  resumeSchedule,
  deleteSchedule,
  parseScheduleMarkers,
  formatScheduleDate,
  type AtmajaSchedule,
} from '@/lib/atmajaSchedulerClient'
import { browseUrl, parseBrowseCommand, buildBrowseMessage } from '@/lib/atmajaBrowseClient'
import { parseInsightMarkers } from '@/lib/atmajaInsightClient'
import { exportMessageAsPdf } from '@/lib/exportPdf'
import {
  parseDocMarkers,
  estimateDocSize,
  countWords,
  userWantsPdf,
  isRefusalResponse,
  stripRefusalText,
  synthesizeDocFromResponse,
  looksLikeDocumentResponse,
  extractDocumentContent,
  type AtmajaDoc,
} from '@/lib/atmajaDocClient'
import { generateImage, parseImageCommand, type OpenAIImageModel } from '@/lib/openaiImageClient'
import { generateVideo, parseVideoCommand, type OpenAIVideoModel } from '@/lib/openaiVideoClient'
import { type ChatMessage } from '@/lib/mockReplies'
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

interface AtmajaVideo {
  id: string
  title: string
  caption: string
  /** URL ke /api/openai/video/content?id=xxx, pasang langsung ke <video src=...>. */
  contentUrl: string
  prompt: string
  model: OpenAIVideoModel
  size: string
  seconds: string
}

interface AtmajaMessage extends ChatMessage {
  timeAgo: string
  attachments?: AtmajaAttachment[]
  visuals?: AtmajaVisual[]
  videos?: AtmajaVideo[]
  /** PDF/dokumen yang Atmaja generate via [ATMAJA_DOC] marker */
  documents?: AtmajaDoc[]
}

const STORAGE_KEY = 'gerai:atmaja-thread'
const MAX_ATTACHMENTS = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_PREVIEW_CHARS = 30_000
// Cap untuk image yang dikirim inline ke server (~1.5 MB raw → ~2 MB base64).
// Lebih besar dari ini → tetap ditampilkan sebagai metadata, Atmaja tidak akan lihat isinya.
const MAX_IMAGE_INLINE_BYTES = 1_572_864
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
// Cap untuk PDF yang dikirim inline (~2.5 MB raw → ~3.4 MB base64). Server cap 3.5 MB base64.
// Vercel body cap 4.3 MB, jadi sisakan buffer untuk text + history.
const MAX_PDF_INLINE_BYTES = 2_621_440
const ALLOWED_PDF_MIME = new Set(['application/pdf'])
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

function saveThread(messages: AtmajaMessage[]): { ok: boolean; error?: string } {
  try {
    // 300 pesan terakhir disimpan client-side. PDF base64 + previewText sudah di-strip
    // di stripAttachmentForStorage, jadi quota localStorage aman (text 300 pesan ~600 KB).
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-300).map(stripMessageForStorage)))
    return { ok: true }
  } catch (err) {
    // FIX (CRITICAL #2): expose error supaya UI bisa kasih feedback ke user
    // (quota exceeded, localStorage disabled di private mode, dll)
    const errorMsg = err instanceof Error ? err.message : 'storage_unknown'
    console.error('[saveThread] failed:', errorMsg)
    return { ok: false, error: errorMsg }
  }
}

// FIX (CRITICAL #2): wrapper supaya callers tidak crash + bisa optional toast
function saveThreadSafe(messages: AtmajaMessage[]): boolean {
  const result = saveThread(messages)
  if (!result.ok) {
    // Mute toast spam — log only. UI tetap render messages via React state.
    console.warn('[saveThread] localStorage save failed:', result.error, '(messages still in React state)')
  }
  return result.ok
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

// FASE 3 UX: Capability cards untuk showcase fitur Atmaja ke user baru.
// Sama dengan pattern Claude.ai empty state — capabilities + suggested prompts visible.
const capabilityCards = [
  {
    title: 'Buatkan PDF',
    description: 'Atmaja generate file PDF langsung di chat',
    example: 'Buatkan saya PDF strategi pricing premium untuk produk lokal Bali',
  },
  {
    title: 'Jadwalkan reminder',
    description: 'NL Scheduler auto-create task recurring',
    example: 'Ingatkan saya review brief tiap Senin pagi',
  },
  {
    title: 'Research web',
    description: 'Browse URL untuk analisis kompetitor + market',
    example: '/browse https://kompetitor.com analisis positioning mereka',
  },
  {
    title: 'Analisis dokumen',
    description: 'Lampirkan PDF, image, atau text — Atmaja baca isinya',
    example: 'Klik icon attachment, upload PDF, lalu tanya konten-nya',
  },
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

  if (kind === 'document') {
    const mime = (file.type || '').toLowerCase()
    const ext = getFileExtension(file.name)
    const isPdf = ALLOWED_PDF_MIME.has(mime) || ext === 'pdf'

    if (isPdf) {
      if (file.size > MAX_PDF_INLINE_BYTES) {
        return {
          ...base,
          note: `PDF > ${formatFileSize(MAX_PDF_INLINE_BYTES)}, terlalu besar untuk dikirim inline. Pecah file atau extract section utama dulu.`,
        }
      }
      const dataBase64 = await readFileAsBase64(file)
      if (!dataBase64) {
        return { ...base, note: 'Gagal membaca PDF sebagai data byte.' }
      }
      return {
        ...base,
        dataBase64,
        note: 'PDF dikirim ke Atmaja (native PDF reading aktif).',
      }
    }

    return {
      ...base,
      note: 'Dokumen diterima sebagai metadata. Format docx/xlsx belum didukung native — extract atau paste isi ke chat.',
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

function buildVisualsForReply(
  _userText: string,
  replyText: string,
  userAttachments: AtmajaAttachment[] = [],
): AtmajaVisual[] {
  // Catatan: buildGeneratedVisual lama sengaja dihapus dari pipeline auto-render.
  // SVG generic "INPUT → ATMAJA → C-LEVEL → OUT" tidak punya nilai informasional, hanya dekoratif,
  // dan membuat reply seolah-olah berisi visual real padahal tidak.
  //
  // Aturan palette card: HANYA render kalau (a) reply text benar-benar menyebut ≥2 hex Gerai
  // DAN (b) user message TIDAK ada attachment apa-apa. Kalau user upload file (zip/foto/dll),
  // jangan auto-render palette brand Gerai — itu jadi seperti Atmaja "menjawab" file kamu padahal
  // mungkin hanya kebetulan menyebut warna brand di teks reply.
  if (userAttachments.length > 0) return []
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
  // Lapis 3: file library state (persistent PDFs di Vercel Blob)
  const [serverCaps, setServerCaps] = useState<AtmajaServerCapabilities | null>(null)
  const [serverWarnings, setServerWarnings] = useState<AtmajaServerWarning[]>([])
  const [warningsDismissed, setWarningsDismissed] = useState<Set<string>>(new Set())
  const [libraryFiles, setLibraryFiles] = useState<AtmajaLibraryFile[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryUploading, setLibraryUploading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [attachedLibraryIds, setAttachedLibraryIds] = useState<string[]>([])
  // Skill Proposals state (foundation Self-Evolving Atmaja)
  const [proposals, setProposals] = useState<AtmajaProposal[]>([])
  const [proposalsOpen, setProposalsOpen] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')

  // NL Scheduler (Hermes-inspired automation)
  const [schedules, setSchedules] = useState<AtmajaSchedule[]>([])
  const [schedulesOpen, setSchedulesOpen] = useState(false)
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  // Browse status untuk show progress saat /browse fetch URL
  const [browsing, setBrowsing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryUploadRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const pendingReplyTimerRef = useRef<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const voiceRecognitionRef = useRef<unknown>(null)

  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)

  // Mobile keyboard handling — visualViewport API set --keyboard-h CSS variable.
  // Saat keyboard open di iOS/Android, composer bar auto-naik supaya tetap visible.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height)
      document.documentElement.style.setProperty('--keyboard-h', `${offset}px`)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.documentElement.style.setProperty('--keyboard-h', '0px')
    }
  }, [])

  // Detect Web Speech API support (Chrome desktop + Android, Safari iOS 14.5+).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setVoiceSupported(Boolean(W.SpeechRecognition || W.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    saveThread(messages)
  }, [messages])

  // Lapis 3: load server capabilities + library files on mount.
  // Plus auto-detect kalau service worker cache stale (response empty padahal capability live)
  // dan otomatis suggest force reload tanpa user harus tau teknis.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const snap = await fetchServerHealth()
      if (cancelled) return
      const caps = snap.capabilities
      setServerCaps(caps)
      setServerWarnings(snap.warnings ?? [])
      // Auto-load proposals kalau capability ready
      if (caps.skillProposals) {
        void (async () => {
          const pl = await listProposals('pending')
          if (cancelled) return
          if (pl?.ok) setProposals(pl.proposals)
        })()
      }
      if (caps.fileLibrary) {
        setLibraryLoading(true)
        const list = await listLibraryFiles()
        if (cancelled) return
        if (list?.ok) {
          setLibraryFiles(list.files)
          setLibraryError('')
          // Cek versi service worker — kalau ada update pending, auto-trigger update biar UX cepat
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((reg) => {
              if (reg && reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' })
              }
              if (reg) {
                void reg.update()
              }
            }).catch(() => {})
          }
        } else {
          // Library fetch fail dari client tapi server capability fileLibrary=true.
          // Bisa 1 dari 2: SW intercept return stale, atau real server error.
          // Try once more dengan SW skip via cache:'reload' option (force network).
          try {
            const retryResp = await fetch(`/api/atmaja/memory?type=files&_=${Date.now()}`, {
              cache: 'reload',
              headers: { 'cache-control': 'no-cache' },
            })
            if (retryResp.ok) {
              const retryData = await retryResp.json()
              if (retryData?.ok) {
                setLibraryFiles(retryData.files ?? [])
                setLibraryError('')
                setLibraryLoading(false)
                return
              }
            }
          } catch {
            // ignore, fall through to error UI
          }
          setLibraryError(
            'Library fetch gagal. Service worker cache lama mungkin block. Klik "Force reload PWA" di bawah untuk auto-fix.',
          )
        }
        setLibraryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshLibrary = useCallback(async () => {
    if (!serverCaps?.fileLibrary) {
      setLibraryError('Server fileLibrary capability not detected. Cek /api/agent/health.')
      return
    }
    setLibraryLoading(true)
    setLibraryError('')
    const list = await listLibraryFiles()
    if (list?.ok) {
      setLibraryFiles(list.files)
    } else {
      setLibraryError('Refresh gagal. Server tidak return data. Coba force reload PWA via tombol di bawah.')
    }
    setLibraryLoading(false)
  }, [serverCaps?.fileLibrary])

  // Force unregister all service workers + clear cache + reload. Nuclear option untuk SW cache stale.
  const forceReloadPWA = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (err) {
      console.error('Force reload error:', err)
    }
    // Reload dengan cache-bust query
    window.location.href = `/atmaja?_reload=${Date.now()}`
  }, [])

  const handleLibraryUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!serverCaps?.fileLibrary) {
      setLibraryError('File library belum tersedia. Setup Vercel Blob storage dulu.')
      return
    }
    const file = files[0]
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setLibraryError('Library hanya support PDF saat ini. File lain pakai attachment biasa.')
      return
    }
    if (file.size > 2_621_440) {
      setLibraryError(`PDF > 2.5 MB terlalu besar. Pecah file dulu.`)
      return
    }
    setLibraryUploading(true)
    setLibraryError('')
    try {
      const dataBase64 = await readFileAsBase64(file)
      if (!dataBase64) {
        setLibraryError('Gagal baca file sebagai base64.')
        return
      }
      const result = await uploadLibraryFile({
        name: file.name,
        contentType: 'application/pdf',
        dataBase64,
      })
      if (!result.ok) {
        setLibraryError(`Upload gagal: ${result.error ?? 'unknown error'}`)
        return
      }
      await refreshLibrary()
    } finally {
      setLibraryUploading(false)
    }
  }, [serverCaps?.fileLibrary, refreshLibrary])

  const handleLibraryDelete = useCallback(async (id: string) => {
    setLibraryError('')
    const result = await deleteLibraryFile(id)
    if (!result.ok) {
      setLibraryError(`Delete gagal: ${result.error ?? 'unknown error'}`)
      return
    }
    setAttachedLibraryIds((prev) => prev.filter((x) => x !== id))
    await refreshLibrary()
  }, [refreshLibrary])

  // FIX (MEDIUM #11): pakai server caps untuk file limit, jangan hardcode
  // Fallback ke 3 kalau caps belum loaded
  const maxAttachedPerTurn = serverCaps?.maxFileAttachedPerTurn || 3
  const toggleAttachedLibrary = useCallback(
    (id: string) => {
      setAttachedLibraryIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= maxAttachedPerTurn) return prev
        return [...prev, id]
      })
    },
    [maxAttachedPerTurn],
  )

  // ============ Proposals handlers ============
  const refreshProposals = useCallback(async () => {
    if (!serverCaps?.skillProposals) return
    setProposalsLoading(true)
    setProposalsError('')
    const pl = await listProposals('pending')
    if (pl?.ok) {
      setProposals(pl.proposals)
    } else {
      setProposalsError('Gagal load proposals. Coba refresh.')
    }
    setProposalsLoading(false)
  }, [serverCaps?.skillProposals])

  const handleApproveProposal = useCallback(async (id: string) => {
    setProposalsError('')
    const r = await approveProposal(id)
    if (r?.ok) {
      await refreshProposals()
    } else {
      setProposalsError('Approve gagal. Coba lagi.')
    }
  }, [refreshProposals])

  const handleRejectProposal = useCallback(async (id: string) => {
    setProposalsError('')
    const reason = prompt('Alasan reject (opsional, untuk Atmaja learn dari pattern):') || ''
    const r = await rejectProposal(id, reason)
    if (r?.ok) {
      await refreshProposals()
    } else {
      setProposalsError('Reject gagal. Coba lagi.')
    }
  }, [refreshProposals])

  // ============ NL Scheduler handlers ============
  const refreshSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    const r = await listSchedules()
    if (r?.ok) setSchedules(r.schedules ?? [])
    setSchedulesLoading(false)
  }, [])

  const handlePauseSchedule = useCallback(async (id: string) => {
    const ok = await pauseSchedule(id)
    if (ok) await refreshSchedules()
  }, [refreshSchedules])

  const handleResumeSchedule = useCallback(async (id: string) => {
    const ok = await resumeSchedule(id)
    if (ok) await refreshSchedules()
  }, [refreshSchedules])

  const handleDeleteSchedule = useCallback(async (id: string) => {
    if (!confirm('Hapus schedule ini? Tidak bisa di-undo.')) return
    const ok = await deleteSchedule(id)
    if (ok) await refreshSchedules()
  }, [refreshSchedules])

  // Load schedules on mount
  useEffect(() => {
    void refreshSchedules()
  }, [refreshSchedules])

  const dismissWarning = useCallback((warningType: string) => {
    setWarningsDismissed((prev) => new Set([...prev, warningType]))
  }, [])

  const visibleWarnings = serverWarnings.filter((w) => !warningsDismissed.has(w.type))

  // CATATAN: useEffect lama "upgradeActionableReplies" sengaja dihapus.
  // Efek itu mengganti balasan remote Atmaja yang jujur ("saya tidak lihat zip")
  // dengan mock reply hardcoded yang berisi 3 hex Gerai → palette card otomatis render
  // walau Atmaja sebenarnya tidak menganalisis apa pun. Itu bohong, kita matikan total.

  useEffect(() => {
    return () => {
      if (pendingReplyTimerRef.current !== null) {
        window.clearTimeout(pendingReplyTimerRef.current)
      }
    }
  }, [])

  const scheduleVideoGen = useCallback((userMsg: AtmajaMessage, parsed: { prompt: string; model: OpenAIVideoModel }) => {
    if (pendingReplyTimerRef.current !== null) {
      window.clearTimeout(pendingReplyTimerRef.current)
      pendingReplyTimerRef.current = null
    }
    setSending(true)
    void (async () => {
      const result = await generateVideo({ prompt: parsed.prompt, model: parsed.model })

      if (!result || result.job.status !== 'completed' || !result.job.contentUrl) {
        const errReply: AtmajaMessage = {
          id: `m-${Date.now() + 1}`,
          author: 'ceo',
          text:
            'Tidak bisa generate video saat ini. Cek OPENAI_API_KEY + akses Sora 2 di akun OpenAI. Status detail: /api/openai/video/status?id=<job-id>.',
          timeAgo: 'Baru saja',
        }
        setMessages((prev) => {
          const userIndex = prev.findIndex((m) => m.id === userMsg.id)
          if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
          const next = [...prev, errReply]
          saveThread(next)
          return next
        })
        setSending(false)
        return
      }

      const video: AtmajaVideo = {
        id: `vid-${result.job.id}`,
        title: `${result.job.model} · ${result.job.seconds}s · ${result.job.size}`,
        caption: `Prompt: ${parsed.prompt}`,
        contentUrl: result.job.contentUrl,
        prompt: parsed.prompt,
        model: result.job.model,
        size: result.job.size,
        seconds: result.job.seconds,
      }
      const reply: AtmajaMessage = {
        id: `m-${Date.now() + 1}`,
        author: 'ceo',
        text: `Video siap (${result.job.model}, ${result.job.seconds}s, ${result.job.size}, ${(result.elapsedMs / 1000).toFixed(1)}s).`,
        timeAgo: 'Baru saja',
        videos: [video],
      }
      setMessages((prev) => {
        const userIndex = prev.findIndex((m) => m.id === userMsg.id)
        if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
        const next = [...prev, reply]
        saveThread(next)
        return next
      })
      setSending(false)
    })()
  }, [])

  const scheduleImageGen = useCallback((userMsg: AtmajaMessage, parsed: { prompt: string; model: OpenAIImageModel }) => {
    if (pendingReplyTimerRef.current !== null) {
      window.clearTimeout(pendingReplyTimerRef.current)
      pendingReplyTimerRef.current = null
    }
    setSending(true)
    void (async () => {
      const result = await generateImage({
        prompt: parsed.prompt,
        model: parsed.model,
        size: '1024x1024',
      })

      if (!result) {
        const errReply: AtmajaMessage = {
          id: `m-${Date.now() + 1}`,
          author: 'ceo',
          text:
            'Saya tidak bisa generate gambar saat ini. Cek apakah OPENAI_API_KEY sudah terpasang di server dan credit OpenAI masih ada. Status detail: /api/openai/credits.',
          timeAgo: 'Baru saja',
        }
        setMessages((prev) => {
          const userIndex = prev.findIndex((m) => m.id === userMsg.id)
          if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
          const next = [...prev, errReply]
          saveThread(next)
          return next
        })
        setSending(false)
        return
      }

      const visual: AtmajaVisual = {
        id: `vis-genimg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: 'generated-image',
        title: `${result.model} · ${result.size}`,
        caption: result.revisedPrompt
          ? `Prompt diolah ulang model: ${result.revisedPrompt}`
          : `Prompt: ${parsed.prompt}`,
        imageDataUri: result.dataUri,
        prompt: parsed.prompt,
      }
      const reply: AtmajaMessage = {
        id: `m-${Date.now() + 1}`,
        author: 'ceo',
        text: `Gambar siap (${result.model}, ${result.size}, ${(result.elapsedMs / 1000).toFixed(1)}s).`,
        timeAgo: 'Baru saja',
        visuals: [visual],
      }
      setMessages((prev) => {
        const userIndex = prev.findIndex((m) => m.id === userMsg.id)
        if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
        const next = [...prev, reply]
        saveThread(next)
        return next
      })
      setSending(false)
    })()
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
        const attachedIdsAtTime = attachedLibraryIds
        const remoteResultEnvelope = await requestAtmajaReplyWithError({
          userMessage: userMsg.text,
          history: historySnapshot,
          attachments: userMsg.attachments?.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            kind: attachment.kind,
            note: attachment.note,
            dataBase64: attachment.dataBase64,
            previewText: attachment.previewText,
          })),
          attachedFileIds: attachedIdsAtTime.length > 0 ? attachedIdsAtTime : undefined,
        })

        // Handle error path with informative feedback to user.
        // FIX (HIGH #6): Hanya clear attachedLibraryIds kalau success, supaya kalau
        // error user bisa retry tanpa harus re-attach file
        if (!remoteResultEnvelope.ok) {
          const errReply: AtmajaMessage = {
            id: `m-err-${Date.now()}`,
            author: 'ceo',
            text: `_${remoteResultEnvelope.message}_\n\n(Error: \`${remoteResultEnvelope.errorKind}\`${remoteResultEnvelope.httpStatus ? `, HTTP ${remoteResultEnvelope.httpStatus}` : ''})`,
            timeAgo: 'Baru saja',
          }
          setMessages((prev) => {
            const userIndex = prev.findIndex((message) => message.id === userMsg.id)
            if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
            const nextMessages = [...prev, errReply]
            saveThreadSafe(nextMessages)
            return nextMessages
          })
          setSending(false)
          return
        }

        // Success — sekarang aman clear attached library IDs (user explicit re-attach kalau mau).
        setAttachedLibraryIds([])
        const result = remoteResultEnvelope.reply

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

        const visuals = buildVisualsForReply(modelText, result.text, userMsg.attachments ?? [])

        // Parse markers: schedule + insight + doc. Strip dari display text supaya
        // tidak tampil sebagai bracket text di chat bubble.
        const scheduleResult = parseScheduleMarkers(result.text)
        const insightResult = parseInsightMarkers(scheduleResult.cleanedText)
        const docResult = parseDocMarkers(insightResult.cleanedText)

        // === FRONTEND SAFETY NET (2 layer) ===
        // Layer A: User explicit minta PDF/file/dokumen tapi Atmaja tidak emit marker
        // Layer B: Atmaja respond dengan content yang LOOKS LIKE document (long, headings,
        //   ada code block HTML/markdown) — auto-treat sebagai document attachment
        const matthewWantsPdf = userWantsPdf(userMsg.text)
        const atmajaRefused = isRefusalResponse(insightResult.cleanedText)
        const responseLookSLikeDoc = looksLikeDocumentResponse(insightResult.cleanedText)
        let finalText = docResult.cleanedText
        const finalDocs = [...docResult.docs]

        // Trigger synthesize kalau: explicit PDF intent ATAU response punya struktur document
        const shouldSynthesize = finalDocs.length === 0 && (matthewWantsPdf || responseLookSLikeDoc)

        if (shouldSynthesize) {
          // Extract clean document content (strip HTML code blocks, convert to markdown)
          const docContent = extractDocumentContent(stripRefusalText(insightResult.cleanedText))
          if (docContent.trim().length > 200) {
            const synthDoc = synthesizeDocFromResponse(
              docContent,
              userMsg.text.slice(0, 80) || 'Dokumen Atmaja',
            )
            finalDocs.push(synthDoc)
            // Replace text dengan friendly conversational (chat tidak lagi penuh raw HTML/markdown)
            if (atmajaRefused) {
              finalText = `Berikut PDF "${synthDoc.title}" yang saya susun untuk Anda, silakan diunduh.`
            } else if (responseLookSLikeDoc) {
              // Strip raw content, ganti dengan friendly opener
              finalText = `Berikut "${synthDoc.title}" sudah saya susun jadi PDF, silakan klik untuk download.`
            } else {
              finalText = stripRefusalText(finalText)
            }
          }
        }

        const displayText = withVisualFollowUp(finalText, modelText, visuals)
        const reply: AtmajaMessage = {
          id: `m-${Date.now() + 1}`,
          author: 'ceo',
          text: displayText,
          timeAgo: 'Baru saja',
        }
        if (visuals.length > 0) reply.visuals = visuals
        if (finalDocs.length > 0) reply.documents = finalDocs

        setMessages((prev) => {
          const userIndex = prev.findIndex((message) => message.id === userMsg.id)
          if (userIndex >= 0 && prev[userIndex + 1]?.author === 'ceo') return prev
          const nextMessages = [...prev, reply]
          saveThread(nextMessages)
          return nextMessages
        })
        setSending(false)

        // Fire-and-forget: process schedule markers di background. Tidak block UI.
        if (scheduleResult.schedules.length > 0) {
          void (async () => {
            for (const s of scheduleResult.schedules) {
              await createSchedule(s)
            }
            await refreshSchedules()
          })()
        }
      })()
    }, delay)
  }, [attachedLibraryIds, refreshSchedules])

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.author !== 'matthew' || sending) return
    // Cek video-gen command dulu (paling spesifik).
    const vidCmd = parseVideoCommand(lastMessage.text)
    if (vidCmd) {
      scheduleVideoGen(lastMessage, vidCmd)
      return
    }
    // Lalu image-gen.
    const imgCmd = parseImageCommand(lastMessage.text)
    if (imgCmd) {
      scheduleImageGen(lastMessage, imgCmd)
      return
    }
    scheduleAtmajaReply(messages.slice(0, -1), lastMessage, 350)
  }, [messages, scheduleAtmajaReply, scheduleImageGen, scheduleVideoGen, sending])

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

  // Voice input via Web Speech API. Chrome desktop + Android + Safari iOS 14.5+.
  // Append hasil transcription ke text field, biarkan Matthew edit sebelum kirim.
  const toggleVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    const SpeechRecognitionCtor = (W.SpeechRecognition ?? W.webkitSpeechRecognition) as
      | (new () => {
          continuous: boolean
          interimResults: boolean
          lang: string
          onresult:
            | ((event: {
                resultIndex: number
                results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
              }) => void)
            | null
          onerror: ((event: { error: string }) => void) | null
          onend: (() => void) | null
          start: () => void
          stop: () => void
        })
      | undefined
    if (!SpeechRecognitionCtor) {
      setAttachmentError('Voice input tidak didukung di browser ini. Coba pakai Chrome atau Safari terbaru.')
      return
    }

    // Toggle off kalau sedang listening.
    if (voiceListening) {
      try {
        const current = voiceRecognitionRef.current as { stop?: () => void } | null
        current?.stop?.()
      } catch {
        // ignore
      }
      setVoiceListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognitionCtor()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'id-ID'
      // FIX (HIGH #7): Track text BEFORE voice session + the full combined transcript
      // to prevent duplication. Each interim result replaces (not appends) the last interim.
      const baseTextBeforeVoice = text
      let finalTranscript = ''
      recognition.onresult = (event) => {
        let interim = ''
        // Hanya iterate dari resultIndex untuk avoid double-counting events
        // (some browsers replay all results in each event)
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const transcript = result[0].transcript
          if (result.isFinal) {
            finalTranscript += transcript
          } else {
            interim += transcript
          }
        }
        const combined = (finalTranscript + interim).trim()
        if (combined) {
          // Replace voice portion entirely, preserve text user typed before voice started
          const base = baseTextBeforeVoice.trim()
          setText(base ? `${base} ${combined}` : combined)
        }
      }
      recognition.onerror = (event) => {
        setVoiceListening(false)
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setAttachmentError(`Voice input gagal: ${event.error}`)
        }
      }
      recognition.onend = () => {
        setVoiceListening(false)
      }
      voiceRecognitionRef.current = recognition
      recognition.start()
      setVoiceListening(true)
      if ('vibrate' in navigator) navigator.vibrate(30)
    } catch (error) {
      setVoiceListening(false)
      setAttachmentError(`Voice input gagal start: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }, [voiceListening])

  const handleFileSelect = async (files: FileList | null) => {
    // FIX (HIGH #5): Clear stale attachment error di awal setiap call,
    // supaya error message dari run sebelumnya tidak lingering
    setAttachmentError('')

    const selectedFiles = Array.from(files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (selectedFiles.length === 0 || readingFiles) return

    const remainingSlots = MAX_ATTACHMENTS - attachments.length
    if (remainingSlots <= 0) {
      setAttachmentError(`Maksimal ${MAX_ATTACHMENTS} file per pesan.`)
      return
    }

    setReadingFiles(true)
    // Set warning hanya kalau ada file extra yang di-skip
    if (selectedFiles.length > remainingSlots) {
      setAttachmentError(`Hanya ${remainingSlots} file pertama yang ditambahkan.`)
    }

    try {
      const nextAttachments = await Promise.all(selectedFiles.slice(0, remainingSlots).map(buildAttachment))
      setAttachments((current) => [...current, ...nextAttachments])
    } catch (err) {
      console.error('[handleFileSelect] failed:', err)
      setAttachmentError(
        err instanceof Error ? `Gagal baca file: ${err.message}` : 'Gagal baca file. Coba lagi.',
      )
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
    // Intercept video-gen command (paling spesifik).
    const vidCmd = parseVideoCommand(displayText)
    if (vidCmd) {
      scheduleVideoGen(userMsg, vidCmd)
      return
    }
    // Lalu image-gen command.
    const imgCmd = parseImageCommand(displayText)
    if (imgCmd) {
      scheduleImageGen(userMsg, imgCmd)
      return
    }
    // /browse command — fetch URL via Vercel Edge, feed content ke Atmaja untuk analysis.
    const browseCmd = parseBrowseCommand(displayText)
    if (browseCmd) {
      setBrowsing(true)
      setSending(true)
      void (async () => {
        const result = await browseUrl(browseCmd.url)
        setBrowsing(false)
        if (!result || !result.ok) {
          const errorReply: AtmajaMessage = {
            id: `m-${Date.now() + 1}`,
            author: 'ceo',
            text: `Maaf, gagal buka ${browseCmd.url}. Error: \`${result?.error ?? 'unknown'}\`. Coba URL lain, atau cek apakah halaman public dan HTML-based.`,
            timeAgo: 'Baru saja',
          }
          setMessages((prev) => {
            const next = [...prev, errorReply]
            saveThread(next)
            return next
          })
          setSending(false)
          return
        }
        setSending(false)
        // Enriched user msg untuk API call (visible chat tetap pakai original /browse text)
        const enrichedUserMsg: AtmajaMessage = {
          ...userMsg,
          text: buildBrowseMessage(browseCmd.url, result, browseCmd.question),
        }
        scheduleAtmajaReply(historySnapshot, enrichedUserMsg)
      })()
      return
    }
    scheduleAtmajaReply(historySnapshot, userMsg)
  }

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col pb-32 pt-safe-top sm:px-6 lg:px-8"
      style={{
        paddingLeft: 'max(1rem, var(--safe-left, 0px))',
        paddingRight: 'max(1rem, var(--safe-right, 0px))',
      }}
    >
      {/* Warnings banner — credit low / env missing / dll */}
      {visibleWarnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleWarnings.map((w) => (
            <div
              key={w.type}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2 text-xs',
                w.severity === 'critical'
                  ? 'border-status-review bg-status-review/10 text-status-review'
                  : w.severity === 'warning'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-800'
                    : 'border-accent/40 bg-accent-bg/40 text-accent-dark',
              )}
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p className="flex-1 font-bold">{w.message}</p>
              <button
                type="button"
                onClick={() => dismissWarning(w.type)}
                aria-label="Dismiss warning"
                className="shrink-0 rounded-full p-0.5 hover:bg-white/40"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
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
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-end gap-2.5"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-role-ceo text-white font-serif text-base"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                A
              </span>
              <div className="min-w-0 max-w-[min(90%,600px)]">
                <p
                  className="mb-1 px-1 text-meta font-bold text-accent-dark"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Atmaja
                </p>
                <div className="rounded-[18px] rounded-bl-md bg-white/82 px-4 py-3 shadow-card space-y-2">
                  <div className="skeleton-line h-3.5 rounded" />
                  <div className="skeleton-line h-3.5 w-5/6 rounded" />
                  <div className="skeleton-line h-3.5 w-4/6 rounded" />
                </div>
                <p className="mt-1 px-1 text-[10px] text-text-faint inline-flex items-center gap-1">
                  <span className="inline-flex gap-0.5">
                    <span className="size-1 animate-pulse rounded-full bg-text-faint" />
                    <span
                      className="size-1 animate-pulse rounded-full bg-text-faint"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="size-1 animate-pulse rounded-full bg-text-faint"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </span>
                  {browsing ? 'Membuka halaman web' : 'Atmaja menulis'}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="mb-4 space-y-4">
            {/* Welcome banner — Claude-style empty state */}
            <div className="rounded-2xl border border-white/55 bg-white/55 p-4 shadow-soft backdrop-blur-md">
              <p className="text-label-caps text-accent-dark">Mulai dari sini</p>
              <h2 className="mt-1 text-[20px] font-extrabold leading-tight tracking-[-0.01em] text-text-primary">
                Selamat datang, Matthew
              </h2>
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-text-secondary">
                Atmaja siap membantu dari sintesis kepemimpinan, generate PDF, jadwal harian,
                sampai research kompetitor web. Pilih kapabilitas di bawah atau langsung tanya.
              </p>
            </div>

            {/* Capability cards — quick start dengan example prompt yang langsung jalan */}
            <div>
              <p className="mb-2 px-1 text-label-caps text-text-muted">Kapabilitas Atmaja</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {capabilityCards.map((c) => (
                  <button
                    key={c.title}
                    type="button"
                    onClick={() => send(c.example)}
                    className={cn(
                      'group rounded-xl border border-white/65 bg-white/75 p-3 text-left shadow-soft',
                      'transition-all duration-fast hover:border-accent/40 hover:bg-white hover:shadow-card hover:-translate-y-px',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    )}
                  >
                    <p className="text-[13px] font-extrabold text-text-primary">{c.title}</p>
                    <p className="mt-1 text-[11px] font-semibold text-text-muted leading-relaxed">
                      {c.description}
                    </p>
                    <p className="mt-2 text-[10px] font-medium italic text-accent-dark line-clamp-2 group-hover:text-accent">
                      "{c.example}"
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick prompts — collapsible secondary */}
            <div>
              <button
                type="button"
                onClick={() => setQuickOpen((open) => !open)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-extrabold text-text-secondary shadow-soft hover:bg-white hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
                aria-expanded={quickOpen}
              >
                Contoh pertanyaan lain
                <ChevronDown
                  className={cn('size-3 transition-transform duration-fast', quickOpen && 'rotate-180')}
                />
              </button>
              {quickOpen && (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className={cn(
                        'rounded-lg bg-white/70 px-3 py-2 text-left text-[12px] font-bold leading-tight text-text-secondary shadow-soft',
                        'transition-colors duration-fast hover:bg-white hover:text-text-primary',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            'composer-sticky rounded-[22px] border bg-white/76 p-2 shadow-pop backdrop-blur-xl transition-colors duration-fast',
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

          {/* Lapis 3: Attached library file chips (PDF dari library yang akan di-include di next message) */}
          {attachedLibraryIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-2">
              {attachedLibraryIds.map((id) => {
                const file = libraryFiles.find((f) => f.id === id)
                if (!file) return null
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-bg/60 px-2.5 py-1 text-[11px] font-extrabold text-accent-dark"
                  >
                    <BookOpen className="size-3" />
                    {file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name}
                    <button
                      type="button"
                      onClick={() => toggleAttachedLibrary(id)}
                      className="-mr-0.5 ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-accent-dark/70 hover:bg-accent/15 hover:text-accent-dark"
                      aria-label={`Lepas ${file.name}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2">
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
            {/* Camera input — capture=environment supaya HP buka camera back langsung */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
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
                'inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                sending || readingFiles
                  ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                  : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              {readingFiles ? <Loader2 className="size-5 sm:size-4 animate-spin" /> : <Paperclip className="size-5 sm:size-4" />}
            </button>
            {/* Camera button — HP: buka kamera langsung. Desktop: hidden (sm:hidden) karena tidak relevan. */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={sending || readingFiles}
              aria-label="Ambil foto dengan kamera"
              className={cn(
                'sm:hidden inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                sending || readingFiles
                  ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                  : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              <Camera className="size-5" />
            </button>
            {/* Lapis 3: Library button — open drawer ke list semua PDF persistent.
                Hidden di mobile (sm:flex) untuk hemat space, akses via menu lain. */}
            {serverCaps?.fileLibrary && (
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                disabled={sending}
                aria-label={`Library — ${libraryFiles.length} file`}
                title={`Library Atmaja — ${libraryFiles.length} file PDF`}
                className={cn(
                  'hidden sm:inline-flex relative size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                  sending
                    ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                    : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <Library className="size-4" />
                {libraryFiles.length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-white shadow-soft">
                    {libraryFiles.length}
                  </span>
                )}
              </button>
            )}
            {/* Skill Proposals button — Atmaja self-evolving.
                Hidden di mobile untuk hemat space. */}
            {serverCaps?.skillProposals && (
              <button
                type="button"
                onClick={() => {
                  setProposalsOpen(true)
                  void refreshProposals()
                }}
                disabled={sending}
                aria-label={`Proposals — ${proposals.length} pending`}
                title={`Skill Proposals Atmaja — ${proposals.length} pending`}
                className={cn(
                  'hidden sm:inline-flex relative size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                  sending
                    ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                    : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <Sparkles className="size-4" />
                {proposals.length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-status-review px-1 text-[10px] font-extrabold text-white shadow-soft">
                    {proposals.length}
                  </span>
                )}
              </button>
            )}
            {/* Schedules button — NL Scheduler (Hermes-inspired).
                Hidden di mobile untuk hemat space, akses via swipe atau menu. */}
            <button
              type="button"
              onClick={() => {
                setSchedulesOpen(true)
                void refreshSchedules()
              }}
              disabled={sending}
              aria-label={`Jadwal — ${schedules.filter((s) => s.status === 'active').length} aktif`}
              title="Jadwal & reminder Atmaja"
              className={cn(
                'hidden sm:inline-flex relative size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                sending
                  ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                  : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              <CalendarClock className="size-4" />
              {schedules.filter((s) => s.status === 'active').length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-status-final px-1 text-[10px] font-extrabold text-white shadow-soft">
                  {schedules.filter((s) => s.status === 'active').length}
                </span>
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Desktop: Cmd/Ctrl+Enter kirim. Mobile: Enter alone kirim (kalau tidak shift).
                const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
                if (e.key === 'Enter') {
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault()
                    send(text)
                  } else if (isMobile && !e.shiftKey) {
                    e.preventDefault()
                    send(text)
                  }
                }
              }}
              onFocus={() => {
                // Scroll textarea into view setelah keyboard naik (delay match keyboard animation).
                window.setTimeout(() => {
                  textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 320)
              }}
              placeholder={attachments.length > 0 ? 'Tambah catatan untuk file...' : 'Tanya Atmaja...'}
              rows={1}
              className={cn(
                'max-h-32 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-text-primary placeholder:text-text-faint',
                'focus:outline-none',
              )}
              style={{ minHeight: '44px' }}
            />
            {/* Voice input button — hanya muncul kalau browser support Web Speech API */}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={sending || readingFiles}
                aria-label={voiceListening ? 'Hentikan voice input' : 'Mulai voice input'}
                title={voiceListening ? 'Hentikan voice input' : 'Voice input (id-ID)'}
                className={cn(
                  'inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                  voiceListening
                    ? 'bg-status-review text-white shadow-glow-accent voice-recording'
                    : sending || readingFiles
                      ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                      : 'bg-white text-text-secondary shadow-soft hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                {voiceListening ? <MicOff className="size-5 sm:size-4" /> : <Mic className="size-5 sm:size-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                send(text)
                if ('vibrate' in navigator) navigator.vibrate(40)
              }}
              disabled={(!text.trim() && attachments.length === 0 && attachedLibraryIds.length === 0) || sending || readingFiles}
              aria-label="Kirim ke Atmaja"
              className={cn(
                'inline-flex size-12 sm:size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast',
                (text.trim() || attachments.length > 0 || attachedLibraryIds.length > 0) && !sending && !readingFiles
                  ? 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark'
                  : 'bg-bg-soft text-text-faint cursor-not-allowed',
              )}
            >
              <Send className="size-5 sm:size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Lapis 3: Library Drawer — list + upload + delete persistent PDFs */}
      <AnimatePresence>
        {libraryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setLibraryOpen(false)}
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl sm:max-h-[85vh] sm:rounded-2xl sm:p-6"
              style={{ maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                    <Library className="size-5 text-accent" />
                    Library Atmaja
                  </h2>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    PDF tersimpan permanent di Vercel Blob. Attach ke chat tanpa re-upload.
                    {' '}({libraryFiles.length}/{serverCaps ? 50 : '?'} file)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLibraryOpen(false)}
                  aria-label="Tutup Library"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-bg-soft text-text-secondary hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <input
                ref={libraryUploadRef}
                type="file"
                className="sr-only"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  void handleLibraryUpload(event.target.files)
                  if (event.target) event.target.value = ''
                }}
              />
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => libraryUploadRef.current?.click()}
                  disabled={libraryUploading}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-colors',
                    libraryUploading
                      ? 'bg-bg-soft text-text-faint cursor-not-allowed'
                      : 'bg-accent text-white shadow-glow-accent hover:bg-accent-dark',
                  )}
                >
                  {libraryUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  {libraryUploading ? 'Uploading...' : 'Upload PDF baru'}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshLibrary()}
                  disabled={libraryLoading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-text-secondary shadow-soft hover:text-text-primary"
                >
                  {libraryLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Refresh'}
                </button>
              </div>

              {libraryError && (
                <div className="mb-3 rounded-md bg-status-review/10 px-3 py-2">
                  <p className="text-xs font-bold text-status-review">{libraryError}</p>
                  <button
                    type="button"
                    onClick={() => void forceReloadPWA()}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-status-review px-3 py-1 text-[11px] font-extrabold text-white hover:bg-status-review/80"
                  >
                    Force reload PWA (clear cache + reload)
                  </button>
                </div>
              )}

              {!serverCaps?.fileLibrary && (
                <div className="rounded-md bg-bg-soft p-4 text-sm text-text-secondary">
                  Library belum tersedia. Server butuh setup Vercel Blob storage (BLOB_READ_WRITE_TOKEN env var).
                </div>
              )}

              {serverCaps?.fileLibrary && libraryFiles.length === 0 && !libraryLoading && (
                <div className="rounded-md bg-bg-soft p-6 text-center text-sm text-text-secondary">
                  <BookOpen className="mx-auto mb-2 size-6 opacity-40" />
                  <p>Library kosong. Upload PDF pertama untuk mulai.</p>
                  <p className="mt-3 text-[11px] text-text-faint">
                    Atau kalau kamu yakin sudah upload tapi tetap kosong, kemungkinan service worker cache stale.
                  </p>
                  <button
                    type="button"
                    onClick={() => void forceReloadPWA()}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-accent-dark"
                  >
                    Force reload PWA
                  </button>
                </div>
              )}

              {/* Original empty state (legacy block — keep collapsed since new block above replaces it visually). */}
              {false && serverCaps?.fileLibrary && libraryFiles.length === 0 && (
                <div className="hidden">
                  <BookOpen className="mx-auto mb-2 size-6 opacity-40" />
                  Library kosong. Upload PDF pertama untuk mulai.
                </div>
              )}

              {serverCaps?.fileLibrary && libraryFiles.length > 0 && (
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
                  {libraryFiles.map((file) => {
                    const isAttached = attachedLibraryIds.includes(file.id)
                    const canAttachMore = attachedLibraryIds.length < maxAttachedPerTurn
                    return (
                      <div
                        key={file.id}
                        className={cn(
                          'flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors',
                          isAttached
                            ? 'border-accent bg-accent-bg/40'
                            : 'border-white/75 bg-white hover:border-accent/30',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-accent" />
                            <p className="truncate text-sm font-extrabold text-text-primary">{file.name}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            {formatLibFileSize(file.size)} · uploaded {formatLibUploadedAt(file.uploadedAt)}
                          </p>
                          {file.description && (
                            <p className="mt-1 text-[11px] italic text-text-secondary">{file.description}</p>
                          )}
                          <p className="mt-1 font-mono text-[10px] text-text-faint">ID: {file.id}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleAttachedLibrary(file.id)}
                            disabled={!isAttached && !canAttachMore}
                            title={!isAttached && !canAttachMore ? `Max ${maxAttachedPerTurn} file per turn` : ''}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition-colors',
                              isAttached
                                ? 'bg-accent text-white hover:bg-accent-dark'
                                : canAttachMore
                                  ? 'bg-white text-text-secondary shadow-soft hover:text-text-primary'
                                  : 'bg-bg-soft text-text-faint cursor-not-allowed',
                            )}
                          >
                            {isAttached ? 'Attached' : 'Attach'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus "${file.name}" dari library? Tidak bisa di-undo.`)) {
                                void handleLibraryDelete(file.id)
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-status-review shadow-soft hover:bg-status-review/10"
                          >
                            <Trash2 className="size-3" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 border-t border-white/40 pt-3 text-[11px] text-text-secondary">
                Atmaja tahu daftar file ini dari memory long-term, jadi bisa reference kapan saja.
                Max 3 file attach per pertanyaan. PDF di-process native (no OCR), text + tabel langsung dibaca Opus 4.7.
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Skill Proposals Drawer — Self-Evolving Atmaja foundation */}
        {proposalsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setProposalsOpen(false)}
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl sm:max-h-[85vh] sm:rounded-2xl sm:p-6"
              style={{ maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                    <Sparkles className="size-5 text-accent" />
                    Skill Proposals Atmaja
                  </h2>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Atmaja propose kapabilitas baru tiap Senin pagi (Workflow #4). Approve untuk implementation pipeline aktif, reject untuk dismiss. ({proposals.length} pending)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProposalsOpen(false)}
                  aria-label="Tutup Proposals"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-bg-soft text-text-secondary hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void refreshProposals()}
                disabled={proposalsLoading}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-text-secondary shadow-soft hover:text-text-primary"
              >
                {proposalsLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Refresh'}
              </button>

              {proposalsError && (
                <p className="mb-3 rounded-md bg-status-review/10 px-3 py-2 text-xs font-bold text-status-review">
                  {proposalsError}
                </p>
              )}

              {proposals.length === 0 && !proposalsLoading && (
                <div className="rounded-md bg-bg-soft p-6 text-center text-sm text-text-secondary">
                  <Sparkles className="mx-auto mb-2 size-6 opacity-40" />
                  <p>Belum ada proposal pending.</p>
                  <p className="mt-2 text-[11px] text-text-faint">
                    Atmaja akan review memory + chat history setiap Senin 09:00 WITA + generate proposal otomatis kalau detect gap kapabilitas.
                  </p>
                </div>
              )}

              {proposals.length > 0 && (
                <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                  {proposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="rounded-lg border border-accent/20 bg-white p-3 shadow-soft"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent-dark">
                          {formatProposalTypeLabel(prop.type)}
                        </span>
                        <span className="text-[10px] text-text-faint">{formatProposalDate(prop.createdAt)}</span>
                      </div>
                      <h3 className="text-sm font-extrabold text-text-primary">{prop.title}</h3>
                      <p className="mt-1 text-xs text-text-secondary">{prop.description}</p>
                      {prop.rationale && (
                        <p className="mt-2 text-[11px] italic text-text-secondary">
                          <span className="font-bold not-italic">Alasan:</span> {prop.rationale}
                        </p>
                      )}
                      {prop.examples && prop.examples.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-[11px] text-text-secondary">
                          {prop.examples.map((ex, i) => (
                            <li key={i}>{ex}</li>
                          ))}
                        </ul>
                      )}
                      {(prop.estimatedEffort || prop.estimatedCost) && (
                        <p className="mt-2 text-[11px] text-text-faint">
                          {prop.estimatedEffort && <span>Effort: {prop.estimatedEffort}</span>}
                          {prop.estimatedEffort && prop.estimatedCost && <span> · </span>}
                          {prop.estimatedCost && <span>Cost: {prop.estimatedCost}</span>}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApproveProposal(prop.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold text-white shadow-soft hover:bg-accent-dark"
                        >
                          <Check className="size-3" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectProposal(prop.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-status-review shadow-soft hover:bg-status-review/10"
                        >
                          <X className="size-3" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-white/40 pt-3 text-[11px] text-text-secondary">
                Approved proposals di-track untuk implementation. Phase 2 (auto-implement via Claude API + GitHub PR) butuh setup GitHub PAT. Sekarang Phase 1: kamu approve, Atmaja note untuk implementasi manual nanti.
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Schedules Drawer — NL Scheduler (Hermes-inspired automation).
            Atmaja parse intent dari chat ("ingatkan saya X tiap Y") + auto-create schedule. */}
        {schedulesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setSchedulesOpen(false)}
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl sm:max-h-[85vh] sm:rounded-2xl sm:p-6"
              style={{ maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                    <CalendarClock className="size-5 text-accent" />
                    Jadwal & Reminder
                  </h2>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Atmaja parse intent dari chat ("ingatkan saya X tiap Y") + auto-create schedule. Lihat, pause, atau hapus dari sini. ({schedules.filter((s) => s.status === 'active').length} aktif)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedulesOpen(false)}
                  aria-label="Tutup Jadwal"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-bg-soft text-text-secondary hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void refreshSchedules()}
                disabled={schedulesLoading}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-text-secondary shadow-soft hover:text-text-primary"
              >
                {schedulesLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Refresh'}
              </button>

              {schedules.length === 0 && !schedulesLoading && (
                <div className="rounded-md bg-bg-soft p-6 text-center text-sm text-text-secondary">
                  <CalendarClock className="mx-auto mb-2 size-6 opacity-40" />
                  <p>Belum ada jadwal.</p>
                  <p className="mt-2 text-[11px] text-text-faint">
                    Cara pakai: chat Atmaja dengan kalimat seperti "ingatkan saya cek inventory tiap Senin pagi" atau "jadwalkan review brief mingguan". Atmaja parse intent + simpan otomatis.
                  </p>
                </div>
              )}

              {schedules.length > 0 && (
                <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                  {schedules.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        'rounded-lg border p-3 shadow-soft',
                        s.status === 'paused' ? 'border-border-soft bg-bg-soft/60 opacity-70' : 'border-accent/25 bg-white',
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                            s.status === 'active'
                              ? 'bg-status-final-bg text-status-final'
                              : 'bg-bg-soft text-text-muted',
                          )}
                        >
                          {s.status === 'active' ? 'Aktif' : 'Pause'}
                        </span>
                        <span className="text-[10px] text-text-faint">{formatScheduleDate(s.createdAt)}</span>
                      </div>
                      <h3 className="text-sm font-extrabold text-text-primary">{s.task}</h3>
                      <p className="mt-1 text-[11px] text-accent-dark">
                        <CalendarClock className="inline size-3 mr-1" />
                        {s.cronHuman}
                      </p>
                      {s.lastRunAt && (
                        <p className="mt-1 text-[10px] text-text-faint">
                          Terakhir jalan: {formatScheduleDate(s.lastRunAt)}
                        </p>
                      )}
                      <div className="mt-2.5 flex gap-1.5">
                        {s.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => void handlePauseSchedule(s.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-2.5 py-1 text-[10px] font-extrabold text-text-secondary hover:text-text-primary"
                          >
                            <Pause className="size-2.5" />
                            Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleResumeSchedule(s.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-2.5 py-1 text-[10px] font-extrabold text-accent-dark hover:bg-accent/15"
                          >
                            <Play className="size-2.5" />
                            Resume
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteSchedule(s.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-status-review shadow-soft hover:bg-status-review/10"
                        >
                          <Trash2 className="size-2.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-white/40 pt-3 text-[11px] text-text-secondary">
                Eksekusi schedule via n8n Daily Digest (workflow #2) yang check schedules table tiap hari. Tip: pakai juga <code>/browse [url]</code> untuk Atmaja research kompetitor langsung.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

      <div className={cn('min-w-0 max-w-[min(92%,600px)] sm:max-w-[min(86%,760px)]', isMatthew ? 'items-end' : 'items-start')}>
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
              ? 'rounded-[18px] rounded-br-md bg-accent text-white whitespace-pre-line'
              : 'rounded-[18px] rounded-bl-md bg-white/82 text-text-primary',
          )}
        >
          {isMatthew ? (
            message.text
          ) : (
            <MarkdownBlock content={message.text} className="atmaja-bubble-markdown" />
          )}
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
        {message.videos && message.videos.length > 0 && (
          <div className="mt-2 grid gap-2">
            {message.videos.map((video) => (
              <AtmajaVideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
        {/* Doc attachments — Atmaja-generated PDF/dokumen lewat marker [ATMAJA_DOC] */}
        {message.documents && message.documents.length > 0 && (
          <div className="mt-2 grid gap-2">
            {message.documents.map((doc) => (
              <AtmajaDocCard key={doc.id} doc={doc} />
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

function AtmajaDocCard({ doc }: { doc: AtmajaDoc }) {
  const hiddenContentRef = useRef<HTMLDivElement>(null)
  const wordCount = countWords(doc.content)
  const sizeStr = estimateDocSize(doc.content)

  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    const html = hiddenContentRef.current?.innerHTML ?? ''
    if (!html.trim()) {
      alert('Konten dokumen belum ter-render. Coba klik lagi sebentar.')
      return
    }
    if (doc.type === 'pdf') {
      setDownloading(true)
      try {
        await exportMessageAsPdf({
          contentHtml: html,
          title: doc.title,
          subtitle: `Disusun Atmaja pada ${new Date(doc.generatedAt).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        })
      } finally {
        setDownloading(false)
      }
    } else if (doc.type === 'md') {
      // Download as raw markdown file
      const blob = new Blob([doc.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.replace(/[^\w\s-]/g, '').slice(0, 60)}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      {/* Hidden div untuk render markdown content via MarkdownBlock — capture innerHTML saat user klik.
          Pakai offscreen absolute positioning supaya MarkdownBlock benar-benar render (sr-only class
          kadang punya clip yang menggangu rendering). */}
      <div
        ref={hiddenContentRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-99999px',
          top: '0',
          width: '800px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <MarkdownBlock content={doc.content} />
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-gradient-to-br from-accent-bg/70 to-white px-3.5 py-3 text-left shadow-soft',
          'transition-all duration-fast hover:border-accent/55 hover:shadow-card active:scale-[0.99]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          downloading && 'cursor-wait opacity-80',
        )}
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-dark text-white shadow-soft">
          {downloading ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold leading-tight text-text-primary">{doc.title}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-accent-dark">
            {doc.type === 'pdf' ? 'PDF Document' : doc.type === 'md' ? 'Markdown File' : 'Document'}
            <span className="mx-1.5 text-text-faint">·</span>
            <span className="text-text-muted">{wordCount} kata</span>
            <span className="mx-1.5 text-text-faint">·</span>
            <span className="text-text-muted">{sizeStr}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-text-muted">
            {downloading
              ? 'Menyusun PDF...'
              : `Klik untuk download ${doc.type === 'pdf' ? 'PDF' : doc.type.toUpperCase()}`}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/85 text-accent-dark shadow-soft group-hover:bg-accent group-hover:text-white"
        >
          {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5 -rotate-45" />}
        </span>
      </button>
    </>
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

function AtmajaVideoCard({ video }: { video: AtmajaVideo }) {
  // Aspect ratio dari size string (mis. "720x1280" → 9:16, "1280x720" → 16:9)
  const [w, h] = video.size.split('x').map((n) => Number(n) || 0)
  const aspectClass = w > 0 && h > 0
    ? (h > w ? 'aspect-[9/16]' : w === h ? 'aspect-square' : 'aspect-video')
    : 'aspect-video'

  return (
    <figure className="overflow-hidden rounded-lg border border-border-soft bg-white/86 text-text-primary shadow-card">
      <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-bg text-accent-dark">
          <ImageIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black">{video.title}</p>
          <p className="truncate text-[10px] font-bold text-text-muted">Generated video (Sora 2)</p>
        </div>
      </div>
      <video
        src={video.contentUrl}
        controls
        playsInline
        preload="metadata"
        className={cn('block w-full bg-black object-cover', aspectClass)}
      >
        <track kind="captions" />
      </video>
      <figcaption className="px-3 py-2 text-xs font-semibold leading-relaxed text-text-secondary">
        {video.caption}
      </figcaption>
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

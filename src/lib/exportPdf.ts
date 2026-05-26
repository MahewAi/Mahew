// Export PDF langsung ke file download (no print dialog).
// Pakai html2pdf.js (lazy-loaded ~140KB) untuk convert HTML → PDF blob → download.
//
// Flow:
// 1. User klik attachment card
// 2. Lazy import html2pdf.js (cached setelah first load)
// 3. Build branded HTML container offscreen
// 4. html2pdf generate PDF → trigger native browser download
// 5. Cleanup container
//
// Tidak ada print dialog, tidak ada window baru. Just file download.

interface ExportPdfOptions {
  /** innerHTML dari rendered markdown (via MarkdownBlock) */
  contentHtml: string
  /** Title untuk PDF header + filename */
  title?: string
  /** Subtitle untuk context (misal: "Dari chat Atmaja, 25 Mei 2026") */
  subtitle?: string
}

// Build container HTML dengan brand canon Gerai 1000 Pintu inline styling.
// Inline styles supaya html2canvas pick up correctly (tidak depend external CSS).
function buildPdfContainer({ contentHtml, title, subtitle }: ExportPdfOptions): HTMLDivElement {
  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const safeTitle = String(title ?? 'Sintesis Atmaja').replace(/[<>]/g, '')
  const safeSubtitle = String(
    subtitle ?? `Gerai 1000 Pintu · ${dateStr} pukul ${timeStr} WITA`,
  ).replace(/[<>]/g, '')

  const container = document.createElement('div')
  container.id = 'gerai-pdf-root'
  // FIX (Bug B v2): Console showed canvas (719x0). Root cause: visibility:hidden →
  // visible race + layout collapse. Solusi: ALWAYS visible (opacity 0.001), positioned
  // di document flow normal but di luar viewport visual user via z-index -1 + filter alpha 0.
  // display: block !important + height auto biar content menentukan tinggi.
  container.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 794px;
    min-height: 100px;
    height: auto;
    background: #FAF8F4;
    padding: 32px 36px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1F1A14;
    font-size: 11.5pt;
    line-height: 1.65;
    box-sizing: border-box;
    z-index: -1;
    display: block !important;
    opacity: 0.01;
    pointer-events: none;
    overflow: visible;
  `

  container.innerHTML = `
    <style>
      #gerai-pdf-root * { box-sizing: border-box; }
      #gerai-pdf-root h1 {
        font-family: Georgia, 'Cormorant Garamond', serif;
        font-size: 28pt;
        font-weight: 600;
        line-height: 1.1;
        color: #1F1A14;
        margin: 24px 0 12px;
        letter-spacing: -0.01em;
      }
      #gerai-pdf-root h2 {
        font-size: 16pt;
        font-weight: 700;
        margin: 22px 0 10px;
        color: #1F1A14;
        letter-spacing: -0.008em;
      }
      #gerai-pdf-root h3 {
        font-size: 13pt;
        font-weight: 600;
        margin: 16px 0 6px;
        color: #1F1A14;
      }
      #gerai-pdf-root p { margin: 0 0 12px; line-height: 1.65; }
      #gerai-pdf-root strong { font-weight: 600; color: #1F1A14; }
      #gerai-pdf-root em { font-style: italic; color: #6B6253; }
      #gerai-pdf-root ul, #gerai-pdf-root ol {
        margin: 0 0 14px;
        padding-left: 20px;
      }
      #gerai-pdf-root li {
        margin: 0 0 6px;
        line-height: 1.6;
      }
      #gerai-pdf-root ul li::marker { color: #A07A38; }
      #gerai-pdf-root ol li::marker { color: #A07A38; font-weight: 700; }
      #gerai-pdf-root a {
        color: #A07A38;
        text-decoration: underline;
      }
      #gerai-pdf-root blockquote {
        margin: 14px 0;
        padding-left: 14px;
        border-left: 3px solid #B8956B;
        color: #6B6253;
        font-style: italic;
      }
      #gerai-pdf-root code {
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 0.92em;
        background: rgba(184, 149, 107, 0.12);
        padding: 1px 6px;
        border-radius: 4px;
        color: #A07A38;
      }
      #gerai-pdf-root pre {
        margin: 12px 0;
        padding: 14px 16px;
        background: #F1ECE3;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 9.5pt;
        line-height: 1.5;
      }
      #gerai-pdf-root pre code { background: transparent; padding: 0; color: #1F1A14; }
      #gerai-pdf-root hr { margin: 22px 0; border: none; border-top: 1px solid #E6DDD0; }
      #gerai-pdf-root table {
        border-collapse: collapse;
        width: 100%;
        margin: 14px 0;
        font-size: 10pt;
        border: 1px solid #E6DDD0;
        border-radius: 6px;
        overflow: hidden;
      }
      #gerai-pdf-root thead { background: #F1ECE3; }
      #gerai-pdf-root th {
        padding: 10px 12px;
        text-align: left;
        font-weight: 600;
        color: #1F1A14;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-bottom: 1px solid #E6DDD0;
      }
      #gerai-pdf-root td {
        padding: 10px 12px;
        border-top: 1px solid #F0E9DC;
        vertical-align: top;
      }
      #gerai-pdf-root tr:nth-child(even) td { background: #FCFAF6; }
    </style>

    <header style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:18px;margin-bottom:24px;border-bottom:2px solid #B8956B;">
      <div>
        <div style="font-size:9pt;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#A07A38;margin-bottom:8px;">Sintesis Atmaja</div>
        <div style="font-family:Georgia,serif;font-size:26pt;font-weight:600;line-height:1.05;color:#1F1A14;letter-spacing:-0.01em;">${safeTitle}</div>
      </div>
      <div style="text-align:right;font-size:8.5pt;color:#6B6253;">
        <div style="font-family:Georgia,serif;font-size:13pt;font-weight:600;color:#1F1A14;margin-bottom:6px;">Gerai 1000 Pintu</div>
        <div>${dateStr}</div>
        <div>${timeStr} WITA</div>
      </div>
    </header>

    <p style="font-size:10pt;color:#807767;font-style:italic;margin:0 0 22px;">${safeSubtitle}</p>

    <div style="color:#1F1A14;">
      ${contentHtml}
    </div>

    <footer style="margin-top:36px;padding-top:14px;border-top:1px solid #E6DDD0;display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:#807767;">
      <span style="font-family:Georgia,serif;font-size:11pt;color:#A07A38;">Atmaja</span>
      <span>Generated dari chat Atmaja · gerai.mahewwork.com</span>
    </footer>
  `

  return container
}

function safeFilename(title: string): string {
  return String(title || 'Sintesis_Atmaja')
    .replace(/[^\w\s\-À-ɏ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 70)
}

// Show small overlay toast while generating (UX feedback supaya user tau lagi proses)
function showGeneratingToast(): HTMLDivElement {
  const toast = document.createElement('div')
  toast.id = 'gerai-pdf-toast'
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: rgba(31, 26, 20, 0.92);
    color: #FAF8F4;
    padding: 12px 20px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(31, 26, 20, 0.3);
    backdrop-filter: blur(12px);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `
  toast.innerHTML = `
    <span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(250,248,244,0.3);border-top-color:#FAF8F4;border-radius:50%;animation:gerai-spin 0.8s linear infinite;"></span>
    <span>Menyusun PDF...</span>
    <style>
      @keyframes gerai-spin { to { transform: rotate(360deg); } }
    </style>
  `
  document.body.appendChild(toast)
  return toast
}

function showResultToast(message: string, isError = false) {
  const toast = document.createElement('div')
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: ${isError ? '#A55974' : 'rgba(61, 111, 88, 0.95)'};
    color: #FFFFFF;
    padding: 12px 20px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(31, 26, 20, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `
  toast.textContent = message
  document.body.appendChild(toast)
  window.setTimeout(() => {
    try {
      toast.style.transition = 'opacity 0.3s ease'
      toast.style.opacity = '0'
      window.setTimeout(() => {
        try { document.body.removeChild(toast) } catch {}
      }, 350)
    } catch {}
  }, 2400)
}

// Detect PWA standalone mode (display-mode: standalone atau iOS standalone)
function isPwaStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if ((window.navigator as { standalone?: boolean }).standalone === true) return true
    return false
  } catch {
    return false
  }
}

// Type guard untuk FileSystem Access API
interface FileSystemAccessWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{ description?: string; accept?: Record<string, string[]> }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

/**
 * Primary download: pakai FileSystem Access API kalau available (Chrome/Edge
 * desktop + Chrome Android 86+). User dapat native save dialog dengan folder picker.
 * Paling reliable di PWA standalone karena tidak depend pada synthetic click.
 */
async function downloadViaFileSystemApi(blob: Blob, filename: string): Promise<'success' | 'cancelled' | 'unsupported' | 'error'> {
  const w = window as FileSystemAccessWindow
  if (typeof w.showSaveFilePicker !== 'function') {
    console.info('[exportPdf] FileSystem Access API tidak supported')
    return 'unsupported'
  }
  try {
    console.info('[exportPdf] trying FileSystem Access API save picker...')
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    console.info('[exportPdf] FileSystem Access API save berhasil')
    return 'success'
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.info('[exportPdf] user cancelled save dialog')
      return 'cancelled'
    }
    console.warn('[exportPdf] FileSystem Access API failed:', err)
    return 'error'
  }
}

/**
 * Fallback 1: synchronous anchor click via element yang sudah di-DOM.
 * Untuk browser yang tidak support FileSystem Access API.
 */
function downloadViaAnchor(blob: Blob, filename: string): boolean {
  try {
    const blobUrl = URL.createObjectURL(blob)
    console.info('[exportPdf] anchor download method, blob:', blobUrl)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.target = '_blank' // helps mobile browsers treat as download
    a.rel = 'noopener'
    a.style.position = 'fixed'
    a.style.left = '-9999px'
    document.body.appendChild(a)

    // Pakai .click() native (not dispatchEvent) — preserve user gesture lebih baik
    a.click()
    console.info('[exportPdf] a.click() called for download:', filename)

    window.setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
      URL.revokeObjectURL(blobUrl)
    }, 5000)
    return true
  } catch (err) {
    console.error('[exportPdf] anchor download failed:', err)
    return false
  }
}

/**
 * Fallback 2: open blob URL di tab baru. Browser render PDF inline via PDF viewer,
 * user save manual via Ctrl+S atau download icon di toolbar PDF viewer.
 */
function openBlobInNewTab(blob: Blob): boolean {
  try {
    const blobUrl = URL.createObjectURL(blob)
    console.info('[exportPdf] fallback: opening blob in new tab')
    const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')
    if (!newWindow) {
      console.warn('[exportPdf] window.open blocked — try current window navigation')
      // Last resort: navigate current window (akan keluar PWA standalone)
      window.location.href = blobUrl
      return true
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    return true
  } catch (err) {
    console.error('[exportPdf] openBlobInNewTab failed:', err)
    return false
  }
}

// === STRATEGY V3: Browser native print() via popup window ===
// html2canvas terbukti unreliable (PDF kosong walau container valid dimensions),
// ganti ke popup window + auto print(). Browser native print engine handle PDF
// conversion sendiri, jauh lebih reliable, no canvas dependency, works di semua browser.
//
// Flow:
//   1. Buka popup window dengan branded HTML lengkap
//   2. Setelah load, auto trigger window.print()
//   3. User pilih "Save as PDF" di print dialog (Chrome/Edge default)
//   4. User dapat PDF beneran dengan content
//
// Fallback kalau popup blocked: download .html, user buka manual + Ctrl+P
export async function exportMessageAsPdfViaPrint(options: ExportPdfOptions): Promise<boolean> {
  const { contentHtml, title, subtitle } = options
  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const safeTitle = String(title ?? 'Sintesis Atmaja').replace(/[<>]/g, '')
  const safeSubtitle = String(
    subtitle ?? `Gerai 1000 Pintu · ${dateStr} pukul ${timeStr} WITA`,
  ).replace(/[<>]/g, '')

  const printHtml = `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1F1A14; background: #FAF8F4; max-width: 800px; margin: 0 auto; padding: 24px 32px; font-size: 11.5pt; line-height: 1.65; }
  h1 { font-family: Georgia, 'Cormorant Garamond', serif; font-size: 28pt; font-weight: 600; margin: 0 0 12px; color: #1F1A14; letter-spacing: -0.01em; }
  h2 { font-size: 16pt; font-weight: 700; margin: 22px 0 10px; color: #1F1A14; }
  h3 { font-size: 13pt; font-weight: 700; margin: 18px 0 8px; color: #1F1A14; }
  p, li { margin: 8px 0; }
  ul, ol { padding-left: 22px; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 10.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #D4C8B0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #F2E9D5; font-weight: 700; }
  code { background: #F2E9D5; padding: 2px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 10pt; }
  pre { background: #1F1A14; color: #FAF8F4; padding: 14px 16px; border-radius: 8px; overflow-x: auto; font-size: 10pt; font-family: 'JetBrains Mono', monospace; page-break-inside: avoid; }
  pre code { background: transparent; padding: 0; color: inherit; }
  blockquote { border-left: 3px solid #B8956B; padding-left: 14px; margin: 14px 0; color: #6B6253; font-style: italic; }
  strong { color: #1F1A14; }
  hr { border: none; border-top: 1px solid #E6DDD0; margin: 22px 0; }
  header { border-bottom: 2px solid #B8956B; padding-bottom: 14px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; page-break-after: avoid; }
  footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #E6DDD0; font-size: 8.5pt; color: #807767; display: flex; justify-content: space-between; }
  .print-banner { background: #F2E9D5; border: 1px solid #D4C8B0; padding: 14px 18px; border-radius: 10px; margin-bottom: 22px; font-size: 11pt; color: #6B6253; }
  @media print { .print-banner { display: none !important; } }
</style>
</head><body>
  <div class="print-banner">
    <strong>Print dialog akan otomatis muncul.</strong> Pilih <em>Save as PDF</em> di Destination, lalu klik Save. Margin sudah diatur otomatis untuk A4. Tutup tab ini setelah selesai.
  </div>
  <header>
    <div>
      <div style="font-size:9pt;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#A07A38;margin-bottom:6px;">Sintesis Atmaja</div>
      <h1>${safeTitle}</h1>
    </div>
    <div style="text-align:right;font-size:9pt;color:#6B6253;">
      <div style="font-family:Georgia,serif;font-size:13pt;font-weight:600;color:#1F1A14;margin-bottom:4px;">Gerai 1000 Pintu</div>
      <div>${dateStr}</div>
      <div>${timeStr} WITA</div>
    </div>
  </header>
  <p style="font-size:10pt;color:#807767;font-style:italic;margin:0 0 22px;">${safeSubtitle}</p>
  <div>${contentHtml}</div>
  <footer>
    <span style="font-family:Georgia,serif;font-size:11pt;color:#A07A38;">Atmaja</span>
    <span>gerai.mahewwork.com</span>
  </footer>
  <script>
    // Auto-trigger print() setelah content load. Browser tampilkan native print dialog,
    // user pilih "Save as PDF" untuk dapat PDF beneran. Popup tidak boleh auto-close,
    // user harus bisa interact dengan print dialog sampai selesai.
    function triggerPrint() {
      try {
        window.focus()
        window.print()
      } catch (e) {
        document.body.insertAdjacentHTML('beforeend',
          '<div style="position:fixed;top:0;left:0;right:0;background:#A55974;color:#fff;padding:14px;font-family:sans-serif;font-size:14px;text-align:center;z-index:9999;">Print dialog gagal trigger otomatis. Tekan Ctrl+P (Cmd+P di Mac) untuk save as PDF.</div>')
      }
    }
    // Wait fonts + layout settle, then trigger print
    if (document.readyState === 'complete') {
      setTimeout(triggerPrint, 700)
    } else {
      window.addEventListener('load', () => setTimeout(triggerPrint, 700))
    }
    // Don't auto-close — user perlu interact dengan print dialog
  </script>
</body></html>`

  // PENTING: jangan pakai noopener,noreferrer — bikin popup orphan + auto-close
  // sebelum user sempat interact dengan print dialog. Default flags = popup stay alive.
  const popup = window.open('', '_blank')
  if (!popup) {
    // Popup blocked — fallback ke download HTML
    console.warn('[exportPdf] popup blocked, falling back to HTML download')
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeFilename(safeTitle)}.html`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
      URL.revokeObjectURL(url)
    }, 2000)
    showResultToast('Popup blocked. HTML ter-download, buka file lalu Ctrl+P → Save as PDF.', false)
    return true
  }

  // Tulis HTML ke popup. Browser akan auto load + trigger print() via script di body.
  popup.document.write(printHtml)
  popup.document.close()
  showResultToast('Print dialog akan terbuka. Pilih Save as PDF untuk download.')
  return true
}

// Legacy html2pdf path — kept untuk backward compat tapi tidak dipanggil lagi karena unreliable.
export async function exportMessageAsPdf(options: ExportPdfOptions): Promise<boolean> {
  // Default sekarang pakai print-via-popup yang proven reliable
  return exportMessageAsPdfViaPrint(options)
}

// @ts-expect-error legacy fallback, kept for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _exportMessageAsPdfViaHtml2Canvas_LEGACY(options: ExportPdfOptions): Promise<boolean> {
  const generatingToast = showGeneratingToast()
  const container = buildPdfContainer(options)
  document.body.appendChild(container)

  const standalone = isPwaStandalone()
  console.info('[exportPdf] PWA standalone mode:', standalone, '| UA:', navigator.userAgent.slice(0, 80))

  const cleanup = () => {
    try { document.body.removeChild(container) } catch {}
    try { document.body.removeChild(generatingToast) } catch {}
  }

  // Timeout supaya spinner tidak hang forever
  const TIMEOUT_MS = 45_000
  let timedOut = false
  const timeoutHandle = window.setTimeout(() => {
    timedOut = true
    cleanup()
    showResultToast('PDF generation timeout (45s). Coba lagi atau dokumen lebih kecil.', true)
  }, TIMEOUT_MS)

  const filename = `${safeFilename(options.title ?? 'Sintesis_Atmaja')}.pdf`

  try {
    // Beri waktu DOM untuk render (fonts, layout) sebelum capture
    await new Promise((r) => window.setTimeout(r, 200))

    // Lazy import html2pdf (cached setelah first call)
    const html2pdfModule = await import('html2pdf.js')
    if (timedOut) return false

    // Type definition untuk html2pdf chain API. Pakai outputPdf('blob') supaya
    // kita bisa manual control download (lebih reliable di PWA standalone).
    type Html2PdfInstance = {
      from: (el: HTMLElement) => Html2PdfInstance
      set: (opts: Record<string, unknown>) => Html2PdfInstance
      output: (type: 'blob' | 'datauristring' | 'arraybuffer') => Promise<Blob | string | ArrayBuffer>
      save: () => Promise<void>
    }
    const html2pdfFactory = (html2pdfModule.default ?? html2pdfModule) as unknown as () => Html2PdfInstance

    console.info('[exportPdf] html2pdf loaded, generating PDF blob...')

    // Scroll page ke container biar html2canvas bisa capture (kalau perlu)
    // Container ada di top: 100vh = below viewport, scrollIntoView sebentar
    const containerRect = container.getBoundingClientRect()
    console.info('[exportPdf] container initial rect:', {
      top: containerRect.top,
      left: containerRect.left,
      width: containerRect.width,
      height: containerRect.height,
      scrollHeight: container.scrollHeight,
      offsetHeight: container.offsetHeight,
      innerHTML_length: container.innerHTML.length,
      children: container.children.length,
    })

    // Container sekarang permanently rendered dengan opacity 0.01 (no visibility flip race).
    // Tunggu fonts + image + markdown render settle.
    await new Promise((r) => window.setTimeout(r, 1000))

    const finalRect = container.getBoundingClientRect()
    console.info('[exportPdf] container final rect:', {
      top: finalRect.top,
      width: finalRect.width,
      height: finalRect.height,
      scrollHeight: container.scrollHeight,
      offsetHeight: container.offsetHeight,
    })

    // Defensive: kalau height masih 0, force height via inline style supaya html2canvas
    // dapat dimensions valid. Bisa terjadi kalau parent ancestor punya display:flex collapse.
    if (finalRect.height < 100 || container.scrollHeight < 100) {
      console.warn('[exportPdf] container height suspicious (<100px), forcing height')
      container.style.height = 'auto'
      container.style.minHeight = `${Math.max(container.scrollHeight, 1000)}px`
      // Last resort: explicitly set computed height from content children
      const childrenHeight = Array.from(container.children).reduce(
        (sum, child) => sum + (child as HTMLElement).offsetHeight,
        0,
      )
      if (childrenHeight > 0) {
        container.style.height = `${childrenHeight + 80}px`
        console.info('[exportPdf] forced height to', childrenHeight + 80, 'px')
      }
      await new Promise((r) => window.setTimeout(r, 300))
    }

    // Generate PDF as Blob — jangan langsung .save() yang internal trigger download
    // tapi sering gagal di PWA standalone karena user gesture lost
    const pdfBlob = (await html2pdfFactory()
      .from(container)
      .set({
        margin: [12, 10, 14, 10], // mm: top, left, bottom, right
        filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: true,
          letterRendering: true,
          backgroundColor: '#FAF8F4',
          // Pakai container width sebagai windowWidth — supaya html2canvas viewport match
          // BUKAN screen size (yang bisa lebih kecil di mobile dan crop content).
          windowWidth: 850,
          // height auto dari content, BUKAN cap 1200 (yang motong content panjang jadi blank).
          scrollX: 0,
          scrollY: 0,
          // Force render dari element sendiri, bukan dari window
          foreignObjectRendering: false,
          removeContainer: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true,
        },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'thead', 'pre', 'blockquote'] },
      })
      .output('blob')) as Blob

    if (timedOut) return false
    window.clearTimeout(timeoutHandle)
    cleanup()

    console.info('[exportPdf] PDF blob generated, size:', pdfBlob.size, 'bytes, type:', pdfBlob.type)

    // === DOWNLOAD STRATEGY ===
    // Method 1 (PREFERRED): FileSystem Access API — native save dialog,
    //   user pilih folder + filename, reliable di PWA standalone Chrome/Edge
    // Method 2 (FALLBACK): Anchor click — works di browser biasa
    // Method 3 (LAST RESORT): Open in new tab — user save manual

    const fsResult = await downloadViaFileSystemApi(pdfBlob, filename)
    if (fsResult === 'success') {
      showResultToast('PDF tersimpan ke file system')
      return true
    }
    if (fsResult === 'cancelled') {
      showResultToast('Download dibatalkan')
      return false
    }
    // 'unsupported' atau 'error' → coba fallback

    console.info('[exportPdf] FileSystem API not used, trying anchor click...')
    const anchorOk = downloadViaAnchor(pdfBlob, filename)
    if (anchorOk && !standalone) {
      // Di browser biasa, anchor click biasanya jalan. Show success.
      showResultToast('PDF berhasil di-download. Cek Downloads folder.')
      return true
    }

    // Standalone PWA: anchor sering silent fail. Pakai new tab fallback supaya
    // user PASTI lihat PDF + bisa save manual.
    console.warn('[exportPdf] PWA standalone — bypass ke new tab fallback supaya reliable')
    const tabOk = openBlobInNewTab(pdfBlob)
    if (tabOk) {
      showResultToast(
        'PDF terbuka di tab baru. Tap titik tiga di atas → Download atau Save as PDF.',
      )
      return true
    }

    showResultToast('Gagal trigger download. Coba pakai browser biasa (bukan PWA standalone).', true)
    return false
  } catch (err) {
    if (timedOut) return false
    window.clearTimeout(timeoutHandle)
    console.error('[exportPdf] html2pdf failed:', err)
    cleanup()
    showResultToast(
      `Gagal generate PDF: ${err instanceof Error ? err.message : 'unknown'}`,
      true,
    )
    return false
  }
}

/**
 * Generate title singkat untuk PDF header dari first paragraph user prompt + Atmaja reply.
 * Fallback ke "Sintesis Atmaja".
 */
export function deriveTitleFromMessage(text: string, fallback = 'Sintesis Atmaja'): string {
  if (!text) return fallback
  const headingMatch = text.match(/^#+\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim().slice(0, 80)
  const firstSentence = text
    .replace(/^[\s>*-]+/, '')
    .split(/[.!?]/)[0]
    ?.trim()
  if (firstSentence && firstSentence.length > 3 && firstSentence.length < 90) {
    return firstSentence
  }
  return fallback
}

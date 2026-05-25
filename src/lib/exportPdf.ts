// Export PDF dari Atmaja message ke browser native print dialog.
// Pakai HIDDEN IFRAME approach supaya kompatibel dengan PWA standalone mode
// (window.open biasanya di-block di PWA standalone).
//
// Cara kerja:
// 1. Create hidden iframe (offscreen, 0×0)
// 2. Write branded HTML ke iframe.contentDocument
// 3. iframe.contentWindow.print() trigger native print dialog di atas PWA
// 4. User pilih "Save as PDF" di dialog → dapat file PDF
// 5. Fallback kalau iframe gagal: download as .html (user double-click → open di browser → print)

interface ExportPdfOptions {
  /** Innerhtml dari rendered markdown (sudah di-style oleh MarkdownBlock) */
  contentHtml: string
  /** User-facing title untuk PDF header */
  title?: string
  /** Optional brief context (misal: "Dari chat dengan Atmaja, 25 Mei 2026") */
  subtitle?: string
}

export function exportMessageAsPdf({ contentHtml, title, subtitle }: ExportPdfOptions): boolean {

  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const safeTitle = String(title ?? 'Sintesis Atmaja').replace(/[<>]/g, '')
  const safeSubtitle = String(subtitle ?? `Gerai 1000 Pintu, ${dateStr} pukul ${timeStr} WITA`).replace(
    /[<>]/g,
    '',
  )

  // HTML lengkap dengan brand canon styling (warm ivory + brass + Cormorant serif accent)
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — Gerai 1000 Pintu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #FAF8F4;
      color: #1F1A14;
      font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11.5pt;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    body {
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 32px 64px;
    }
    /* Header brand */
    .gerai-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding-bottom: 18px;
      margin-bottom: 28px;
      border-bottom: 2px solid #B8956B;
    }
    .gerai-header-left .label {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #A07A38;
      margin-bottom: 6px;
    }
    .gerai-header-left .title {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 28pt;
      font-weight: 600;
      line-height: 1;
      color: #1F1A14;
      letter-spacing: -0.01em;
    }
    .gerai-header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #6B6253;
      font-weight: 500;
    }
    .gerai-header-right .brand {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 13pt;
      font-weight: 600;
      color: #1F1A14;
      margin-bottom: 4px;
    }

    /* Subtitle */
    .gerai-subtitle {
      font-size: 10pt;
      color: #807767;
      font-weight: 500;
      margin-bottom: 24px;
      font-style: italic;
    }

    /* Content typography (mirror MarkdownBlock styling) */
    .gerai-content { color: #1F1A14; }
    .gerai-content h1 {
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: -0.012em;
      margin: 28px 0 12px;
      color: #1F1A14;
    }
    .gerai-content h2 {
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: -0.008em;
      margin: 22px 0 10px;
      color: #1F1A14;
    }
    .gerai-content h3 {
      font-size: 12pt;
      font-weight: 600;
      margin: 16px 0 6px;
      color: #1F1A14;
    }
    .gerai-content p {
      margin: 0 0 12px;
      line-height: 1.65;
    }
    .gerai-content strong { font-weight: 600; color: #1F1A14; }
    .gerai-content em { font-style: italic; color: #6B6253; }
    .gerai-content ul, .gerai-content ol {
      margin: 0 0 14px;
      padding-left: 0;
      list-style: none;
    }
    .gerai-content ol { counter-reset: list-counter; }
    .gerai-content ul li, .gerai-content ol li {
      margin: 0 0 6px;
      padding-left: 22px;
      position: relative;
      line-height: 1.6;
    }
    .gerai-content ul li::before {
      content: '•';
      position: absolute;
      left: 8px;
      color: #A07A38;
      font-weight: 700;
    }
    .gerai-content ol li {
      counter-increment: list-counter;
    }
    .gerai-content ol li::before {
      content: counter(list-counter) '.';
      position: absolute;
      left: 0;
      width: 18px;
      color: #A07A38;
      font-weight: 700;
    }
    .gerai-content a {
      color: #A07A38;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .gerai-content blockquote {
      margin: 14px 0;
      padding-left: 14px;
      border-left: 3px solid #B8956B;
      color: #6B6253;
      font-style: italic;
    }
    .gerai-content code {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', monospace;
      font-size: 0.92em;
      background: rgba(184, 149, 107, 0.12);
      padding: 1px 6px;
      border-radius: 4px;
      color: #A07A38;
    }
    .gerai-content pre {
      margin: 12px 0;
      padding: 14px 16px;
      background: #F1ECE3;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 9.5pt;
      line-height: 1.5;
    }
    .gerai-content pre code {
      background: transparent;
      padding: 0;
      color: #1F1A14;
    }
    .gerai-content hr {
      margin: 22px 0;
      border: none;
      border-top: 1px solid #E6DDD0;
    }
    /* Tables */
    .gerai-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 14px 0;
      font-size: 10pt;
      border: 1px solid #E6DDD0;
      border-radius: 8px;
      overflow: hidden;
    }
    .gerai-content thead {
      background: #F1ECE3;
    }
    .gerai-content th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #1F1A14;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #E6DDD0;
    }
    .gerai-content td {
      padding: 10px 12px;
      border-top: 1px solid #F0E9DC;
      vertical-align: top;
    }
    .gerai-content tr:nth-child(even) td {
      background: #FCFAF6;
    }

    /* Footer */
    .gerai-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #E6DDD0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      color: #807767;
    }
    .gerai-footer .left {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 11pt;
      color: #A07A38;
    }

    /* Print-specific */
    @media print {
      body {
        padding: 0;
        background: #FFFFFF;
      }
      .gerai-no-print { display: none !important; }
      a { color: #1F1A14; text-decoration: none; }
      .gerai-content pre { page-break-inside: avoid; }
      .gerai-content h1, .gerai-content h2, .gerai-content h3 { page-break-after: avoid; }
      .gerai-content table { page-break-inside: avoid; }
    }

    /* Toolbar (non-print) */
    .gerai-toolbar {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 10;
    }
    .gerai-toolbar button {
      background: #1F1A14;
      color: #FAF8F4;
      border: none;
      padding: 10px 16px;
      border-radius: 999px;
      font-family: inherit;
      font-size: 10.5pt;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(31, 26, 20, 0.2);
    }
    .gerai-toolbar button.secondary {
      background: rgba(255, 255, 255, 0.95);
      color: #1F1A14;
      border: 1px solid #E6DDD0;
    }
  </style>
</head>
<body>
  <div class="gerai-toolbar gerai-no-print">
    <button onclick="window.print()" class="primary">Simpan PDF</button>
    <button onclick="window.close()" class="secondary">Tutup</button>
  </div>

  <header class="gerai-header">
    <div class="gerai-header-left">
      <div class="label">Sintesis Atmaja</div>
      <div class="title">${safeTitle}</div>
    </div>
    <div class="gerai-header-right">
      <div class="brand">Gerai 1000 Pintu</div>
      <div>${dateStr}</div>
      <div>${timeStr} WITA</div>
    </div>
  </header>

  <p class="gerai-subtitle">${safeSubtitle}</p>

  <div class="gerai-content">
    ${contentHtml}
  </div>

  <footer class="gerai-footer">
    <span class="left">Atmaja</span>
    <span>Generated dari chat Atmaja. gerai.mahewwork.com</span>
  </footer>


</body>
</html>`

  // === IFRAME APPROACH (works in PWA standalone) ===
  // Create hidden iframe, write HTML, trigger print via iframe.contentWindow.print()
  // CRITICAL: cleanup iframe + restore focus to chat textarea IMMEDIATELY setelah
  // print() return (sync di Chrome). Tidak boleh leave iframe focused — kalau iya,
  // typing user akan masuk ke iframe content, bukan chat input.
  console.info('[exportPdf] starting export via iframe approach...')

  // Capture current focused element supaya bisa restore setelah print
  const previouslyFocused = document.activeElement as HTMLElement | null

  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.setAttribute('tabindex', '-1')
    iframe.title = 'PDF preview'
    iframe.style.position = 'fixed'
    iframe.style.left = '-99999px'
    iframe.style.top = '0'
    iframe.style.width = '794px' // A4 width at 96 DPI
    iframe.style.height = '1123px' // A4 height at 96 DPI
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const idoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!idoc) {
      console.warn('[exportPdf] iframe document not accessible, fallback to HTML download')
      document.body.removeChild(iframe)
      return downloadAsHtmlFile(html, safeTitle)
    }

    idoc.open()
    idoc.write(html)
    idoc.close()

    let printed = false

    // Cleanup helper: hapus iframe + restore focus ke previous focused element
    // (biasanya chat textarea). Penting supaya typing user tidak nyangkut di iframe.
    const cleanup = () => {
      try {
        // Blur iframe + clear content supaya tidak bisa capture input
        iframe.contentWindow?.blur?.()
        if (iframe.contentDocument?.body) {
          iframe.contentDocument.body.innerHTML = ''
        }
      } catch {
        // ignore
      }
      try {
        document.body.removeChild(iframe)
      } catch {
        // ignore
      }
      // Restore focus ke chat input atau body
      try {
        if (previouslyFocused && document.body.contains(previouslyFocused)) {
          previouslyFocused.focus()
        } else {
          // Cari textarea chat sebagai fallback target
          const chatInput = document.querySelector(
            'textarea[placeholder*="Tanya"], textarea[placeholder*="Atmaja"]',
          )
          if (chatInput instanceof HTMLElement) {
            chatInput.focus()
          } else {
            window.focus()
          }
        }
      } catch {
        // ignore
      }
    }

    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        const win = iframe.contentWindow
        if (!win) {
          console.warn('[exportPdf] iframe.contentWindow null')
          cleanup()
          downloadAsHtmlFile(html, safeTitle)
          return
        }
        // Print: di Chrome desktop sync (block sampai user close dialog),
        // di Firefox/Safari kadang async. Cleanup setelah print return.
        win.print()
        console.info('[exportPdf] print() returned, cleaning up...')
      } catch (err) {
        console.error('[exportPdf] iframe.print() failed:', err)
        cleanup()
        downloadAsHtmlFile(html, safeTitle)
        return
      }
      // Cleanup IMMEDIATELY setelah print() — restore focus ke chat input.
      // Di sync print() (Chrome), ini run after user close dialog.
      // Di async print() (Firefox), dialog still appears karena sudah ke-trigger,
      // tapi iframe focus ter-release dengan cepat.
      cleanup()
      // Safety net: kalau cleanup gagal pertama kali, retry setelah 5s
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          console.warn('[exportPdf] cleanup retry')
          cleanup()
        }
      }, 5000)
    }

    // Wait iframe load + fonts ready
    iframe.onload = () => {
      // Wait fonts kalau available
      const win = iframe.contentWindow
      const fontsReady = win?.document?.fonts?.ready
      if (fontsReady && typeof fontsReady.then === 'function') {
        fontsReady.then(() => window.setTimeout(triggerPrint, 250))
      } else {
        window.setTimeout(triggerPrint, 700)
      }
    }

    // Fallback timeout — kalau onload tidak fire dalam 3s, force print
    window.setTimeout(() => {
      if (!printed) {
        console.warn('[exportPdf] onload timeout, force trigger print')
        triggerPrint()
      }
    }, 3000)

    return true
  } catch (err) {
    console.error('[exportPdf] iframe approach failed:', err)
    return downloadAsHtmlFile(html, safeTitle)
  }
}

// Fallback: download as .html file kalau iframe approach gagal. User open .html
// di browser, lalu Ctrl/Cmd+P → Save as PDF manually.
function downloadAsHtmlFile(html: string, title: string): boolean {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = String(title || 'Sintesis Atmaja')
      .replace(/[^\w\s\-À-ɏ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60)
    a.download = `${safeName || 'Sintesis_Atmaja'}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    // Inform user dengan toast/alert ringan
    alert(
      'PDF print belum bisa di-trigger langsung di PWA. File .html sudah diunduh — buka di browser lalu Ctrl+P (atau Cmd+P) untuk Save as PDF.',
    )
    return true
  } catch (err) {
    console.error('[exportPdf] downloadAsHtmlFile failed:', err)
    alert('Gagal generate file PDF. Coba reload PWA atau pakai browser desktop.')
    return false
  }
}

/**
 * Generate title singkat untuk PDF header dari first paragraph user prompt + Atmaja reply.
 * Fallback ke "Sintesis Atmaja".
 */
export function deriveTitleFromMessage(text: string, fallback = 'Sintesis Atmaja'): string {
  if (!text) return fallback
  // Ambil heading pertama kalau ada
  const headingMatch = text.match(/^#+\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim().slice(0, 80)
  // Atau kalimat pertama
  const firstSentence = text
    .replace(/^[\s>*-]+/, '')
    .split(/[.!?]/)[0]
    ?.trim()
  if (firstSentence && firstSentence.length > 3 && firstSentence.length < 90) {
    return firstSentence
  }
  return fallback
}

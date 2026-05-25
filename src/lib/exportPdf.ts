// Export PDF dari Atmaja message ke browser native print dialog.
// User pilih "Save as PDF" di dialog → dapat PDF berkualitas tinggi.
// Tidak butuh extra library (no jsPDF/html2canvas), bundle tetap kecil.
//
// Cara kerja:
// 1. Buka window baru dengan HTML yang sudah di-style brand canon
// 2. Embed content message (markdown sudah ter-render via react-markdown)
// 3. Auto-trigger window.print() setelah onload
// 4. User klik "Save as PDF" di print dialog

interface ExportPdfOptions {
  /** Innerhtml dari rendered markdown (sudah di-style oleh MarkdownBlock) */
  contentHtml: string
  /** User-facing title untuk PDF header */
  title?: string
  /** Optional brief context (misal: "Dari chat dengan Atmaja, 25 Mei 2026") */
  subtitle?: string
}

export function exportMessageAsPdf({ contentHtml, title, subtitle }: ExportPdfOptions): boolean {
  // Open blank window. Pakai about:blank biar tidak terkena CSP atau cross-origin.
  const printWindow = window.open('', '_blank', 'width=920,height=900')
  if (!printWindow) {
    alert('Browser memblokir pop-up. Izinkan pop-up untuk gerai.mahewwork.com agar bisa simpan PDF.')
    return false
  }

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

  <script>
    // Auto-trigger print dialog setelah font load (atau timeout fallback).
    function tryPrint() {
      try { window.focus(); window.print(); } catch (e) {}
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(tryPrint, 200))
    } else {
      setTimeout(tryPrint, 700)
    }
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  return true
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

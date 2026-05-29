# Document Output Paths — 3 Cara Dapat Document dari Atmaja

3 path tersedia untuk Matthew dapat dokumen formal dari AI Department. Pilih sesuai kebutuhan.

---

## Path A: MCP `generate_document` tool (Recommended for PDF)

**Atmaja invoke tool → URL ke styled HTML → browser print → PDF**

### Cara Pakai

Matthew minta Atmaja:
```
Atmaja, buatkan executive brief Wave 1 marketing decision dalam document format.
Generate via tool generate_document supaya bisa di-PDF.
```

Atmaja akan:
1. Synthesize content
2. Invoke `generate_document(title, content_markdown)`
3. Return URL (e.g., `https://blob.vercel-storage.com/documents/1735420800-wave-1-marketing.html`)
4. Matthew click URL → buka di browser

### Convert ke PDF

Di browser:
- **Chrome/Edge:** Ctrl+P → Destination: "Save as PDF" → Save
- **Safari:** Cmd+P → "Save as PDF" dari dropdown bawah kiri → Save
- **Firefox:** Ctrl+P → "Save to File" → format PDF

### Pros
- ✅ Brand canon styled (Brass + Charcoal + Ivory palette)
- ✅ Professional layout (Playfair Display + Inter typography)
- ✅ Print-optimized (margin, page break, hidden navigation)
- ✅ Tabel + code + blockquote semua rendered properly
- ✅ Public URL, bisa share langsung

### Cons
- 1 extra step (browser print → PDF)
- HTML temporary di Vercel Blob (persistent sampai manual delete)

---

## Path B: LibreChat Artifacts (Real-time render in chat)

**Atmaja generate artifact → render in-line di chat → Matthew copy**

### Cara Pakai

Atmaja Agent sudah punya Artifacts capability **enabled**. Saat Atmaja generate content yang structured, dia akan auto-create artifact panel di chat.

Matthew minta Atmaja:
```
Atmaja, kasih Wave 1 marketing strategy dalam format artifact yang bisa saya
render. Markdown ya supaya saya bisa edit + export.
```

Atmaja akan generate artifact (markdown atau HTML), render di **panel kanan chat** (atau popup).

### Export dari Artifact

- Copy markdown → paste ke Notion / Google Docs / Word → export PDF
- Copy HTML → save sebagai `.html` file → open browser → Ctrl+P
- Copy → paste ke Typora / Mark Text → export PDF langsung

### Pros
- ✅ Real-time render di chat (immediate feedback)
- ✅ Editable artifact (Matthew bisa iterate)
- ✅ No upload to external (privacy)

### Cons
- Manual copy-paste step
- Styling tergantung tool tujuan
- Tidak auto-share via URL

---

## Path C: Markdown Plain + Manual Render

**Atmaja kasih markdown content → Matthew render via tool pilihan**

### Cara Pakai

Default behavior. Matthew minta:
```
Atmaja, kasih content untuk weekly report Wave 1 dalam markdown.
```

Atmaja kasih markdown plain di chat response.

### Tools untuk Render Markdown → PDF (Free)

| Tool | Platform | Setup | Output Quality |
|---|---|---|---|
| **Pandoc** | CLI cross-platform | `brew install pandoc` / `apt install pandoc` | Excellent (LaTeX template support) |
| **Typora** | Desktop GUI | Download from typora.io | Excellent (WYSIWYG preview) |
| **Mark Text** | Desktop GUI | Download free | Very good |
| **Obsidian** | Desktop GUI | Download free, paste markdown | Good (limited PDF export) |
| **VS Code** | Editor + extension | Install "Markdown PDF" extension | Good |
| **md-to-pdf.com** | Web tool | Just paste, click convert | Quick + zero install |
| **Dillinger.io** | Web tool | Paste, click "Export as PDF" | Quick |
| **StackEdit.io** | Web tool | Paste, File → Export → PDF | Quick |

### Pandoc Recommended Workflow

Install once:
```bash
# macOS
brew install pandoc basictex

# Linux  
sudo apt install pandoc texlive-xetex

# Windows (via Chocolatey)
choco install pandoc miktex
```

Use:
```bash
# Save Atmaja output as input.md
pandoc input.md -o output.pdf --pdf-engine=xelatex \
  --variable mainfont="Inter" \
  --variable monofont="SF Mono" \
  --variable fontsize=11pt \
  --variable geometry:margin=1in
```

Hasil: professional PDF dengan typography control penuh.

### Pros (Path C)
- ✅ Zero dependency on AI tools
- ✅ Full control over styling
- ✅ Best for power users (Pandoc/LaTeX)
- ✅ Free, offline

### Cons
- Manual workflow per document
- Setup tool sekali (Pandoc, Typora, dll)
- Tidak terintegrasi dengan AI Department

---

## Decision Matrix

| Use Case | Recommended Path |
|---|---|
| Internal weekly brief | Path A (quick + branded) |
| Customer-facing proposal | Path A (branded) or Path C with custom Pandoc template |
| Decision document for vault | Path A (also auto-log via `log_decision`) |
| Quick draft for iteration | Path B (Artifacts, editable) |
| Long-form report (>10 pages) | Path C with Pandoc (better page break control) |
| Meeting notes | Path C (paste to Notion, export) |
| Investor deck | External (Canva, Google Slides) + content from Atmaja |

---

## Atmaja Behavior Guide

**Default:** Atmaja deliver content in chat (markdown plain). Matthew choose path.

**When Matthew explicitly says:**
- "PDF" / "document" / "formal brief" → Atmaja invoke `generate_document` (Path A)
- "artifact" / "render in chat" → Atmaja create artifact (Path B)
- "markdown" / "raw" / default → Atmaja plain markdown (Path C)

**For decision logs:**
- Atmaja always invoke `log_decision` (vault append) PLUS `generate_document` (PDF deliverable) if Matthew want both formats.

---

## Future Enhancement (Phase 4)

Possible improvements:
- Add `format: 'pdf'` parameter di `generate_document` → server-side PDF render via Puppeteer (eliminate Ctrl+P step)
- Add template variants: "brief", "proposal", "report", "memo" with different layouts
- Add cover page generator
- Add table of contents auto-generation for long docs
- Export to DOCX (for editable Word output)
- Direct integration with Google Drive / Notion API

Defer until Matthew need + use case validates.

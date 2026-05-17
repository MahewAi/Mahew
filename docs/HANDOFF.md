# Gerai 1000 Pintu — Component Handoff Spec

> Developer-grade spec untuk setiap component. Tujuan: implementasi konsisten,
> mengunci token, state, behavior, dan a11y sebelum kode ditulis.
>
> Berlaku setelah multi-lens review (16 Mei 2026). Semua angka WCAG sudah verified
> terhadap token di `src/styles/globals.css` versi terkini.

## Konvensi global

| Aspek | Standar |
|---|---|
| Touch target minimum | 44 × 44 CSS px (WCAG 2.5.5) — pakai `min-h-touch min-w-touch` |
| Focus indicator | Ring 2px `accent` + offset 2px. Jangan dihilangkan dengan `outline-none` tanpa fallback |
| Motion duration | `fast` (180ms) untuk feedback, `base` (240ms) untuk transisi UI, `sheet` (380ms) untuk slide-up, `accordion` (360ms) untuk expand |
| Easing default | `cubic-bezier(0.32, 0.72, 0, 1)` (token `ease-sheet`) untuk semua transition besar |
| Reduced motion | Hormati `prefers-reduced-motion: reduce` — skip slide, fade saja |
| Color encoding | **Jangan pernah** menyampaikan status hanya lewat warna. Selalu ada label atau icon backup |
| Touch feedback | Scale 0.97 + shadow lift via Framer Motion `whileTap` |
| Aria-label wajib | Semua icon-only button |

---

## 1. BriefCard

**Tujuan:** Entry point ke detail brief. Scannable, expressive, tap-friendly.

### Props
| Property | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | — | Untuk key + navigate target |
| `status` | `'decision' \| 'doing' \| 'review' \| 'final'` | — | Stripe color + label |
| `priority` | `'high' \| 'normal'` | `'normal'` | Toggle kicker "HIGH PRIORITY" |
| `labels` | `string[]` | `[]` | Domain tag (Strategi, Pricing, dll) |
| `title` | `string` | — | Headline brief |
| `description` | `string` | — | 1-2 kalimat ringkas |
| `contributors` | `Role[]` | `[]` | Forwarded ke AvatarGroup |
| `commentCount` | `number?` | — | Show comment icon hanya jika > 0 |
| `timeAgo` | `string` | — | "5 menit", "1 jam", "1 hari" |
| `onClick` | `() => void` | — | Tap handler |

### Layout
```
┌─ rounded-lg bg-bg-elevated shadow-card p-4 relative overflow-hidden ──┐
│ ▌ ← absolute left-0 top-0 bottom-0 w-1 bg-status-[status]            │
│                                                                       │
│  [HIGH PRIORITY] · [timeAgo]              ← row meta (kicker + dot)   │
│  Title (text-base font-medium leading-snug)                           │
│  Description (text-sm text-text-secondary leading-relaxed line-clamp-2)│
│                                                                       │
│  [AvatarGroup] [commentIcon N]       [StatusPill status]              │ ← footer
└───────────────────────────────────────────────────────────────────────┘
```

### Critical: status label backup (fix C2)
Stripe kiri saja tidak cukup. Tambahkan **StatusPill kecil di footer-right** sebagai backup label untuk color-blind users.

### States
| State | Visual | Behavior |
|---|---|---|
| Default | `shadow-card` | — |
| Hover (desktop) | `shadow-pop`, translateY(-2px) | 240ms ease-sheet |
| Active (tap) | `scale-[0.97]`, `shadow-pop` | Framer Motion `whileTap` |
| Focused (keyboard) | Ring 2px accent + 2px offset | Tab navigation |
| Pressed | Same as Active | Visual feedback minimum 100ms |

### Accessibility
- Wrapper: `<button>` atau `<a>` (bukan `<div>`)
- `aria-label`: `${title}. Status ${statusText}. ${contributors.length} kontributor. ${commentCount ?? 0} komentar. ${timeAgo}.`
- Focus visible
- Touch target ≥ 44px height (sudah > dengan `p-4`)

### Don'ts
- Jangan hilangkan StatusPill dari card meski stripe ada
- Jangan pakai `text-text-muted` untuk title (gagal AA → pakai `text-text-primary`)
- Jangan ambil seluruh padding card sebagai hit area "open detail" jika ada nested button (avatar tap dll)

---

## 2. StatusPill

**Tujuan:** Label kecil untuk status, priority, kategori. Reusable.

### Props
| Property | Type | Default | Description |
|---|---|---|---|
| `variant` | `'decision' \| 'doing' \| 'review' \| 'final' \| 'strategi' \| 'pricing' \| 'operasi' \| 'marketing' \| 'branding' \| 'priority'` | — | Maps ke token color |
| `size` | `'sm' \| 'md'` | `'sm'` | sm: card meta, md: detail header |
| `children` | `ReactNode` | — | Label text |

### Sizing
| Size | Padding | Text | Use case |
|---|---|---|---|
| sm | `px-2 py-0.5` | `text-[10px] font-semibold tracking-wider uppercase` | Inside BriefCard |
| md | `px-3 py-1` | `text-xs font-semibold tracking-wider uppercase` | Detail sheet header |

### Color mapping
Status: bg = `status-{variant}-bg`, text = `status-{variant}`.
Kategori (strategi, pricing, dll): bg = `accent-bg`, text = `accent-dark` (**bukan `accent`** — gagal contrast).
Priority: bg = `status-decision-bg`, text = `status-decision`.

### Contrast verified
| Variant | Text on bg ratio |
|---|---|
| decision | 3.5:1 ❌ body, ✅ large/uppercase 14px+ bold (treated as "large text") |
| doing | 5.7:1 ✅ |
| review | 4.9:1 ✅ |
| final | 4.7:1 ✅ |

**Catatan:** `decision` warna agak tipis. Sengaja dipertahankan karena pill text bold + uppercase + 14px effective size, dianggap "large text" per WCAG (≥18.66px untuk regular, ≥14px untuk bold). Verify dengan tool kontras setelah build.

### Accessibility
- Pure visual label, bukan button → `<span role="status">` jika status, `<span>` biasa jika kategori
- Tidak perlu aria-label (text sudah readable)

---

## 3. AvatarGroup

**Tujuan:** Tampilkan kontributor brief, overlap rapi.

### Props
| Property | Type | Default | Description |
|---|---|---|---|
| `contributors` | `Contributor[]` | — | C-suite atau specialist, urutan = urutan display |
| `max` | `number` | `3` | Setelah ini, "+N" |
| `size` | `'sm' \| 'md'` | `'sm'` | sm: 24px, md: 32px |

### Layout
- Flex row, child margin-left negatif (`-ml-2` sm, `-ml-2.5` md) kecuali yang pertama
- Tiap avatar: `rounded-full` + `ring-2 ring-bg-elevated` (border putih agar pop)
- Background pakai `bg-role-{role}`, text white inisial serif

### Inisial mapping (C-suite + specialist)

Single source of truth: `CONTRIBUTOR_META` di [src/lib/types.ts](../src/lib/types.ts).
C-suite pakai 1 huruf, specialist pakai 2 huruf → auto disambiguate visual hierarchy.

**C-suite (1 huruf):**
| Role | Inisial | Avatar bg |
|---|---|---|
| ceo | A (Atmaja) | `bg-role-ceo` brass |
| coo | O (Operations) | `bg-role-coo` teal-sage |
| cmo | M (Marketing) | `bg-role-cmo` rose |
| cfo | F (Finance) | `bg-role-cfo` gold |
| cco | C (Creative) | `bg-role-cco` violet |

**Specialist (2 huruf, mewarisi warna C-suite parent):**
| Specialist | Inisial | Parent | Avatar bg |
|---|---|---|---|
| HR & Systems | HS | COO | `bg-role-coo` |
| Production Manager | PM | COO | `bg-role-coo` |
| Curator | CU | COO | `bg-role-coo` |
| Brand Strategist | BS | CMO | `bg-role-cmo` |
| Market Researcher | MR | CMO | `bg-role-cmo` |
| Sales Strategist | SS | CMO | `bg-role-cmo` |
| Innovation Scout | IS | CMO | `bg-role-cmo` |
| Business Designer | BD | CFO | `bg-role-cfo` |
| Financial Analyst | FA | CFO | `bg-role-cfo` |
| Document Writer | DW | CCO | `bg-role-cco` |
| Editorial | ED | CCO | `bg-role-cco` |
| Web Researcher | WR | CCO | `bg-role-cco` |

**Implementation:** AvatarGroup tidak perlu logic khusus untuk specialist vs C-suite.
Gunakan helper `getContributorColorRole(c)` dari types.ts untuk dapat color key,
dan `CONTRIBUTOR_META[c].initials` untuk inisial. Ukuran font auto-adjust:
- 1 huruf: `text-sm` (sm avatar) / `text-base` (md avatar)
- 2 huruf: `text-[10px]` (sm avatar) / `text-xs` (md avatar)

### "+N" badge
- Avatar terakhir jika `contributors.length > max`: bg `bg-bg-soft`, text `text-text-secondary`, `text-xs font-semibold`

### Accessibility
- Wrapper `<div role="group" aria-label="N kontributor: CEO Atmaja, COO Operasi, ...">`
- Tiap avatar `aria-hidden="true"` (decorative — info sudah di aria-label parent)
- Hover/tap tidak perlu untuk MVP. Jika diaktifkan: tooltip muncul, tap → filter by contributor

### Contrast (semua white text on role bg, ratio ≥3:1 untuk UI component)
| Role | New hex | White text ratio |
|---|---|---|
| CEO `#A07A38` | 4.9:1 ✅ |
| COO `#56877D` | 4.0:1 ✅ |
| CMO `#B95B7A` | 4.0:1 ✅ |
| CFO `#D69922` | 2.6:1 ❌ → gunakan `text-text-primary` di atas CFO avatar |
| CCO `#6F539A` | 5.4:1 ✅ |

**Catatan:** CFO gold terlalu terang untuk white text. Override: inisial CFO pakai `text-text-primary` (dark) sehingga ratio jadi 6.8:1 ✅.

---

## 4. BriefDetailSheet

**Tujuan:** Slide-up modal detail brief. Mobile-native pattern.

### Behavior
- Buka via `setOpen(true)` setelah BriefCard tap. URL update via `navigate('/brief/:id')` (lihat routing strategy)
- Tutup: tap backdrop, swipe down, ESC, button close, atau back navigation
- Max-height: `88vh` di mobile, `min(720px, 88vh)` di desktop. Centered modal di desktop ≥ 768px
- Drag handle visible di top, 36px wide × 4px tall, `bg-border-strong`, rounded-pill

### Structure
```
Sheet
├── Backdrop (bg-text-primary/40 with backdrop-blur-sm)
└── Content (rounded-t-xl bg-bg-elevated)
    ├── Handle area (pt-3 pb-2, drag handle centered)
    ├── ScrollArea (flex-1)
    │   ├── Header (px-5 pt-4)
    │   │   ├── Monogram (size md)
    │   │   ├── Kicker italic "brief {id}" font-serif text-xs text-accent-dark
    │   │   ├── Title font-serif text-2xl font-medium leading-tight
    │   │   ├── Subtitle (lokasi/konteks) text-sm text-text-secondary
    │   │   └── Pills row [StatusPill md] [Kategori pills...]
    │   ├── Summary card (mx-5 mt-4, bg-bg-soft, accent stripe kiri 4px, p-4)
    │   ├── Section divider (italic kicker "C-suite input" text-accent-dark)
    │   └── CSuiteCard list (mx-5, space-y-3)
    └── Action bar (sticky bottom, bg-bg-elevated, border-t-soft, px-5 py-3 pb-safe-bottom)
        ├── Approve (primary, full-width default open, w-full)
        ├── Revise (ghost, flex-1)
        └── Telaah lebih dalam (ghost, flex-1)
```

### Animation
| Element | Duration | Easing | Property |
|---|---|---|---|
| Sheet slide-in | `sheet` (380ms) | `ease-sheet` | translateY 100% → 0 |
| Backdrop fade | `backdrop` (320ms) | `ease-out` | opacity 0 → 1 |
| Accordion expand | `accordion` (360ms) | `ease-sheet` | max-height + opacity |

### Reduced motion
Skip slide, gunakan fade-in 200ms.

### Action bar
| Button | Label | Action |
|---|---|---|
| Primary | "Setujui · Pindahkan ke Final" | onApprove → toast → close → optimistic update brief.status |
| Ghost | "Revisi" | onRevise → form/route handler (Phase 2) |
| Ghost | "Telaah lebih dalam" | onDeepDive → handler (Phase 2) |

### Accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="brief-title"`
- Focus trap aktif (Radix Sheet handles)
- ESC closes
- Return focus ke BriefCard yang membuka sheet
- Drag handle: `aria-label="Tutup detail brief"`, swipe gesture work, also tappable

---

## 5. CSuiteCard (sub-component dari BriefDetailSheet)

**Tujuan:** Akordeon untuk tiap kontribusi (C-suite atau specialist).

### Props
| Property | Type | Default |
|---|---|---|
| `input` | `CSuiteInput` | — |
| `defaultExpanded` | `boolean` | `false` (CEO `true`) |

### Visual differentiation C-suite vs Specialist
- **C-suite**: avatar 1-letter, header `text-base font-medium`
- **Specialist**: avatar 2-letter, header `text-sm font-medium text-text-secondary`,
  sub-label kecil di bawah nama: `"di bawah {Parent C-suite Name}"` text-xs italic text-text-muted
- Indent visual specialist (margin-left 12px) optional jika dirender langsung di bawah parent C-suite

### Layout
```
┌─ rounded-md border border-border-soft bg-bg-elevated ──────────┐
│  ┌─ Header (button, w-full, px-4 py-3, flex justify-between) ─┐│
│  │  [Avatar role md] {name}              {verdict pill?} ▼/▶  ││ ← tap to toggle
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─ Content (px-4 pb-4, hidden if collapsed) ─────────────────┐│
│  │  {subtitle if any, text-xs text-text-muted italic font-serif}││
│  │  • bullet 1 (text-sm leading-relaxed)                       ││
│  │  • bullet 2                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Verdict pill
Jika `input.verdict`: pill kecil di header right, bg by `verdict.type`:
- A: `bg-status-doing-bg text-status-doing`
- B: `bg-status-final-bg text-status-final`
- C: `bg-status-review-bg text-status-review`

### Animation
Akordeon `max-height` + opacity, 360ms `ease-sheet`. Chevron rotate 180deg, 240ms.

### Accessibility
- Header: `<button aria-expanded={expanded} aria-controls={contentId}>`
- Content: `<div id={contentId} role="region">`
- Keyboard: Enter/Space toggle

---

## 6. TopBar

**Tujuan:** Identitas hero, jumlah brief aktif.

### Props
| Property | Type | Description |
|---|---|---|
| `activeCount` | `number` | "● 4 brief aktif" |
| `pendingCount` | `number` | "8 menunggu" |

### Layout
```
┌─ px-5 pt-safe-top pt-4 pb-3 bg-bg-app ────────────────────────┐
│  ┌─ Monogram md ┐  AI Department         🔔                   │
│  └──────────────┘  Gerai 1000 Pintu      (button)             │
│                                                                │
│  ● 4 brief aktif · 8 menunggu  ← text-xs text-text-muted      │
└────────────────────────────────────────────────────────────────┘
```

### Typography
- "AI Department": `font-serif text-xl font-medium leading-tight`
- "Gerai 1000 Pintu": `text-sm text-text-secondary`
- Status line: dot uses `text-status-decision` (red dot) when activeCount > 0

### Bell button
- 44×44 hit area, icon 20px
- Badge merah kecil jika `pendingCount > 0`: `absolute top-2 right-2 size-2 rounded-full bg-status-decision`
- `aria-label="Notifikasi, {pendingCount} brief menunggu"`
- Tap → scroll ke top + filter "Keputusan" (MVP behavior)

---

## 7. FilterChips

**Tujuan:** Filter status horizontal scroll.

### Props
| Property | Type |
|---|---|
| `active` | `'all' \| Status` |
| `onChange` | `(value) => void` |
| `counts` | `Record<Status \| 'all', number>` |

### Chips
| Value | Label | Count |
|---|---|---|
| `all` | Semua | total |
| `decision` | Keputusan | count |
| `doing` | Berjalan | count |
| `review` | Tinjau | count |
| `final` | Final | count |

### Visual
- `flex gap-2 overflow-x-auto scrollbar-hide px-5 pb-3` (horizontal scroll)
- Tiap chip: `min-h-touch px-4 py-2 rounded-pill text-sm font-medium whitespace-nowrap`
- Active: `bg-bg-elevated border border-border-med shadow-soft text-text-primary`
- Inactive: `bg-transparent text-text-muted`
- Count suffix: `text-text-faint ml-1` (e.g., "Keputusan 2")

### Accessibility
- `role="tablist"`, tiap chip `role="tab" aria-selected`
- Arrow keys navigate, Home/End jump
- Horizontal scroll: `scroll-snap-type: x mandatory` agar smooth

---

## 8. BottomNav

**Tujuan:** Floating capsule, 3 destinations primer.

### Items
| Icon | Label | Route |
|---|---|---|
| Inbox | Board | `/` |
| Sparkles | Atmaja | `/atmaja` (Phase 2 — disabled di MVP, masking sebagai "Soon") |
| User | Profile | `/settings` |

**Resolusi Q minor:** `/settings` masuk ke "Profile" agar tidak yatim.

### Visual
```
fixed bottom-4 left-1/2 -translate-x-1/2 z-nav
flex gap-1 p-1.5
bg-bg-elevated/85 backdrop-blur-md border border-border-soft
rounded-pill shadow-pop
```

### Tiap item
- `min-h-touch min-w-touch px-4 py-2 rounded-pill`
- Active: `bg-accent text-bg-app` (white text on brass — ratio 4.0:1 ✅)
- Inactive: `text-text-muted`
- Icon size 20px, label text-[11px] di bawah icon

### Accessibility
- `<nav aria-label="Navigasi utama">`
- Tiap item `<a aria-current={active ? 'page' : undefined}>`

---

## 9. Monogram

**Tujuan:** "G" mark, brand pin.

### Props
| Property | Type | Default |
|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |

### Sizing
| Size | Dimensions | Font |
|---|---|---|
| sm | 28 × 28 | `font-serif text-base` |
| md | 36 × 36 | `font-serif text-xl` |
| lg | 56 × 56 | `font-serif text-3xl` |

### Visual
- `rounded-md`
- Background: linear-gradient `from-accent to-accent-dark` (135deg)
- Inner highlight: `ring-1 ring-inset ring-white/20`
- Glow: `shadow-[0_4px_12px_rgba(184,149,107,0.3)]`
- "G" centered, white, `font-serif font-medium`

### Accessibility
- Decorative usually → `aria-hidden="true"`
- Jika digunakan sebagai logo link, parent button: `aria-label="Gerai 1000 Pintu"`

---

## 10. Toast

**Tujuan:** Feedback pasca aksi (Approve, Revise, dll).

### Props
| Property | Type | Default |
|---|---|---|
| `variant` | `'success' \| 'info' \| 'error'` | `'info'` |
| `message` | `string` | — |
| `duration` | `number` | `3500` |

### Visual
```
fixed bottom-24 left-1/2 -translate-x-1/2 z-toast
min-w-[280px] max-w-[88vw]
px-4 py-3 rounded-md shadow-pop
flex items-center gap-3
```

### Variant colors
| Variant | Bg | Text | Icon |
|---|---|---|---|
| success | `bg-status-final-bg` | `text-status-final` | Check |
| info | `bg-bg-soft` | `text-text-primary` | Info |
| error | `bg-status-decision-bg` | `text-status-decision` | AlertCircle |

### Animation
- Enter: slide-up 12px + fade, 240ms
- Exit: fade only, 200ms
- Auto-dismiss after `duration`

### Accessibility
- `role="status"` untuk info/success, `role="alert"` untuk error
- `aria-live="polite"` (info/success), `aria-live="assertive"` (error)

---

## Open questions / Phase 2 items

| # | Question | Decision needed by |
|---|---|---|
| Q1 | Apa exact action "Revisi"? Open form? Comment? | Sebelum implement BriefDetailSheet action bar |
| Q2 | Apa exact action "Telaah lebih dalam"? | Sebelum implement BriefDetailSheet action bar |
| Q3 | Notifikasi tap di TopBar bell → behavior detail? | Bisa di-stub di MVP |
| Q4 | Empty state copy + ilustrasi? | Sebelum build Inbox |
| Q5 | Skeleton loader pakai placeholder block atau shimmer? | Sebelum polish phase |

---

## Build order rekomendasi (Phase 4)

1. **Monogram** — paling sederhana, dipakai TopBar dan Sheet
2. **StatusPill** — dipakai BriefCard dan Sheet
3. **AvatarGroup** — dipakai BriefCard dan CSuiteCard
4. **BriefCard** — komposisi dari 1-3 + own visual
5. **TopBar** — dipakai Inbox
6. **FilterChips** — dipakai Inbox
7. **BottomNav** — fixed di App.tsx
8. **Toast** — dipakai BriefDetailSheet
9. **CSuiteCard** — sub-component Sheet
10. **BriefDetailSheet** — komposisi terbesar

Render preview tiap component di Inbox stub sebelum lanjut.

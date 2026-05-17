import { useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronRight, Edit3 } from 'lucide-react'
import type { Brief } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Monogram } from '@/components/shared/Monogram'
import { useToast } from '@/components/shared/Toast'
import { StatusPill, getCategoryVariant, getStatusLabel } from './StatusPill'
import { CSuiteCard } from './CSuiteCard'

interface BriefDetailSheetProps {
  brief: Brief | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (briefId: string) => void
}

export function BriefDetailSheet({ brief, open, onOpenChange, onApprove }: BriefDetailSheetProps) {
  const toast = useToast()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  const handleApprove = () => {
    if (!brief) return
    onApprove(brief.id)
    onOpenChange(false)
    toast.show('Brief disetujui. Dipindahkan ke Final.', { variant: 'success' })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && brief && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-sheet bg-text-primary/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'fixed left-0 right-0 bottom-0 z-sheet',
                  'mx-auto w-full md:max-w-xl',
                  'bg-bg-elevated rounded-t-xl shadow-pop',
                  'flex flex-col',
                  'max-h-[88vh]',
                )}
              >
                <div className="flex justify-center pt-3 pb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Tutup detail brief"
                    className="h-1 w-9 rounded-pill bg-border-strong"
                  />
                </div>

                <div className="overflow-y-auto flex-1 overscroll-contain">
                  <header className="px-5 pt-3 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Monogram size="sm" ariaLabel="Gerai 1000 Pintu" />
                        <span className="text-label-caps text-text-muted">brief · {brief.id.slice(-8)}</span>
                      </div>
                      <span className="text-meta text-text-faint">{brief.timestamp}</span>
                    </div>

                    <Dialog.Title asChild>
                      <h2 className="mt-6 text-display text-text-primary">{brief.title}</h2>
                    </Dialog.Title>

                    <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                      <StatusPill variant={brief.status} size="md">
                        {getStatusLabel(brief.status)}
                      </StatusPill>
                      {brief.priority === 'high' && (
                        <StatusPill variant="priority" size="md">
                          Prioritas tinggi
                        </StatusPill>
                      )}
                      {brief.labels.map((label) => (
                        <StatusPill key={label} variant={getCategoryVariant(label)} size="md">
                          {label}
                        </StatusPill>
                      ))}
                    </div>
                  </header>

                  <section
                    aria-label="Ringkasan"
                    className="mx-5 mt-5 relative rounded-md bg-bg-soft p-4 pl-5 overflow-hidden"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-md"
                    />
                    <p
                      className="text-sm leading-relaxed text-text-primary"
                      dangerouslySetInnerHTML={{ __html: formatSummary(brief.summary) }}
                    />
                  </section>

                  <div className="mt-6 px-5">
                    <p className="text-label-caps text-text-muted">Input dari tim</p>
                    <div className="mt-3 space-y-2 pb-6">
                      {brief.csuiteInput.map((input, idx) => (
                        <CSuiteCard
                          key={`${input.role}-${idx}`}
                          input={input}
                          defaultExpanded={input.role === 'ceo'}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-border-soft bg-bg-elevated px-5 py-3 pb-safe-bottom">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className={cn(
                      'w-full min-h-touch rounded-md bg-accent hover:bg-accent-dark text-white',
                      'inline-flex items-center justify-center gap-2 px-4 py-3',
                      'text-sm font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      'transition-colors duration-fast',
                    )}
                  >
                    <Check aria-hidden="true" className="size-4" />
                    Setujui · Pindahkan ke Final
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => toast.show('Mode revisi belum tersedia di MVP.', { variant: 'info' })}
                      className={cn(
                        'flex-1 min-h-touch rounded-md border border-border-med',
                        'inline-flex items-center justify-center gap-2 px-3 py-2',
                        'text-sm font-medium text-text-primary',
                        'hover:bg-bg-soft',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      )}
                    >
                      <Edit3 aria-hidden="true" className="size-4" />
                      Revisi
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast.show('Telaah lebih dalam belum tersedia di MVP.', { variant: 'info' })
                      }
                      className={cn(
                        'flex-1 min-h-touch rounded-md border border-border-med',
                        'inline-flex items-center justify-center gap-2 px-3 py-2',
                        'text-sm font-medium text-text-primary',
                        'hover:bg-bg-soft',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      )}
                    >
                      <ChevronRight aria-hidden="true" className="size-4" />
                      Telaah lebih dalam
                    </button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function formatSummary(text: string): string {
  // Minimal markdown: **bold**. Escape HTML lalu replace.
  const escaped = text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!))
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
}

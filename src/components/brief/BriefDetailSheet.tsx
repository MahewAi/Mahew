import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronRight, Edit3, Sparkles } from 'lucide-react'
import type { Brief, Comment, Contributor } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { StatusPill, getCategoryVariant, getStatusLabel } from './StatusPill'
import { CSuiteCard } from './CSuiteCard'
import { GeneratedCover } from './GeneratedCover'
import { CommentThread } from './CommentThread'
import { AskRolePanel } from './AskRolePanel'
import { BlockList } from '@/components/blocks/BlockRenderer'
import { MarkdownBlock } from '@/components/blocks/MarkdownBlock'

interface BriefDetailSheetProps {
  brief: Brief | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (briefId: string) => void
  onAddComment: (briefId: string, comment: Comment) => void
}

export function BriefDetailSheet({ brief, open, onOpenChange, onApprove, onAddComment }: BriefDetailSheetProps) {
  const toast = useToast()
  const reduceMotion = useReducedMotion()
  const [askRole, setAskRole] = useState<Contributor | null>(null)

  const handleAddComment = (text: string, author: Contributor | 'matthew') => {
    if (!brief) return
    const comment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      author,
      text,
      timeAgo: 'Baru saja',
    }
    onAddComment(brief.id, comment)
  }

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
                  'glass-strong rounded-t-[24px] shadow-glass-hero',
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
                  {/* Cinematic cover hero */}
                  <div className="relative">
                    <GeneratedCover brief={brief} animated className="aspect-[21/9]" />
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-bg-elevated pointer-events-none"
                    />
                  </div>

                  <header className="px-5 -mt-2 relative">
                    <div className="flex items-center gap-2 mb-3">
                      {brief.priority === 'high' && (
                        <span className="inline-flex items-center gap-1 text-label-caps text-accent-dark">
                          <Sparkles aria-hidden="true" className="size-3" />
                          Prioritas
                        </span>
                      )}
                      {brief.priority === 'high' && (
                        <span aria-hidden="true" className="text-text-faint">·</span>
                      )}
                      <span className="text-label-caps text-text-muted">
                        {getStatusLabel(brief.status)}
                      </span>
                      <span aria-hidden="true" className="text-text-faint">·</span>
                      <span className="text-label-caps text-text-faint">{brief.timestamp}</span>
                    </div>

                    <Dialog.Title asChild>
                      <h2 className="text-[36px] leading-[40px] font-bold tracking-[-0.028em] text-text-primary">
                        {brief.title}
                      </h2>
                    </Dialog.Title>

                    <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                      {brief.labels.map((label) => (
                        <StatusPill key={label} variant={getCategoryVariant(label)} size="md">
                          {label}
                        </StatusPill>
                      ))}
                    </div>
                  </header>

                  {/* TL;DR summary */}
                  <section
                    aria-label="Ringkasan"
                    className="mx-5 mt-5 relative rounded-[16px] glass-soft shadow-glass p-4 pl-5 overflow-hidden"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-md"
                    />
                    <MarkdownBlock
                      content={brief.summary}
                      className="[&_p]:mb-0 [&_p]:text-sm [&_p]:text-text-primary"
                    />
                  </section>

                  {/* Rich content blocks — primary detail surface */}
                  {brief.blocks && brief.blocks.length > 0 && (
                    <div className="px-5 mt-2">
                      <BlockList blocks={brief.blocks} />
                    </div>
                  )}

                  {/* Legacy C-suite accordion (Ask Role context) — kept untuk Tanya-feature
                      Render hanya kalau tidak ada csuite-vote block (avoid duplikasi). */}
                  {!brief.blocks?.some((b) => b.type === 'csuite-vote') && (
                    <div className="mt-6 px-5">
                      <p className="text-label-caps text-text-muted">Input dari tim</p>
                      <div className="mt-3 space-y-2">
                        {brief.csuiteInput.map((input, idx) => (
                          <CSuiteCard
                            key={`${input.role}-${idx}`}
                            input={input}
                            defaultExpanded={input.role === 'ceo'}
                            onAsk={() => setAskRole(input.role)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* When blocks include csuite-vote, still surface Ask-Role discreetly */}
                  {brief.blocks?.some((b) => b.type === 'csuite-vote') && (
                    <div className="mt-4 px-5">
                      <p className="text-label-caps text-text-muted mb-2">Tanya langsung</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brief.csuiteInput.map((input) => (
                          <button
                            key={input.role}
                            type="button"
                            onClick={() => setAskRole(input.role)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                              'glass-soft hover:bg-white/60 text-xs font-medium text-text-primary',
                              'transition-colors duration-fast',
                            )}
                          >
                            <span className="text-meta text-text-muted">→</span>
                            {input.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <CommentThread brief={brief} onAddComment={handleAddComment} />

                  <div className="h-6" />
                </div>

                <div className="shrink-0 border-t border-white/40 bg-white/50 backdrop-blur-md px-5 py-3 pb-safe-bottom">
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

      {brief && (
        <AskRolePanel
          role={askRole}
          brief={brief}
          open={askRole !== null}
          onOpenChange={(o) => !o && setAskRole(null)}
        />
      )}
    </Dialog.Root>
  )
}


import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'success' | 'info' | 'error'

interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration: number
}

interface ToastContextValue {
  show: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const variantStyle: Record<ToastVariant, { bg: string; text: string; icon: typeof Info }> = {
  success: { bg: 'bg-status-final-bg', text: 'text-status-final', icon: CheckCircle2 },
  info: { bg: 'bg-bg-soft', text: 'text-text-primary', icon: Info },
  error: { bg: 'bg-status-decision-bg', text: 'text-status-decision', icon: AlertCircle },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idSeed = useId()
  const counter = useRef(0)

  const show = useCallback<ToastContextValue['show']>(
    (message, options) => {
      counter.current += 1
      const id = `${idSeed}-${counter.current}`
      const item: ToastItem = {
        id,
        message,
        variant: options?.variant ?? 'info',
        duration: options?.duration ?? 3500,
      }
      setToasts((prev) => [...prev, item])
    },
    [idSeed],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-toast flex flex-col items-center gap-2 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { bg, text, icon: Icon } = variantStyle[toast.variant]

  useEffect(() => {
    const id = window.setTimeout(onDismiss, toast.duration)
    return () => window.clearTimeout(id)
  }, [onDismiss, toast.duration])

  return (
    <motion.div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'pointer-events-auto min-w-[280px] max-w-[88vw]',
        'px-4 py-3 rounded-md shadow-pop',
        'flex items-center gap-3 text-sm font-medium',
        bg,
        text,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{toast.message}</span>
    </motion.div>
  )
}

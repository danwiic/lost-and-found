'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Icon } from '@/components/ui/Icon'

type ToastItem = { id: number; message: string }

const ToastContext = createContext<{ notify: (message: string) => void } | null>(null)

/**
 * Toasts confirm a completed action the user does not need to decide about
 * (agents/UX.md §14). They announce politely to assistive technology.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string) => {
      nextId.current += 1
      const id = nextId.current
      setToasts((current) => [...current, { id, message }])
      window.setTimeout(() => dismiss(id), 5200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="drawer-overlay pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border border-line bg-surface py-3 pr-3 pl-4 shadow-lift"
          >
            <span className="mt-1 text-verified">
              <Icon name="check" className="h-4 w-4" />
            </span>
            <p className="text-sm text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink"
              aria-label="Dismiss notification"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

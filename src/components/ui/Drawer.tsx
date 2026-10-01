'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

/**
 * Quick contextual inspection without losing your place in the list
 * (agents/UX.md §4.4). Not a disguised page: keep the content short and put
 * substantial work on its own route.
 *
 * Accessibility (agents/UX.md §24): focus moves in on open, stays trapped while
 * open, returns to the trigger on close, Escape closes, and the backdrop is not
 * part of the tab order.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    triggerRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const firstField = panel?.querySelector<HTMLElement>('[data-autofocus]')
    ;(firstField ?? panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="drawer-overlay absolute inset-0 cursor-default bg-[rgb(9_9_11/0.35)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className="drawer-panel relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-lg border-line bg-surface shadow-drawer sm:max-h-none sm:max-w-lg sm:rounded-none sm:border-l"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-4">
          <div>
            <h2 id="drawer-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p className="measure mt-1 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mt-1 -mr-1 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

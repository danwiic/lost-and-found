'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

type Tone = 'default' | 'danger'

/**
 * A short, focused decision: clear title, one sentence of explanation, a
 * primary action and a way out (agents/UX.md §4.2). Used for consequential
 * confirmations — rejecting a claim, withdrawing a report — where the user has
 * to decide something, never for a long form or a table (§4.3).
 *
 * Accessibility matches the drawer (§24): focus moves in, stays trapped, returns
 * to the trigger on close, Escape cancels, and the backdrop is not tabbable.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'default',
  busy = false,
  size = 'default',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer: ReactNode
  tone?: Tone
  busy?: boolean
  /** `wide` gives photographs room to be looked at; copy stays on `default`. */
  size?: 'default' | 'wide'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    triggerRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // Focus the first real control, so the decision is one keystroke away.
    const firstField = panel?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-dialog-dismiss])',
    )
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
      if (event.key === 'Escape' && !busy) {
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
  }, [open, onClose, busy])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-dialog-dismiss
        onClick={busy ? undefined : onClose}
        className="drawer-overlay absolute inset-0 cursor-default bg-[rgb(9_9_11/0.35)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`drawer-panel relative w-full rounded-lg border border-line bg-surface shadow-lift ${
          size === 'wide' ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          {tone === 'danger' ? (
            <span className="mt-1 text-refused">
              <Icon name="alert" className="h-5 w-5" />
            </span>
          ) : null}
          <h2 id={titleId} className="flex-1 text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            data-dialog-dismiss
            className="-mt-1 -mr-1 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink disabled:opacity-50"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {description ? (
          <p id={descriptionId} className="measure mt-2 px-6 text-sm text-ink-muted">
            {description}
          </p>
        ) : null}

        {children ? <div className="mt-4 px-6">{children}</div> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  )
}

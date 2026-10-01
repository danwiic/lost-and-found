import type { ReactNode } from 'react'

/**
 * Empty states explain the situation and offer the next real action when one
 * exists (agents/UX.md §16). A blank screen is a defect.
 */
export function EmptyState({
  title,
  message,
  children,
  className = '',
}: {
  title: string
  message: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`px-6 py-12 text-center ${className}`}>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="measure mx-auto mt-2 text-sm text-ink-muted">{message}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}

/** Loading placeholder for ledger rows — never an unexplained blank area. */
export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="divide-y divide-line" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="flex items-center gap-4 px-6 py-4 sm:px-6">
          <div className="h-14 w-14 rounded-lg bg-surface-sunk" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded-lg bg-surface-sunk" />
            <div className="h-3 w-3/5 rounded-lg bg-surface-sunk" />
          </div>
          <div className="hidden h-6 w-24 rounded-full bg-surface-sunk sm:block" />
        </li>
      ))}
    </ul>
  )
}

/** Inline failure with a real recovery action (agents/UX.md §17). */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-refused/25 bg-refused-soft px-3 py-2 text-sm text-refused"
    >
      {children}
    </p>
  )
}

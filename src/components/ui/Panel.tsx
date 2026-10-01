import type { ReactNode } from 'react'

/**
 * The record surface. One level only — panels are never nested, because a card
 * inside a card is how dashboards start looking assembled. A panel carries a
 * hairline border and no shadow; inside it, separate content with hairline
 * rules rather than more boxes.
 */
export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return (
    <Tag className={`rounded-lg border border-line bg-surface ${className}`}>{children}</Tag>
  )
}

/** Panel heading: one step above body text, hairline base, optional action. */
export function PanelHeading({
  title,
  description,
  action,
  id,
}: {
  title: string
  description?: string
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line px-6 pt-6 pb-4 sm:px-6">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="measure mt-1 text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

/**
 * Hairline-divided list used for every ledger of records and notices. The 8px
 * under the last row brings the card's own bottom padding to 24px, the same as
 * every other card in the application.
 */
export function LedgerList({
  children,
  labelledBy,
  className = '',
}: {
  children: ReactNode
  labelledBy?: string
  className?: string
}) {
  return (
    <ul aria-labelledby={labelledBy} className={`divide-y divide-line pb-2 ${className}`}>
      {children}
    </ul>
  )
}

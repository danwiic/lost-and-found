import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

/**
 * The one page header.
 *
 * Every signed-in page states its name at the same size, with at most one brief
 * line of explanation under it, so the eye always lands in the same place and
 * only the content below differs. The title scale, the description's size,
 * colour and measure, the status slot and the way back to a parent page are
 * defined here and nowhere else — a hand-rolled `<h1>` is exactly how two pages
 * drift apart, which is what `scripts/header-audit.mjs` exists to prevent.
 *
 * Hierarchy it encodes, from the page down: name (title, 2xl→3xl), one line of
 * context (muted body), then the panels — whose own headings are one step
 * smaller (lg) than the page title and are never mixed with it.
 */
export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: ReactNode
  /**
   * One brief line. Anything longer belongs in the panel that acts on it, where
   * it sits next to the control it explains.
   */
  description?: string
  /** Right-aligned status: a badge, or the single action the page exists for. */
  action?: ReactNode
  /** A parent destination. Drawn one way everywhere: quiet, with a back arrow. */
  back?: { href: string; label: string }
}) {
  return (
    <header className="space-y-6">
      {back ? (
        <Link href={back.href} className={buttonClass({ variant: 'quiet', size: 'sm' })}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          {back.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="measure mt-3 text-[0.9375rem] text-ink-muted">{description}</p>
          ) : null}
        </div>

        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
    </header>
  )
}

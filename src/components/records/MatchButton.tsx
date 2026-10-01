'use client'

import { useState } from 'react'
import { MatchDrawer, type MatchSubject } from '@/components/dashboard/MatchDrawer'
import { buttonClass, type ButtonSize } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

/**
 * The one "View Match" control. It always opens the same comparison drawer, so
 * the action behaves identically wherever it appears (agents/UX.md §25).
 * Rendered only when the record actually has candidates.
 */
export function MatchButton({
  subject,
  size = 'sm',
  label = 'View Match',
}: {
  subject: MatchSubject
  size?: ButtonSize
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: 'secondary', size })}
      >
        <Icon name="compare" className="h-4 w-4" />
        {label}
      </button>
      <MatchDrawer open={open} subject={subject} onClose={() => setOpen(false)} />
    </>
  )
}

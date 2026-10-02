'use client'

import { useState } from 'react'
import { buttonClass } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'

/**
 * The photo a claimant attached as proof of ownership, shown small next to the
 * written proof so the verification desk stays scannable. Clicking it opens the
 * same photo in a modal large enough to actually examine.
 *
 * A stored photo can still fail to load — the file removed from disk, a dropped
 * connection — so a load error degrades to a labelled "Photo unavailable" plate
 * instead of the browser's broken-image glyph.
 */
export function ProofPhoto({
  src,
  claimantName,
  itemName,
}: {
  src: string
  claimantName: string
  itemName: string
}) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const alt = `Proof of ownership attached by ${claimantName}`

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — the file could not be loaded`}
        className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-sunk px-2"
      >
        <span className="text-center text-[0.6875rem] font-medium text-ink-muted">
          Photo unavailable
        </span>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open the proof photo attached by ${claimantName} for ${itemName}`}
        className="group relative block overflow-hidden rounded-lg border border-line bg-surface-sunk transition-colors duration-200 ease-[var(--ease-out-expo)] hover:border-line-strong"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- private, same-origin photo route with its own sizing and caching */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-24 w-24 object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-surface/90 py-1 text-[0.6875rem] font-medium text-ink-muted group-hover:text-ink">
          <Icon name="search" className="h-3 w-3" />
          View
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Proof of ownership photo"
        description={`Attached by ${claimantName} for "${itemName}".`}
        size="wide"
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClass({ variant: 'secondary' })}
          >
            Close
          </button>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- private, same-origin photo route with its own sizing and caching */}
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[65vh] w-auto rounded-lg border border-line bg-surface-sunk object-contain"
        />
      </Dialog>
    </>
  )
}

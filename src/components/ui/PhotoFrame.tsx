'use client'

import { useState } from 'react'

const SIZES = {
  thumb: 'h-14 w-14 rounded-lg',
  card: 'aspect-[4/3] w-full rounded-lg',
  feature: 'aspect-[4/3] w-full rounded-lg',
} as const

export type PhotoSize = keyof typeof SIZES

/**
 * Item photograph. A hairline border and no shadow — a card gets one or the
 * other, never both. Alt text always describes the item, because the photo is
 * evidence the user reasons about (agents/UX.md §24). Seeded images are flat
 * illustrations, so the alt text says what the item is, not what the picture is.
 *
 * A stored photo can still fail to load — a file removed from disk, a dropped
 * connection — so a load error degrades to the same "No photo" state a missing
 * photo gets, instead of the browser's broken-image glyph.
 */
export function PhotoFrame({
  src,
  alt,
  size = 'thumb',
  className = '',
}: {
  src: string | null
  alt: string
  size?: PhotoSize
  className?: string
}) {
  const shape = SIZES[size]
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — no photo on file`}
        className={`flex items-center justify-center border border-dashed border-line-strong bg-surface-sunk ${shape} ${className}`}
      >
        <span className="px-2 text-center text-[0.6875rem] font-medium text-ink-muted">
          No photo
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, same-origin photo route with its own sizing and caching
    <img
      key={src}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`border border-line bg-surface-sunk object-cover ${shape} ${className}`}
    />
  )
}

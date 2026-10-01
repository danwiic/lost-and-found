import type { ReactNode } from 'react'
import type { Tone } from '@/lib/format'

const BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap'

/*
 * A soft tint carries the tone; the word inside the pill carries the meaning.
 * Colour never communicates a status on its own, which is what agents/UX.md
 * §1.4 and §24 require. `muted` is an outline rather than a tint so "Closed"
 * stays visually distinct from a neutral "Pending" without spending colour.
 */
const TONES: Record<Tone, string> = {
  neutral: 'border-transparent bg-surface-sunk text-ink-muted',
  muted: 'border-line-strong bg-surface text-ink-muted',
  attention: 'border-transparent bg-attention-soft text-attention',
  accent: 'border-transparent bg-accent-soft text-accent',
  verified: 'border-transparent bg-verified-soft text-verified',
  refused: 'border-transparent bg-refused-soft text-refused',
}

/**
 * The status badge. Every status is a word first, colour second — the `title`
 * carries the plain-language meaning from src/lib/format.ts, so the same words
 * describe the same state on every screen.
 */
export function Badge({
  tone = 'neutral',
  children,
  title,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <span className={`${BASE} ${TONES[tone]} ${className}`} title={title}>
      {children}
    </span>
  )
}

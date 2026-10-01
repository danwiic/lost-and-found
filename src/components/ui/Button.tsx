export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg border font-sans font-medium ' +
  'transition-colors duration-200 ease-[var(--ease-out-expo)] ' +
  'disabled:opacity-50 disabled:pointer-events-none'

/*
 * Two treatments: primary actions are solid, everything else is a ghost that
 * only shows itself on hover. `quiet` is kept as an alias of `secondary` so
 * call sites did not have to change. `danger` is solid because a destructive
 * action is a primary-strength decision (agents/UX.md §21).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border-transparent bg-transparent text-ink hover:bg-surface-sunk',
  quiet: 'border-transparent bg-transparent text-ink-muted hover:bg-surface-sunk hover:text-ink',
  danger: 'border-transparent bg-refused text-on-accent hover:bg-refused-hover',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-10 px-4 py-2 text-sm',
  sm: 'min-h-8 px-3 py-2 text-[0.8125rem]',
}

export function buttonClass(options?: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}): string {
  const { variant = 'secondary', size = 'md', block = false } = options ?? {}
  return [BASE, VARIANTS[variant], SIZES[size], block ? 'w-full' : ''].filter(Boolean).join(' ')
}

/** A loading button keeps its label and blocks a second submission (§5.5). */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    // Lucide `loader-circle` geometry (ISC) — see the note in Icon.tsx.
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`h-4 w-4 animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

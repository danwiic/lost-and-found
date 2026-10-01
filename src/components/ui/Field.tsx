import type { ReactNode } from 'react'

/*
 * Inputs stay minimal: a 1px light border, no shadow, no heavy box. Focus is
 * drawn by the global `:focus-visible` outline, so nothing here suppresses it.
 */
export function inputClass(options?: { invalid?: boolean; className?: string }): string {
  const base =
    'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink ' +
    'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:border-line-strong'
  const border = options?.invalid ? 'border-refused' : 'border-line'
  return `${base} ${border} ${options?.className ?? ''}`
}

/**
 * Labelled field. The label is always a real <label> — placeholder text is never
 * the label (agents/UX.md §24). Errors are wired through aria-describedby so a
 * screen reader hears the problem with the control.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optionalHint,
  children,
  className = '',
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optionalHint?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
  className?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {optionalHint ? <span className="text-xs text-ink-muted">{optionalHint}</span> : null}
      </div>

      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      <div className="mt-2">
        {children({
          id,
          'aria-describedby': describedBy,
          ...(error ? { 'aria-invalid': true as const } : {}),
        })}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-refused">
          {error}
        </p>
      ) : null}
    </div>
  )
}

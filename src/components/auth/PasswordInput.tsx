'use client'

import { useState, type KeyboardEvent } from 'react'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'

/**
 * The password control used by both auth forms: the input itself, a show/hide
 * toggle, and a Caps Lock warning.
 *
 * The toggle is a real button, so it is keyboard reachable and announces its
 * state; it sits after the input in the tab order and never submits the form
 * (`type="button"`). Caps Lock is only reported while the field is focused and
 * the key is actually on — a warning that is always on screen stops being read.
 */
export function PasswordInput({
  id,
  name,
  'aria-describedby': describedBy,
  'aria-invalid': invalidAttr,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  maxLength,
  invalid = false,
}: {
  id: string
  name?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: string
  placeholder?: string
  maxLength?: number
  invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  function readCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          aria-describedby={describedBy}
          aria-invalid={invalidAttr}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            setCapsLock(false)
            onBlur?.()
          }}
          onKeyDown={readCapsLock}
          onKeyUp={readCapsLock}
          className={inputClass({ invalid, className: 'pr-12' })}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-ink"
        >
          <Icon name={visible ? 'eye-off' : 'eye'} className="h-4 w-4" />
        </button>
      </div>

      {capsLock ? (
        <p role="status" className="mt-2 text-xs text-attention">
          Caps Lock is on.
        </p>
      ) : null}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { parseFailure } from '@/lib/client-api'

type FieldErrors = {
  accountType?: string
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  studentId?: string
  contact?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Matches the server's rule, so the two never disagree about a valid password. */
const PASSWORD_MIN = 8
/** The server caps these too; the attributes keep the two in step. */
const NAME_MAX = 120
const STUDENT_ID_MAX = 60
const CONTACT_MAX = 120
const PASSWORD_MAX = 200

/**
 * Creates a student or personnel account. The API signs the new account in straight away, so
 * a successful registration lands on the desk rather than back at a sign-in
 * form. Validation is per-field and happens on blur and on submit — never while
 * the user is still typing (agents/UX.md §5.4). The six fields are split into
 * three labelled sections so the form reads as shorter than it is, and the
 * optional half is named as optional up front.
 */
export function RegisterForm() {
  const router = useRouter()

  const [values, setValues] = useState({
    accountType: 'STUDENT' as 'STUDENT' | 'PERSONNEL',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    contact: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function set(field: keyof typeof values) {
    return (value: string) => setValues((current) => ({ ...current, [field]: value }))
  }

  /** Editing a field clears its message; the problem is re-checked on blur. */
  function clear(field: keyof FieldErrors) {
    setErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: undefined },
    )
  }

  function validateOne(field: keyof FieldErrors): string | undefined {
    const trimmed = values[field].trim()

    if (field === 'name') {
      if (!trimmed) return 'Enter your full name.'
      if (trimmed.length < 2) return 'Enter your full name.'
      if (trimmed.length > NAME_MAX) {
        return `Your name must be at most ${NAME_MAX} characters.`
      }
      return undefined
    }
    if (field === 'email') {
      if (!trimmed) return 'Enter your email address.'
      if (!EMAIL_PATTERN.test(trimmed)) return 'That does not look like an email address.'
      return undefined
    }
    if (field === 'password') {
      if (!values.password) return 'Choose a password.'
      if (values.password.length < PASSWORD_MIN) {
        return `Use at least ${PASSWORD_MIN} characters.`
      }
      return undefined
    }
    if (field === 'confirmPassword') {
      if (!values.confirmPassword) return 'Re-enter your password.'
      if (values.confirmPassword !== values.password) return 'Passwords do not match.'
      return undefined
    }
    return undefined
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {}
    for (const field of ['name', 'email', 'password', 'confirmPassword'] as const) {
      const problem = validateOne(field)
      if (problem) found[field] = problem
    }
    return found
  }

  /** Validate a single field once it loses focus, and only if it has content. */
  function onBlur(field: 'name' | 'email' | 'password' | 'confirmPassword') {
    return () => {
      const problem = validateOne(field)
      setErrors((current) => ({ ...current, [field]: problem }))
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return // §5.5 — send the request once

    const found = validate()
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) {
      // Move attention to the first invalid field.
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountType: values.accountType,
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          confirmPassword: values.confirmPassword,
          ...(values.studentId.trim() ? { studentId: values.studentId.trim() } : {}),
          ...(values.contact.trim() ? { contact: values.contact.trim() } : {}),
        }),
      })

      if (!response.ok) {
        const failure = await parseFailure(response)
        // Field problems belong beside their control, not in a summary (§5.3).
        const fields = Object.keys(failure.fields)
        if (fields.length > 0) {
          setErrors(failure.fields as FieldErrors)
          document.getElementById(fields[0])?.focus()
        } else if (failure.status === 409) {
          // "That email already has an account" points at the email field.
          setErrors({ email: failure.message })
          document.getElementById('email')?.focus()
        } else {
          setFormError(failure.message)
        }
        setSubmitting(false)
        return
      }

      // Keep the button in its loading state while the desk loads.
      router.push('/')
      router.refresh()
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <section className="space-y-6">
        <h2 className="text-base font-semibold">Your account</h2>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">I am signing up as</legend>
          <p className="text-xs text-ink-muted">
            Personnel accounts have OSAS staff access.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'STUDENT' as const, label: 'Student' },
              { value: 'PERSONNEL' as const, label: 'Personnel' },
            ].map(option => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  values.accountType === option.value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="accountType"
                  value={option.value}
                  checked={values.accountType === option.value}
                  onChange={() => setValues(current => ({ ...current, accountType: option.value }))}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="name" label="Full name" error={errors.name}>
          {props => (
            <input
              {...props}
              type="text"
              name="name"
              autoComplete="name"
              maxLength={NAME_MAX}
              placeholder="Juan Dela Cruz"
              value={values.name}
              onChange={event => {
                set('name')(event.target.value)
                clear('name')
              }}
              onBlur={onBlur('name')}
              className={inputClass({ invalid: Boolean(errors.name) })}
            />
          )}
        </Field>

        <Field
          id="email"
          label="Email address"
          hint="This is how OSAS reaches you about a claim."
          error={errors.email}
        >
          {props => (
            <input
              {...props}
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="you@cvsu.edu.ph"
              value={values.email}
              onChange={event => {
                set('email')(event.target.value)
                clear('email')
              }}
              onBlur={onBlur('email')}
              className={inputClass({ invalid: Boolean(errors.email) })}
            />
          )}
        </Field>
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <h2 className="text-base font-semibold">Choose a password</h2>

        <Field
          id="password"
          label="Password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={errors.password}
        >
          {props => (
            <PasswordInput
              {...props}
              name="password"
              value={values.password}
              onChange={value => {
                set('password')(value)
                clear('password')
                // A confirmation problem the user can already see keeps up with
                // the password instead of waiting for the next blur.
                if (values.confirmPassword) {
                  setErrors(current => ({
                    ...current,
                    confirmPassword:
                      value === values.confirmPassword ? undefined : 'Passwords do not match.',
                  }))
                }
              }}
              onBlur={onBlur('password')}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              placeholder={`At least ${PASSWORD_MIN} characters`}
              invalid={Boolean(errors.password)}
            />
          )}
        </Field>

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          {props => (
            <PasswordInput
              {...props}
              name="confirmPassword"
              value={values.confirmPassword}
              onChange={value => {
                set('confirmPassword')(value)
                clear('confirmPassword')
              }}
              onBlur={onBlur('confirmPassword')}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              placeholder="Re-enter your password"
              invalid={Boolean(errors.confirmPassword)}
            />
          )}
        </Field>
      </section>

      <details className="group border-t border-line pt-6">
        <summary className="cursor-pointer list-none rounded-lg text-base font-semibold text-ink outline-offset-4 marker:hidden focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-4">
            Additional information
            <Icon
              name="arrow"
              className="h-4 w-4 rotate-90 text-accent transition-transform duration-200 group-open:-rotate-90"
            />
          </span>
          <span className="mt-1 block text-xs font-normal text-ink-muted">
            Optional — helps OSAS verify claims and schedule collection.
          </span>
        </summary>

        <div className="mt-6 space-y-6">
          <Field
            id="studentId"
            label="Student or personnel ID"
            optionalHint="Optional"
            error={errors.studentId}
          >
            {props => (
              <input
                {...props}
                type="text"
                name="studentId"
                maxLength={STUDENT_ID_MAX}
                placeholder="202212345"
                value={values.studentId}
                onChange={event => {
                  set('studentId')(event.target.value)
                  clear('studentId')
                }}
                className={inputClass({ invalid: Boolean(errors.studentId) })}
              />
            )}
          </Field>

          <Field
            id="contact"
            label="Contact number"
            optionalHint="Optional"
            hint="Used on a claim so OSAS can reach you about collection."
            error={errors.contact}
          >
            {props => (
              <input
                {...props}
                type="tel"
                name="contact"
                autoComplete="tel"
                maxLength={CONTACT_MAX}
                placeholder="0917 000 0000"
                value={values.contact}
                onChange={event => {
                  set('contact')(event.target.value)
                  clear('contact')
                }}
                className={inputClass({ invalid: Boolean(errors.contact) })}
              />
            )}
          </Field>
        </div>
      </details>

      <button
        type="submit"
        disabled={submitting}
        className={buttonClass({ variant: 'primary', block: true })}
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  )
}

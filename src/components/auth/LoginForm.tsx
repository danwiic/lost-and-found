'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { homeFor } from '@/components/shell/nav-items'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'

type FieldErrors = { email?: string; password?: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Sign in. Field problems are checked on blur and on submit — never while the
 * user is still typing — and editing a field clears its message so a fixed
 * problem does not keep staring back (agents/UX.md §5.4). A failed sign-in
 * stays a form-level message: the API deliberately refuses to say which half of
 * the pair was wrong.
 */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validateOne(field: keyof FieldErrors): string | undefined {
    if (field === 'email') {
      const trimmed = email.trim()
      if (!trimmed) return 'Enter the email address on your account.'
      if (!EMAIL_PATTERN.test(trimmed)) return 'That does not look like an email address.'
      return undefined
    }
    if (!password) return 'Enter your password.'
    return undefined
  }

  function onBlur(field: keyof FieldErrors) {
    return () => setErrors((current) => ({ ...current, [field]: validateOne(field) }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return // no duplicate submissions

    const found: FieldErrors = {}
    for (const field of ['email', 'password'] as const) {
      const problem = validateOne(field)
      if (problem) found[field] = problem
    }
    setErrors(found)
    setFormError(null)

    const firstInvalid = (['email', 'password'] as const).find((field) => found[field])
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setFormError(
          data?.error ?? "We couldn't sign you in. Check your connection and try again.",
        )
        setSubmitting(false)
        return
      }

      // The role decides where a plain sign-in lands: staff belong on the OSAS
      // dashboard, and sending them to the student desk first is the confusion
      // this avoids. An explicit `?next=` always wins — that is a destination
      // someone was already trying to reach.
      const data = (await response.json().catch(() => null)) as {
        user?: { role?: string; mustChangePassword?: boolean }
      } | null
      const landing =
        returnTo !== '/'
          ? returnTo
          : // A temporary password from the counter has one destination: the
            // screen that replaces it.
            data?.user?.mustChangePassword
            ? '/change-password'
            : homeFor(data?.user?.role === 'ADMIN' ? 'ADMIN' : 'USER')

      // Keep the button in its loading state while the destination loads.
      router.push(landing)
      router.refresh()
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <Field id="email" label="Email address" error={errors.email}>
        {(props) => (
          <input
            {...props}
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            placeholder="you@cvsu.edu.ph"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
            }}
            onBlur={onBlur('email')}
            className={inputClass({ invalid: Boolean(errors.email) })}
          />
        )}
      </Field>

      <div className="space-y-3">
        <Field id="password" label="Password" error={errors.password}>
          {(props) => (
            <PasswordInput
              {...props}
              name="password"
              value={password}
              onChange={(value) => {
                setPassword(value)
                if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
              }}
              onBlur={onBlur('password')}
              autoComplete="current-password"
              maxLength={200}
              placeholder="Your password"
              invalid={Boolean(errors.password)}
            />
          )}
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-accent hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={buttonClass({ variant: 'primary', block: true })}
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

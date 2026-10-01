'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'

type FieldErrors = { email?: string; password?: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const found: FieldErrors = {}
    const trimmed = email.trim()

    if (!trimmed) found.email = 'Enter the email address on your account.'
    else if (!EMAIL_PATTERN.test(trimmed)) found.email = 'That does not look like an email address.'

    if (!password) found.password = 'Enter your password.'

    return found
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return // no duplicate submissions

    const found = validate()
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

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

      // Keep the button in its loading state while the dashboard loads.
      router.push(returnTo)
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass({ invalid: Boolean(errors.email) })}
          />
        )}
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        {(props) => (
          <input
            {...props}
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={200}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass({ invalid: Boolean(errors.password) })}
          />
        )}
      </Field>

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

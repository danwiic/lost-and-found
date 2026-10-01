'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { parseFailure } from '@/lib/client-api'

type FieldErrors = {
  name?: string
  email?: string
  password?: string
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
 * Creates a student account. The API signs the new account in straight away, so
 * a successful registration lands on the desk rather than back at a sign-in
 * form. Validation is per-field and happens on blur and on submit — never while
 * the user is still typing (agents/UX.md §5.4).
 */
export function RegisterForm() {
  const router = useRouter()

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    studentId: '',
    contact: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function set(field: keyof typeof values) {
    return (value: string) => setValues((current) => ({ ...current, [field]: value }))
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
    return undefined
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {}
    for (const field of ['name', 'email', 'password'] as const) {
      const problem = validateOne(field)
      if (problem) found[field] = problem
    }
    return found
  }

  /** Validate a single field once it loses focus, and only if it has content. */
  function onBlur(field: 'name' | 'email' | 'password') {
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
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
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
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <Field id="name" label="Full name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            type="text"
            name="name"
            autoComplete="name"
            maxLength={NAME_MAX}
            value={values.name}
            onChange={(event) => set('name')(event.target.value)}
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
        {(props) => (
          <input
            {...props}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={values.email}
            onChange={(event) => set('email')(event.target.value)}
            onBlur={onBlur('email')}
            className={inputClass({ invalid: Boolean(errors.email) })}
          />
        )}
      </Field>

      <Field
        id="password"
        label="Password"
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={errors.password}
      >
        {(props) => (
          <input
            {...props}
            type="password"
            name="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={values.password}
            onChange={(event) => set('password')(event.target.value)}
            onBlur={onBlur('password')}
            className={inputClass({ invalid: Boolean(errors.password) })}
          />
        )}
      </Field>

      <Field
        id="studentId"
        label="Student / personnel ID"
        optionalHint="Optional"
        error={errors.studentId}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            name="studentId"
            maxLength={STUDENT_ID_MAX}
            value={values.studentId}
            onChange={(event) => set('studentId')(event.target.value)}
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
        {(props) => (
          <input
            {...props}
            type="tel"
            name="contact"
            autoComplete="tel"
            maxLength={CONTACT_MAX}
            value={values.contact}
            onChange={(event) => set('contact')(event.target.value)}
            className={inputClass({ invalid: Boolean(errors.contact) })}
          />
        )}
      </Field>

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

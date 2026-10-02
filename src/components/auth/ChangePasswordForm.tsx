'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { homeFor } from '@/components/shell/nav-items'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { changeOwnPassword, RequestError } from '@/lib/client-api'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 200

type FieldName = 'currentPassword' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>

/**
 * Changes the password of the signed-in account. Two callers, one form:
 *
 * - `temporary` — the forced screen after OSAS issues a temporary password. It
 *   is also how that state ends, so it is the only surface the app leaves open.
 * - otherwise — the profile's own Password panel, for anyone who just wants to
 *   change it.
 *
 * The current password is always asked for: an unattended phone should not be
 * enough to take an account over, and the API insists on it anyway.
 *
 * On success the API re-issues this device's cookie at the new session epoch, so
 * the person stays signed in while every other device is signed out — the
 * confirmation says exactly that instead of a generic "saved".
 */
export function ChangePasswordForm({
  role,
  temporary = false,
}: {
  role: 'USER' | 'ADMIN'
  /** True on the forced screen that replaces a staff-issued password. */
  temporary?: boolean
}) {
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  function clear(field: FieldName) {
    setErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: '' },
    )
  }

  function validateOne(field: FieldName) {
    if (field === 'currentPassword' && !currentPassword) {
      return temporary
        ? 'Enter the temporary password you signed in with.'
        : 'Enter your current password.'
    }
    if (field === 'password') {
      if (!password) return 'Choose a new password.'
      if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
      if (password === currentPassword) return 'That is the password you are already using.'
    }
    if (field === 'confirmPassword') {
      if (!confirmPassword) return 'Re-enter the new password.'
      if (confirmPassword !== password) return 'Passwords do not match.'
    }
    return undefined
  }

  function onBlur(field: FieldName) {
    return () => setErrors((current) => ({ ...current, [field]: validateOne(field) }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found: FieldErrors = {}
    for (const field of ['currentPassword', 'password', 'confirmPassword'] as const) {
      const problem = validateOne(field)
      if (problem) found[field] = problem
    }
    setErrors(found)
    setFormError(null)

    const firstInvalid = (['currentPassword', 'password', 'confirmPassword'] as const).find(
      (field) => found[field],
    )
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setBusy(true)
    try {
      await changeOwnPassword({ currentPassword, password, confirmPassword })
      setDone(true)
      router.refresh()
    } catch (error) {
      if (error instanceof RequestError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields)
        const first = ['currentPassword', 'password', 'confirmPassword'].find(
          (field) => error.fields[field],
        )
        document.getElementById(first ?? 'currentPassword')?.focus()
      } else {
        setFormError(
          error instanceof Error ? error.message : 'We could not change that password.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <p className="measure text-sm text-ink">
          Your password is changed, and this device is still signed in. Any other device that was
          signed in to this account has been signed out.
        </p>
        {temporary ? (
          // The forced screen sits outside the app shell, so it has to offer the
          // way back in; on the profile there is nowhere to go.
          <Link href={homeFor(role)} className={buttonClass({ variant: 'primary' })}>
            Continue to the {role === 'ADMIN' ? 'OSAS dashboard' : 'desk'}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCurrentPassword('')
              setPassword('')
              setConfirmPassword('')
              setErrors({})
              setDone(false)
            }}
            className={buttonClass({ variant: 'secondary' })}
          >
            Change it again
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <Field
        id="currentPassword"
        label={temporary ? 'Temporary password' : 'Current password'}
        error={errors.currentPassword}
        hint={
          temporary
            ? 'The one OSAS gave you at the counter.'
            : 'The password you sign in with now.'
        }
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="currentPassword"
            value={currentPassword}
            onChange={(value) => {
              setCurrentPassword(value)
              clear('currentPassword')
            }}
            onBlur={onBlur('currentPassword')}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            placeholder={temporary ? 'Temporary password' : 'Current password'}
            invalid={Boolean(errors.currentPassword)}
          />
        )}
      </Field>

      <Field
        id="password"
        label="New password"
        error={errors.password}
        hint={`At least ${PASSWORD_MIN} characters. Nobody at OSAS will know this one.`}
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            value={password}
            onChange={(value) => {
              setPassword(value)
              clear('password')
              if (confirmPassword) clear('confirmPassword')
            }}
            onBlur={onBlur('password')}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            invalid={Boolean(errors.password)}
          />
        )}
      </Field>

      <Field id="confirmPassword" label="Re-enter new password" error={errors.confirmPassword}>
        {(props) => (
          <PasswordInput
            {...props}
            name="confirmPassword"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value)
              clear('confirmPassword')
            }}
            onBlur={onBlur('confirmPassword')}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            placeholder="Re-enter the new password"
            invalid={Boolean(errors.confirmPassword)}
          />
        )}
      </Field>

      <button type="submit" disabled={busy} className={buttonClass({ variant: 'primary', block: true })}>
        {busy ? <Spinner /> : null}
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}

'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import {
  fetchRecoveryQuestions,
  RequestError,
  resetPasswordWithAnswers,
  type RecoveryQuestion,
} from '@/lib/client-api'

type Step = 'email' | 'questions' | 'unknown' | 'done'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 200

/**
 * The self-service reset, in two steps: identify the account, then answer its
 * questions and choose a new password.
 *
 * There is no mail provider in this project, so nothing is sent — the questions
 * are the whole mechanism. Both endpoints answer identically for an unknown
 * address and an account without questions, so this form cannot be used to
 * discover which emails are registered; the copy it shows covers both cases
 * without pretending to know which one happened.
 */
export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [questions, setQuestions] = useState<RecoveryQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function clear(field: string) {
    setErrors((current) => (current[field] === undefined ? current : { ...current, [field]: '' }))
  }

  async function onSubmitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const trimmed = email.trim()
    if (!trimmed) {
      setErrors({ email: 'Enter the email address on your account.' })
      document.getElementById('reset-email')?.focus()
      return
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrors({ email: 'That does not look like an email address.' })
      document.getElementById('reset-email')?.focus()
      return
    }

    setErrors({})
    setFormError(null)
    setBusy(true)
    try {
      const found = await fetchRecoveryQuestions(trimmed)
      setEmail(trimmed)
      if (found.length === 0) {
        setStep('unknown')
        return
      }
      setQuestions(found)
      setAnswers({})
      setStep('questions')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found: Record<string, string> = {}
    for (const question of questions) {
      if (!answers[question.questionKey]?.trim()) {
        found[question.questionKey] = 'Please answer this question.'
      }
    }
    if (!password) {
      found.password = 'Choose a new password.'
    } else if (password.length < PASSWORD_MIN) {
      found.password = `Use at least ${PASSWORD_MIN} characters.`
    }
    if (!confirmPassword) {
      found.confirmPassword = 'Re-enter your new password.'
    } else if (confirmPassword !== password) {
      found.confirmPassword = 'Passwords do not match.'
    }
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) {
      const first = questions.find((question) => found[question.questionKey])
      document
        .getElementById(
          first ? `reset-answer-${first.questionKey}` : found.password ? 'reset-password' : 'reset-confirm',
        )
        ?.focus()
      return
    }

    setBusy(true)
    try {
      await resetPasswordWithAnswers({
        email,
        answers: questions.map((question) => ({
          questionKey: question.questionKey,
          answer: answers[question.questionKey] ?? '',
        })),
        password,
        confirmPassword,
      })
      setStep('done')
    } catch (error) {
      // Wrong answers come back as a form-level message (the API will not say
      // which question was wrong); field problems land next to their control.
      if (error instanceof RequestError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields)
      } else {
        setFormError(
          error instanceof Error ? error.message : 'We could not reset that password.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  if (step === 'unknown') {
    return (
      <EmptyState
        title="No recovery questions on that account"
        message="Either there is no account with that email, or it has no security questions set up. Contact the OSAS office with your student ID — staff can reset your password in person."
      >
        <button
          type="button"
          onClick={() => {
            setStep('email')
            setFormError(null)
          }}
          className={buttonClass({ variant: 'secondary' })}
        >
          Try another email
        </button>
        <Link href="/login" className={buttonClass({ variant: 'quiet' })}>
          Back to sign in
        </Link>
      </EmptyState>
    )
  }

  if (step === 'done') {
    return (
      <EmptyState
        title="Password reset"
        message="Sign in with your new password. Any device that was already signed in to this account has been signed out."
      >
        <Link href="/login" className={buttonClass({ variant: 'primary' })}>
          Sign in
        </Link>
      </EmptyState>
    )
  }

  if (step === 'questions') {
    return (
      <form onSubmit={onSubmitAnswers} noValidate className="space-y-6">
        {formError ? <ErrorNote>{formError}</ErrorNote> : null}

        <p className="measure text-sm text-ink-muted">
          Answer the questions {email} set up, then choose a new password. Capitals and extra
          spaces do not matter.
        </p>

        {questions.map((question, index) => (
          <Field
            key={question.questionKey}
            id={`reset-answer-${question.questionKey}`}
            label={question.prompt}
            error={errors[question.questionKey]}
          >
            {(props) => (
              <PasswordInput
                {...props}
                name={`answer-${index}`}
                value={answers[question.questionKey] ?? ''}
                onChange={(value) => {
                  setAnswers((current) => ({ ...current, [question.questionKey]: value }))
                  clear(question.questionKey)
                }}
                autoComplete="off"
                maxLength={120}
                placeholder="Your answer"
                invalid={Boolean(errors[question.questionKey])}
              />
            )}
          </Field>
        ))}

        <Field id="reset-password" label="New password" error={errors.password}>
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
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              placeholder={`At least ${PASSWORD_MIN} characters`}
              invalid={Boolean(errors.password)}
            />
          )}
        </Field>

        <Field id="reset-confirm" label="Re-enter new password" error={errors.confirmPassword}>
          {(props) => (
            <PasswordInput
              {...props}
              name="confirmPassword"
              value={confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value)
                clear('confirmPassword')
              }}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              placeholder="Re-enter the new password"
              invalid={Boolean(errors.confirmPassword)}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={buttonClass({ variant: 'primary' })}>
            {busy ? <Spinner /> : null}
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setErrors({})
              setFormError(null)
            }}
            className={buttonClass({ variant: 'quiet' })}
          >
            Use another email
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={onSubmitEmail} noValidate className="space-y-6">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <Field
        id="reset-email"
        label="Email address"
        error={errors.email}
        hint="The account's security questions come next."
      >
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
              clear('email')
            }}
            className={inputClass({ invalid: Boolean(errors.email) })}
          />
        )}
      </Field>

      <button type="submit" disabled={busy} className={buttonClass({ variant: 'primary', block: true })}>
        {busy ? <Spinner /> : null}
        {busy ? 'Checking…' : 'Continue'}
      </button>
    </form>
  )
}

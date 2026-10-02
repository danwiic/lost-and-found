'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import {
  RequestError,
  saveRecoveryQuestions,
  type RecoveryQuestion,
} from '@/lib/client-api'
import {
  RECOVERY_ANSWER_MAX,
  RECOVERY_ANSWER_MIN,
  RECOVERY_QUESTION_COUNT,
  RECOVERY_QUESTIONS,
} from '@/lib/security-questions'

/**
 * The account's security questions, as the profile shows them: the prompts that
 * are configured, and the form that replaces them. Answers are never echoed
 * back — not even masked — because they are not stored in a readable form to
 * echo. Replacing them asks for the current password, so a session someone else
 * picked up cannot quietly lock the owner out of their own recovery.
 */
export function RecoverySection({ current }: { current: RecoveryQuestion[] }) {
  const router = useRouter()
  const { notify } = useToast()

  const configured = current.length > 0
  const [editing, setEditing] = useState(!configured)
  const [keys, setKeys] = useState<string[]>(() =>
    defaultKeys(current.map((question) => question.questionKey)),
  )
  const [answers, setAnswers] = useState<string[]>(() =>
    Array.from({ length: RECOVERY_QUESTION_COUNT }, () => ''),
  )
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setKeys(defaultKeys([]))
    setAnswers(Array.from({ length: RECOVERY_QUESTION_COUNT }, () => ''))
    setPassword('')
    setErrors({})
    setFormError(null)
  }

  function clearFieldError(key: string) {
    setErrors((current) =>
      current[key] === undefined ? current : { ...current, [key]: '' },
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const found: Record<string, string> = {}
    keys.forEach((key, index) => {
      if (answers[index].trim().length < RECOVERY_ANSWER_MIN) {
        found[key] = 'Please answer this question.'
      }
    })
    if (new Set(keys).size !== RECOVERY_QUESTION_COUNT) {
      found.answers = 'Choose three different questions.'
    }
    if (!password) found.password = 'Enter your current password.'
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) {
      const firstId = found.password
        ? 'recovery-password'
        : `recovery-answer-${keys.findIndex((key) => found[key])}`
      document.getElementById(firstId)?.focus()
      return
    }

    setSaving(true)
    try {
      await saveRecoveryQuestions({
        password,
        answers: keys.map((questionKey, index) => ({
          questionKey,
          answer: answers[index],
        })),
      })
      notify('Recovery questions saved.')
      resetForm()
      setEditing(false)
      router.refresh()
    } catch (error) {
      if (error instanceof RequestError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields)
      } else {
        setFormError(error instanceof Error ? error.message : 'We could not save that.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <>
        <ul className="divide-y divide-line">
          {current.map((question, index) => (
            <li key={question.questionKey} className="px-6 py-4 sm:px-6">
              <p className="text-xs text-ink-muted">Question {index + 1}</p>
              <p className="mt-1 text-sm text-ink">{question.prompt}</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-6 py-6 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setKeys(defaultKeys(current.map((question) => question.questionKey)))
            }}
            className={buttonClass({ variant: 'secondary' })}
          >
            Replace answers
          </button>
          <p className="measure text-xs text-ink-muted">
            Answers cannot be read back — not even by OSAS staff. Replacing them asks for your
            current password.
          </p>
        </div>
      </>
    )
  }

  const firstTime = !configured

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 px-6 py-6 sm:px-6">
      {formError || errors.answers ? (
        <ErrorNote>{formError ?? errors.answers}</ErrorNote>
      ) : null}

      {firstTime ? (
        <p className="measure text-sm text-ink-muted">
          Pick three questions and answer them. If you ever forget your password, these are the way
          back in — without them, a reset means a trip to the OSAS office.
        </p>
      ) : null}

      {keys.map((key, index) => (
        <div key={index} className="space-y-4">
          <Field id={`recovery-question-${index}`} label={`Question ${index + 1}`}>
            {(props) => (
              <select
                {...props}
                value={key}
                onChange={(event) => {
                  const next = [...keys]
                  next[index] = event.target.value
                  setKeys(next)
                  clearFieldError('answers')
                }}
                className={inputClass()}
              >
                {RECOVERY_QUESTIONS.map((question) => (
                  <option
                    key={question.key}
                    value={question.key}
                    // A question already used by another row cannot be picked twice.
                    disabled={keys.includes(question.key) && question.key !== key}
                  >
                    {question.prompt}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id={`recovery-answer-${index}`}
            label="Your answer"
            error={errors[key]}
            hint="Capitals and extra spaces are ignored."
          >
            {(props) => (
              <PasswordInput
                {...props}
                name={`answer-${index}`}
                value={answers[index]}
                onChange={(value) => {
                  setAnswers((current) =>
                    current.map((entry, position) => (position === index ? value : entry)),
                  )
                  clearFieldError(key)
                }}
                autoComplete="off"
                maxLength={RECOVERY_ANSWER_MAX}
                placeholder={`Answer ${index + 1}`}
                invalid={Boolean(errors[key])}
              />
            )}
          </Field>
        </div>
      ))}

      <Field
        id="recovery-password"
        label="Your current password"
        error={errors.password}
        hint="Asked for because these questions are a way into your account."
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            value={password}
            onChange={(value) => {
              setPassword(value)
              clearFieldError('password')
            }}
            autoComplete="current-password"
            maxLength={200}
            placeholder="Current password"
            invalid={Boolean(errors.password)}
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={buttonClass({ variant: 'primary' })}>
          {saving ? <Spinner /> : null}
          {saving ? 'Saving…' : firstTime ? 'Save recovery questions' : 'Save new answers'}
        </button>
        {configured ? (
          <button
            type="button"
            onClick={() => {
              resetForm()
              setEditing(false)
            }}
            className={buttonClass({ variant: 'quiet' })}
          >
            Cancel
          </button>
        ) : null}
      </div>

      <p className="measure text-xs text-ink-muted">
        Nobody can read your answers back, including OSAS staff — they are stored the way a
        password is. Spelling still has to match: “Balagtas” and “balagtas” are the same answer, but
        “Balagtas” and “Balagtaz” are not.
      </p>
    </form>
  )
}

/**
 * Three questions to put in the selects. The account's existing questions are
 * kept in place when replacing them; anything missing is filled from the top of
 * the catalog so no row starts empty.
 */
function defaultKeys(configured: string[]): string[] {
  const keys = configured.slice(0, RECOVERY_QUESTION_COUNT)
  for (const question of RECOVERY_QUESTIONS) {
    if (keys.length >= RECOVERY_QUESTION_COUNT) break
    if (!keys.includes(question.key)) keys.push(question.key)
  }
  return keys
}

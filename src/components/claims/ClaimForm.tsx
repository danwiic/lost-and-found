'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { submitClaim } from '@/lib/client-api'

type Values = {
  claimantName: string
  studentId: string
  contact: string
  additionalDetails: string
  proof: string
}

type Errors = Partial<Record<keyof Values, string>>

/**
 * Client-side mirrors of the server's length caps (the claims API route), so a
 * too-long answer is caught on blur instead of as a 422 after submit.
 */
const CLAIM_LIMITS: Record<keyof Values, number | undefined> = {
  claimantName: 120,
  studentId: 60,
  contact: 120,
  additionalDetails: undefined,
  proof: 2000,
}

const limitLabel: Partial<Record<keyof Values, string>> = {
  claimantName: 'Claimant name',
  studentId: 'Student / personnel ID',
  contact: 'Contact information',
  proof: 'Proof of ownership',
}

/**
 * The claim request (agents/UX.md §5.1, §10). Five fields, and the two that
 * carry the verification — contact and proof of ownership — are required.
 *
 * Submitting never implies a decision: the claim starts Pending and the copy
 * says so (§10.2), then the user is sent to My Claims where the status lives
 * (§3.3).
 */
export function ClaimForm({
  itemId,
  defaults,
}: {
  itemId: string
  defaults: { claimantName: string; studentId: string; contact: string }
}) {
  const router = useRouter()
  const { notify } = useToast()

  const [values, setValues] = useState<Values>({
    claimantName: defaults.claimantName,
    studentId: defaults.studentId,
    contact: defaults.contact,
    additionalDetails: '',
    proof: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dirty =
    values.claimantName !== defaults.claimantName ||
    values.studentId !== defaults.studentId ||
    values.contact !== defaults.contact ||
    values.additionalDetails !== '' ||
    values.proof !== ''

  // §22 — the same prompt ReportForm gives: a half-filled form never silently
  // vanishes, including on a full-page refresh while the submit is in flight.
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function set(field: keyof Values) {
    return (value: string) => setValues((current) => ({ ...current, [field]: value }))
  }

  function validateOne(field: keyof Values): string | undefined {
    const value = values[field].trim()
    if (field === 'additionalDetails') return undefined
    if (!value) {
      switch (field) {
        case 'claimantName':
          return 'Enter the name OSAS should verify.'
        case 'studentId':
          return 'Enter your student or personnel ID.'
        case 'contact':
          return 'Enter a contact number or email address.'
        case 'proof':
          return 'Describe what proves the item is yours.'
      }
    }
    if (field === 'proof' && value.length < 10) {
      return 'Add a little more detail — OSAS verifies claims against this.'
    }
    const limit = CLAIM_LIMITS[field]
    if (limit && value.length > limit) {
      return `${limitLabel[field] ?? field} must be at most ${limit} characters.`
    }
    return undefined
  }

  function validate(): Errors {
    const found: Errors = {}
    for (const field of ['claimantName', 'studentId', 'contact', 'proof'] as const) {
      const problem = validateOne(field)
      if (problem) found[field] = problem
    }
    return found
  }

  function onBlur(field: keyof Values) {
    return () => setErrors((current) => ({ ...current, [field]: validateOne(field) }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return // §10.2 — no duplicate claims

    const found = validate()
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setSubmitting(true)
    try {
      const result = await submitClaim(itemId, {
        claimantName: values.claimantName.trim(),
        studentId: values.studentId.trim(),
        contact: values.contact.trim(),
        additionalDetails: values.additionalDetails.trim(),
        proof: values.proof.trim(),
      })

      notify(result.message)
      router.push('/claims')
      router.refresh()
    } catch (error) {
      const failure = error as { message?: string; fields?: Record<string, string> }
      if (failure.fields && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields as Errors)
      } else {
        setFormError(
          failure.message ?? "We couldn't submit your claim. Check your connection and try again.",
        )
      }
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Who is claiming</h2>

        <Field id="claimantName" label="Claimant name" error={errors.claimantName}>
          {(props) => (
            <input
              {...props}
              type="text"
              name="claimantName"
              autoComplete="name"
              maxLength={120}
              value={values.claimantName}
              onChange={(event) => set('claimantName')(event.target.value)}
              onBlur={onBlur('claimantName')}
              className={inputClass({ invalid: Boolean(errors.claimantName) })}
            />
          )}
        </Field>

        <Field
          id="studentId"
          label="Student / personnel ID"
          hint="The ID OSAS will check against your record."
          error={errors.studentId}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              name="studentId"
              maxLength={60}
              value={values.studentId}
              onChange={(event) => set('studentId')(event.target.value)}
              onBlur={onBlur('studentId')}
              className={inputClass({ invalid: Boolean(errors.studentId) })}
            />
          )}
        </Field>

        <Field id="contact" label="Contact information" error={errors.contact}>
          {(props) => (
            <input
              {...props}
              type="text"
              name="contact"
              autoComplete="tel"
              maxLength={120}
              placeholder="0917 000 0000"
              value={values.contact}
              onChange={(event) => set('contact')(event.target.value)}
              onBlur={onBlur('contact')}
              className={inputClass({ invalid: Boolean(errors.contact) })}
            />
          )}
        </Field>
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <h2 className="text-lg font-semibold">Why it is yours</h2>

        <Field
          id="proof"
          label="Proof of ownership"
          hint="What only the owner would know — a mark, a scratch, contents, a serial number, a photo of you with it."
          error={errors.proof}
        >
          {(props) => (
            <textarea
              {...props}
              name="proof"
              rows={5}
              maxLength={2000}
              value={values.proof}
              onChange={(event) => set('proof')(event.target.value)}
              onBlur={onBlur('proof')}
              className={inputClass({ invalid: Boolean(errors.proof) })}
            />
          )}
        </Field>

        <Field
          id="additionalDetails"
          label="Additional item details"
          optionalHint="Optional"
          hint="Anything else OSAS should know about the item or how you lost it."
        >
          {(props) => (
            <textarea
              {...props}
              name="additionalDetails"
              rows={3}
              maxLength={2000}
              value={values.additionalDetails}
              onChange={(event) => set('additionalDetails')(event.target.value)}
              className={inputClass()}
            />
          )}
        </Field>
      </section>

      <div className="rounded-lg border border-attention/25 bg-attention-soft px-4 py-3">
        <p className="text-sm font-medium text-attention">What happens next</p>
        <p className="measure mt-1 text-sm text-attention">
          Your claim starts as Pending. OSAS staff review it in person, and you are notified either
          way. A match between photos is not proof of ownership — this step is where a person
          decides.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="submit" disabled={submitting} className={buttonClass({ variant: 'primary' })}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Submitting claim…' : 'Submit Claim'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className={buttonClass({ variant: 'quiet' })}
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to the item
        </button>
      </div>
    </form>
  )
}

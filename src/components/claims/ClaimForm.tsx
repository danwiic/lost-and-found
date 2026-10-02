'use client'

import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { submitClaim } from '@/lib/client-api'

/*
 * Mirrors the server's upload rules (src/lib/config.ts) so an obviously wrong
 * file is caught before a request is spent on it. The server still re-checks —
 * this is a courtesy, not the guard.
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

type Values = {
  claimantName: string
  studentId: string
  contact: string
  additionalDetails: string
  proof: string
}

type Errors = Partial<Record<keyof Values | 'photo', string>>

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
 * carry the verification — contact and proof of ownership — are required. A
 * proof photo can be attached as well; it is optional, and the written proof is
 * what OSAS always verifies against.
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
  const photoId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const previewUrl = useRef<string | null>(null)

  const [values, setValues] = useState<Values>({
    claimantName: defaults.claimantName,
    studentId: defaults.studentId,
    contact: defaults.contact,
    additionalDetails: '',
    proof: '',
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dirty =
    photo !== null ||
    values.claimantName !== defaults.claimantName ||
    values.studentId !== defaults.studentId ||
    values.contact !== defaults.contact ||
    values.additionalDetails !== '' ||
    values.proof !== ''

  // Object URLs are revoked when the photo is replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    }
  }, [])

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

  /* ---------------------------------------------------------------- *
   * Proof photo (optional)
   * ---------------------------------------------------------------- */

  function acceptPhoto(file: File | undefined) {
    if (!file) return

    // An image problem never clears the rest of the form.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors((current) => ({
        ...current,
        photo: 'That file is not a JPEG, PNG or WebP image. Choose a photo of the proof.',
      }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((current) => ({
        ...current,
        photo: 'That photo is larger than 8 MB. Choose a smaller one.',
      }))
      return
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    const url = URL.createObjectURL(file)
    previewUrl.current = url

    setPhoto(file)
    setPreview(url)
    setErrors((current) => ({ ...current, photo: undefined }))
  }

  function removePhoto() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
    setPhoto(null)
    setPreview(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    acceptPhoto(event.dataTransfer.files[0])
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    acceptPhoto(event.target.files?.[0])
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
      const result = await submitClaim(
        itemId,
        {
          claimantName: values.claimantName.trim(),
          studentId: values.studentId.trim(),
          contact: values.contact.trim(),
          additionalDetails: values.additionalDetails.trim(),
          proof: values.proof.trim(),
        },
        photo,
      )

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
          hint="What only the owner would know — a mark, a scratch, contents, a serial number. OSAS verifies the claim against this."
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
              placeholder="e.g. a scratch on the back, the serial number under the lid, or what is inside."
              className={inputClass({ invalid: Boolean(errors.proof) })}
            />
          )}
        </Field>

        {/* Optional: a photo helps OSAS check faster, but the written proof
            above is the part that is always required. */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">Proof photo</span>
            <span className="text-xs text-ink-muted">Optional</span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            A photo that backs up the description — an engraving, a receipt, or the item in your
            possession. JPEG, PNG or WebP, up to 8 MB.
          </p>

          {preview ? (
            <div className="mt-2 flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served asset */}
              <img
                src={preview}
                alt="The proof photo you selected for this claim"
                className="h-28 w-28 rounded-lg border border-line bg-surface-sunk object-cover"
              />
              <div className="space-y-2">
                <p className="break-all text-sm text-ink">{photo?.name}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className={buttonClass({ variant: 'secondary', size: 'sm' })}
                  >
                    Replace photo
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className={buttonClass({ variant: 'quiet', size: 'sm' })}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunk/50'
              }`}
            >
              <p className="text-sm text-ink">No photo attached</p>
              <p className="mt-1 text-xs text-ink-muted">
                A photo is optional — the written proof above is enough on its own.
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={`mt-3 ${buttonClass({ variant: 'secondary', size: 'sm' })}`}
              >
                <Icon name="upload" className="h-4 w-4" />
                Add a photo
              </button>
            </div>
          )}

          <input
            ref={fileInput}
            id={photoId}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={onPick}
            className="sr-only"
            aria-describedby={errors.photo ? `${photoId}-error` : undefined}
            aria-invalid={errors.photo ? true : undefined}
          />

          {errors.photo ? (
            <p id={`${photoId}-error`} role="alert" className="mt-2 text-sm text-refused">
              {errors.photo}
            </p>
          ) : null}
        </div>

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
              placeholder="e.g. where and when you last used the item, or a distinguishing detail."
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

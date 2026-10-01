'use client'

import Link from 'next/link'
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
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { submitReport, type MatchCandidate, type ReportResponse } from '@/lib/client-api'
import { formatSimilarity, itemStatusLabel, itemTypeLabel, localDay } from '@/lib/format'

/*
 * Mirrors the server's upload rules (src/lib/config.ts) so an obviously wrong
 * file is caught before a request is spent on it. The server still re-checks —
 * this is a courtesy, not the guard.
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

type Values = {
  name: string
  description: string
  color: string
  dateEvent: string
  location: string
  additionalDetails: string
}

type Errors = Partial<Record<keyof Values | 'photo', string>>

const EMPTY: Values = {
  name: '',
  description: '',
  color: '',
  dateEvent: '',
  location: '',
  additionalDetails: '',
}

/**
 * The report form for both lost and found items — the fields are identical, so
 * the wording is the only thing that changes (agents/UX.md §5.1).
 *
 * The photo is required because matching runs on it. Once the report is
 * accepted the form is replaced by a confirmation that shows whatever the
 * matching system found, and for a found item it also instructs the finder to
 * turn the physical item over to OSAS (agents/UX.md §29).
 */
export function ReportForm({ type }: { type: 'LOST' | 'FOUND' }) {
  const lost = type === 'LOST'
  // The viewer's own today — the boundary the date picker and validator agree on.
  const today = localDay()
  const photoId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const previewUrl = useRef<string | null>(null)

  const [values, setValues] = useState<Values>(EMPTY)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReportResponse | null>(null)
  const [dragging, setDragging] = useState(false)

  const dirty =
    !result &&
    (photo !== null || (Object.keys(EMPTY) as Array<keyof Values>).some(key => values[key] !== ''))

  // §22 — a half-filled form that would silently vanish deserves a prompt.
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Object URLs are revoked when the photo is replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    }
  }, [])

  function set(field: keyof Values) {
    return (value: string) => setValues(current => ({ ...current, [field]: value }))
  }

  /* ---------------------------------------------------------------- *
   * Photo
   * ---------------------------------------------------------------- */

  function acceptPhoto(file: File | undefined) {
    if (!file) return

    // An image problem never clears the rest of the form (§6.2).
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors(current => ({
        ...current,
        photo: 'That file is not a JPEG, PNG or WebP image. Choose a photo of the item.',
      }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors(current => ({
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
    setErrors(current => ({ ...current, photo: undefined }))
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

  /* ---------------------------------------------------------------- *
   * Validation and submit
   * ---------------------------------------------------------------- */

  function validate(): Errors {
    const found: Errors = {}

    if (!values.name.trim()) found.name = 'Enter the item name.'
    if (!values.description.trim()) found.description = 'Describe the item.'
    if (!values.dateEvent) {
      found.dateEvent = `Enter the date it was ${lost ? 'lost' : 'found'}.`
    } else if (Number.isNaN(new Date(values.dateEvent).getTime())) {
      found.dateEvent = 'Enter a valid date.'
    } else if (values.dateEvent > today) {
      found.dateEvent = "The date can't be in the future."
    }
    if (!values.location.trim()) {
      found.location = `Enter where it was ${lost ? 'lost' : 'found'}.`
    }
    if (!photo) found.photo = 'A photo is required — the matching system reads it.'

    return found
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return // §5.5 — never a duplicate report

    const found = validate()
    setErrors(found)
    setFormError(null)

    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0]
      const target = first === 'photo' ? photoId : first
      document.getElementById(target)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.set('type', type)
      form.set('name', values.name.trim())
      form.set('description', values.description.trim())
      if (values.color.trim()) form.set('color', values.color.trim())
      form.set('dateEvent', values.dateEvent)
      form.set('location', values.location.trim())
      if (values.additionalDetails.trim()) {
        form.set('additionalDetails', values.additionalDetails.trim())
      }
      // Photo last: the server reads it as the multipart file part.
      if (photo) form.set('photo', photo)

      setResult(await submitReport(form))
    } catch (error) {
      const failure = error as { message?: string; fields?: Record<string, string> }
      // Entered data is preserved — only the messages change (§5.5, §17.1).
      if (failure.fields && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields as Errors)
      } else {
        setFormError(
          failure.message ?? "We couldn't submit your report. Check your connection and try again."
        )
      }
      setSubmitting(false)
    }
  }

  /* ---------------------------------------------------------------- *
   * Confirmation
   * ---------------------------------------------------------------- */

  if (result) {
    return <ReportConfirmation type={type} result={result} />
  }

  const dateLabel = lost ? 'Date lost' : 'Date found'
  const placeLabel = lost ? 'Where it was lost' : 'Where it was found'
  const dateHint = lost ? 'The day you last had it.' : 'The day you found it.'

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">What the item is</h2>

        <Field id="name" label="Item name" error={errors.name}>
          {props => (
            <input
              {...props}
              type="text"
              name="name"
              maxLength={150}
              value={values.name}
              onChange={event => set('name')(event.target.value)}
              placeholder={lost ? 'Blue backpack with a broken zip' : 'Black umbrella'}
              className={inputClass({ invalid: Boolean(errors.name) })}
            />
          )}
        </Field>

        <Field
          id="description"
          label="Description"
          hint="What it looks like, and anything that marks it as yours."
          error={errors.description}
        >
          {props => (
            <textarea
              {...props}
              name="description"
              rows={4}
              maxLength={2000}
              value={values.description}
              onChange={event => set('description')(event.target.value)}
              className={inputClass({ invalid: Boolean(errors.description) })}
            />
          )}
        </Field>

        <Field id="color" label="Colour" optionalHint="Optional">
          {props => (
            <input
              {...props}
              type="text"
              name="color"
              maxLength={60}
              value={values.color}
              onChange={event => set('color')(event.target.value)}
              placeholder="Blue"
              className={inputClass()}
            />
          )}
        </Field>
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <h2 className="text-lg font-semibold">When and where</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="dateEvent" label={dateLabel} hint={dateHint} error={errors.dateEvent}>
            {props => (
              <input
                {...props}
                type="date"
                name="dateEvent"
                max={today}
                value={values.dateEvent}
                onChange={event => set('dateEvent')(event.target.value)}
                className={inputClass({ invalid: Boolean(errors.dateEvent) })}
              />
            )}
          </Field>

          <Field
            id="location"
            label={placeLabel}
            hint="Where you found the item."
            error={errors.location}
          >
            {props => (
              <input
                {...props}
                type="text"
                name="location"
                maxLength={200}
                value={values.location}
                onChange={event => set('location')(event.target.value)}
                placeholder={lost ? 'Library, 2nd floor' : 'Main lobby'}
                className={inputClass({ invalid: Boolean(errors.location) })}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <div>
          <h2 className="text-lg font-semibold">Photo</h2>
          <p className="measure mt-1 text-sm text-ink-muted">
            Required. The matching system compares this photo against open reports of the opposite
            type — a lost report against found items, and the other way round.
          </p>
        </div>

        {preview ? (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served asset */}
            <img
              src={preview}
              alt="The photo you selected for this report"
              className="h-40 w-40 rounded-lg border border-line bg-surface-sunk object-cover"
            />
            <div className="space-y-2">
              <p className="text-sm text-ink">{photo?.name}</p>
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
            onDragOver={event => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-200 ease-[var(--ease-out-expo)] ${
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunk/50'
            }`}
          >
            <p className="text-sm font-medium text-ink">Drop a photo here</p>
            <p className="mt-1 text-xs text-ink-muted">JPEG, PNG or WebP, up to 8 MB.</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={`mt-4 ${buttonClass({ variant: 'secondary', size: 'sm' })}`}
            >
              Choose a photo
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
          <p id={`${photoId}-error`} role="alert" className="text-sm text-refused">
            {errors.photo}
          </p>
        ) : null}
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <Field
          id="additionalDetails"
          label="Additional details"
          optionalHint="Optional"
          hint="Anything that did not fit above."
        >
          {props => (
            <textarea
              {...props}
              name="additionalDetails"
              rows={3}
              maxLength={2000}
              value={values.additionalDetails}
              onChange={event => set('additionalDetails')(event.target.value)}
              className={inputClass()}
            />
          )}
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="submit" disabled={submitting} className={buttonClass({ variant: 'primary' })}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Submitting…' : lost ? 'Submit Lost Report' : 'Submit Found Report'}
        </button>
        <p className="text-xs text-ink-muted">
          Required fields are name, description, {dateLabel.toLowerCase()},{' '}
          {placeLabel.toLowerCase()} and the photo.
        </p>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ *
 * Confirmation
 * ------------------------------------------------------------------ */

function ReportConfirmation({ type, result }: { type: 'LOST' | 'FOUND'; result: ReportResponse }) {
  const lost = type === 'LOST'
  const { matches, warning } = result

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-verified/25 bg-verified-soft px-6 py-4">
        <p className="flex items-center gap-2 text-sm font-medium text-verified">
          <Icon name="check" className="h-4 w-4" />
          Report submitted successfully.
        </p>
        <p className="measure mt-1 text-sm text-verified">
          “{result.item.name}” is now on the record with the status{' '}
          {itemStatusLabel(result.item.status)}.
        </p>
      </div>

      {!lost ? (
        <section className="rounded-lg border border-attention/25 bg-attention-soft px-6 py-4">
          <h2 className="text-sm font-medium text-attention">Turn the item over to OSAS</h2>
          <p className="measure mt-1 text-sm text-attention">
            Take the physical item to the OSAS office. The record you just filed is not a hand-over:
            the item stays in your care until the office receives it.
          </p>
        </section>
      ) : null}

      {warning ? <ErrorNote>{warning}</ErrorNote> : null}

      {matches.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">
            {matches.length === 1 ? 'One possible match' : `${matches.length} possible matches`}
          </h2>
          <p className="measure mt-1 text-sm text-ink-muted">
            These are the items whose photos look most like yours. Similarity is a lead, not proof —
            open one and claim it only if it is yours.
          </p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {matches.map(match => (
              <CandidateCard key={match.matchId} match={match} />
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-semibold">No possible match yet</h2>
          <p className="measure mt-1 text-sm text-ink-muted">
            Nothing open looks like this photo right now. Your report stays on the list, and you
            will get a notification if a matching item is reported later.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Link href="/my-reports" className={buttonClass({ variant: 'primary' })}>
          Go to My Reports
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
        <Link href={`/items/${result.item.id}`} className={buttonClass()}>
          View this report
        </Link>
        <Link href="/" className={buttonClass({ variant: 'quiet' })}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}

/** A candidate the matching system returned, with its honest similarity reading. */
function CandidateCard({ match }: { match: MatchCandidate }) {
  const photo = match.imagePath ? `/api/files/${match.imagePath}` : null

  return (
    <li className="overflow-hidden rounded-lg border border-line bg-surface">
      <PhotoFrame src={photo} alt={match.name} size="card" />

      <div className="border-t border-line px-4 py-4">
        <p className="text-[0.9375rem] leading-snug font-medium">{match.name}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {itemTypeLabel(match.type)} · {match.location}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">Visual similarity</span>
          {/* Measurement type: a reading to compare exactly. */}
          <span className="data ml-auto text-sm text-attention">
            {formatSimilarity(match.similarity)}
          </span>
        </div>

        <Link
          href={`/items/${match.itemId}`}
          className={`mt-4 ${buttonClass({ variant: 'secondary', size: 'sm' })}`}
        >
          View Item
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </li>
  )
}

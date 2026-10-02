'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
import {
  searchUserAccounts,
  submitReport,
  type MatchCandidate,
  type ReportResponse,
  type UserLookup,
} from '@/lib/client-api'
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
  /** Intake only: who physically handed the item over at the counter. */
  finderName: string
  finderContact: string
}

type Errors = Partial<Record<keyof Values | 'photo' | 'reporterId', string>>

const EMPTY: Values = {
  name: '',
  description: '',
  color: '',
  dateEvent: '',
  location: '',
  additionalDetails: '',
  finderName: '',
  finderContact: '',
}

/**
 * The report form for both lost and found items — the fields are identical, so
 * the wording is the only thing that changes (agents/UX.md §5.1).
 *
 * `intake` is the OSAS counter variant: office wording ("Date surrendered"),
 * who handed the item over, and an optional link to the finder's account. It is
 * the same form and the same POST /api/items, so an intake record runs through
 * the identical embed/match/notify pipeline.
 *
 * The photo is required because matching runs on it. Once the report is
 * accepted the form is replaced by a confirmation that shows whatever the
 * matching system found, and for a found item it also instructs the finder to
 * turn the physical item over to OSAS (agents/UX.md §29).
 */
export function ReportForm({
  type,
  intake = false,
}: {
  type: 'LOST' | 'FOUND'
  /** OSAS counter mode: office wording, finder fields, optional account link. */
  intake?: boolean
}) {
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

  // Intake only: the registered account the record may be filed under.
  const [linkedUser, setLinkedUser] = useState<UserLookup | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserLookup[]>([])
  const [userSearching, setUserSearching] = useState(false)
  const [userSearchError, setUserSearchError] = useState<string | null>(null)

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

  // Look the finder's account up as staff type. Two characters minimum, the
  // request debounced and aborted when the query moves on. Every setState here
  // happens inside the debounce callback, never synchronously in the effect.
  useEffect(() => {
    if (!intake || linkedUser) return

    const q = userQuery.trim()
    if (q.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setUserResults([])
      setUserSearchError(null)
      setUserSearching(true)
      searchUserAccounts(q, controller.signal)
        .then((rows) => {
          setUserResults(rows)
          setUserSearchError(null)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setUserResults([])
          setUserSearchError(
            error instanceof Error ? error.message : "We couldn't search the accounts.",
          )
        })
        .finally(() => {
          if (!controller.signal.aborted) setUserSearching(false)
        })
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [intake, linkedUser, userQuery])

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
      if (intake) {
        if (values.finderName.trim()) form.set('finderName', values.finderName.trim())
        if (values.finderContact.trim()) form.set('finderContact', values.finderContact.trim())
        if (linkedUser) form.set('reporterId', linkedUser.id)
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
          failure.message ??
            (intake
              ? "We couldn't record the item. Check your connection and try again."
              : "We couldn't submit your report. Check your connection and try again."),
        )
      }
      setSubmitting(false)
    }
  }

  /* ---------------------------------------------------------------- *
   * Confirmation
   * ---------------------------------------------------------------- */

  if (result) {
    return <ReportConfirmation type={type} intake={intake} result={result} />
  }

  const dateLabel = intake ? 'Date surrendered' : lost ? 'Date lost' : 'Date found'
  const placeLabel = intake ? 'Where it was found' : lost ? 'Where it was lost' : 'Where it was found'
  const dateHint = intake
    ? 'The day the finder handed it in at the office.'
    : lost
      ? 'The day you last had it.'
      : 'The day you found it.'
  const placeHint = intake
    ? 'Where the finder came across it — matching reads this.'
    : lost
      ? 'The place you lost it.'
      : 'The place you found it.'
  // Nothing in the account lookup renders unless a real query is on screen.
  const userQueryReady = intake && userQuery.trim().length >= 2

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
          hint={
            intake
              ? "What it looks like, and anything that would mark it as the owner's."
              : 'What it looks like, and anything that marks it as yours.'
          }
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
        <h2 className="text-lg font-semibold">
          {intake ? 'When and where it was received' : 'When and where'}
        </h2>

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

          <Field id="location" label={placeLabel} hint={placeHint} error={errors.location}>
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

      {intake ? (
        <section className="space-y-6 border-t border-line pt-8">
          <div>
            <h2 className="text-lg font-semibold">Who handed it in</h2>
            <p className="measure mt-1 text-sm text-ink-muted">
              Record the person who brought the item to the counter. They do not need an account —
              a name and a contact number are enough for the office to follow up.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              id="finderName"
              label="Finder's name"
              optionalHint="Optional"
              hint="As they gave it at the counter."
              error={errors.finderName}
            >
              {props => (
                <input
                  {...props}
                  type="text"
                  name="finderName"
                  maxLength={120}
                  value={values.finderName}
                  onChange={event => set('finderName')(event.target.value)}
                  placeholder="Ana Cruz"
                  className={inputClass({ invalid: Boolean(errors.finderName) })}
                />
              )}
            </Field>

            <Field
              id="finderContact"
              label="Finder's contact"
              optionalHint="Optional"
              hint="A phone number or email to follow up on."
              error={errors.finderContact}
            >
              {props => (
                <input
                  {...props}
                  type="text"
                  name="finderContact"
                  maxLength={120}
                  value={values.finderContact}
                  onChange={event => set('finderContact')(event.target.value)}
                  placeholder="0917 000 0000"
                  className={inputClass({ invalid: Boolean(errors.finderContact) })}
                />
              )}
            </Field>
          </div>

          {linkedUser ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-verified/25 bg-verified-soft px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-verified">Filed under</p>
                <p className="mt-1 text-sm font-medium text-verified">{linkedUser.name}</p>
                <p className="mt-1 text-xs text-verified">
                  {linkedUser.email}
                  {linkedUser.studentId ? ` · ID ${linkedUser.studentId}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinkedUser(null)
                  setUserQuery('')
                  setUserResults([])
                }}
                className={`ml-auto ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
              >
                Clear
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="finderAccount" className="text-sm font-medium text-ink">
                Finder&rsquo;s account
              </label>
              <p className="mt-1 text-xs text-ink-muted">
                Optional. If the finder is registered and present, link their account and the record
                is filed under their name. Leave it empty and the record sits under yours, with the
                name above capturing who actually handed it over.
              </p>

              <input
                id="finderAccount"
                type="search"
                value={userQuery}
                onChange={event => setUserQuery(event.target.value)}
                placeholder="Search by name, email or student ID"
                autoComplete="off"
                className={`mt-2 ${inputClass()}`}
              />

              {userQueryReady && userSearchError ? (
                <p role="alert" className="mt-2 text-sm text-refused">
                  {userSearchError}
                </p>
              ) : null}

              {userQueryReady && userSearching ? (
                <p role="status" className="mt-2 text-xs text-ink-muted">
                  Searching accounts…
                </p>
              ) : null}

              {userQueryReady &&
              !userSearching &&
              userResults.length === 0 &&
              !userSearchError ? (
                <p role="status" className="mt-2 text-xs text-ink-muted">
                  No account matches that search.
                </p>
              ) : null}

              {userQueryReady && userResults.length > 0 ? (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {userResults.map(user => (
                    <li
                      key={user.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{user.name}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {user.email}
                          {user.studentId ? ` · ID ${user.studentId}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkedUser(user)
                          setUserResults([])
                          setUserSearching(false)
                        }}
                        className={`ml-auto ${buttonClass({ variant: 'secondary', size: 'sm' })}`}
                      >
                        Use this account
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {errors.reporterId ? (
                <p role="alert" className="mt-2 text-sm text-refused">
                  {errors.reporterId}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-6 border-t border-line pt-8">
        <div>
          <h2 className="text-lg font-semibold">Photo</h2>
          <p className="measure mt-1 text-sm text-ink-muted">
            {intake
              ? 'Required. It is embedded and compared against open lost reports the moment you record the item.'
              : 'Required. The matching system compares this photo against open reports of the opposite type — a lost report against found items, and the other way round.'}
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
          {submitting
            ? 'Submitting…'
            : intake
              ? 'Record received item'
              : lost
                ? 'Submit Lost Report'
                : 'Submit Found Report'}
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

function ReportConfirmation({
  type,
  intake,
  result,
}: {
  type: 'LOST' | 'FOUND'
  intake: boolean
  result: ReportResponse
}) {
  const lost = type === 'LOST'
  const { matches, warning } = result
  // Tuning mode: `?debug=1` prints the raw cosine behind each candidate score.
  const debug = useSearchParams().get('debug') === '1'

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-verified/25 bg-verified-soft px-6 py-4">
        <p className="flex items-center gap-2 text-sm font-medium text-verified">
          <Icon name="check" className="h-4 w-4" />
          {intake ? 'Item recorded.' : 'Report submitted successfully.'}
        </p>
        <p className="measure mt-1 text-sm text-verified">
          “{result.item.name}” is now on the record with the status{' '}
          {itemStatusLabel(result.item.status)}.
        </p>
      </div>

      {!lost && !intake ? (
        <section className="rounded-lg border border-attention/25 bg-attention-soft px-6 py-4">
          <h2 className="text-sm font-medium text-attention">Turn the item over to OSAS</h2>
          <p className="measure mt-1 text-sm text-attention">
            Take the physical item to the OSAS office. The record you just filed is not a hand-over:
            the item stays in your care until the office receives it.
          </p>
        </section>
      ) : null}

      {intake ? (
        <section className="rounded-lg border border-verified/25 bg-verified-soft px-6 py-4">
          <h2 className="text-sm font-medium text-verified">Keep it with the office</h2>
          <p className="measure mt-1 text-sm text-verified">
            The item is on the found list now. Hold it at the counter until a claim is approved and
            the hand-over is recorded on the claim.
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
            {intake
              ? 'These are the open reports whose photos look most like this item. Both sides are notified, and similarity is a lead — the owner still has to claim it.'
              : 'These are the items whose photos look most like yours. Similarity is a lead, not proof — open one and claim it only if it is yours.'}
          </p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {matches.map(match => (
              <CandidateCard key={match.matchId} match={match} debug={debug} />
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-semibold">No possible match yet</h2>
          <p className="measure mt-1 text-sm text-ink-muted">
            {intake
              ? 'Nothing open looks like this photo right now. The item stays on the found list, and matching runs again against every new lost report.'
              : 'Nothing open looks like this photo right now. Your report stays on the list, and you will get a notification if a matching item is reported later.'}
          </p>
        </section>
      )}

      {intake ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Link href="/admin/intake" className={buttonClass({ variant: 'primary' })}>
            <Icon name="plus" className="h-4 w-4" />
            Log another item
          </Link>
          <Link href={`/items/${result.item.id}`} className={buttonClass()}>
            View this record
          </Link>
          <Link href="/admin/found" className={buttonClass({ variant: 'quiet' })}>
            Found Items
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  )
}

/** A candidate the matching system returned, with its honest similarity reading. */
function CandidateCard({ match, debug }: { match: MatchCandidate; debug: boolean }) {
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
          {debug ? (
            <span className="data text-xs text-ink-muted">
              raw {match.raw.toFixed(4)} · calibrated {match.similarity.toFixed(4)}
            </span>
          ) : null}
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

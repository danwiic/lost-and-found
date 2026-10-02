'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { RecordGrid } from '@/components/records/RecordGrid'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { searchItemsByPhoto, type PhotoSearchResponse } from '@/lib/client-api'
import { formatSimilarity } from '@/lib/format'

/** The same limits the server enforces (src/lib/config.ts). */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 8

type SearchState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ready'; result: PhotoSearchResponse }
  | { status: 'error'; message: string }

/**
 * Search the ledger with a photograph instead of words.
 *
 * It files nothing: no report, no match, no notification, and the photo is never
 * stored — the endpoint is read-only. It always searches both Lost and Found;
 * narrowing by type is the browse filter row's job, and every result card shows
 * its own Lost/Found badge. Results appear in the same card grid the rest of the
 * application uses, each card carrying its similarity, and the browse list below
 * stays exactly where it was (agents/UX.md §1.3 — do not make people lose their
 * place for a small action).
 *
 * It renders bare (no panel of its own): the browse page hosts it inside the
 * search area, under the "Search by photo" tab, so the two search modes read as
 * one control.
 */
export function PhotoSearch() {
  const inputId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  // Tuning mode: `?debug=1` prints the raw cosine behind every score, so a
  // threshold can be set without a terminal open. Nothing else changes.
  const debug = useSearchParams().get('debug') === '1'

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [state, setState] = useState<SearchState>({ status: 'idle' })

  // Preview derived from the file, revoked when it is replaced or unmounted.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function acceptFile(next: File | undefined) {
    if (!next) return
    if (!ACCEPTED_TYPES.includes(next.type)) {
      setFileError('That file is not a JPEG, PNG or WebP image. Choose a photo of the item.')
      return
    }
    if (next.size > MAX_MB * 1024 * 1024) {
      setFileError(`That photo is larger than ${MAX_MB} MB. Choose a smaller one.`)
      return
    }
    setFileError(null)
    setFile(next)
    // A new photo invalidates the previous results rather than mixing them.
    setState({ status: 'idle' })
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0])
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files[0])
  }

  function clearSearch() {
    setFile(null)
    setFileError(null)
    setState({ status: 'idle' })
    if (fileInput.current) fileInput.current.value = ''
  }

  async function runSearch() {
    if (!file || state.status === 'running') return
    setState({ status: 'running' })
    try {
      const result = await searchItemsByPhoto(file)
      setState({ status: 'ready', result })
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : "We couldn't analyse that photo. Check your connection and try again.",
      })
    }
  }

  const running = state.status === 'running'
  const result = state.status === 'ready' ? state.result : null

  return (
    <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Photo of the item</p>

          {preview ? (
            <div className="flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served asset */}
              <img
                src={preview}
                alt="The photo you chose to search with"
                className="h-28 w-28 rounded-lg border border-line bg-surface-sunk object-cover"
              />
              <div className="space-y-2">
                <p className="text-sm text-ink">{file?.name}</p>
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
                    onClick={clearSearch}
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
              className={`rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunk/50'
              }`}
            >
              <p className="text-sm font-medium text-ink">Drop a photo here</p>
              <p className="mt-1 text-xs text-ink-muted">
                JPEG, PNG or WebP, up to {MAX_MB} MB.
              </p>
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
            id={inputId}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={onPick}
            className="sr-only"
            aria-describedby={fileError ? `${inputId}-error` : undefined}
            aria-invalid={fileError ? true : undefined}
          />

          {fileError ? (
            <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-refused">
              {fileError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runSearch}
            disabled={!file || running}
            className={buttonClass({ variant: 'primary' })}
          >
            {running ? <Spinner /> : <Icon name="search" className="h-4 w-4" />}
            {running ? 'Analyzing photo…' : 'Search by photo'}
          </button>

          {file || result ? (
            <button type="button" onClick={clearSearch} className={buttonClass({ variant: 'quiet' })}>
              Clear photo search
            </button>
          ) : null}

          <p className="text-xs text-ink-muted">
            The photo is used for this search only. It is not filed and not saved.
          </p>
        </div>

        <div aria-live="polite" aria-busy={running} className="space-y-6">
          {running ? (
            <p className="text-sm text-ink-muted">Analyzing photo… comparing it with open items.</p>
          ) : null}

          {state.status === 'error' ? (
            <div className="space-y-3">
              <ErrorNote>{state.message}</ErrorNote>
              <button
                type="button"
                onClick={runSearch}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Try Again
              </button>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="space-y-6 border-t border-line pt-6">
            <div>
              <h3 className="text-base font-semibold">
                {result.count === 0
                  ? result.nearMissCount > 0
                    ? 'No clear match — this is the closest on file'
                    : 'Nothing looks like that photo'
                  : result.count === 1
                    ? '1 item looks like that photo'
                    : `${result.count} items look like that photo`}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                Open items whose photographs look closest to yours, best match first.
              </p>
              {debug ? (
                <p className="data mt-2 rounded-lg border border-line bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
                  debug · calibrated bar {result.threshold.toFixed(3)} · baseline{' '}
                  {result.baseline.toFixed(2)} · near-miss floor {result.nearMissFloor.toFixed(2)} · top{' '}
                  {result.topK} · scope {result.scope} · searched {result.searchedTypes.join('+')}
                </p>
              ) : null}
            </div>

            {result.count > 0 ? (
              <RecordGrid records={result.matches} showRaw={debug} />
            ) : result.nearMissCount > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-ink-muted">
                  No clear match — the closest items on file, ranked by resemblance:
                </p>
                <RecordGrid
                  records={result.nearMisses}
                  belowBar
                  showRaw={debug}
                />
              </div>
            ) : (
              <EmptyState
                title="No items match your current search."
                message="Nothing open comes close to that photo. Try another photo, or browse the list below."
              >
                <button
                  type="button"
                  onClick={clearSearch}
                  className={buttonClass({ variant: 'primary' })}
                >
                  Clear photo search
                </button>
              </EmptyState>
            )}

            {/* The one caveat on the page, once. Everything the user needs to judge a
                score lives here instead of being repeated next to every result. */}
            {result.count > 0 || result.nearMissCount > 0 ? (
              <details className="text-xs text-ink-muted">
                <summary className="cursor-pointer select-none text-xs font-medium text-accent">
                  What does this score mean?
                </summary>
                <p className="measure mt-2">
                  Visual similarity is how closely two photographs resemble each other — it is
                  never a chance of ownership. A different photo of the same object often scores
                  lower than expected: angle and background move the score. OSAS verifies every
                  claim before an item is released.
                </p>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
  )
}

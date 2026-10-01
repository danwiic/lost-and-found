'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonClass } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorNote, RowSkeleton } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Badge } from '@/components/ui/Badge'
import {
  fetchItemMatches,
  matchPhotoUrl,
  type MatchCandidate,
  type MatchResponse,
} from '@/lib/client-api'
import {
  formatDate,
  formatSimilarity,
  itemStatusLabel,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'

export type MatchSubject = {
  id: string
  name: string
  type: string
  status: string
  photoUrl: string | null
}

type DrawerState =
  | { status: 'loading' }
  | { status: 'ready'; data: MatchResponse }
  | { status: 'error'; message: string }

/**
 * The possible-match drawer: two photographs side by side, a similarity readout
 * in measurement type, and the sentence that keeps the product honest —
 * similarity is not ownership (agents/UX.md §7.1, PRODUCT.md principle 1).
 */
export function MatchDrawer({
  open,
  subject,
  onClose,
}: {
  open: boolean
  subject: MatchSubject | null
  onClose: () => void
}) {
  if (!subject) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Possible match"
      description={`Compared with your report “${subject.name}”.`}
    >
      {/* Keyed on the subject: a new record starts from its own loading state. */}
      <MatchDrawerBody key={subject.id} subject={subject} />
    </Drawer>
  )
}

function MatchDrawerBody({ subject }: { subject: MatchSubject }) {
  const [state, setState] = useState<DrawerState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    // State changes happen in the callbacks, never in the effect body.
    fetchItemMatches(subject.id, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : "We couldn't load the possible matches for this report.",
        })
      })

    return () => controller.abort()
  }, [subject.id, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  return (
    <div className="space-y-6">
      <section className="flex items-start gap-4 rounded-lg border border-line bg-surface-sunk/60 p-4">
        <PhotoFrame src={subject.photoUrl} alt={subject.name} size="thumb" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">
            {itemTypeLabel(subject.type)} · your report
          </p>
          <p className="mt-1 text-[0.9375rem] leading-snug font-medium">{subject.name}</p>
          <Badge tone={itemStatusTone(subject.status)} className="mt-2">
            {itemStatusLabel(subject.status)}
          </Badge>
        </div>
      </section>

      {state.status === 'loading' ? <RowSkeleton count={2} /> : null}

      {state.status === 'error' ? (
        <div className="space-y-3">
          <ErrorNote>{state.message}</ErrorNote>
          <button
            type="button"
            onClick={retry}
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            Try Again
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && state.data.matches.length === 0 ? (
        <p className="measure text-sm text-ink-muted">
          No possible matches are recorded for this report yet. New reports are checked against
          open items of the opposite type as they arrive.
        </p>
      ) : null}

      {state.status === 'ready' && state.data.matches.length > 0 ? (
        <section aria-label="Candidate items">
          <div className="flex items-end justify-between gap-4">
            <h3 className="text-sm font-medium text-ink">
              {state.data.matches.length === 1
                ? '1 candidate item'
                : `${state.data.matches.length} candidate items`}
            </h3>
            {/* Measurement type: the threshold is a number to read exactly. */}
            <p className="data text-xs text-ink-muted">
              threshold {formatSimilarity(state.data.threshold)}
            </p>
          </div>

          <ul className="mt-3 space-y-4">
            {state.data.matches.map((match) => (
              <CandidateCard key={match.matchId} match={match} subject={subject} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-lg border border-attention/25 bg-attention-soft px-4 py-3 text-xs leading-relaxed text-attention">
        This score represents visual similarity between the uploaded photos. It does not confirm
        ownership. OSAS staff verify every claim in person.
      </p>
    </div>
  )
}

function CandidateCard({ match, subject }: { match: MatchCandidate; subject: MatchSubject }) {
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-2 gap-3 p-4">
        <figure>
          <PhotoFrame src={subject.photoUrl} alt={`Your report: ${subject.name}`} size="card" />
          <figcaption className="mt-2 text-xs text-ink-muted">Your report</figcaption>
        </figure>
        <figure>
          <PhotoFrame src={matchPhotoUrl(match)} alt={match.name} size="card" />
          <figcaption className="mt-2 text-xs text-ink-muted">Candidate item</figcaption>
        </figure>
      </div>

      {/* The one authored moment: the reading lands when the drawer opens. */}
      <div className="flex items-center gap-2 border-t border-line bg-surface-sunk/50 px-4 py-3">
        <span className="text-ink-muted">
          <Icon name="compare" className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium text-ink-muted">Visual similarity</p>
        <p className="data reading-in ml-auto text-lg leading-none text-attention">
          {formatSimilarity(match.similarity)}
        </p>
      </div>

      <div className="border-t border-line px-4 py-4">
        <p className="text-[0.9375rem] leading-snug font-medium">{match.name}</p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-ink-muted">Type</dt>
            <dd className="text-ink">{itemTypeLabel(match.type)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Place</dt>
            <dd className="text-ink">{match.location}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Relevant date</dt>
            <dd className="text-ink">{formatDate(match.dateEvent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Reported by</dt>
            <dd className="text-ink">{match.reporterName}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/items/${match.itemId}`}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
            View Item
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
          <Badge tone={itemStatusTone(match.status)}>{itemStatusLabel(match.status)}</Badge>
        </div>
      </div>
    </li>
  )
}

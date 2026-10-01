import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import type { RecordRow } from '@/lib/records'
import {
  formatDate,
  formatSimilarity,
  itemStatusLabel,
  itemStatusMeaning,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'

/** A search result is a record that also knows how closely it matched. */
export type GridRecord = RecordRow & { similarity?: number }

/**
 * Records as scannable cards. Enough on each one to tell it apart from the
 * next — photograph, name, type, place, date, state — with the detail left to
 * the item page (agents/UX.md §20).
 *
 * The photograph sits inside the card's padding rather than bleeding to its
 * edges, so the card's hairline and the photo's hairline never double up.
 *
 * When a card comes from a photo search it also carries its similarity, in
 * measurement type and the attention tone: it is the reason the card is on
 * screen. The score is never phrased as a chance of ownership (agents/UX.md §7.1).
 * A card below the match bar says so on its face — `threshold` is only passed
 * for near misses, and it flips the line from "this is why it's here" to
 * "this is how far short it fell".
 */
export function RecordGrid({
  records,
  threshold,
}: {
  records: GridRecord[]
  /** Present only for below-bar results: makes the similarity line honest. */
  threshold?: number
}) {
  const belowBar = typeof threshold === 'number'
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => (
        <li key={record.id} className="card-pad relative flex flex-col rounded-lg border border-line bg-surface">
          <PhotoFrame src={record.photoUrl} alt={record.name} size="card" />

          <h2 className="mt-3 text-[0.9375rem] leading-snug font-medium">
            <Link
              href={`/items/${record.id}`}
              className="rounded-lg after:absolute after:inset-0 hover:underline"
            >
              {record.name}
            </Link>
          </h2>

          <p className="mt-1 text-xs text-ink-muted">
            {itemTypeLabel(record.type)} · {record.location} · {formatDate(record.dateEvent)}
          </p>

          {typeof record.similarity === 'number' ? (
            belowBar ? (
              <p className="mt-2 text-xs text-ink-muted">
                <span className="nums font-medium text-ink">{formatSimilarity(record.similarity)}</span>
                <span> · below the {formatSimilarity(threshold)} match bar</span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">
                Visual similarity{' '}
                <span className="nums font-medium text-attention">
                  {formatSimilarity(record.similarity)}
                </span>
              </p>
            )
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            <Badge tone={itemStatusTone(record.status)} title={itemStatusMeaning(record.status)}>
              {itemStatusLabel(record.status)}
            </Badge>
            {record.isMine ? <Badge tone="accent">Your report</Badge> : null}
          </div>

          {record.matchCount > 0 ? (
            <p className="mt-3 text-xs font-medium text-attention">
              {record.matchCount === 1
                ? '1 candidate item'
                : `${record.matchCount} candidate items`}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

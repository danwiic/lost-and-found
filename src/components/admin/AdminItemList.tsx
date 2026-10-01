import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import {
  formatDate,
  itemStatusLabel,
  itemStatusMeaning,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'
import type { RecordRow } from '@/lib/records'

const STATUS_CODES = ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'RETURNED', 'CLOSED']

export type AdminItemFilters = { q: string; status: string; page: number }

function href(base: string, filters: AdminItemFilters, change: Partial<AdminItemFilters>): string {
  const next = { ...filters, ...change }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.status) params.set('status', next.status)
  if (next.page > 1) params.set('page', String(next.page))
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

/**
 * The OSAS record list for one item type. Scannable rows carrying what a staff
 * member needs to triage — item, reporter, date, state — with the record itself
 * one click away (agents/UX.md §20).
 */
export function AdminItemList({
  base,
  type,
  filters,
  records,
  total,
  pageCount,
}: {
  base: string
  type: 'LOST' | 'FOUND'
  filters: AdminItemFilters
  records: RecordRow[]
  total: number
  pageCount: number
}) {
  const filtered = Boolean(filters.q || filters.status)

  return (
    <div className="space-y-6">
      <form action={base} method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="mb-2 block text-sm font-medium text-ink">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, place, colour, description"
            className={inputClass()}
          />
        </div>

        <div>
          <label htmlFor="status" className="mb-2 block text-sm font-medium text-ink">
            Status
          </label>
          <select id="status" name="status" defaultValue={filters.status} className={inputClass()}>
            <option value="">Any status</option>
            {STATUS_CODES.map((code) => (
              <option key={code} value={code}>
                {itemStatusLabel(code)}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className={buttonClass({ variant: 'primary', size: 'sm' })}>
          <Icon name="search" className="h-4 w-4" />
          Search
        </button>

        {filtered ? (
          <Link href={base} className={buttonClass({ variant: 'quiet', size: 'sm' })}>
            Clear Filters
          </Link>
        ) : null}

        <p className="nums ml-auto text-sm text-ink-muted">
          {total === 1 ? '1 report' : `${total} reports`}
        </p>
      </form>

      <Panel>
        {records.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No reports match your current search."
              message="Nothing on the list matches every filter you have applied."
            >
              <Link href={base} className={buttonClass({ variant: 'primary' })}>
                Clear Filters
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              title={`No ${type === 'LOST' ? 'lost' : 'found'} reports yet.`}
              message="Reports appear here as soon as a student files one."
            />
          )
        ) : (
          <LedgerList>
            {records.map((record) => (
              <li key={record.id} className="relative">
                <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                  <PhotoFrame src={record.photoUrl} alt={record.name} size="thumb" />

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[0.9375rem] leading-snug font-medium">
                      <Link
                        href={`/items/${record.id}`}
                        className="rounded-lg after:absolute after:inset-0 hover:underline"
                      >
                        {record.name}
                      </Link>
                    </h2>

                    <p className="mt-1 text-xs text-ink-muted">
                      {record.reporterName ?? 'Unknown'} · {record.location} ·{' '}
                      {formatDate(record.dateEvent)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={itemStatusTone(record.status)}
                        title={itemStatusMeaning(record.status)}
                      >
                        {itemStatusLabel(record.status)}
                      </Badge>
                      {record.matchCount > 0 ? (
                        <p className="text-xs font-medium text-attention">
                          {record.matchCount === 1
                            ? '1 candidate item'
                            : `${record.matchCount} candidate items`}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="hidden shrink-0 text-xs text-ink-muted sm:block">
                    {itemTypeLabel(record.type)}
                  </p>
                </div>
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>

      {pageCount > 1 ? (
        <nav
          aria-label="Pages of reports"
          className="flex items-center justify-between gap-4 border-t border-line pt-6"
        >
          {filters.page > 1 ? (
            <Link
              href={href(base, filters, { page: filters.page - 1 })}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
              Previous
            </Link>
          ) : (
            <span />
          )}

          <p className="nums text-sm text-ink-muted">
            Page {filters.page} of {pageCount}
          </p>

          {filters.page < pageCount ? (
            <Link
              href={href(base, filters, { page: filters.page + 1 })}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              Next
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}

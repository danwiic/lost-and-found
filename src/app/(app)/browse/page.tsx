import type { Metadata } from 'next'
import Link from 'next/link'
import { PhotoSearch } from '@/components/records/PhotoSearch'
import { RecordGrid } from '@/components/records/RecordGrid'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { itemStatusLabel } from '@/lib/format'
import {
  hasActiveFilters,
  loadBrowse,
  readBrowseFilters,
  type BrowseFilters,
} from '@/lib/records'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Browse Items — Lost and Found' }

const STATUS_CODES = ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'RETURNED', 'CLOSED']

/** Builds a /browse URL with one filter changed or removed. */
function browseHref(filters: BrowseFilters, change: Partial<BrowseFilters>): string {
  const next = { ...filters, ...change }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.type) params.set('type', next.type)
  if (next.status) params.set('status', next.status)
  if (next.color) params.set('color', next.color)
  if (next.page > 1) params.set('page', String(next.page))
  const query = params.toString()
  return query ? `/browse?${query}` : '/browse'
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireSession('/browse')
  const raw = await searchParams

  // searchParams values arrive as string | string[]; keep the first.
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) params.set(key, first)
  }

  const filters = readBrowseFilters(params)
  const { records, total, pageCount } = await loadBrowse(user, filters)
  const filtered = hasActiveFilters(filters)

  const active: Array<{ label: string; href: string }> = []
  if (filters.q) active.push({ label: `“${filters.q}”`, href: browseHref(filters, { q: '', page: 1 }) })
  if (filters.type) {
    active.push({
      label: filters.type === 'LOST' ? 'Lost items' : 'Found items',
      href: browseHref(filters, { type: '', page: 1 }),
    })
  }
  if (filters.status) {
    active.push({
      label: itemStatusLabel(filters.status),
      href: browseHref(filters, { status: '', page: 1 }),
    })
  }
  if (filters.color) {
    active.push({ label: filters.color, href: browseHref(filters, { color: '', page: 1 }) })
  }

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Browse Items
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Everything reported lost or found. Open an item for details, or to claim it as yours.
        </p>
      </div>

      {/* Search by photo: read-only, and it leaves the list below untouched. */}
      <PhotoSearch />

      {/* A plain GET form: the filters work before any JavaScript loads. */}
      <form action="/browse" method="get" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium text-ink">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Name, colour or place"
              className={inputClass()}
            />
          </div>

          <div>
            <label htmlFor="type" className="mb-2 block text-sm font-medium text-ink">
              Type
            </label>
            <select id="type" name="type" defaultValue={filters.type} className={inputClass()}>
              <option value="">Lost and found</option>
              <option value="LOST">Lost</option>
              <option value="FOUND">Found</option>
            </select>
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

          <div>
            <label htmlFor="color" className="mb-2 block text-sm font-medium text-ink">
              Colour
            </label>
            <input
              id="color"
              name="color"
              type="text"
              defaultValue={filters.color}
              placeholder="Blue"
              className={inputClass()}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={buttonClass({ variant: 'primary', size: 'sm' })}>
            <Icon name="search" className="h-4 w-4" />
            Search
          </button>
          {filtered ? (
            <Link href="/browse" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
              Clear Filters
            </Link>
          ) : null}
          <p className="nums ml-auto text-sm text-ink-muted">
            {total === 1 ? '1 item' : `${total} items`}
          </p>
        </div>
      </form>

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">Active filters</span>
          {active.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[0.8125rem] text-ink-muted transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface-sunk hover:text-ink"
            >
              {chip.label}
              <Icon name="close" className="h-3.5 w-3.5" />
              <span className="sr-only">Remove this filter</span>
            </Link>
          ))}
        </div>
      ) : null}

      {records.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No items match your current search."
            message="Nothing on the list matches every filter you have applied. Removing one may bring results back."
          >
            <Link href="/browse" className={buttonClass({ variant: 'primary' })}>
              Clear Filters
            </Link>
          </EmptyState>
        ) : (
          <EmptyState
            title="Nothing has been reported yet."
            message="As soon as someone reports a lost or found item, it appears here with its photograph."
          >
            <Link href="/report/lost" className={buttonClass({ variant: 'primary' })}>
              Report Lost Item
            </Link>
            <Link href="/report/found" className={buttonClass()}>
              Report Found Item
            </Link>
          </EmptyState>
        )
      ) : (
        <>
          <RecordGrid records={records} />

          {pageCount > 1 ? (
            <nav aria-label="Pages of results" className="flex items-center justify-between gap-4 border-t border-line pt-6">
              {filters.page > 1 ? (
                <Link
                  href={browseHref(filters, { page: filters.page - 1 })}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  <Icon name="arrow" className="h-4 w-4 rotate-180" />
                  Newer items
                </Link>
              ) : (
                <span />
              )}

              <p className="nums text-sm text-ink-muted">
                Page {filters.page} of {pageCount}
              </p>

              {filters.page < pageCount ? (
                <Link
                  href={browseHref(filters, { page: filters.page + 1 })}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  Older items
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}

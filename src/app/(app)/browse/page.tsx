import type { Metadata } from 'next'
import Link from 'next/link'
import { BrowseSearchTabs } from '@/components/records/BrowseSearchTabs'
import { RecordGrid } from '@/components/records/RecordGrid'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { itemStatusLabel } from '@/lib/format'
import {
  hasActiveFilters,
  loadBrowse,
  loadRecentItems,
  readBrowseFilters,
  type BrowseFilters,
} from '@/lib/records'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Browse Items — Lost and Found' }

const STATUS_CODES = ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'RETURNED', 'CLOSED']
const DAY_OPTIONS: Array<{ value: '0' | '7' | '30'; label: string }> = [
  { value: '0', label: 'Any date' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
]

/** Builds a /browse URL with one filter changed or removed. */
function browseHref(filters: BrowseFilters, change: Partial<BrowseFilters>): string {
  const next = { ...filters, ...change }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.type) params.set('type', next.type)
  if (next.status) params.set('status', next.status)
  if (next.color) params.set('color', next.color)
  if (next.days) params.set('days', String(next.days))
  if (next.sort !== 'newest') params.set('sort', next.sort)
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
  const [{ records, total, pageCount }, recent] = await Promise.all([
    loadBrowse(user, filters),
    // New records land above; these few only carry context and skip no page.
    filters.q || hasActiveFilters(filters) ? loadRecentItems(user, 4) : Promise.resolve([]),
  ])
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
  if (filters.days) {
    const option = DAY_OPTIONS.find((o) => o.value === String(filters.days))
    active.push({
      label: option?.label ?? 'Recent only',
      href: browseHref(filters, { days: 0, page: 1 }),
    })
  }

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Browse Items
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Browse reported lost &amp; found items.
        </p>
      </div>

      {/* Search: text and photo as tabs of one area. The text side is a plain
          GET form that works before JavaScript loads; the photo side is the
          client photo-search (agents/UX.md §1.3 — the photo search never moves
          the list below out from under the user). */}
      <BrowseSearchTabs
        filtersActive={filtered}
        searchBar={
          <>
            <div className="relative min-w-[16rem] flex-1">
              <label htmlFor="q" className="sr-only">
                Search by name, colour or place
              </label>
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              />
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Search by name, colour or place…"
                className={inputClass({ className: 'py-2 pl-8' })}
              />
            </div>
            <button type="submit" className={buttonClass({ variant: 'primary' })}>
              <Icon name="search" className="h-4 w-4" />
              Search
            </button>
          </>
        }
        filterRow={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div>
              <label htmlFor="type" className="mb-2 block text-sm font-medium text-ink">
                Type
              </label>
              <select id="type" name="type" defaultValue={filters.type} className={inputClass()}>
                <option value="">All</option>
                <option value="LOST">Lost</option>
                <option value="FOUND">Found</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="mb-2 block text-sm font-medium text-ink">
                Status
              </label>
              <select id="status" name="status" defaultValue={filters.status} className={inputClass()}>
                <option value="">All</option>
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
                placeholder="Any colour"
                maxLength={60}
                className={inputClass()}
              />
            </div>

            <div>
              <label htmlFor="days" className="mb-2 block text-sm font-medium text-ink">
                Date
              </label>
              <select id="days" name="days" defaultValue={String(filters.days)} className={inputClass()}>
                {DAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sort" className="mb-2 block text-sm font-medium text-ink">
                Sort
              </label>
              <select id="sort" name="sort" defaultValue={filters.sort} className={inputClass()}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        }
      />

      {filtered ? (
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
          <Link
            href="/browse"
            className={`ml-auto ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
          >
            Clear Filters
          </Link>
        </div>
      ) : null}

      {records.length === 0 ? (
        <div className="space-y-8">
          {filtered ? (
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
          )}

          {recent.length > 0 ? (
            <section aria-labelledby="recent-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="recent-heading" className="text-lg font-semibold">
                  Recently Uploaded
                </h2>
                <p className="text-sm text-ink-muted">The newest reports on file — not your search results.</p>
              </div>
              <div className="mt-4">
                <RecordGrid records={recent} />
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <>
          {/* The ledger under the search card. It is named for what it actually
              is, because a photo search stacks its own results directly above
              it: an unnamed "6 results" grid under those cards reads as more
              matches, and a second "Recently Uploaded" band below it reads as
              results that belong to the search. Unfiltered, this list *is* the
              recent uploads — newest first — so it says so. */}
          <section aria-labelledby="browse-list-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="browse-list-heading" className="text-lg font-semibold">
                {filtered ? 'Search Results' : 'Recently Uploaded'}
              </h2>
              <p className="nums text-sm text-ink-muted">
                {filtered
                  ? total === 1
                    ? '1 result'
                    : `${total} results`
                  : total === 1
                    ? '1 item'
                    : `${total} items`}
              </p>
            </div>
            <p className="text-sm text-ink-muted">
              {filtered
                ? 'Everything on the list that matches every filter above.'
                : 'Every report on file, newest first.'}
            </p>
            <RecordGrid records={records} />
          </section>

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

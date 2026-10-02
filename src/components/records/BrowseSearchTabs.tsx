'use client'

import { useState, type ReactNode } from 'react'
import { PhotoSearch } from '@/components/records/PhotoSearch'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

/**
 * The browse search area: text search and photo search as two tabs of one
 * card. The text side arrives from the server as two slots — the search bar
 * (always visible) and the filter row (behind a Filters toggle, which opens by
 * default when filters are active so the current state is never hidden). Both
 * slots sit inside one GET form, so a submit carries the search text and every
 * filter, and the form still works without JavaScript. The photo side is the
 * client photo-search component, which needs JavaScript regardless.
 */
export function BrowseSearchTabs({
  searchBar,
  filterRow,
  filtersActive,
}: {
  searchBar: ReactNode
  filterRow: ReactNode
  filtersActive: boolean
}) {
  const [mode, setMode] = useState<'text' | 'photo'>('text')
  // Filters start open while they carry an active choice, closed otherwise —
  // the server knows the state, the client only reveals it.
  const [filtersOpen, setFiltersOpen] = useState(filtersActive)

  const tab = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ease-[var(--ease-out-expo)] ${
      active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-sunk hover:text-ink'
    }`

  return (
    <div className="card-pad rounded-lg border border-line bg-surface">
      <div role="tablist" aria-label="Search mode" className="flex gap-1">
        <button
          type="button"
          role="tab"
          id="search-tab-text"
          aria-selected={mode === 'text'}
          aria-controls="search-panel-text"
          onClick={() => setMode('text')}
          className={tab(mode === 'text')}
        >
          <Icon name="search" className="h-4 w-4" />
          Search by text
        </button>
        <button
          type="button"
          role="tab"
          id="search-tab-photo"
          aria-selected={mode === 'photo'}
          aria-controls="search-panel-photo"
          onClick={() => setMode('photo')}
          className={tab(mode === 'photo')}
        >
          <Icon name="upload" className="h-4 w-4" />
          Search by photo
        </button>
      </div>

      {mode === 'text' ? (
        <div id="search-panel-text" role="tabpanel" aria-labelledby="search-tab-text" className="mt-4">
          <form action="/browse" method="get" className="space-y-3">
            {/* Search bar and the filter toggle share one row: the filter row
                is one click away without costing a line of its own. */}
            <div className="flex flex-wrap items-center gap-3">
              {searchBar}

              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="browse-filter-row"
                className={
                  filtersActive && !filtersOpen
                    ? buttonClass({ variant: 'secondary', size: 'sm' })
                    : buttonClass({ variant: 'quiet', size: 'sm' })
                }
              >
                <Icon name="filter" className="h-4 w-4" />
                Filters
                {/* A visible marker while filters apply, so a collapsed row is
                    never a lie about what the list below is filtered by. */}
                {filtersActive ? (
                  <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                    On
                  </span>
                ) : null}
              </button>
            </div>

            {filtersOpen ? <div id="browse-filter-row">{filterRow}</div> : null}
          </form>
        </div>
      ) : (
        <div id="search-panel-photo" role="tabpanel" aria-labelledby="search-tab-photo" className="mt-6">
          <PhotoSearch />
        </div>
      )}
    </div>
  )
}

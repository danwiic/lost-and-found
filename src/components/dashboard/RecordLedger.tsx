'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MatchDrawer, type MatchSubject } from '@/components/dashboard/MatchDrawer'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { LedgerList } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Badge } from '@/components/ui/Badge'
import type { ClaimRow, RecordRow } from '@/lib/dashboard'
import {
  claimStatusLabel,
  claimStatusMeaning,
  claimStatusTone,
  formatDate,
  itemStatusLabel,
  itemStatusMeaning,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'

type FilterKey = 'all' | 'lost' | 'found' | 'attention'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Lost' },
  { key: 'found', label: 'Found' },
  { key: 'attention', label: 'Needs attention' },
]

function needsAttention(status: string): boolean {
  return status === 'POSSIBLE_MATCH' || status === 'CLAIM_PENDING'
}

/**
 * The user's own records as a ledger. Filters are visible, removable, and there
 * is a way to clear them (agents/UX.md §19). Rows carry the record's real state,
 * and only a record that actually has a match offers "View Match".
 */
export function RecordLedger({
  records,
  claims,
}: {
  records: RecordRow[]
  claims: ClaimRow[]
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [subject, setSubject] = useState<MatchSubject | null>(null)

  const visible = useMemo(() => {
    if (filter === 'lost') return records.filter((record) => record.type === 'LOST')
    if (filter === 'found') return records.filter((record) => record.type === 'FOUND')
    if (filter === 'attention') return records.filter((record) => needsAttention(record.status))
    return records
  }, [filter, records])

  if (records.length === 0 && claims.length === 0) {
    return (
      <EmptyState
        title="You haven't reported any lost or found items yet."
        message="Report what you lost, or what you found and turned in. The matching system looks for a possible match as soon as a photo is uploaded."
      >
        <Link href="/report/lost" className={buttonClass({ variant: 'primary' })}>
          Report Lost Item
        </Link>
        <Link href="/report/found" className={buttonClass()}>
          Report Found Item
        </Link>
      </EmptyState>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-3 sm:px-6">
        <div role="group" aria-label="Filter my reports" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const active = filter === option.key
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.key)}
                className={`rounded-full border px-3 py-1 text-[0.8125rem] transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                  active
                    ? 'border-transparent bg-accent text-on-accent'
                    : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-sunk hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {filter !== 'all' ? (
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`ml-auto ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No items match your current filter."
          message="Nothing in your reports is in that state right now."
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={buttonClass({ variant: 'secondary' })}
          >
            Clear Filters
          </button>
        </EmptyState>
      ) : (
        <LedgerList>
          {visible.map((record) => (
            <li key={record.id} className="relative">
              <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                <PhotoFrame src={record.photoUrl} alt={record.name} size="thumb" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-[0.9375rem] leading-snug font-medium">
                      <Link
                        href={`/items/${record.id}`}
                        className="rounded-lg after:absolute after:inset-0 hover:underline"
                      >
                        {record.name}
                      </Link>
                    </h3>
                    {record.matchCount > 0 ? (
                      <p className="text-xs font-medium text-attention">
                        {record.matchCount === 1
                          ? '1 candidate item'
                          : `${record.matchCount} candidate items`}
                      </p>
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">
                    {itemTypeLabel(record.type)} · {record.location} ·{' '}
                    {formatDate(record.dateEvent)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      tone={itemStatusTone(record.status)}
                      title={itemStatusMeaning(record.status)}
                    >
                      {itemStatusLabel(record.status)}
                    </Badge>

                    {record.status === 'POSSIBLE_MATCH' ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSubject({
                            id: record.id,
                            name: record.name,
                            type: record.type,
                            status: record.status,
                            photoUrl: record.photoUrl,
                          })
                        }
                        className={`relative z-10 ${buttonClass({ variant: 'secondary', size: 'sm' })}`}
                      >
                        View Match
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </LedgerList>
      )}

      {claims.length > 0 ? (
        <>
          <div className="border-t border-line bg-surface-sunk/40 px-6 py-3 sm:px-6">
            <h3 className="text-sm font-medium text-ink">Claims you filed</h3>
          </div>

          <LedgerList>
            {claims.map((claim) => (
              <li
                key={claim.id}
                className="flex items-start gap-4 px-6 py-4 sm:px-6"
              >
                <PhotoFrame src={claim.item.photoUrl} alt={claim.item.name} size="thumb" />

                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] text-ink">{claim.item.name}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Filed {formatDate(claim.createdAt)} · {itemTypeLabel(claim.item.type)} item
                  </p>
                  {claim.status === 'REJECTED' && claim.decisionNote ? (
                    <p className="measure mt-2 text-xs text-ink-muted">
                      OSAS note: {claim.decisionNote}
                    </p>
                  ) : null}
                </div>

                <Badge
                  tone={claimStatusTone(claim.status)}
                  title={claimStatusMeaning(claim.status)}
                >
                  {claimStatusLabel(claim.status)}
                </Badge>
              </li>
            ))}
          </LedgerList>
        </>
      ) : null}

      <MatchDrawer
        open={subject !== null}
        subject={subject}
        onClose={() => setSubject(null)}
      />
    </>
  )
}

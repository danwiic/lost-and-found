import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { TallyLine } from '@/components/ui/TallyLine'
import { claimStatusLabel, claimStatusTone, formatRelative, itemTypeLabel } from '@/lib/format'
import { loadAdminClaims, loadClaimCounts } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Claims — OSAS' }

const FILTERS = [
  { value: '', label: 'All claims' },
  { value: 'PENDING', label: 'Pending' },
  // Not a claim status: approved with no return recorded yet. It is the only
  // view that needs someone to walk to the shelf, so it sits beside the others.
  { value: 'AWAITING_RELEASE', label: 'Awaiting release' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

function claimsHref(status: string, page: number): string {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/admin/claims?${query}` : '/admin/claims'
}

/**
 * The verification queue. Claims are worked oldest first, so the list is
 * chronological rather than newest-first — the opposite of every other list in
 * the product, deliberately (agents/UX.md §11).
 */
export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminSession('/admin/claims')

  const raw = await searchParams
  const first = (key: string) => {
    const value = raw[key]
    const single = Array.isArray(value) ? value[0] : value
    return (single ?? '').trim()
  }
  const status = first('status').toUpperCase()
  const rawPage = Number(first('page'))
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

  const { claims, total, pageCount } = await loadAdminClaims({ status, page })
  const counts = await loadClaimCounts()
  const awaiting = status === 'AWAITING_RELEASE'

  return (
    <div className="page-stack">
      <div className="space-y-6">
        <PageHeader
          title="Claims"
          description="Every claim a student has filed, oldest first."
        />

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: 'Matching this view', value: total },
              { label: 'Pending overall', value: counts.pending, emphasis: counts.pending > 0 },
              { label: 'Approved', value: counts.approved },
              { label: 'Awaiting release', value: counts.awaitingRelease, emphasis: counts.awaitingRelease > 0 },
              { label: 'Rejected', value: counts.rejected },
            ]}
          />
        </div>
      </div>

      <nav aria-label="Filter claims by status" className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = filter.value === status
          return (
            <Link
              key={filter.value || 'all'}
              href={claimsHref(filter.value, 1)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-accent-soft px-3 py-1 text-[0.8125rem] font-medium text-accent'
                  : 'rounded-full border border-line-strong bg-surface px-3 py-1 text-[0.8125rem] text-ink-muted transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface-sunk hover:text-ink'
              }
            >
              {filter.label}
            </Link>
          )
        })}
      </nav>

      <Panel>
        {claims.length === 0 ? (
          <EmptyState
            title={
              awaiting
                ? 'Nothing is waiting to be collected.'
                : status
                  ? 'No claims with that status.'
                  : 'No claims have been filed yet.'
            }
            message={
              awaiting
                ? 'Every approved claim has had its hand-over recorded. Items still on the shelf appear here the moment a claim is approved.'
                : status
                  ? 'Nothing in this view right now. Claims move here as OSAS decides them.'
                  : 'When a student submits a claim on an item, it arrives here for verification.'
            }
          >
            {status ? (
              <Link href="/admin/claims" className={buttonClass({ variant: 'primary' })}>
                Show all claims
              </Link>
            ) : null}
          </EmptyState>
        ) : (
          <LedgerList>
            {claims.map((claim) => (
              <li key={claim.id} className="relative">
                <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                  <PhotoFrame src={claim.item.photoUrl} alt={claim.item.name} size="thumb" />

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[0.9375rem] leading-snug font-medium">
                      <Link
                        href={`/admin/claims/${claim.id}`}
                        className="rounded-lg after:absolute after:inset-0 hover:underline"
                      >
                        {claim.item.name}
                      </Link>
                    </h2>

                    <p className="mt-1 text-xs text-ink-muted">
                      {itemTypeLabel(claim.item.type)} · claimed by {claim.claimantName} · filed{' '}
                      {formatRelative(claim.createdAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={claimStatusTone(claim.status)}>
                        {claimStatusLabel(claim.status)}
                      </Badge>
                      {/* Approved is two different situations: on the shelf, or
                          gone. Only the row's own state can tell them apart. */}
                      {claim.awaitingRelease ? (
                        <Badge tone="attention">On the shelf — not released</Badge>
                      ) : null}
                      {claim.returnRecord ? (
                        <p className="text-xs text-ink-muted">
                          Released {formatRelative(claim.returnRecord.returnDate)}
                        </p>
                      ) : null}
                      {claim.decidedByName ? (
                        <p className="text-xs text-ink-muted">Decided by {claim.decidedByName}</p>
                      ) : null}
                    </div>
                  </div>

                  <span className="mt-1 hidden shrink-0 text-ink-muted sm:block">
                    <Icon name="arrow" className="h-4 w-4" />
                  </span>
                </div>
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>

      {pageCount > 1 ? (
        <nav
          aria-label="Pages of claims"
          className="flex items-center justify-between gap-4 border-t border-line pt-6"
        >
          {page > 1 ? (
            <Link
              href={claimsHref(status, page - 1)}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
              Previous
            </Link>
          ) : (
            <span />
          )}

          <p className="nums text-sm text-ink-muted">
            Page {page} of {pageCount}
          </p>

          {page < pageCount ? (
            <Link
              href={claimsHref(status, page + 1)}
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

import type { Metadata } from 'next'
import Link from 'next/link'
import { MatchDecision } from '@/components/admin/MatchDecision'
import { MatchButton } from '@/components/records/MatchButton'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LedgerList, Panel, PanelHeading } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { TallyLine } from '@/components/ui/TallyLine'
import { Icon } from '@/components/ui/Icon'
import {
  claimStatusLabel,
  claimStatusTone,
  formatDate,
  formatRelative,
  formatSimilarity,
  itemStatusLabel,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'
import {
  loadAdminAttention,
  loadAdminMatchPairs,
  loadAdminOverview,
  type MatchPairRow,
} from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'OSAS Dashboard — Lost and Found' }

/**
 * The staff desk. Counters first, then the two things that actually need a
 * person: claims waiting for verification, and items sitting in Claim Pending.
 * Totals are a ledger line, not a grid of metric cards.
 */
export default async function AdminPage() {
  const admin = await requireAdminSession('/admin')
  const [{ totals, recentItems, recentClaims }, attention, matchQueue] = await Promise.all([
    loadAdminOverview(admin),
    loadAdminAttention(),
    loadAdminMatchPairs(),
  ])

  return (
    <div className="page-stack">
      <header className="space-y-6">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
            Every report on the system, the claims waiting to be verified, and the returns already
            recorded. Matching suggests a candidate; this is where a person decides.
          </p>
        </div>

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: 'Lost reports', value: totals.totalLostItems },
              { label: 'Found reports', value: totals.totalFoundItems },
              {
                label: 'Claims to verify',
                value: totals.pendingClaims,
                emphasis: totals.pendingClaims > 0,
              },
              { label: 'Open items', value: totals.openItems },
              { label: 'Candidate pairs', value: totals.possibleMatches },
              { label: 'Returns recorded', value: totals.returnRecords },
            ]}
          />
        </div>
      </header>

      {/* What needs a person, oldest wait first. This is the panel the desk
          opens the day.
      */}
      <Panel>
        <PanelHeading
          title="Waiting on OSAS"
          action={
            <Link href="/admin/claims" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
              All claims
            </Link>
          }
        />

        {attention.length === 0 ? (
          <EmptyState
            title="Nothing is waiting on you."
            message="No claim is awaiting verification and no approved item is still on the shelf."
          />
        ) : (
          <LedgerList>
            {attention.map(entry => (
              <li key={entry.id} className="relative">
                <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                  <PhotoFrame src={entry.photoUrl} alt={entry.itemName} size="thumb" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[0.9375rem] leading-snug font-medium">
                      <Link
                        href={`/admin/claims/${entry.id}`}
                        className="rounded-lg after:absolute after:inset-0 hover:underline"
                      >
                        {entry.itemName}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {itemTypeLabel(entry.itemType)} · {entry.personName} · waiting{' '}
                      {formatRelative(entry.since)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={entry.kind === 'CLAIM' ? 'attention' : 'accent'}>
                        {entry.kind === 'CLAIM'
                          ? 'Claim to verify'
                          : 'Approved — record the return'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel>
          <PanelHeading
            title="Claims to verify"
            action={
              <Link href="/admin/claims" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
                All claims
              </Link>
            }
          />

          {recentClaims.length === 0 ? (
            <EmptyState
              title="No claims are waiting."
              message="Nothing is pending verification right now. New claims appear here as students file them."
            />
          ) : (
            <LedgerList>
              {recentClaims.map(claim => (
                <li key={claim.id} className="relative">
                  <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                    <PhotoFrame src={claim.item.photoUrl} alt={claim.item.name} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[0.9375rem] leading-snug font-medium">
                        <Link
                          href={`/admin/claims/${claim.id}`}
                          className="rounded-lg after:absolute after:inset-0 hover:underline"
                        >
                          {claim.item.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-ink-muted">
                        {claim.claimantName} · filed {formatRelative(claim.createdAt)}
                      </p>
                      <Badge tone={claimStatusTone(claim.status)} className="mt-3">
                        {claimStatusLabel(claim.status)}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </LedgerList>
          )}
        </Panel>

        <Panel>
          <PanelHeading
            title="Recently reported"
            action={
              <Link href="/admin/lost" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
                Item records
              </Link>
            }
          />

          {recentItems.length === 0 ? (
            <EmptyState
              title="Nothing has been reported yet."
              message="Reports appear here the moment a student files one."
            />
          ) : (
            <LedgerList>
              {recentItems.map(item => (
                <li key={item.id} className="relative">
                  <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                    <PhotoFrame src={item.photoUrl} alt={item.name} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[0.9375rem] leading-snug font-medium">
                        <Link
                          href={`/items/${item.id}`}
                          className="rounded-lg after:absolute after:inset-0 hover:underline"
                        >
                          {item.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-ink-muted">
                        {itemTypeLabel(item.type)} · {item.reporterName ?? 'Unknown'} ·{' '}
                        {formatDate(item.createdAt)}
                      </p>
                      <Badge tone={itemStatusTone(item.status)} className="mt-3">
                        {itemStatusLabel(item.status)}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </LedgerList>
          )}
        </Panel>
      </div>

      {/* The verification step "matching suggests, OSAS verifies" never had.
          This is a work queue, not a metric: every row asks for one of two
          decisions, and it keeps asking until someone makes it. */}
      <Panel>
        <PanelHeading
          title="Possible matches"
          description={
            matchQueue.total === 0
              ? 'Candidate pairs the photo matching suggests. Nothing is waiting on a decision.'
              : matchQueue.total === 1
                ? 'One candidate pair is waiting for a decision.'
                : `${matchQueue.total} candidate pairs are waiting for a decision.${
                    matchQueue.total > matchQueue.pairs.length
                      ? ` Showing the ${matchQueue.pairs.length} oldest.`
                      : ''
                  }`
          }
        />

        {matchQueue.pairs.length === 0 ? (
          <EmptyState
            title="No candidate pairs are waiting."
            message="When a report's photo looks like an item already on file, the pair lands here for OSAS to confirm or dismiss."
          />
        ) : (
          <LedgerList>
            {matchQueue.pairs.map((pair) => (
              <li key={pair.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-6 gap-y-4">
                    <PairSide item={pair.lostItem} />
                    <span aria-hidden="true" className="mt-4 hidden text-ink-muted sm:block">
                      <Icon name="compare" className="h-4 w-4" />
                    </span>
                    <PairSide item={pair.foundItem} />
                  </div>

                  <div className="shrink-0 sm:ml-auto">
                    <p className="text-xs text-ink-muted">
                      Visual similarity{' '}
                      <span className="data font-medium text-attention">
                        {formatSimilarity(pair.similarity)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Suggested {formatRelative(pair.createdAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <MatchButton
                        subject={pair.foundItem}
                        size="sm"
                        label="Review match"
                      />
                      <MatchDecision matchId={pair.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>

      <Panel>
        <PanelHeading
          title="Where things stand"
          description="The steps that move an item from reported to returned."
        />
        <div className="grid gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-3 sm:px-6">
          <Step
            href="/admin/claims?status=PENDING"
            label="Verify claims"
            detail={`${totals.pendingClaims} waiting`}
          />
          <Step
            href="/admin/claims?status=AWAITING_RELEASE"
            label="Record returns"
            detail={`${totals.awaitingRelease} awaiting release`}
          />
          <Step
            href="/admin/returns"
            label="Return history"
            detail={`${totals.returnRecords} returned`}
          />
        </div>
      </Panel>
    </div>
  )
}

/**
 * One side of a suggested pair: the photo, what the record is, and the record
 * itself one click away.
 */
function PairSide({ item }: { item: MatchPairRow['lostItem'] }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <PhotoFrame src={item.photoUrl} alt={item.name} size="thumb" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{itemTypeLabel(item.type)}</p>
        <Link href={`/items/${item.id}`} className="text-sm font-medium hover:underline">
          {item.name}
        </Link>
        <p className="mt-1 text-xs text-ink-muted">{item.location}</p>
      </div>
    </div>
  )
}

function Step({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-lg p-2 hover:bg-surface-sunk"
    >
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-1 block text-xs text-ink-muted">{detail}</span>
      </span>
      <span className="mt-1 text-ink-muted transition-colors group-hover:text-accent">
        <Icon name="arrow" className="h-4 w-4" />
      </span>
    </Link>
  )
}

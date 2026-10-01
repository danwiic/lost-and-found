import type { Metadata } from 'next'
import Link from 'next/link'
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
  itemStatusLabel,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'
import { loadAdminOverview } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'OSAS Dashboard — Lost and Found' }

/**
 * The staff desk. Counters first, then the two things that actually need a
 * person: claims waiting for verification, and items sitting in Claim Pending.
 * Totals are a ledger line, not a grid of metric cards.
 */
export default async function AdminPage() {
  const admin = await requireAdminSession('/admin')
  const { totals, recentItems, recentClaims } = await loadAdminOverview(admin)

  return (
    <div className="page-stack">
      <header className="space-y-6">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            OSAS Dashboard
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
              { label: 'Returned', value: totals.returnedItems },
            ]}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel>
          <PanelHeading
            title="Claims to verify"
            description="Oldest first — the queue is worked from the bottom up."
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
              {recentClaims.map((claim) => (
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
            description="The newest records across lost and found."
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
              {recentItems.map((item) => (
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
            href="/admin/claims?status=APPROVED"
            label="Record returns"
            detail="Approved, not yet released"
          />
          <Step
            href="/admin/returns"
            label="Return history"
            detail={`${totals.returnedItems} returned`}
          />
        </div>
      </Panel>
    </div>
  )
}

function Step({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-start justify-between gap-3 rounded-lg p-2 hover:bg-surface-sunk">
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

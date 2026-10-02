import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { TallyLine } from '@/components/ui/TallyLine'
import {
  claimStatusLabel,
  claimStatusMeaning,
  claimStatusTone,
  formatDate,
  itemStatusLabel,
  itemTypeLabel,
} from '@/lib/format'
import { loadMyClaims, type ClaimListRow } from '@/lib/records'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'My Claims — Lost and Found' }

/**
 * The claims the user has filed, and where each one stands. The copy keeps
 * approval and physical release apart, because they are different events
 * (agents/UX.md §10.4, Rule 2).
 */
export default async function ClaimsPage() {
  const user = await requireSession('/claims')
  const claims = await loadMyClaims(user)

  const pending = claims.filter((claim) => claim.status === 'PENDING').length
  const approved = claims.filter((claim) => claim.status === 'APPROVED').length
  const collected = claims.filter((claim) => claim.returnRecord !== null).length

  return (
    <div className="page-stack">
      <header className="space-y-6">
        <PageHeader
          title="My Claims"
          description="Claims you have filed and where each one stands."
        />

        {claims.length > 0 ? (
          <div className="border-t border-line pt-6">
            <TallyLine
              items={[
                { label: 'Awaiting verification', value: pending, emphasis: pending > 0 },
                { label: 'Approved for release', value: approved },
                { label: 'Collected', value: collected },
              ]}
            />
          </div>
        ) : null}
      </header>

      <Panel>
        {claims.length === 0 ? (
          <EmptyState
            title="You don't have any claims yet."
            message="When you find something in Browse that is yours, open it and submit a claim. OSAS verifies every claim before an item is released."
          >
            <Link href="/browse" className={buttonClass({ variant: 'primary' })}>
              Browse Items
            </Link>
          </EmptyState>
        ) : (
          <LedgerList>
            {claims.map((claim) => (
              <ClaimItem key={claim.id} claim={claim} />
            ))}
          </LedgerList>
        )}
      </Panel>
    </div>
  )
}

function ClaimItem({ claim }: { claim: ClaimListRow }) {
  return (
    <li className="relative px-6 py-6 sm:px-6">
      <div className="flex items-start gap-4">
        <PhotoFrame src={claim.item.photoUrl} alt={claim.item.name} size="thumb" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-[0.9375rem] leading-snug font-medium">
              <Link
                href={`/items/${claim.item.id}`}
                className="rounded-lg after:absolute after:inset-0 hover:underline"
              >
                {claim.item.name}
              </Link>
            </h2>
            <Badge tone={claimStatusTone(claim.status)} title={claimStatusMeaning(claim.status)}>
              {claimStatusLabel(claim.status)}
            </Badge>
          </div>

          <p className="mt-1 text-xs text-ink-muted">
            {itemTypeLabel(claim.item.type)} item · filed {formatDate(claim.createdAt)}
            {claim.decidedAt ? ` · decided ${formatDate(claim.decidedAt)}` : ''}
          </p>

          {/* Each state says what it means and what happens next. */}
          {claim.status === 'PENDING' ? (
            <p className="measure mt-3 text-sm text-ink-muted">
              Your claim is awaiting OSAS verification. Bring your student or personnel ID when you
              are asked to collect it.
            </p>
          ) : null}

          {claim.status === 'APPROVED' && !claim.returnRecord ? (
            <div className="mt-3 rounded-lg border border-verified/25 bg-verified-soft px-4 py-3">
              <p className="text-sm font-medium text-verified">Approved — ready for collection</p>
              <p className="measure mt-1 text-sm text-verified">
                Take your student or personnel ID to the OSAS office. The item is marked Returned
                once the office records the release.
              </p>
            </div>
          ) : null}

          {claim.returnRecord ? (
            <div className="mt-3 rounded-lg border border-verified/25 bg-verified-soft px-4 py-3">
              <p className="text-sm font-medium text-verified">
                Collected on {formatDate(claim.returnRecord.returnDate)}
              </p>
              {claim.returnRecord.notes ? (
                <p className="measure mt-1 text-sm text-verified">{claim.returnRecord.notes}</p>
              ) : null}
            </div>
          ) : null}

          {claim.status === 'REJECTED' ? (
            <div className="mt-3 rounded-lg border border-refused/25 bg-refused-soft px-4 py-3">
              <p className="text-sm font-medium text-refused">Not verified</p>
              {claim.decisionNote ? (
                <p className="measure mt-1 text-sm text-refused">{claim.decisionNote}</p>
              ) : null}
              {/* Only point back at the item while it is still claimable. */}
              {claim.item.status !== 'RETURNED' && claim.item.status !== 'CLOSED' ? (
                <p className="measure mt-1 text-sm text-refused">
                  The item is still listed as {itemStatusLabel(claim.item.status)}. If you can
                  provide better proof, OSAS can advise you at the office.
                </p>
              ) : null}
            </div>
          ) : null}

          {claim.decidedByName ? (
            <p className="mt-2 text-xs text-ink-muted">Decided by {claim.decidedByName}</p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

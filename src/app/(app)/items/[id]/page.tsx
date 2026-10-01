import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminItemStatus } from '@/components/admin/AdminItemStatus'
import { MatchButton } from '@/components/records/MatchButton'
import { WithdrawReport } from '@/components/records/WithdrawReport'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Icon } from '@/components/ui/Icon'
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
import { loadItem, type ClaimSummary } from '@/lib/records'
import { requireSession } from '@/lib/session'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await requireSession('/browse')
  const { id } = await params
  const data = await loadItem(user, id)
  return { title: data ? `${data.item.name} — Lost and Found` : 'Item — Lost and Found' }
}

export default async function ItemPage({ params }: Props) {
  const user = await requireSession('/browse')
  const { id } = await params
  const data = await loadItem(user, id)
  if (!data) notFound()

  const { item, claims, claimsCount } = data
  const lost = item.type === 'LOST'

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/browse" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to Browse
        </Link>
        {item.isMine ? <Badge tone="accent">Your report</Badge> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <PhotoFrame src={item.photoUrl} alt={item.name} size="feature" />

        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {item.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={itemStatusTone(item.status)} title={itemStatusMeaning(item.status)}>
              {itemStatusLabel(item.status)}
            </Badge>
            <Badge tone="neutral">{itemTypeLabel(item.type)} item</Badge>
          </div>

          <p className="measure mt-6 text-[0.9375rem] text-ink">{item.description}</p>

          <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
            <Detail label="Colour" value={item.color ?? 'Not recorded'} />
            <Detail
              label={lost ? 'Date lost' : 'Date found'}
              value={formatDate(item.dateEvent)}
            />
            <Detail label={lost ? 'Where it was lost' : 'Where it was found'} value={item.location} />
            <Detail label="Reported" value={formatDate(item.createdAt)} />
          </dl>

          {item.additionalDetails ? (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-xs font-medium text-ink-muted">Additional details</p>
              <p className="measure mt-1 text-sm text-ink">{item.additionalDetails}</p>
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-xs font-medium text-ink-muted">Reported by</p>
            <p className="mt-1 text-sm text-ink">{item.reporter.name}</p>
            {/* Contact details reach the owner and OSAS staff only. */}
            {item.reporter.contact ? (
              <p className="mt-1 text-sm text-ink-muted">{item.reporter.contact}</p>
            ) : null}
            {item.reporter.studentId ? (
              <p className="text-sm text-ink-muted">ID {item.reporter.studentId}</p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {item.claimable ? (
              <Link
                href={`/items/${item.id}/claim`}
                className={buttonClass({ variant: 'primary' })}
              >
                Submit Claim
              </Link>
            ) : null}

            {item.isMine && item.matchCount > 0 ? (
              <MatchButton subject={item} label={`View Match (${item.matchCount})`} size="md" />
            ) : null}

            {item.canWithdraw ? <WithdrawReport itemId={item.id} name={item.name} /> : null}
          </div>

          {/* Say why the claim action is absent rather than leaving a gap. */}
          {!item.claimable && item.myPendingClaim ? (
            <p className="measure mt-4 rounded-lg border border-attention/25 bg-attention-soft px-4 py-3 text-sm text-attention">
              Your claim for this item is awaiting OSAS verification. You will be notified when it is
              decided.
            </p>
          ) : null}

          {!item.claimable && !item.myPendingClaim && item.isMine ? (
            <p className="measure mt-4 text-sm text-ink-muted">
              This is your report. If someone else believes the item is theirs, they file the claim
              and OSAS verifies it — you will be notified either way.
            </p>
          ) : null}

          {!item.claimable &&
          !item.myPendingClaim &&
          !item.isMine &&
          (item.status === 'RETURNED' || item.status === 'CLOSED') ? (
            <p className="measure mt-4 text-sm text-ink-muted">
              This item has been {item.status === 'RETURNED' ? 'returned to its owner' : 'closed'}, so
              it can no longer be claimed.
            </p>
          ) : null}
        </div>
      </div>

      {/* The claim record is visible to the reporter and to OSAS staff. */}
      {claims.length > 0 ? (
        <Panel>
          <PanelHeading
            title="Claims on this item"
            description={
              claimsCount === 1 ? 'One claim has been filed.' : `${claimsCount} claims have been filed.`
            }
          />
          <ul className="divide-y divide-line">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* OSAS sees the same record as everyone else, plus the control staff need
          to correct a mis-filed report without leaving the page. */}
      {user.role === 'ADMIN' ? (
        <Panel>
          <PanelHeading
            title="OSAS controls"
            description="Correcting the record. Releasing an item to a claimant is recorded on the claim, not here."
            action={
              claimsCount > 0 ? (
                <Link href="/admin/claims" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
                  Claims queue
                </Link>
              ) : undefined
            }
          />
          <div className="px-6 py-6 sm:px-6">
            <AdminItemStatus itemId={item.id} status={item.status} />
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  )
}

function ClaimRow({ claim }: { claim: ClaimSummary }) {
  return (
    <li className="px-6 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[0.9375rem] font-medium">{claim.claimantName}</p>
        <Badge tone={claimStatusTone(claim.status)} title={claimStatusMeaning(claim.status)}>
          {claimStatusLabel(claim.status)}
        </Badge>
        <p className="text-xs text-ink-muted">Filed {formatDate(claim.createdAt)}</p>
      </div>

      {claim.studentId ? (
        <p className="mt-1 text-xs text-ink-muted">ID {claim.studentId}</p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">{claim.contact}</p>

      {claim.decisionNote ? (
        <p className="measure mt-2 text-sm text-ink-muted">OSAS note: {claim.decisionNote}</p>
      ) : null}

      {claim.returnRecord ? (
        <p className="mt-2 text-xs text-verified">
          Released {formatDate(claim.returnRecord.returnDate)}
          {claim.returnRecord.notes ? ` — ${claim.returnRecord.notes}` : ''}
        </p>
      ) : null}
    </li>
  )
}

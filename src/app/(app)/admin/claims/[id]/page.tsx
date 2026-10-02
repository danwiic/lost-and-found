import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaimDecision } from '@/components/admin/ClaimDecision'
import { ProofPhoto } from '@/components/admin/ProofPhoto'
import { RecordReturn } from '@/components/admin/RecordReturn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LedgerList, Panel, PanelHeading } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import {
  claimStatusLabel,
  claimStatusMeaning,
  claimStatusTone,
  formatDate,
  formatSimilarity,
  formatRelative,
  itemStatusLabel,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'
import { loadClaim } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Verify Claim — OSAS' }

/**
 * The verification desk for one claim. Everything OSAS needs to decide is on
 * this page — the item as reported, the item as claimed, and the proof — laid
 * out so the two descriptions can be read against each other (agents/UX.md §11).
 */
export default async function AdminClaimPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminSession('/admin/claims')
  const { id } = await params

  const claim = await loadClaim(id)
  if (!claim) notFound()

  const open = claim.status === 'PENDING'
  const released = claim.returnRecord !== null
  const awaitingRelease = claim.status === 'APPROVED' && !released

  return (
    <div className="page-stack">
      <PageHeader
        back={{ href: '/admin/claims', label: 'All claims' }}
        title="Verify Claim"
        description={`Filed by ${claim.claimantName} ${formatRelative(claim.createdAt)}.`}
        action={
          <Badge tone={claimStatusTone(claim.status)} title={claimStatusMeaning(claim.status)}>
            {claimStatusLabel(claim.status)}
          </Badge>
        }
      />

      {open ? (
        <div className="rounded-lg border border-line bg-surface px-6 py-4 sm:px-6">
          <p className="measure text-sm text-ink-muted">
            Read the proof below against how the item was first described. Similarity between two
            photographs is a lead, not proof — the decision rests on what the claimant knows about
            the item that a stranger could not.
          </p>
        </div>
      ) : null}

      {/* The two descriptions, side by side, so they can be compared directly. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel>
          <PanelHeading
            title="The item as reported"
            description={`Logged by ${claim.item.reporter.name}`}
            action={
              <Link
                href={`/items/${claim.item.id}`}
                className={buttonClass({ variant: 'quiet', size: 'sm' })}
              >
                Open record
              </Link>
            }
          />

          <div className="space-y-6 px-6 py-6 sm:px-6">
            <PhotoFrame src={claim.item.photoUrl} alt={claim.item.name} size="feature" />

            <div>
              <h3 className="text-[0.9375rem] font-medium text-ink">{claim.item.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">
                {itemTypeLabel(claim.item.type)} · {claim.item.location} ·{' '}
                {formatDate(claim.item.dateEvent)}
              </p>
            </div>

            <dl className="space-y-3 border-t border-line pt-6 text-sm">
              <Row label="Description">{claim.item.description}</Row>
              <Row label="Colour">{claim.item.color ?? 'Not recorded'}</Row>
              <Row label="Additional details">
                {claim.item.additionalDetails ?? 'Nothing further recorded'}
              </Row>
              <Row label="Status">
                <Badge tone={itemStatusTone(claim.item.status)}>
                  {itemStatusLabel(claim.item.status)}
                </Badge>
              </Row>
            </dl>

            <div className="border-t border-line pt-6">
              <h4 className="text-xs font-medium text-ink-muted">Reported by</h4>
              <p className="mt-2 text-sm text-ink">{claim.item.reporter.name}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {claim.item.reporter.email}
                {claim.item.reporter.contact ? ` · ${claim.item.reporter.contact}` : ''}
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeading
            title="The item as claimed"
            description="What the claimant says, in their own words."
          />

          <div className="space-y-6 px-6 py-6 sm:px-6">
            <dl className="space-y-3 text-sm">
              <Row label="Claimant">{claim.claimantName}</Row>
              <Row label="Student ID">{claim.studentId ?? 'Not given'}</Row>
              <Row label="Contact">{claim.contact}</Row>
              <Row label="Additional details">
                {claim.additionalDetails ?? 'Nothing further offered'}
              </Row>
            </dl>

            <div className="border-t border-line pt-6">
              <h4 className="text-xs font-medium text-ink-muted">Proof of ownership</h4>
              <p className="measure mt-2 text-sm whitespace-pre-line text-ink">
                {claim.proof ?? 'No proof of ownership was recorded with this claim.'}
              </p>

              {/* Small on the desk so the page stays scannable; clicking opens
                  the photo large enough to examine. */}
              {claim.proofPhotoUrl ? (
                <div className="mt-4">
                  <ProofPhoto
                    src={claim.proofPhotoUrl}
                    claimantName={claim.claimantName}
                    itemName={claim.item.name}
                  />
                </div>
              ) : claim.proof ? (
                <p className="mt-4 text-xs text-ink-muted">No photo was attached to this claim.</p>
              ) : null}
            </div>

            {claim.decidedAt ? (
              <div className="border-t border-line pt-6">
                <h4 className="text-xs font-medium text-ink-muted">Decision</h4>
                <p className="mt-2 text-sm text-ink">
                  {claimStatusLabel(claim.status)}
                  {claim.decidedByName ? ` by ${claim.decidedByName}` : ''} ·{' '}
                  {formatDate(claim.decidedAt)}
                </p>
                {claim.decisionNote ? (
                  <p className="measure mt-2 text-sm whitespace-pre-line text-ink-muted">
                    {claim.decisionNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* What else is attached to this item. A claim is decided against the
          whole picture: another claimant may be waiting, and the item may carry
          candidate matches that bear on who it belongs to. */}
      {claim.otherClaims.length > 0 || claim.matches.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Panel>
            <PanelHeading
              title="Other claims on this item"
              description="Approving one claim rejects the others and notifies everyone."
            />
            {claim.otherClaims.length === 0 ? (
              <div className="px-6 py-6 sm:px-6">
                <p className="text-sm text-ink-muted">
                  No one else has claimed this item. This is the only claim on record.
                </p>
              </div>
            ) : (
              <LedgerList>
                {claim.otherClaims.map((other) => (
                  <li key={other.id} className="relative">
                    <div className="px-6 py-4 sm:px-6">
                      <h3 className="text-[0.9375rem] leading-snug font-medium">
                        <Link
                          href={`/admin/claims/${other.id}`}
                          className="rounded-lg after:absolute after:inset-0 hover:underline"
                        >
                          {other.claimantName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-ink-muted">
                        {other.studentId ? `${other.studentId} · ` : ''}filed{' '}
                        {formatRelative(other.createdAt)}
                      </p>
                      <Badge tone={claimStatusTone(other.status)} className="mt-3">
                        {claimStatusLabel(other.status)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </LedgerList>
            )}
          </Panel>

          <Panel>
            <PanelHeading
              title="Candidate matches"
              description="Visual leads only — similarity never proves ownership."
            />
            {claim.matches.length === 0 ? (
              <div className="px-6 py-6 sm:px-6">
                <p className="text-sm text-ink-muted">
                  No other item&apos;s photograph resembles this one closely enough to suggest a
                  match.
                </p>
              </div>
            ) : (
              <LedgerList>
                {claim.matches.map((match) => (
                  <li key={match.matchId} className="relative">
                    <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                      <PhotoFrame
                        src={match.imagePath ? `/api/files/${match.imagePath}` : null}
                        alt={match.name}
                        size="thumb"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[0.9375rem] leading-snug font-medium">
                          <Link
                            href={`/items/${match.itemId}`}
                            className="rounded-lg after:absolute after:inset-0 hover:underline"
                          >
                            {match.name}
                          </Link>
                        </h3>
                        <p className="mt-1 text-xs text-ink-muted">
                          {itemTypeLabel(match.type)} · {match.location} · reported by{' '}
                          {match.reporterName}
                        </p>
                        <p className="mt-2 text-xs text-ink-muted">
                          Visual similarity{' '}
                          <span className="nums font-medium text-attention">
                            {formatSimilarity(match.similarity)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </LedgerList>
            )}
          </Panel>
        </div>
      ) : null}

      {open ? (
        <Panel>
          <PanelHeading
            title="Your decision"
            description="Approving allows the item to be released. Rejecting returns it to the open list."
          />
          <div className="px-6 py-6 sm:px-6">
            <ClaimDecision
              claimId={claim.id}
              claimantName={claim.claimantName}
              itemName={claim.item.name}
            />
          </div>
        </Panel>
      ) : null}

      {awaitingRelease ? (
        <Panel>
          <PanelHeading
            title="Record the return"
            description="Approved. The item is released once the hand-over is recorded here."
          />
          <div className="px-6 py-6 sm:px-6">
            <RecordReturn
              claimId={claim.id}
              itemName={claim.item.name}
              claimantName={claim.claimantName}
              claimDate={claim.createdAt}
            />
          </div>
        </Panel>
      ) : null}

      {released && claim.returnRecord ? (
        <Panel>
          <PanelHeading
            title="Return recorded"
            description="The claim is complete — the item physically left the office."
          />
          <LedgerList>
            <li className="px-6 py-4 sm:px-6">
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Released on">{formatDate(claim.returnRecord.returnDate)}</Row>
                <Row label="Handed to">{claim.claimantName}</Row>
                <Row label="Notes">{claim.returnRecord.notes ?? 'Nothing further recorded'}</Row>
              </dl>
            </li>
          </LedgerList>
        </Panel>
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-ink">{children}</dd>
    </div>
  )
}

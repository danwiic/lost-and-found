import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ClaimForm } from '@/components/claims/ClaimForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { formatDate, itemTypeLabel } from '@/lib/format'
import { loadItem } from '@/lib/records'
import { requireSession } from '@/lib/session'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Submit a Claim — Lost and Found' }

/**
 * The claim request as its own page (agents/UX.md §4.1): a substantial form, and
 * one that shows the item again so the claimant reviews what they are claiming
 * before they commit (§10.1).
 */
export default async function ClaimPage({ params }: Props) {
  const user = await requireSession('/claims')
  const { id } = await params
  const data = await loadItem(user, id)
  if (!data) notFound()

  const { item } = data

  // Nothing to claim: a claim already under verification goes back to the item.
  if (!item.claimable) redirect(`/items/${item.id}`)

  return (
    <div className="page-stack">
      <PageHeader
        back={{ href: `/items/${item.id}`, label: 'Back to the item' }}
        title="Submit a Claim"
        description="Why this item is yours — OSAS verifies every claim in person."
      />

      {/* Review before submit (§10.1). */}
      <Panel className="card-pad">
        <div className="flex items-start gap-4">
          <PhotoFrame src={item.photoUrl} alt={item.name} size="thumb" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted">
              You are claiming this {itemTypeLabel(item.type).toLowerCase()} item
            </p>
            <p className="mt-1 text-[0.9375rem] leading-snug font-medium">{item.name}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {item.location} · {formatDate(item.dateEvent)}
            </p>
            <Badge tone="neutral" className="mt-2">
              Reported by {item.reporter.name}
            </Badge>
          </div>
        </div>
      </Panel>

      <ClaimForm
        itemId={item.id}
        defaults={{
          claimantName: user.name,
          studentId: user.studentId ?? '',
          contact: user.contact ?? '',
        }}
      />
    </div>
  )
}

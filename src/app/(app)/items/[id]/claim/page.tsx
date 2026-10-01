import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ClaimForm } from '@/components/claims/ClaimForm'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Icon } from '@/components/ui/Icon'
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
      <div>
        <Link
          href={`/items/${item.id}`}
          className={`mb-6 ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to the item
        </Link>

        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Submit a Claim
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Tell OSAS why this item is yours. They verify every claim in person before anything is
          released, so be specific — vague claims are the ones that get rejected.
        </p>
      </div>

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

import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { TallyLine } from '@/components/ui/TallyLine'
import { formatDate, formatRelative, itemTypeLabel } from '@/lib/format'
import { loadReturns } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Returns — OSAS' }

/**
 * The hand-over register. Every entry here is an item that physically left the
 * office, which is why this list and not the item statuses is the record of what
 * has actually been given back (agents/UX.md §12, Rule 2).
 */
export default async function AdminReturnsPage() {
  await requireAdminSession('/admin/returns')
  const returns = await loadReturns()

  const thisMonth = returns.filter((record) => {
    const when = new Date(record.returnDate)
    const now = new Date()
    return when.getMonth() === now.getMonth() && when.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="page-stack">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Returns
          </h1>
          <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
            Every item OSAS has handed over, newest first, with the person it was released to and
            whoever recorded it.
          </p>
        </div>

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: 'Releases shown', value: returns.length },
              { label: 'This month', value: thisMonth },
            ]}
          />
        </div>
      </div>

      <Panel>
        {returns.length === 0 ? (
          <EmptyState
            title="Nothing has been released yet."
            message="A return is recorded on an approved claim, at the moment the item is handed over at the counter."
          />
        ) : (
          <LedgerList>
            {returns.map((record) => (
              <li key={record.id} className="relative">
                <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                  <PhotoFrame src={record.item.photoUrl} alt={record.item.name} size="thumb" />

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[0.9375rem] leading-snug font-medium">
                      <Link
                        href={`/items/${record.item.id}`}
                        className="rounded-lg after:absolute after:inset-0 hover:underline"
                      >
                        {record.item.name}
                      </Link>
                    </h2>

                    <p className="mt-1 text-xs text-ink-muted">
                      {itemTypeLabel(record.item.type)} · released {formatDate(record.returnDate)} ·{' '}
                      {formatRelative(record.returnDate)}
                    </p>

                    <p className="mt-2 text-xs text-ink-muted">
                      To {record.claimantName ?? 'an unnamed claimant'}
                      {record.claimantStudentId ? ` (${record.claimantStudentId})` : ''}
                      {record.releasedByName ? ` · recorded by ${record.releasedByName}` : ''}
                    </p>

                    {record.notes ? (
                      <p className="measure mt-2 text-sm whitespace-pre-line text-ink-muted">
                        {record.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { MatchButton } from '@/components/records/MatchButton'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { TallyLine } from '@/components/ui/TallyLine'
import {
  formatDate,
  itemStatusLabel,
  itemStatusMeaning,
  itemStatusTone,
  itemTypeLabel,
} from '@/lib/format'
import { loadMyReports, type RecordRow } from '@/lib/records'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'My Reports — Lost and Found' }

type View = 'all' | 'lost' | 'found' | 'attention'

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Lost' },
  { key: 'found', label: 'Found' },
  { key: 'attention', label: 'Needs attention' },
]

function readView(raw: string | string[] | undefined): View {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'lost' || value === 'found' || value === 'attention' ? value : 'all'
}

export default async function MyReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireSession('/my-reports')
  const view = readView((await searchParams).show)
  const { records, tallies } = await loadMyReports(user)

  const visible = records.filter((record) => {
    if (view === 'lost') return record.type === 'LOST'
    if (view === 'found') return record.type === 'FOUND'
    if (view === 'attention') {
      return record.status === 'POSSIBLE_MATCH' || record.status === 'CLAIM_PENDING'
    }
    return true
  })

  return (
    <div className="page-stack">
      <header className="space-y-6">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            My Reports
          </h1>
          <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
            Everything you have reported, with its current state. A report marked Possible Match has
            at least one item whose photo looks like yours — open it to compare before you claim
            anything.
          </p>
        </div>

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: 'Lost reports', value: tallies.lost },
              { label: 'Found reports', value: tallies.found },
              { label: 'With candidates', value: tallies.matched, emphasis: tallies.matched > 0 },
              { label: 'Returned', value: tallies.returned },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/report/lost" className={buttonClass({ variant: 'primary' })}>
            Report Lost Item
          </Link>
          <Link href="/report/found" className={buttonClass()}>
            Report Found Item
          </Link>
        </div>
      </header>

      {records.length === 0 ? (
        <Panel>
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
        </Panel>
      ) : (
        <Panel>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-3 sm:px-6">
            <div role="group" aria-label="Filter my reports" className="flex flex-wrap gap-2">
              {VIEWS.map((option) => {
                const active = view === option.key
                return (
                  <Link
                    key={option.key}
                    href={option.key === 'all' ? '/my-reports' : `/my-reports?show=${option.key}`}
                    aria-current={active ? 'true' : undefined}
                    className={`rounded-full border px-3 py-1 text-[0.8125rem] transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                      active
                        ? 'border-transparent bg-accent text-on-accent'
                        : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-sunk hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>

            {view !== 'all' ? (
              <Link
                href="/my-reports"
                className={`ml-auto ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
              >
                Clear Filters
              </Link>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="No items match your current filter."
              message="Nothing in your reports is in that state right now."
            >
              <Link href="/my-reports" className={buttonClass()}>
                Clear Filters
              </Link>
            </EmptyState>
          ) : (
            <LedgerList>
              {visible.map((record) => (
                <ReportRow key={record.id} record={record} />
              ))}
            </LedgerList>
          )}
        </Panel>
      )}
    </div>
  )
}

function ReportRow({ record }: { record: RecordRow }) {
  const hasMatches = record.matchCount > 0

  return (
    <li className="relative">
      <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
        <PhotoFrame src={record.photoUrl} alt={record.name} size="thumb" />

        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] leading-snug font-medium">
            <Link
              href={`/items/${record.id}`}
              className="rounded-lg after:absolute after:inset-0 hover:underline"
            >
              {record.name}
            </Link>
          </h2>

          <p className="mt-1 text-xs text-ink-muted">
            {itemTypeLabel(record.type)} · {record.location} · {formatDate(record.dateEvent)}
          </p>

          {hasMatches ? (
            <p className="mt-1 text-xs font-medium text-attention">
              {record.matchCount === 1
                ? '1 candidate item'
                : `${record.matchCount} candidate items`}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={itemStatusTone(record.status)} title={itemStatusMeaning(record.status)}>
              {itemStatusLabel(record.status)}
            </Badge>

            {hasMatches ? (
              // Layered above the stretched link so the row still navigates.
              <span className="relative z-10">
                <MatchButton subject={record} />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

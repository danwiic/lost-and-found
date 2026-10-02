import Link from 'next/link'
import { NoticeList } from '@/components/dashboard/NoticeList'
import { RecordLedger } from '@/components/dashboard/RecordLedger'
import { RecoveryPrompt } from '@/components/dashboard/RecoveryPrompt'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { TallyLine } from '@/components/ui/TallyLine'
import { loadDashboard, type NoticeRow } from '@/lib/dashboard'
import { requireSession } from '@/lib/session'

/**
 * The desk. The heading states the current situation rather than naming the
 * screen, so the first thing a student reads is whether anything is on them.
 */
export default async function HomePage() {
  const user = await requireSession('/')
  const data = await loadDashboard(user)

  const countOf = (type: string): number =>
    data.notices.filter((notice: NoticeRow) => notice.type === type).length

  const matchesWaiting = countOf('POSSIBLE_MATCH')
  const confirmedWaiting = countOf('MATCH_CONFIRMED')
  const approvedWaiting = countOf('CLAIM_APPROVED')

  // A confirmed match outranks an unconfirmed one: OSAS has already looked, and
  // the next step belongs to the owner — file the claim.
  const headline =
    confirmedWaiting > 0
      ? confirmedWaiting === 1
        ? 'OSAS confirmed a match — file a claim'
        : `${confirmedWaiting} confirmed matches — file your claims`
      : matchesWaiting > 0
        ? matchesWaiting === 1
          ? 'One possible match to review'
          : `${matchesWaiting} possible matches to review`
        : approvedWaiting > 0
          ? 'Your claim was approved'
          : data.tallies.unread > 0
            ? data.tallies.unread === 1
              ? 'One unread notice'
              : `${data.tallies.unread} unread notices`
            : 'Nothing is waiting on you'

  const situation =
    confirmedWaiting > 0
      ? 'OSAS confirmed the match. File a claim — proof of ownership is what releases an item.'
      : matchesWaiting > 0
        ? 'Items resembling your reports are waiting. Similarity is a lead, not proof.'
        : approvedWaiting > 0
          ? 'OSAS verified your claim. Bring your student ID to the office to collect it.'
          : 'Report what you lost, or what you found — the photo does the matching.'

  return (
    <div className="page-stack">
      <div className="space-y-6">
        <PageHeader title={headline} description={situation} />

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/report/lost" className={buttonClass({ variant: 'primary' })}>
            <Icon name="plus" className="h-4 w-4" />
            Report Lost Item
          </Link>
          <Link href="/report/found" className={buttonClass()}>
            <Icon name="plus" className="h-4 w-4" />
            Report Found Item
          </Link>
          {user.role === 'ADMIN' ? (
            <Link href="/admin" className={buttonClass({ variant: 'quiet' })}>
              OSAS dashboard
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: 'My lost reports', value: data.tallies.lost },
              { label: 'My found reports', value: data.tallies.found },
              { label: 'My claims', value: data.tallies.claims },
              {
                label: 'Unread notices',
                value: data.tallies.unread,
                emphasis: data.tallies.unread > 0,
              },
            ]}
          />
        </div>
      </div>

      <Panel>
        <PanelHeading
          id="attention-heading"
          title="Waiting on you"
          description="Possible matches and claim decisions from the last few days."
          action={
            <Link href="/notifications" className={buttonClass({ variant: 'quiet', size: 'sm' })}>
              All notifications
            </Link>
          }
        />
        <NoticeList notices={data.notices} />
      </Panel>

      <Panel>
        <PanelHeading
          id="records-heading"
          title="My records"
          description="Everything you have reported, with its current state."
        />
        <RecordLedger records={data.records} claims={data.claims} />
      </Panel>

      {/* Last, not first: setting up recovery is an aside, and putting it above
          "Waiting on you" pushed the page's actual purpose below the fold. */}
      {data.showRecoveryPrompt ? <RecoveryPrompt /> : null}
    </div>
  )
}

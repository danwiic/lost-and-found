import Link from 'next/link'
import { NoticeList } from '@/components/dashboard/NoticeList'
import { RecordLedger } from '@/components/dashboard/RecordLedger'
import { RecoveryPrompt } from '@/components/dashboard/RecoveryPrompt'
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
      ? 'OSAS checked the resemblance and confirmed the two records are the same item. Ownership is still proved through a claim — file it with what only the owner would know.'
      : matchesWaiting > 0
        ? 'The matching system found items that look like something you reported. Similarity is a lead, not proof — open the photos and claim only what is yours.'
        : approvedWaiting > 0
          ? 'OSAS verified your claim. Bring your student ID to the OSAS office to collect the item; the return is recorded when it is released.'
          : 'Report what you lost, or what you found and turned in. A new report is compared against open items of the opposite type as soon as its photo arrives.'

  return (
    <div className="page-stack">
      <header className="space-y-6">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {headline}
          </h1>
          <p className="measure mt-3 text-[0.9375rem] text-ink-muted">{situation}</p>
        </div>

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
      </header>

      {data.showRecoveryPrompt ? <RecoveryPrompt /> : null}

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
    </div>
  )
}

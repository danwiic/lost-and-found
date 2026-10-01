import type { Metadata } from 'next'
import { NoticeList } from '@/components/dashboard/NoticeList'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { loadNotices } from '@/lib/dashboard'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Notifications — Lost and Found' }

export default async function NotificationsPage() {
  const user = await requireSession('/notifications')
  const notices = await loadNotices(user.id)
  const unread = notices.filter((notice) => !notice.read).length

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Notifications
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Possible matches, claim decisions and recorded returns. Opening a notice marks it as
          read — a notice is never cleared just because this page was opened.
        </p>
      </div>

      <Panel>
        <PanelHeading
          title="All notices"
          description={
            unread > 0
              ? `${unread} unread`
              : 'Everything here has been read.'
          }
        />
        <NoticeList notices={notices} allowMarkAll />
      </Panel>
    </div>
  )
}

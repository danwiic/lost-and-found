import type { Metadata } from 'next'
import { NoticeList } from '@/components/dashboard/NoticeList'
import { PageHeader } from '@/components/layout/PageHeader'
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
        <PageHeader
          title="Notifications"
          description="Possible matches, claim decisions and recorded returns."
        />
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

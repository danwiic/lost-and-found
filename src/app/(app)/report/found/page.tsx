import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReportForm } from '@/components/report/ReportForm'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Report a Found Item — Lost and Found' }

export default async function ReportFoundPage() {
  await requireSession('/report/found')

  return (
    <div className="page-stack">
      <div>
        <Link href="/" className={`mb-6 ${buttonClass({ variant: 'quiet', size: 'sm' })}`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to Home
        </Link>

        <PageHeader
          title="Report Found Item"
          description="What you found and where — then take the item to the OSAS office."
        />
      </div>

      <ReportForm type="FOUND" />
    </div>
  )
}

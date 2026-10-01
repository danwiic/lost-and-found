import type { Metadata } from 'next'
import Link from 'next/link'
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

        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Report Found Item
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Record what you found and where. Filing this report does not hand the item over — take the
          physical item to the OSAS office. Whoever reported it lost is notified if the photos look
          alike.
        </p>
      </div>

      <ReportForm type="FOUND" />
    </div>
  )
}

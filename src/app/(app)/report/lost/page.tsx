import type { Metadata } from 'next'
import Link from 'next/link'
import { ReportForm } from '@/components/report/ReportForm'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Report a Lost Item — Lost and Found' }

export default async function ReportLostPage() {
  await requireSession('/report/lost')

  return (
    <div className="page-stack">
      <div>
        <Link
          href="/"
          className={`mb-6 ${buttonClass({ variant: 'quiet', size: 'sm' })}`}
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to Home
        </Link>

        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Report Lost Item
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Tell us what you lost and where. The photo is the important part: as soon as the report is
          submitted, it is compared against open found items and you are told about anything that
          looks similar.
        </p>
      </div>

      <ReportForm type="LOST" />
    </div>
  )
}

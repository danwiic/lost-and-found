import type { Metadata } from 'next'
import Link from 'next/link'
import { ReportForm } from '@/components/report/ReportForm'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Intake — OSAS' }

/**
 * The counter form: someone walks in with an item they found and OSAS logs it
 * without filing it as the student's own report. It is the found-item form with
 * the office's wording, plus who handed the item over — the record then runs
 * through the same embed/match/notify pipeline as any other found report, since
 * it is the same POST /api/items.
 */
export default async function AdminIntakePage() {
  await requireAdminSession('/admin/intake')

  return (
    <div className="page-stack">
      <div>
        <Link href="/admin" className={`mb-6 ${buttonClass({ variant: 'quiet', size: 'sm' })}`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Received at the OSAS office
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Log an item handed in at the counter. The finder&rsquo;s name and contact are recorded with
          the report, so the chain of custody survives even when the record is filed under your
          account. The photo is embedded and compared against open lost reports the moment you
          record it.
        </p>
      </div>

      <ReportForm type="FOUND" intake />
    </div>
  )
}

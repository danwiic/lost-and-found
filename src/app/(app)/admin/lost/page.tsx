import type { Metadata } from 'next'
import { AdminItemList, type AdminItemFilters } from '@/components/admin/AdminItemList'
import { loadAdminItems } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Lost Items — OSAS' }

function readFilters(raw: Record<string, string | string[] | undefined>): AdminItemFilters {
  const first = (key: string) => {
    const value = raw[key]
    const single = Array.isArray(value) ? value[0] : value
    return (single ?? '').trim()
  }
  const page = Number(first('page'))

  return {
    q: first('q'),
    status: first('status').toUpperCase(),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  }
}

/** OSAS: every lost report on the system, with the filters staff actually use. */
export default async function AdminLostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdminSession('/admin/lost')

  const filters = readFilters(await searchParams)
  const { records, total, pageCount } = await loadAdminItems(admin, 'LOST', filters)

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Lost Items
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Every item a student has reported missing. Open a record to see its candidates, its claims,
          and the reporter&apos;s contact details.
        </p>
      </div>

      <AdminItemList
        base="/admin/lost"
        type="LOST"
        filters={filters}
        records={records}
        total={total}
        pageCount={pageCount}
      />
    </div>
  )
}

import type { Metadata } from 'next'
import { AdminItemList, type AdminItemFilters } from '@/components/admin/AdminItemList'
import { loadAdminItems } from '@/lib/records'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Found Items — OSAS' }

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

/** OSAS: the items physically held at the office, and what state each is in. */
export default async function AdminFoundPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdminSession('/admin/found')

  const filters = readFilters(await searchParams)
  const { records, total, pageCount } = await loadAdminItems(admin, 'FOUND', filters)

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Found Items
        </h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">
          Everything handed in or picked up and logged by OSAS. The status tells you whether it is
          still on the shelf, held for a claim, or already released.
        </p>
      </div>

      <AdminItemList
        base="/admin/found"
        type="FOUND"
        filters={filters}
        records={records}
        total={total}
        pageCount={pageCount}
      />
    </div>
  )
}

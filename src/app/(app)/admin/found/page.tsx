import type { Metadata } from 'next'
import { AdminItemList, type AdminItemFilters } from '@/components/admin/AdminItemList'
import { PageHeader } from '@/components/layout/PageHeader'
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
      <PageHeader title="Found Items" description="Everything handed in and logged by OSAS." />

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

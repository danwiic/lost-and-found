import type { NextRequest } from 'next/server'
import { handleRoute, json, parsePagination } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Return records for the OSAS "record item return" history. Staff only. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin(request)

    const { page, pageSize, skip, take } = parsePagination(request.nextUrl.searchParams)

    const [total, records] = await Promise.all([
      prisma.returnRecord.count(),
      prisma.returnRecord.findMany({
        orderBy: { returnDate: 'desc' },
        skip,
        take,
        include: {
          item: {
            select: { id: true, name: true, type: true, imagePath: true, location: true },
          },
          claim: {
            select: { id: true, claimantName: true, studentId: true, contact: true },
          },
          releasedBy: { select: { id: true, name: true } },
        },
      }),
    ])

    return json({
      returns: records.map((record) => ({
        ...record,
        item: {
          ...record.item,
          photoUrl: record.item.imagePath ? `/api/files/${record.item.imagePath}` : null,
        },
      })),
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })
}

import type { NextRequest } from 'next/server'
import { badRequest, handleRoute, json, parsePagination } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

/**
 * `GET /api/claims`
 * - Students: their own claims (My Claims).
 * - OSAS staff: the whole queue, or `?scope=mine` for just their own.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const params = request.nextUrl.searchParams

    const rawStatus = params.get('status')?.toUpperCase()
    const scope = (params.get('scope') ?? '').toLowerCase()
    const { page, pageSize, skip, take } = parsePagination(params)

    if (rawStatus && !CLAIM_STATUSES.includes(rawStatus as (typeof CLAIM_STATUSES)[number])) {
      throw badRequest(`Unknown status "${rawStatus}".`)
    }

    const adminQueue = viewer.role === 'ADMIN' && scope !== 'mine'
    const filters = {
      ...(adminQueue ? {} : { claimantId: viewer.id }),
      ...(rawStatus ? { status: rawStatus as (typeof CLAIM_STATUSES)[number] } : {}),
    }

    const [total, claims] = await Promise.all([
      prisma.claim.count({ where: filters }),
      prisma.claim.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              imagePath: true,
              location: true,
              dateEvent: true,
              reporterId: true,
            },
          },
          claimant: {
            select: { id: true, name: true, email: true, studentId: true, contact: true },
          },
          decidedBy: { select: { id: true, name: true } },
          returns: { select: { id: true, returnDate: true, notes: true } },
        },
      }),
    ])

    return json({
      claims: claims.map((claim) => ({
        ...claim,
        item: {
          ...claim.item,
          photoUrl: claim.item.imagePath ? `/api/files/${claim.item.imagePath}` : null,
        },
      })),
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })
}

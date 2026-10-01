import type { NextRequest } from 'next/server'
import { handleRoute, json } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toItemSummary } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

/** Dashboard counters for the OSAS side. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request)

    const [
      totalLost,
      totalFound,
      pendingClaims,
      possibleMatches,
      returnedItems,
      openItems,
      recentItems,
      recentClaims,
    ] = await Promise.all([
      prisma.item.count({ where: { type: 'LOST' } }),
      prisma.item.count({ where: { type: 'FOUND' } }),
      prisma.claim.count({ where: { status: 'PENDING' } }),
      prisma.match.count(),
      prisma.item.count({ where: { status: 'RETURNED' } }),
      prisma.item.count({ where: { status: { in: ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING'] } } }),
      prisma.item.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { reporter: { select: { id: true, name: true } } },
      }),
      prisma.claim.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: {
          item: { select: { id: true, name: true, type: true, imagePath: true } },
          claimant: { select: { id: true, name: true } },
        },
      }),
    ])

    return json({
      totals: {
        totalLostItems: totalLost,
        totalFoundItems: totalFound,
        pendingClaims,
        possibleMatches,
        returnedItems,
        openItems,
      },
      recent: {
        items: recentItems.map((item) => toItemSummary(item, admin)),
        claims: recentClaims.map((claim) => ({
          ...claim,
          item: {
            ...claim.item,
            photoUrl: claim.item.imagePath ? `/api/files/${claim.item.imagePath}` : null,
          },
        })),
      },
    })
  })
}

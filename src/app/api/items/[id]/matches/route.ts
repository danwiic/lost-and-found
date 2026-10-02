import type { NextRequest } from 'next/server'
import { forbidden, handleRoute, json, notFound } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'
import { listMatchesForItem, MATCH_BASELINE } from '@/lib/match'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

/**
 * Possible matches for one item. Only the reporter and OSAS staff may look at
 * this: it reveals the other side's item and its reporter name.
 */
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, reporterId: true },
    })
    if (!item) throw notFound('That item does not exist.')

    if (item.reporterId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden('Possible matches are only visible to the reporter and to OSAS staff.')
    }

    return json({
      itemId: item.id,
      threshold: config.matching.threshold,
      // The raw-cosine floor the calibration subtracts — shown only by ?debug=1.
      baseline: MATCH_BASELINE,
      matches: await listMatchesForItem(item.id),
    })
  })
}

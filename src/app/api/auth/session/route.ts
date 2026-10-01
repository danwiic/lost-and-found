import type { NextRequest } from 'next/server'
import { handleRoute, json } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Current session plus the counters the user dashboard shows. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const user = await getSessionUser(request)

    if (!user) {
      return json({ user: null })
    }

    const [myLost, myFound, myClaims, unread] = await Promise.all([
      prisma.item.count({ where: { reporterId: user.id, type: 'LOST' } }),
      prisma.item.count({ where: { reporterId: user.id, type: 'FOUND' } }),
      prisma.claim.count({ where: { claimantId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ])

    return json({
      user,
      counts: { myLost, myFound, myClaims, unreadNotifications: unread },
    })
  })
}

import type { NextRequest } from 'next/server'
import { accountSearchWhere } from '@/lib/accounts'
import { handleRoute, json } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Account lookup for the OSAS intake desk: who to file a found item under when
 * the finder is registered and standing at the counter. Matches on name, email
 * or student ID. Admin-only, and deliberately returns nothing at all below two
 * characters rather than the whole user table.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin(request)

    const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 2) return json({ users: [] })

    const users = await prisma.user.findMany({
      where: accountSearchWhere(q),
      orderBy: { name: 'asc' },
      take: 8,
      select: { id: true, name: true, email: true, studentId: true },
    })

    return json({ users })
  })
}

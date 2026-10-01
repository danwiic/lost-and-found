import type { NextRequest } from 'next/server'
import { badRequest, handleRoute, json, parsePagination, readBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** The signed-in user's notifications, newest first. */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const params = request.nextUrl.searchParams
    const unreadOnly = ['1', 'true'].includes((params.get('unread') ?? '').toLowerCase())
    const { page, pageSize, skip, take } = parsePagination(params)

    const filters = { userId: viewer.id, ...(unreadOnly ? { read: false } : {}) }

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where: filters }),
      prisma.notification.count({ where: { userId: viewer.id, read: false } }),
      prisma.notification.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ])

    return json({
      notifications,
      unreadCount,
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })
}

/** `POST /api/notifications` with `{ action: 'READ_ALL' }` clears the badge. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const body = await readBody(request)
    const action = typeof body.action === 'string' ? body.action.toUpperCase() : ''

    if (action !== 'READ_ALL') {
      throw badRequest('Unsupported action. Use { "action": "READ_ALL" }.')
    }

    const result = await prisma.notification.updateMany({
      where: { userId: viewer.id, read: false },
      data: { read: true },
    })

    return json({ ok: true, updated: result.count, unreadCount: 0 })
  })
}

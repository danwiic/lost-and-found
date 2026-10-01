import type { NextRequest } from 'next/server'
import { handleRoute, json, notFound, readBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

/** Marks a single notification as read (or unread with `{ read: false }`). */
export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const body = await readBody(request)
    const read = typeof body.read === 'boolean' ? body.read : true

    const existing = await prisma.notification.findFirst({
      where: { id, userId: viewer.id },
      select: { id: true },
    })
    if (!existing) throw notFound('That notification does not exist.')

    const notification = await prisma.notification.update({
      where: { id: existing.id },
      data: { read },
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: viewer.id, read: false },
    })

    return json({ notification, unreadCount })
  })
}

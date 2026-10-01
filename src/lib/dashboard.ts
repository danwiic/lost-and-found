import { prisma } from '@/lib/db'
import type { SessionUser } from '@/lib/session'

/**
 * Everything the home desk renders, assembled from the same tables the API
 * serves. The UI reads through the backend's data layer rather than over HTTP so
 * the first paint carries real content; writes still go through the API.
 */

export type NoticeRow = {
  id: string
  type: string
  message: string
  createdAt: string
  read: boolean
  itemId: string | null
  matchId: string | null
  /** The recipient's own item for match notices, or the claimed item. */
  item: { id: string; name: string; type: string; status: string; photoUrl: string | null } | null
}

export type RecordRow = {
  id: string
  type: 'LOST' | 'FOUND'
  name: string
  color: string | null
  location: string
  dateEvent: string
  status: string
  photoUrl: string | null
  createdAt: string
  matchCount: number
}

export type ClaimRow = {
  id: string
  status: string
  createdAt: string
  decisionNote: string | null
  item: { id: string; name: string; type: string; status: string; photoUrl: string | null }
}

export type DashboardData = {
  user: SessionUser
  tallies: {
    lost: number
    found: number
    claims: number
    unread: number
    possibleMatches: number
  }
  notices: NoticeRow[]
  records: RecordRow[]
  claims: ClaimRow[]
}

function photoUrl(imagePath: string | null): string | null {
  return imagePath ? `/api/files/${imagePath}` : null
}

export async function loadDashboard(user: SessionUser): Promise<DashboardData> {
  const [lost, found, claims, unread, possibleMatches, notices, items, myClaims] =
    await Promise.all([
      prisma.item.count({ where: { reporterId: user.id, type: 'LOST' } }),
      prisma.item.count({ where: { reporterId: user.id, type: 'FOUND' } }),
      prisma.claim.count({ where: { claimantId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
      prisma.item.count({ where: { reporterId: user.id, status: 'POSSIBLE_MATCH' } }),
      prisma.notification.findMany({
        where: { userId: user.id, read: false },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.item.findMany({
        where: { reporterId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { _count: { select: { lostMatches: true, foundMatches: true } } },
      }),
      prisma.claim.findMany({
        where: { claimantId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          item: { select: { id: true, name: true, type: true, status: true, imagePath: true } },
        },
      }),
    ])

  // Notices carry an itemId; resolve those items in one query so each row can
  // show the record it is about without a request per row.
  const noticeItemIds = [...new Set(notices.map((notice) => notice.itemId).filter(Boolean))]
  const noticeItems =
    noticeItemIds.length > 0
      ? await prisma.item.findMany({
          where: { id: { in: noticeItemIds as string[] } },
          select: { id: true, name: true, type: true, status: true, imagePath: true },
        })
      : []
  const itemById = new Map(noticeItems.map((item) => [item.id, item]))

  return {
    user,
    tallies: { lost, found, claims, unread, possibleMatches },
    notices: notices.map((notice) => {
      const item = notice.itemId ? itemById.get(notice.itemId) : undefined
      return {
        id: notice.id,
        type: notice.type,
        message: notice.message,
        createdAt: notice.createdAt.toISOString(),
        read: notice.read,
        itemId: notice.itemId,
        matchId: notice.matchId,
        item: item
          ? {
              id: item.id,
              name: item.name,
              type: item.type,
              status: item.status,
              photoUrl: photoUrl(item.imagePath),
            }
          : null,
      }
    }),
    records: items.map((item) => ({
      id: item.id,
      type: item.type as 'LOST' | 'FOUND',
      name: item.name,
      color: item.color,
      location: item.location,
      dateEvent: item.dateEvent.toISOString(),
      status: item.status,
      photoUrl: photoUrl(item.imagePath),
      createdAt: item.createdAt.toISOString(),
      matchCount: item._count.lostMatches + item._count.foundMatches,
    })),
    claims: myClaims.map((claim) => ({
      id: claim.id,
      status: claim.status,
      createdAt: claim.createdAt.toISOString(),
      decisionNote: claim.decisionNote,
      item: {
        id: claim.item.id,
        name: claim.item.name,
        type: claim.item.type,
        status: claim.item.status,
        photoUrl: photoUrl(claim.item.imagePath),
      },
    })),
  }
}

/** Notices for the dedicated Notifications surface (read and unread together). */
export async function loadNotices(
  userId: string,
  options: { take?: number; unreadOnly?: boolean } = {},
): Promise<NoticeRow[]> {
  const notices = await prisma.notification.findMany({
    where: { userId, ...(options.unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 40,
  })

  const itemIds = [...new Set(notices.map((notice) => notice.itemId).filter(Boolean))] as string[]
  const items =
    itemIds.length > 0
      ? await prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true, type: true, status: true, imagePath: true },
        })
      : []
  const itemById = new Map(items.map((item) => [item.id, item]))

  return notices.map((notice) => {
    const item = notice.itemId ? itemById.get(notice.itemId) : undefined
    return {
      id: notice.id,
      type: notice.type,
      message: notice.message,
      createdAt: notice.createdAt.toISOString(),
      read: notice.read,
      itemId: notice.itemId,
      matchId: notice.matchId,
      item: item
        ? {
            id: item.id,
            name: item.name,
            type: item.type,
            status: item.status,
            photoUrl: photoUrl(item.imagePath),
          }
        : null,
    }
  })
}

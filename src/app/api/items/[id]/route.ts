import type { NextRequest } from 'next/server'
import { badRequest, conflict, forbidden, handleRoute, json, notFound, readBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listMatchesForItem } from '@/lib/match'
import { toItemDetail } from '@/lib/serialize'
import { deletePhoto } from '@/lib/uploads'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const ITEM_STATUSES = [
  'PENDING',
  'POSSIBLE_MATCH',
  'CLAIM_PENDING',
  'RETURNED',
  'CLOSED',
] as const

const REPORTER_SELECT = {
  id: true,
  name: true,
  email: true,
  studentId: true,
  contact: true,
} as const

type Context = { params: Promise<{ id: string }> }

/** Item details, plus the possible matches for the owner / OSAS staff. */
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      include: { reporter: { select: REPORTER_SELECT } },
    })
    if (!item) throw notFound('That item does not exist.')

    const maySeeMatches = item.reporterId === viewer.id || viewer.role === 'ADMIN'

    const [matches, claimsCount] = await Promise.all([
      maySeeMatches ? listMatchesForItem(item.id) : Promise.resolve([]),
      prisma.claim.count({ where: { itemId: item.id } }),
    ])

    return json({ item: toItemDetail(item, viewer), matches, claimsCount })
  })
}

/** Owner or OSAS staff can correct a report; only staff can change the status. */
export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, reporterId: true },
    })
    if (!item) throw notFound('That item does not exist.')

    const isOwner = item.reporterId === viewer.id
    const isAdmin = viewer.role === 'ADMIN'
    if (!isOwner && !isAdmin) throw forbidden('You can only edit your own reports.')

    const body = await readBody(request)
    const fields = new Fields(body)

    const name = fields.optionalText('name', 'Item name', { max: 150 })
    const description = fields.optionalText('description', 'Description', { max: 2000 })
    const color = fields.optionalText('color', 'Colour', { max: 60 })
    const location = fields.optionalText('location', 'Location', { max: 200 })
    const additionalDetails = fields.optionalText('additionalDetails', 'Additional details', {
      max: 2000,
    })
    const dateEvent = fields.optionalDate('dateEvent', 'Date', { notFuture: true })

    const rawStatus = typeof body.status === 'string' ? body.status.toUpperCase() : undefined
    if (rawStatus && !ITEM_STATUSES.includes(rawStatus as (typeof ITEM_STATUSES)[number])) {
      throw badRequest(`Unknown status "${rawStatus}".`)
    }
    if (rawStatus && !isAdmin) {
      throw forbidden('Only OSAS staff can change an item status.')
    }
    fields.throwIfInvalid()

    // A field that is present but empty clears the column.
    const sent = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(location ? { location } : {}),
        ...(dateEvent ? { dateEvent } : {}),
        ...(sent('color') ? { color: color ?? null } : {}),
        ...(sent('additionalDetails') ? { additionalDetails: additionalDetails ?? null } : {}),
        ...(rawStatus ? { status: rawStatus as (typeof ITEM_STATUSES)[number] } : {}),
      },
      include: { reporter: { select: REPORTER_SELECT } },
    })

    return json({ item: toItemDetail(updated, viewer) })
  })
}

/** Removes a report (and its photo). Claims and matches cascade. */
export async function DELETE(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, reporterId: true, imagePath: true, status: true },
    })
    if (!item) throw notFound('That item does not exist.')

    const isOwner = item.reporterId === viewer.id
    const isAdmin = viewer.role === 'ADMIN'
    if (!isOwner && !isAdmin) throw forbidden('You can only delete your own reports.')

    if (!isAdmin && (item.status === 'CLAIM_PENDING' || item.status === 'RETURNED')) {
      throw conflict('This item is part of a claim process and can no longer be deleted.')
    }

    await prisma.item.delete({ where: { id } })
    if (item.imagePath) await deletePhoto(item.imagePath)

    return json({ ok: true, deletedId: id })
  })
}

import type { NextRequest } from 'next/server'
import { badRequest, handleRoute, json, parsePagination, readBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { embedImageBuffer, toVectorLiteral } from '@/lib/embed'
import { matchNewItem, type MatchCandidate } from '@/lib/match'
import { toItemDetail, toItemSummary } from '@/lib/serialize'
import { readPhoto, savePhoto } from '@/lib/uploads'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const ITEM_TYPES = ['LOST', 'FOUND'] as const
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

/**
 * Browse / search items.
 * Query: type, status, q, color, mine, page, pageSize
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)

    const params = request.nextUrl.searchParams
    const rawType = params.get('type')?.toUpperCase()
    const rawStatus = params.get('status')?.toUpperCase()
    const q = params.get('q')?.trim()
    const color = params.get('color')?.trim()
    const mine = ['1', 'true'].includes((params.get('mine') ?? '').toLowerCase())
    const { page, pageSize, skip, take } = parsePagination(params)

    if (rawType && !ITEM_TYPES.includes(rawType as (typeof ITEM_TYPES)[number])) {
      throw badRequest(`Unknown type "${rawType}". Use LOST or FOUND.`)
    }
    if (rawStatus && !ITEM_STATUSES.includes(rawStatus as (typeof ITEM_STATUSES)[number])) {
      throw badRequest(`Unknown status "${rawStatus}".`)
    }

    const filters = {
      ...(rawType ? { type: rawType as (typeof ITEM_TYPES)[number] } : {}),
      ...(rawStatus ? { status: rawStatus as (typeof ITEM_STATUSES)[number] } : {}),
      ...(mine ? { reporterId: viewer.id } : {}),
      ...(color ? { color: { contains: color, mode: 'insensitive' as const } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { color: { contains: q, mode: 'insensitive' as const } },
              { location: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [total, items] = await Promise.all([
      prisma.item.count({ where: filters }),
      prisma.item.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { reporter: { select: REPORTER_SELECT } },
      }),
    ])

    return json({
      items: items.map((item) => toItemSummary(item, viewer)),
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })
}

/**
 * Report a lost or found item (multipart/form-data with `photo`, or JSON).
 *
 * Saves the photo, stores the row, embeds the photo with CLIP, then runs the
 * similarity search which creates Match rows and writes the possible-match
 * notice to the lost side of every new pair.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const body = await readBody(request)
    const fields = new Fields(body)

    const type = fields.requiredEnum('type', 'Item type', ITEM_TYPES)
    const name = fields.requiredText('name', 'Item name', { max: 150 })
    const description = fields.requiredText('description', 'Description', { max: 2000 })
    const color = fields.optionalText('color', 'Colour', { max: 60 })
    const dateEvent = fields.requiredDate(
      'dateEvent',
      type === 'LOST' ? 'Date lost' : 'Date found',
      // An item cannot be lost or found on a day that has not happened yet.
      { notFuture: true },
    )
    const location = fields.requiredText('location', 'Location', { max: 200 })
    const additionalDetails = fields.optionalText('additionalDetails', 'Additional details', {
      max: 2000,
    })

    const photo = fields.files('photo')[0]
    if (!photo) {
      throw new ValidationError({ photo: 'A photo of the item is required.' })
    }
    fields.throwIfInvalid()

    const imagePath = await savePhoto(photo)

    const created = await prisma.item.create({
      data: {
        type,
        name,
        description,
        color: color ?? null,
        dateEvent,
        location,
        additionalDetails: additionalDetails ?? null,
        imagePath,
        reporterId: viewer.id,
      },
      include: { reporter: { select: REPORTER_SELECT } },
    })

    // Embedding + matching are best-effort: a model problem must not lose the
    // report the student just submitted.
    let matches: MatchCandidate[] = []
    let warning: string | undefined

    try {
      const embedding = await embedImageBuffer(await readPhoto(imagePath))
      await prisma.$executeRaw`
        UPDATE "Item" SET embedding = ${toVectorLiteral(embedding)}::vector WHERE id = ${created.id}
      `
      const outcome = await matchNewItem({
        itemId: created.id,
        type,
        name,
        color: color ?? null,
        embedding,
        reporterId: viewer.id,
      })
      matches = outcome.matches
    } catch (error) {
      console.error('[items] image matching failed for item', created.id, error)
      warning =
        'The photo was stored, but image matching is unavailable right now, so no possible matches were searched.'
    }

    const item = matches.length > 0
      ? { ...created, status: 'POSSIBLE_MATCH' as const }
      : created

    return json({ item: toItemDetail(item, viewer), matches, warning }, 201)
  })
}

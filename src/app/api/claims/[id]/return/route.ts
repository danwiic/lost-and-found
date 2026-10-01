import type { NextRequest } from 'next/server'
import { conflict, handleRoute, json, notFound, readBody } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields } from '@/lib/validation'
import { localDay } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

/**
 * Records the physical hand-over of an approved claim: return date, item,
 * claimant and notes go into ReturnRecord and the item becomes RETURNED.
 */
export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request)
    const { id } = await context.params

    const claim = await prisma.claim.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        itemId: true,
        claimantId: true,
        createdAt: true,
        item: { select: { id: true, name: true, status: true } },
      },
    })
    if (!claim) throw notFound('That claim does not exist.')
    if (claim.status !== 'APPROVED') {
      throw conflict('Only an approved claim can be recorded as returned.')
    }

    const alreadyRecorded = await prisma.returnRecord.findFirst({
      where: { claimId: claim.id },
      select: { id: true },
    })
    if (alreadyRecorded) throw conflict('This claim already has a return record.')

    const body = await readBody(request)
    const fields = new Fields(body)
    // The hand-over already happened, so the date is today or earlier — and it
    // cannot precede the claim itself, which is the earliest possible hand-over.
    const returnDate =
      fields.optionalDate('returnDate', 'Return date', {
        notFuture: true,
        min: claim.createdAt,
      }) ?? new Date()
    const notes = fields.optionalText('notes', 'Notes', { max: 1000 })
    fields.throwIfInvalid()

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.returnRecord.create({
        data: {
          itemId: claim.itemId,
          claimId: claim.id,
          returnDate,
          notes: notes ?? null,
          releasedById: admin.id,
        },
      })

      await tx.item.update({
        where: { id: claim.itemId },
        data: { status: 'RETURNED' },
      })

      await tx.notification.create({
        data: {
          userId: claim.claimantId,
          type: 'ITEM_RETURNED',
          // localDay, not toISOString: the notice must name the same day the
          // admin picked, not the UTC rendering of it.
          message: `"${claim.item.name}" was released to you on ${localDay(returnDate)}.`,
          claimId: claim.id,
          itemId: claim.itemId,
        },
      })

      return created
    })

    return json(
      { returnRecord: record, message: 'Return recorded. The item is now returned / closed.' },
      201,
    )
  })
}

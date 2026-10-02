import type { NextRequest } from 'next/server'
import { conflict, handleRoute, json, notFound, readBody } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const DECISIONS = ['CONFIRM', 'DISMISS'] as const

type Context = { params: Promise<{ id: string }> }

/**
 * `PATCH /api/matches/:id` with `{ action: 'CONFIRM' | 'DISMISS' }` — the
 * verification step behind "matching suggests, OSAS verifies".
 *
 * CONFIRM records the judgment and writes the notice that gives it a purpose:
 * the person who filed the lost report is told there is something to claim.
 * Neither decision moves an item or a claim by itself: releasing an item still
 * happens on the claim, after the proof of ownership is verified
 * (agents/UX.md §12, Rule 2).
 */
export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request)
    const { id } = await context.params

    const body = await readBody(request)
    const fields = new Fields(body)
    const action = fields.requiredEnum('action', 'Decision', DECISIONS)
    fields.throwIfInvalid()

    const match = await prisma.match.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        lostItem: { select: { name: true, reporterId: true } },
        foundItem: { select: { id: true, name: true } },
      },
    })
    if (!match) throw notFound('That match does not exist.')
    if (match.status !== 'SUGGESTED') {
      throw conflict(
        `This pair was already ${match.status === 'CONFIRMED' ? 'confirmed' : 'dismissed'}.`,
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const decided = await tx.match.update({
        where: { id },
        data: {
          status: action === 'CONFIRM' ? 'CONFIRMED' : 'DISMISSED',
          decidedById: admin.id,
          decidedAt: new Date(),
        },
        select: { id: true, status: true, decidedAt: true },
      })

      // The notice the confirmation exists for. Its wording stays a lead plus
      // an instruction, never a promise: what was confirmed is that the two
      // records are the same object, not who owns it.
      if (action === 'CONFIRM') {
        await tx.notification.create({
          data: {
            userId: match.lostItem.reporterId,
            type: 'MATCH_CONFIRMED',
            message:
              `OSAS confirmed that a found item matches your lost report "${match.lostItem.name}". ` +
              'If it is yours, file a claim with proof of ownership — the item is only released ' +
              'once the claim is verified.',
            matchId: match.id,
            // The counterpart is the news, as with the possible-match notice.
            itemId: match.foundItem.id,
          },
        })
      }

      return decided
    })

    return json({
      match: updated,
      message:
        action === 'CONFIRM'
          ? `"${match.lostItem.name}" and "${match.foundItem.name}" marked as the same item. The reporter of the lost report has been told to claim it.`
          : 'Pair dismissed — recorded as not a match.',
    })
  })
}

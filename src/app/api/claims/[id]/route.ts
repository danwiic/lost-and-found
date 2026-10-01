import type { NextRequest } from 'next/server'
import { conflict, forbidden, handleRoute, json, notFound, readBody } from '@/lib/api'
import { requireAdmin, requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const DECISIONS = ['APPROVE', 'REJECT'] as const

type Context = { params: Promise<{ id: string }> }

function withPhoto<T extends { imagePath: string | null }>(item: T) {
  return { ...item, photoUrl: item.imagePath ? `/api/files/${item.imagePath}` : null }
}

/** One claim with the item, the claimant and the decision record. */
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        item: {
          include: { reporter: { select: { id: true, name: true, email: true } } },
        },
        claimant: { select: { id: true, name: true, email: true, studentId: true, contact: true } },
        decidedBy: { select: { id: true, name: true } },
        returns: true,
      },
    })
    if (!claim) throw notFound('That claim does not exist.')

    const involved = claim.claimantId === viewer.id || claim.item.reporterId === viewer.id
    if (viewer.role !== 'ADMIN' && !involved) {
      throw forbidden('You can only view your own claims.')
    }

    return json({ claim: { ...claim, item: withPhoto(claim.item) } })
  })
}

/**
 * `PATCH /api/claims/:id` with `{ action: 'APPROVE' | 'REJECT', decisionNote? }`
 * — OSAS staff decide a pending claim.
 *
 * Approve: the claim is approved, competing claims on the same item are closed,
 *          everyone is notified, and the item waits for the return record.
 * Reject:  the claim is rejected and the item goes back on the list.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request)
    const { id } = await context.params

    const body = await readBody(request)
    const fields = new Fields(body)
    const action = fields.requiredEnum('action', 'Decision', DECISIONS)
    const decisionNote = fields.optionalText('decisionNote', 'Decision note', { max: 1000 })
    fields.throwIfInvalid()

    const claim = await prisma.claim.findUnique({
      where: { id },
      select: {
        id: true,
        itemId: true,
        claimantId: true,
        status: true,
        item: { select: { id: true, name: true, status: true } },
      },
    })
    if (!claim) throw notFound('That claim does not exist.')
    if (claim.status !== 'PENDING') {
      throw conflict(`This claim has already been ${claim.status.toLowerCase()}.`)
    }

    const note =
      decisionNote ??
      (action === 'APPROVE' ? 'Claim approved by OSAS.' : 'Claim rejected by OSAS.')

    const decided = await prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          decisionNote: note,
          decidedById: admin.id,
          decidedAt: new Date(),
        },
      })

      if (action === 'APPROVE') {
        // Only one claimant can be verified for an item.
        const competitors = await tx.claim.findMany({
          where: { itemId: claim.itemId, status: 'PENDING', id: { not: claim.id } },
          select: { id: true, claimantId: true },
        })

        if (competitors.length > 0) {
          await tx.claim.updateMany({
            where: { id: { in: competitors.map((row) => row.id) } },
            data: {
              status: 'REJECTED',
              decisionNote: `Another claim for "${claim.item.name}" was verified and approved by OSAS.`,
              decidedById: admin.id,
              decidedAt: new Date(),
            },
          })
        }

        await tx.notification.createMany({
          data: [
            {
              userId: claim.claimantId,
              type: 'CLAIM_APPROVED',
              message: `Your claim for "${claim.item.name}" was approved. Please collect the item at the OSAS office.`,
              claimId: claim.id,
              itemId: claim.itemId,
            },
            ...competitors.map((row) => ({
              userId: row.claimantId,
              type: 'CLAIM_REJECTED' as const,
              message: `Your claim for "${claim.item.name}" was rejected because another claimant was verified first.`,
              claimId: row.id,
              itemId: claim.itemId,
            })),
          ],
        })
      } else {
        // Put the item back on the list: matched items stay flagged as possible
        // matches, everything else returns to pending.
        const existingMatches = await tx.match.count({
          where: { OR: [{ lostItemId: claim.itemId }, { foundItemId: claim.itemId }] },
        })

        if (claim.item.status === 'CLAIM_PENDING') {
          await tx.item.update({
            where: { id: claim.itemId },
            data: { status: existingMatches > 0 ? 'POSSIBLE_MATCH' : 'PENDING' },
          })
        }

        await tx.notification.create({
          data: {
            userId: claim.claimantId,
            type: 'CLAIM_REJECTED',
            message: `Your claim for "${claim.item.name}" was rejected. ${note}`,
            claimId: claim.id,
            itemId: claim.itemId,
          },
        })
      }

      return updated
    })

    return json({
      claim: decided,
      message: action === 'APPROVE'
        ? 'Claim approved. Record the item return once the claimant collects it.'
        : 'Claim rejected and the item is listed again.',
    })
  })
}

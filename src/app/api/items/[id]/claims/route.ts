import type { NextRequest } from 'next/server'
import {
  badRequest,
  conflict,
  forbidden,
  handleRoute,
  json,
  notFound,
  readBody,
} from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyMany } from '@/lib/notifications'
import { savePhoto } from '@/lib/uploads'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const REPORTER_SELECT = {
  id: true,
  name: true,
  email: true,
  studentId: true,
  contact: true,
} as const

/**
 * Files a claim against an item (multipart/form-data with an optional
 * `proofPhoto`, or JSON). The claim starts as PENDING, which is surfaced in the
 * UI as "Claim Pending Verification".
 */
export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, status: true, reporterId: true },
    })
    if (!item) throw notFound('That item does not exist.')

    if (item.reporterId === viewer.id) {
      throw badRequest('You cannot file a claim for an item you reported yourself.')
    }
    if (item.status === 'RETURNED' || item.status === 'CLOSED') {
      throw conflict('This item has already been released or closed, so it cannot be claimed.')
    }

    const pendingClaim = await prisma.claim.findFirst({
      where: { itemId: item.id, claimantId: viewer.id, status: 'PENDING' },
      select: { id: true },
    })
    if (pendingClaim) {
      throw conflict('You already have a claim under verification for this item.')
    }

    const body = await readBody(request)
    const fields = new Fields(body)

    const claimantName =
      fields.optionalText('claimantName', 'Claimant name', { max: 120 }) ?? viewer.name
    const studentId =
      fields.optionalText('studentId', 'Student / personnel ID', { max: 60 }) ??
      viewer.studentId ??
      undefined
    const contact = fields.requiredText('contact', 'Contact information', { max: 120 })
    const additionalDetails = fields.optionalText('additionalDetails', 'Additional item details', {
      max: 2000,
    })
    const proof = fields.requiredText('proof', 'Proof of ownership', { max: 2000 })
    // The photo is optional — the written proof above is the part OSAS always
    // gets. A file that is present but unusable (wrong type, too large, not an
    // image) still fails the request, as a 400 from the uploader.
    const proofPhoto = fields.files('proofPhoto')[0]
    fields.throwIfInvalid()

    const proofImagePath = proofPhoto ? await savePhoto(proofPhoto) : null

    const claim = await prisma.claim.create({
      data: {
        itemId: item.id,
        claimantId: viewer.id,
        claimantName,
        studentId: studentId ?? null,
        contact,
        additionalDetails: additionalDetails ?? null,
        proof,
        proofImagePath,
      },
    })

    await prisma.item.update({ where: { id: item.id }, data: { status: 'CLAIM_PENDING' } })

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    })

    await notifyMany([
      ...admins.map((admin) => ({
        userId: admin.id,
        type: 'CLAIM_SUBMITTED' as const,
        message: `${viewer.name} filed a claim for "${item.name}". Verification is pending.`,
        claimId: claim.id,
        itemId: item.id,
      })),
      {
        userId: item.reporterId,
        type: 'CLAIM_SUBMITTED' as const,
        message: `Someone filed a claim for "${item.name}".`,
        claimId: claim.id,
        itemId: item.id,
      },
    ])

    return json(
      {
        claim,
        message: 'Your claim was submitted and is now pending verification by OSAS.',
      },
      201,
    )
  })
}

/** Claims filed on one item: visible to the reporter and to OSAS staff. */
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const { id } = await context.params

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, reporterId: true },
    })
    if (!item) throw notFound('That item does not exist.')

    if (item.reporterId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden('Only the reporter and OSAS staff can see the claims for this item.')
    }

    const claims = await prisma.claim.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: 'desc' },
      include: { claimant: { select: REPORTER_SELECT }, decidedBy: { select: { id: true, name: true } } },
    })

    return json({ claims })
  })
}

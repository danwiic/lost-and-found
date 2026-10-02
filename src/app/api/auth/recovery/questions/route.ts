import type { NextRequest } from 'next/server'
import { ApiError, handleRoute, json, readBody } from '@/lib/api'
import { prisma } from '@/lib/db'
import { recoveryLockMessage, recoveryPrompt } from '@/lib/security-questions'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/recovery/questions — the first step of a reset: hand back the
 * prompt for each question the account set up, by email address.
 *
 * This is the one endpoint that accepts an email and answers differently for a
 * known and an unknown address: an empty list means either "no such account" or
 * "no questions configured", and the form treats both the same way. It has to
 * answer something to be usable, and an empty array is the smallest signal that
 * still lets the honest case ("I forgot whether I set these up") work.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await readBody(request)
    const fields = new Fields(body)
    const email = fields.email('email', 'Email', { required: true })
    fields.throwIfInvalid()

    const user = await prisma.user.findUnique({
      where: { email: email as string },
      select: {
        recoveryLockedUntil: true,
        securityAnswers: { select: { questionKey: true } },
      },
    })

    if (user?.recoveryLockedUntil && user.recoveryLockedUntil > new Date()) {
      throw new ApiError(429, recoveryLockMessage())
    }

    return json({
      questions:
        user?.securityAnswers.map((entry) => ({
          questionKey: entry.questionKey,
          prompt: recoveryPrompt(entry.questionKey),
        })) ?? [],
    })
  })
}

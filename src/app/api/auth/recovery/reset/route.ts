import type { NextRequest } from 'next/server'
import { ApiError, badRequest, handleRoute, json, readBody } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  normalizeAnswer,
  RECOVERY_LOCK_MINUTES,
  RECOVERY_MAX_ATTEMPTS,
  recoveryLockMessage,
} from '@/lib/security-questions'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/recovery/reset — the public reset. Verifies one answer per
 * stored question, then rotates the password.
 *
 * Wrong answers are counted on the user row and the questions lock after
 * RECOVERY_MAX_ATTEMPTS, because a guessable answer set is the whole risk of
 * this feature. A correct run clears the counter. Every response for a wrong
 * answer is identical whether or not the address exists, so the endpoint never
 * confirms which emails are registered.
 *
 * The reset also bumps `sessionEpoch`, which invalidates every token signed
 * before it: "someone reset my password" has to mean the other devices stop
 * working, or the reset only helps sometimes.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await readBody(request)
    const fields = new Fields(body)

    const email = fields.email('email', 'Email', { required: true })
    const password = fields.password('password', 'New password')
    fields.throwIfInvalid()

    const confirmation = body.confirmPassword
    if (
      typeof confirmation === 'string' &&
      confirmation !== '' &&
      confirmation !== password
    ) {
      throw new ValidationError({ confirmPassword: 'Passwords do not match.' })
    }

    const generic = badRequest('Those answers did not match the questions on this account.')

    const user = await prisma.user.findUnique({
      where: { email: email as string },
      select: {
        id: true,
        recoveryAttempts: true,
        recoveryLockedUntil: true,
        securityAnswers: { select: { questionKey: true, answerHash: true } },
      },
    })

    if (user?.recoveryLockedUntil && user.recoveryLockedUntil > new Date()) {
      throw new ApiError(429, recoveryLockMessage())
    }
    if (!user || user.securityAnswers.length === 0) throw generic

    // Submitted answers by question key; extra or unknown keys are ignored.
    const submitted = new Map<string, string>()
    if (Array.isArray(body.answers)) {
      for (const entry of body.answers) {
        if (typeof entry !== 'object' || entry === null) continue
        const { questionKey, answer } = entry as { questionKey?: unknown; answer?: unknown }
        if (typeof questionKey === 'string' && typeof answer === 'string') {
          submitted.set(questionKey, normalizeAnswer(answer))
        }
      }
    }

    const verdicts = await Promise.all(
      user.securityAnswers.map((entry) =>
        verifyPassword(submitted.get(entry.questionKey) ?? '', entry.answerHash),
      ),
    )

    if (verdicts.some((matches) => !matches)) {
      const attempts = user.recoveryAttempts + 1
      const lock = attempts >= RECOVERY_MAX_ATTEMPTS
      await prisma.user.update({
        where: { id: user.id },
        data: {
          recoveryAttempts: lock ? 0 : attempts,
          recoveryLockedUntil: lock
            ? new Date(Date.now() + RECOVERY_LOCK_MINUTES * 60_000)
            : null,
        },
      })
      if (lock) throw new ApiError(429, recoveryLockMessage())
      throw generic
    }

    const passwordHash = await hashPassword(password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          sessionEpoch: { increment: 1 },
          recoveryAttempts: 0,
          recoveryLockedUntil: null,
        },
      }),
      // The audit row and the notice are written with the change itself, so a
      // reset cannot exist without a record of it.
      prisma.passwordReset.create({ data: { userId: user.id } }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          message:
            'Your password was reset with your security questions. If this was not you, contact the OSAS office right away.',
        },
      }),
    ])

    return json({ message: 'Your password was reset. Sign in with your new password.' })
  })
}

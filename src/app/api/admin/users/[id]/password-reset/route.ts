import type { NextRequest } from 'next/server'
import { forbidden, handleRoute, json, notFound } from '@/lib/api'
import { generateTemporaryPassword, hashPassword, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/users/:id/password-reset — the counter's answer to "I forgot
 * my password and never set up the security questions".
 *
 * It issues a one-time password that is returned exactly once and never stored
 * in readable form, flags the account so nothing else works until the owner
 * chooses their own, and bumps the session epoch, which signs out every device
 * that was already in. A staff-issued reset also writes an audit row naming the
 * staff member: handing out a password is the most powerful thing this app lets
 * a person do, so it is the one action that is always attributable.
 *
 * Staff accounts are refused. Resetting an administrator from here would let
 * one member of staff take over another's account silently, and no counter
 * request needs it.
 */
export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const admin = await requireAdmin(request)
    const { id } = await context.params

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!target) throw notFound('That account no longer exists.')
    if (target.role === 'ADMIN') {
      throw forbidden('Staff accounts cannot be reset from here.')
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          sessionEpoch: { increment: 1 },
          // A forgotten password is not a security-question lockout: clear the
          // counters so the account is not carrying a stale penalty too.
          recoveryAttempts: 0,
          recoveryLockedUntil: null,
        },
      }),
      prisma.passwordReset.create({
        data: { userId: target.id, method: 'STAFF', actorId: admin.id },
      }),
      prisma.notification.create({
        data: {
          userId: target.id,
          type: 'PASSWORD_RESET',
          message:
            'OSAS issued you a temporary password at the office. Sign in with it and choose a password only you know — nothing else works until you do.',
        },
      }),
    ])

    return json({
      account: { id: target.id, name: target.name, email: target.email },
      temporaryPassword,
      issuedBy: admin.name,
    })
  })
}

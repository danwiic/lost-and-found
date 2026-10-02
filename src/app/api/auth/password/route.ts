import type { NextRequest } from 'next/server'
import { badRequest, handleRoute, json, readBody } from '@/lib/api'
import {
  attachSessionCookie,
  createSessionToken,
  hashPassword,
  requireUser,
  verifyPassword,
  type UserRole,
} from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/auth/password — the signed-in user chooses a new password.
 *
 * This is the one data endpoint that answers while a staff-issued temporary
 * password is in force, because it is how that state ends. The current password
 * is still required, so an unattended screen cannot be used to take an account
 * over — and the new one must actually differ, or the hand-off would be
 * pointless.
 *
 * The change bumps `sessionEpoch`, signing out every other device. That would
 * normally include this one, so the response re-issues this device's cookie at
 * the new epoch: the person who just chose the password stays signed in, and
 * nobody else does.
 */
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser(request, { allowTemporaryPassword: true })
    const body = await readBody(request)
    const fields = new Fields(body)

    const currentPassword = fields.password('currentPassword', 'Current password')
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

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    })
    if (!account) throw badRequest('That account is no longer available.')
    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      throw new ValidationError({ currentPassword: 'That password is not correct.' })
    }
    if (currentPassword === password) {
      throw new ValidationError({
        password: 'That is the password you are already using.',
      })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        sessionEpoch: { increment: 1 },
        mustChangePassword: false,
      },
      select: { id: true, name: true, email: true, role: true, sessionEpoch: true },
    })

    const token = await createSessionToken({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: (updated.role === 'ADMIN' ? 'ADMIN' : 'USER') as UserRole,
      epoch: updated.sessionEpoch,
    })

    return attachSessionCookie(
      json({ message: 'Your password was changed. Other devices have been signed out.' }),
      token,
    )
  })
}

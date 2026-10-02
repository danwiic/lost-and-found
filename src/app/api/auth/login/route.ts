import type { NextRequest } from 'next/server'
import { handleRoute, json, readBody, unauthorized } from '@/lib/api'
import { attachSessionCookie, createSessionToken, verifyPassword, type UserRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await readBody(request)
    const fields = new Fields(body)

    const email = fields.email('email', 'Email', { required: true })
    const password = fields.password('password', 'Password')
    fields.throwIfInvalid()

    const user = await prisma.user.findUnique({
      where: { email: email as string },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        contact: true,
        role: true,
        passwordHash: true,
        sessionEpoch: true,
      },
    })

    // Same message for unknown email and wrong password: do not leak accounts.
    const invalid = unauthorized('Email or password is incorrect.')
    if (!user) throw invalid

    const passwordMatches = await verifyPassword(password, user.passwordHash)
    if (!passwordMatches) throw invalid

    const role: UserRole = user.role === 'ADMIN' ? 'ADMIN' : 'USER'

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      epoch: user.sessionEpoch,
    })

    const { passwordHash: _passwordHash, sessionEpoch: _sessionEpoch, ...safeUser } = user

    return attachSessionCookie(json({ user: { ...safeUser, role } }), token)
  })
}

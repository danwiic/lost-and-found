import type { NextRequest } from 'next/server'
import { conflict, handleRoute, json, readBody } from '@/lib/api'
import { attachSessionCookie, createSessionToken, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Creates a student or personnel account and signs it in straight away. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await readBody(request)
    const fields = new Fields(body)

    const accountType = fields.requiredEnum('accountType', 'Account type', ['STUDENT', 'PERSONNEL'] as const)
    const name = fields.requiredText('name', 'Full name', { min: 2, max: 120 })
    const email = fields.email('email', 'Email', { required: true })
    const password = fields.password('password', 'Password')
    const studentId = fields.optionalText('studentId', 'Student / personnel ID', { max: 60 })
    const contact = fields.optionalText('contact', 'Contact information', { max: 120 })
    fields.throwIfInvalid()

    // The signup form always sends the confirmation back; an API client may omit
    // it. When it is present it must match exactly — the field exists to catch a
    // mistyped password before the account is created. Compared untrimmed, since
    // spaces are legitimate password characters.
    const confirmation = body.confirmPassword
    if (typeof confirmation === 'string' && confirmation !== '' && confirmation !== password) {
      throw new ValidationError({ confirmPassword: 'Passwords do not match.' })
    }

    // `email` and `password` are guaranteed non-empty once validation passes.
    const emailAddress = email as string

    const existing = await prisma.user.findUnique({
      where: { email: emailAddress },
      select: { id: true },
    })
    if (existing) {
      throw conflict('An account with that email already exists.')
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: emailAddress,
        passwordHash: await hashPassword(password),
        studentId: studentId ?? null,
        contact: contact ?? null,
        accountType,
        role: accountType === 'PERSONNEL' ? 'ADMIN' : 'USER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        contact: true,
        role: true,
        accountType: true,
        sessionEpoch: true,
      },
    })

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      epoch: user.sessionEpoch,
    })

    const { sessionEpoch: _sessionEpoch, ...safeUser } = user

    return attachSessionCookie(
      json({ user: { ...safeUser, role: user.role === 'ADMIN' ? 'ADMIN' : 'USER' } }, 201),
      token,
    )
  })
}

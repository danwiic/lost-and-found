import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest, NextResponse } from 'next/server'
import { forbidden, unauthorized } from '@/lib/api'
import { config, SESSION_TTL_SECONDS } from '@/lib/config'
import { prisma } from '@/lib/db'

export type UserRole = 'USER' | 'ADMIN'

export type AuthedUser = {
  id: string
  name: string
  email: string
  studentId: string | null
  contact: string | null
  role: UserRole
  /** True while a staff-issued temporary password is still in force. */
  mustChangePassword: boolean
}

const ALGORITHM = 'HS256'
const BCRYPT_ROUNDS = 10

/** Prisma hands back its own enum representation; normalise it once here. */
function toRole(value: unknown): UserRole {
  return value === 'ADMIN' ? 'ADMIN' : 'USER'
}

function secretKey(): Uint8Array {
  const secret = config.auth.secret
  if (!secret || secret === 'change-me-in-env') {
    throw new Error(
      'AUTH_SECRET is not configured. Copy .env.example to .env and set a long random value.',
    )
  }
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

/**
 * Unambiguous alphabet for a password that gets read aloud or written on paper
 * at the counter: no 0/O, no 1/l/I. Lowercase and digits only, because mixed
 * case is where a hand-off goes wrong.
 */
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const TEMP_LENGTH = 10

/**
 * A one-time password for the OSAS counter. Generated from the CSPRNG — the
 * whole value is the security, since it is shown once on screen and never
 * stored in readable form. 10 characters over this alphabet is ~32 bits of
 * entropy behind an admin-only, audited endpoint, and it only lives until the
 * owner changes it at first sign-in.
 */
export function generateTemporaryPassword(): string {
  const bytes = randomBytes(TEMP_LENGTH)
  let password = ''
  for (let index = 0; index < TEMP_LENGTH; index += 1) {
    password += TEMP_ALPHABET[bytes[index] % TEMP_ALPHABET.length]
  }
  return password
}

export async function createSessionToken(user: {
  id: string
  name: string
  email: string
  role: UserRole
  /** The user's session epoch at issue time; a reset makes it stale. */
  epoch: number
}): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role, epoch: user.epoch })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.sessionTtlDays}d`)
    .sign(secretKey())
}

export async function readSessionToken(token: string | undefined): Promise<{
  id: string
  role: UserRole
  epoch: number
} | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] })
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return {
      id: payload.sub,
      role: toRole(payload.role),
      // Tokens signed before session epochs existed carry no claim; the column
      // default is 0, so they stay valid until the user resets a password.
      epoch: typeof payload.epoch === 'number' ? payload.epoch : 0,
    }
  } catch {
    // Expired, tampered with or signed with another secret.
    return null
  }
}

export function sessionCookieOptions() {
  return {
    name: config.auth.cookieName,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.auth.cookieSecure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({ ...sessionCookieOptions(), value: token })
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({ ...sessionCookieOptions(), value: '', maxAge: 0 })
  return response
}

/** Resolves the signed-in user, or null when the request is anonymous. */
export async function getSessionUser(request: NextRequest): Promise<AuthedUser | null> {
  const token = request.cookies.get(config.auth.cookieName)?.value
  const session = await readSessionToken(token)
  if (!session) return null

  // Load the row so role changes, deletions and password resets take effect
  // immediately: a reset bumps sessionEpoch, which makes every token signed
  // before it fail the check below.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      contact: true,
      role: true,
      sessionEpoch: true,
      mustChangePassword: true,
    },
  })
  if (!user) return null
  if (user.sessionEpoch !== session.epoch) return null

  const { sessionEpoch: _sessionEpoch, ...authed } = user
  return { ...authed, role: toRole(user.role) }
}

/**
 * Resolves the signed-in user, refusing anyone holding a temporary password.
 * Enforcement lives here rather than in each route so a new endpoint cannot
 * forget it: while the flag is set, the only calls that answer are the ones
 * that change the password, and they opt in explicitly.
 */
export async function requireUser(
  request: NextRequest,
  options: { allowTemporaryPassword?: boolean } = {},
): Promise<AuthedUser> {
  const user = await getSessionUser(request)
  if (!user) throw unauthorized()
  if (user.mustChangePassword && !options.allowTemporaryPassword) {
    throw forbidden('Choose your own password before using anything else.')
  }
  return user
}

export async function requireAdmin(request: NextRequest): Promise<AuthedUser> {
  const user = await requireUser(request)
  if (user.role !== 'ADMIN') throw forbidden('Only OSAS staff can perform this action.')
  return user
}

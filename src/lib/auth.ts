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

export async function createSessionToken(user: {
  id: string
  name: string
  email: string
  role: UserRole
}): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.sessionTtlDays}d`)
    .sign(secretKey())
}

export async function readSessionToken(token: string | undefined): Promise<{
  id: string
  role: UserRole
} | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] })
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return { id: payload.sub, role: toRole(payload.role) }
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

  // Load the row so role changes and deletions take effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, studentId: true, contact: true, role: true },
  })
  if (!user) return null

  return { ...user, role: toRole(user.role) }
}

export async function requireUser(request: NextRequest): Promise<AuthedUser> {
  const user = await getSessionUser(request)
  if (!user) throw unauthorized()
  return user
}

export async function requireAdmin(request: NextRequest): Promise<AuthedUser> {
  const user = await requireUser(request)
  if (user.role !== 'ADMIN') throw forbidden('Only OSAS staff can perform this action.')
  return user
}

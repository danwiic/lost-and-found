import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readSessionToken } from '@/lib/auth'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'

export type SessionUser = {
  id: string
  name: string
  email: string
  studentId: string | null
  contact: string | null
  role: 'USER' | 'ADMIN'
}

/**
 * Session reader for Server Components. It resolves the same signed cookie the
 * route handlers use, so the UI and the API can never disagree about who is
 * signed in.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(config.auth.cookieName)?.value
  const session = await readSessionToken(token)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, studentId: true, contact: true, role: true },
  })
  if (!user) return null

  return { ...user, role: user.role === 'ADMIN' ? 'ADMIN' : 'USER' }
}

/** Every protected surface calls this; unauthenticated visitors go to sign in. */
export async function requireSession(returnTo?: string): Promise<SessionUser> {
  const user = await readSession()
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login')
  }
  return user
}

/**
 * The OSAS surfaces. A signed-in student is sent to their own desk rather than
 * shown an admin screen they cannot act on — the API refuses these actions
 * anyway, so rendering them would only advertise a capability nobody has.
 */
export async function requireAdminSession(returnTo?: string): Promise<SessionUser> {
  const user = await requireSession(returnTo)
  if (user.role !== 'ADMIN') redirect('/')
  return user
}

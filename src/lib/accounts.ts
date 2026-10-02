import { prisma } from '@/lib/db'

export type AccountRow = {
  id: string
  name: string
  email: string
  studentId: string | null
  contact: string | null
  role: 'USER' | 'ADMIN'
  /** True while a staff-issued temporary password is still in force. */
  mustChangePassword: boolean
  createdAt: string
}

export type AccountList = {
  accounts: AccountRow[]
  total: number
  page: number
  pageCount: number
}

/** One screen of the roster. Alphabetical, so a name can be found by eye too. */
export const ACCOUNTS_PAGE_SIZE = 20

/**
 * The matcher behind both account lookups: the OSAS intake desk (who to file a
 * found item under) and the accounts page (who to hand a temporary password to).
 * Name, email or student ID — someone at the counter may offer any one of them.
 */
export function accountSearchWhere(q: string) {
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
      { studentId: { contains: q, mode: 'insensitive' as const } },
    ],
  }
}

/**
 * A page of accounts, filtered when a query is given.
 *
 * No query is not the same as no results: the roster is listed so a staff member
 * can browse it, which is what someone does when the student cannot remember
 * which email they registered with. The intake typeahead still refuses short
 * queries — that one runs while someone is typing, and this one is a page.
 */
export async function listAccounts({
  q = '',
  page = 1,
}: {
  q?: string
  page?: number
}): Promise<AccountList> {
  const query = q.trim()
  const where = query.length >= 2 ? accountSearchWhere(query) : undefined

  const total = await prisma.user.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE))
  // A hand-typed or stale ?page= is clamped rather than answered with an empty
  // list, so the pagination links always describe what is on screen.
  const current = Math.min(Math.max(page, 1), pageCount)

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    skip: (current - 1) * ACCOUNTS_PAGE_SIZE,
    take: ACCOUNTS_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      contact: true,
      role: true,
      mustChangePassword: true,
      createdAt: true,
    },
  })

  return {
    accounts: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      contact: user.contact,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    })),
    total,
    page: current,
    pageCount,
  }
}

/**
 * The two numbers the page leads with. "On a temporary password" is the one
 * worth watching: it is a hand-off in progress, and it should end when the owner
 * chooses their own password.
 */
export async function loadAccountCounts(): Promise<{
  total: number
  onTemporaryPassword: number
}> {
  const [total, onTemporaryPassword] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { mustChangePassword: true } }),
  ])
  return { total, onTemporaryPassword }
}

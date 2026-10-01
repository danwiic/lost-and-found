/**
 * Seeds the single OSAS staff account.
 *
 * Nothing else is created. There is no demo student, no sample item, no fixture
 * photo and no pre-made match: every other account arrives through a real
 * registration (`POST /api/auth/register`) and every item row comes from a real
 * report made by a signed-in user. That is the point — the matcher is tuned on
 * real photographs, not on curated pairs.
 *
 * Idempotent, so it is safe to run on every container start: it creates the
 * admin account when it is missing and repairs its name, password and role when
 * it is not.
 *
 * Run with `npm run db:seed` (Prisma 7 does not seed automatically).
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

const BCRYPT_ROUNDS = 10

/**
 * The OSAS staff sign-in. These values also land in the server log, which is the
 * only place they are announced. Change them before any real deployment and run
 * `npm run db:seed` again to re-apply.
 */
const ADMIN_ACCOUNT = {
  email: 'admin@cvsu.test',
  name: 'OSAS Staff',
  password: 'admin123',
  studentId: 'OSAS-0001',
  contact: 'osas@cvsu.test',
} as const

async function upsertAdmin(): Promise<{ id: string; email: string; role: string }> {
  const passwordHash = await bcrypt.hash(ADMIN_ACCOUNT.password, BCRYPT_ROUNDS)

  return prisma.user.upsert({
    where: { email: ADMIN_ACCOUNT.email },
    update: {
      name: ADMIN_ACCOUNT.name,
      role: 'ADMIN',
      studentId: ADMIN_ACCOUNT.studentId,
      contact: ADMIN_ACCOUNT.contact,
      passwordHash,
    },
    create: {
      email: ADMIN_ACCOUNT.email,
      name: ADMIN_ACCOUNT.name,
      role: 'ADMIN',
      studentId: ADMIN_ACCOUNT.studentId,
      contact: ADMIN_ACCOUNT.contact,
      passwordHash,
    },
    select: { id: true, email: true, role: true },
  })
}

/** Prints what the database actually holds, so an empty system is obvious. */
async function reportSummary(): Promise<void> {
  const [users, admins, items, matches, notifications] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.item.count(),
    prisma.match.count(),
    prisma.notification.count(),
  ])

  console.log('[seed] ------------------------------------------------------------')
  console.log(
    `[seed] users=${users} (admins=${admins}) items=${items} matches=${matches} notifications=${notifications}`,
  )
  console.log(
    items === 0
      ? '[seed] items=0 on a fresh install: people make reports in the app, nothing is seeded here.'
      : `[seed] the ${items} existing item(s) came from real reports; this seed never writes an item.`,
  )
  console.log(`[seed] admin sign-in: ${ADMIN_ACCOUNT.email} / ${ADMIN_ACCOUNT.password}`)
}

async function main(): Promise<void> {
  const admin = await upsertAdmin()
  console.log(`[seed] admin account ready: ${admin.email} (${admin.role}, ${admin.id})`)
  console.log('[seed] no demo or sample data is created — accounts come from registrations, items from reports.')
  await reportSummary()
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance.',
  )
}

/**
 * Prisma ORM 7 uses the Rust-free client, which talks to Postgres through a
 * driver adapter instead of the bundled query engine binary.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })
}

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { lafPrisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.lafPrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.lafPrisma = prisma
}

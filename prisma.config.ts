import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma ORM 7 configures the CLI (including the datasource URL) from this file
 * instead of the datasource block in schema.prisma.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Run with: npx prisma db seed  (Prisma 7 no longer seeds automatically)
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})

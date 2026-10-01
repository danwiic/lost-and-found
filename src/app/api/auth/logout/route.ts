import type { NextRequest } from 'next/server'
import { handleRoute, json } from '@/lib/api'
import { clearSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  return handleRoute(async () => clearSessionCookie(json({ ok: true })))
}

import { handleRoute, json } from '@/lib/api'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'
import { embedderHealthy } from '@/lib/embed'
import { MATCH_BASELINE } from '@/lib/match'

export const dynamic = 'force-dynamic'

/**
 * Liveness probe for docker-compose. The database is the hard requirement; the
 * embedder sidecar is reported but does not fail the probe, because a report
 * still stores (with a warning) while matching is unavailable, and a transient
 * embedder restart should not mark the whole app unhealthy.
 */
export async function GET() {
  return handleRoute(async () => {
    const startedAt = Date.now()

    let database: 'ok' | 'unavailable' = 'ok'
    let itemCount = 0
    try {
      itemCount = await prisma.item.count()
    } catch (error) {
      database = 'unavailable'
      console.error('[health] database check failed:', error)
    }

    const embedderUp = await embedderHealthy()

    return json(
      {
        status: database === 'ok' ? 'ok' : 'degraded',
        database,
        items: itemCount,
        embedder: embedderUp ? 'ok' : 'unavailable',
        model: config.embeddings.modelId,
        matchBaseline: MATCH_BASELINE,
        matchThreshold: config.matching.threshold,
        tookMs: Date.now() - startedAt,
      },
      database === 'ok' ? 200 : 503,
    )
  })
}

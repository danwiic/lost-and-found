import path from 'node:path'

function str(name: string, fallback: string): string {
  const raw = process.env[name]
  return raw === undefined || raw === '' ? fallback : raw
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, received "${raw}"`)
  }
  return parsed
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

/** Single source of truth for every tunable value in the backend. */
export const config = {
  auth: {
    secret: str('AUTH_SECRET', ''),
    sessionTtlDays: num('SESSION_TTL_DAYS', 7),
    cookieName: 'laf_session',
    // Keep this off for http://localhost; enable when the app is behind HTTPS.
    cookieSecure: bool('COOKIE_SECURE', false),
  },
  uploads: {
    dir: path.resolve(str('UPLOAD_DIR', './uploads')),
    maxBytes: Math.round(num('MAX_UPLOAD_MB', 8) * 1024 * 1024),
    maxDimension: 2000,
  },
  embeddings: {
    // The embedder sidecar (embedder/, compose service `embedder`) serves
    // clip-ViT-L/14 and returns 768-dim L2-normalised vectors. The model is
    // baked into that image at build time; nothing is downloaded at runtime.
    modelId: 'clip-ViT-L-14',
    dimensions: 768,
    // Internal compose address. For bare `npm run dev` on the host, point this
    // at a reachable embedder (e.g. a locally published port).
    url: str('EMBEDDER_URL', 'http://embedder:8000'),
  },
  matching: {
    /**
     * Calibrated similarity a candidate must reach to become a possible match.
     * Every score is calibrated first: raw cosine minus MATCH_BASELINE,
     * rescaled to 0-1 (see lib/match.ts), so the noise floor of unrelated
     * photos calibrates to ~0 instead of ~0.6.
     *
     * Deliberately low for now (0.45): the bar is set this way only to collect
     * real pairs — the same object photographed twice, and different but
     * similar objects — so the final value can be placed where true matches and
     * false matches actually land. Raise it from the `raw=`/`calibrated=`
     * numbers in the `[match]` and `[photo-search]` log lines, never a guess.
     */
    threshold: num('MATCH_THRESHOLD', 0.45),
    /** Candidates requested from pgvector per report. */
    topK: num('MATCH_TOP_K', 10),
    /** Ranking bonus when the reported colours look like the same colour. */
    colorBoost: num('MATCH_COLOR_BOOST', 0.02),
    /** Candidates offered to the UI at most. */
    maxResults: 10,
    /**
     * How many below-threshold candidates the read-only photo search may show
     * as "closest on file" when nothing clears the match bar. The bar itself
     * never moves: these are leads for a person, not matches.
     */
    nearMissCount: num('PHOTO_SEARCH_NEAR_MISSES', 3),
    /**
     * Lowest CALIBRATED similarity a near miss may have — the same space as
     * the threshold above. NOTE: with MATCH_BASELINE 0.6, a floor of 0.6 means
     * a raw cosine of ~0.84, which hides most genuinely similar pairs; expect
     * to lower it (0.25 calibrated ≈ raw 0.70) once the batch tuning run has
     * produced real numbers.
     */
    nearMissFloor: num('PHOTO_SEARCH_NEAR_MISS_FLOOR', 0.6),
  },
} as const

export const SESSION_TTL_SECONDS = config.auth.sessionTtlDays * 24 * 60 * 60

/** MIME types accepted for item photos. */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** MIME type -> file extension used when storing photos. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

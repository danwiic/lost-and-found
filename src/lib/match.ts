import { Prisma } from '@/generated/prisma/client'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'
import { toVectorLiteral } from '@/lib/embed'
import { notifyMany, type NotificationInput } from '@/lib/notifications'

export type ItemType = 'LOST' | 'FOUND'

/**
 * Raw cosine floor for score calibration. Raw CLIP similarity has a high noise
 * floor — unrelated photos routinely score 0.55–0.65 from shared composition
 * and lighting alone — so every comparison is rescaled onto a 0–1 scale where
 * the noise floor sits near zero:
 *
 *   calibrated = max(0, (raw - MATCH_BASELINE) / (1 - MATCH_BASELINE))
 *
 * Calibrated scores are what gets displayed and thresholded everywhere (the
 * match bar, near-miss ranking, UI labels); the raw value travels alongside for
 * logging and tuning only. Start at 0.6 and re-tune from the `raw=` /
 * `calibrated=` pairs the `[match]` and `[photo-search]` lines accumulate
 * across real photo pairs.
 */
export const MATCH_BASELINE = parseBaseline()

function parseBaseline(): number {
  const raw = process.env.MATCH_BASELINE
  if (raw === undefined || raw === '') return 0.6
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    throw new Error(`MATCH_BASELINE must be a number strictly between 0 and 1, received "${raw}"`)
  }
  return parsed
}

/** Rescales one raw cosine similarity onto the calibrated 0–1 scale. */
export function calibrateSimilarity(rawSimilarity: number): number {
  return Math.max(0, (rawSimilarity - MATCH_BASELINE) / (1 - MATCH_BASELINE))
}

/**
 * The inverse of calibrateSimilarity. A stored Match row keeps only the
 * calibrated score, and the debug view wants the raw number the two photos
 * actually scored — this recovers it exactly.
 */
export function rawFromCalibrated(calibrated: number): number {
  return calibrated * (1 - MATCH_BASELINE) + MATCH_BASELINE
}

/** A row returned by the pgvector similarity query. */
type CandidateRow = {
  id: string
  name: string
  description: string
  type: ItemType
  color: string | null
  location: string
  status: string
  imagePath: string | null
  dateEvent: Date
  createdAt: Date
  reporterId: string
  reporterName: string
  /** Calibrated similarity (raw cosine rescaled from MATCH_BASELINE). */
  similarity: number
  /** Raw cosine similarity from pgvector — logging and tuning only. */
  rawSimilarity: number
}

export type MatchCandidate = {
  matchId: string
  itemId: string
  name: string
  type: ItemType
  color: string | null
  location: string
  status: string
  imagePath: string | null
  dateEvent: Date
  reporterName: string
  /** Calibrated similarity — the number the bar is applied to. */
  similarity: number
  /** Raw cosine the calibrated score came from: logging and tuning only. */
  raw: number
  /** similarity + colour bonus, used for ranking only. */
  score: number
  colorMatch: boolean
}

export type MatchOutcome = {
  matches: MatchCandidate[]
  /** True when at least one brand new Match row was created. */
  created: boolean
}

/** A candidate with the numbers the ranking and the log care about. */
type ScoredCandidate = {
  candidate: CandidateRow
  similarity: number
  score: number
  colorMatch: boolean
  /** False when the category gate excluded the pair outright. */
  nameCompatible: boolean
}

const COLOR_STOP_WORDS = new Set([
  'with',
  'and',
  'the',
  'color',
  'colour',
  'dark',
  'light',
  'ish',
])

function colorTokens(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !COLOR_STOP_WORDS.has(token))
}

/**
 * Deliberately forgiving: "navy blue" and "blue" count as the same colour so the
 * free-text colour field can nudge the ranking without hiding real matches.
 */
export function colorsLookSimilar(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = new Set(colorTokens(a))
  if (left.size === 0) return false
  return colorTokens(b).some((token) => left.has(token))
}

/**
 * Tokens that say where or how an item was reported, not what it is. Names are
 * free text ("backpack lost at the library"), so the category gate compares
 * only the descriptive words.
 */
const NAME_STOP_WORDS = new Set([
  'lost',
  'found',
  'near',
  'the',
  'and',
  'with',
  'at',
  'in',
  'on',
  'of',
  'my',
  'item',
  'report',
  'case',
  'other',
  'from',
  'left',
  'handed',
])

/**
 * Descriptive tokens of an item name — the closest thing to a category the data
 * model has. Used only by the hard gate below, never for ranking.
 */
export function categoryTokens(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !NAME_STOP_WORDS.has(token))
}

/**
 * Hard category gate, not a ranking nudge: when both items carry descriptive
 * names and the two token sets share nothing at all, the pair is treated as
 * different kinds of object and excluded from results entirely — a photograph
 * can look alike while the words say "headphones" and "wallet". When either
 * side has no usable name, the gate does not apply and the pair stands.
 */
export function namesLookCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = categoryTokens(a)
  if (left.length === 0) return true
  return categoryTokens(b).some((token) => left.includes(token))
}

/**
 * What a reported item may be matched against: open, and not yet spoken for by a
 * claim. Changing this changes report matching, so it is deliberately its own
 * constant.
 */
export const MATCHABLE_STATUSES = ['PENDING', 'POSSIBLE_MATCH'] as const

/**
 * What the read-only photo search may return: everything still physically in the
 * office, including items whose claim is already being verified. A searcher is
 * allowed to see that an item is spoken for — the status is shown on the result.
 */
export const SEARCHABLE_STATUSES = ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING'] as const

/**
 * Ordered cosine-distance search over open items of the given types. Raw SQL is
 * required because Item.embedding is an Unsupported("vector") column that Prisma
 * Client cannot address.
 *
 * `types` holds one type (report matching searches the opposite side) or both
 * (the photo search). `statuses` defaults to the report-matching set so existing
 * behaviour is unchanged.
 *
 * The SQL speaks raw cosine distance; the rows come back calibrated, with the
 * raw value kept alongside for logging. This is the single choke point, so
 * report matching and the photo search can never disagree about a score.
 */
export async function findSimilarItems(options: {
  embedding: number[]
  types: ItemType[]
  statuses?: readonly string[]
  excludeItemId?: string
  topK?: number
}): Promise<CandidateRow[]> {
  const vectorLiteral = toVectorLiteral(options.embedding)
  const topK = Math.max(1, Math.floor(options.topK ?? config.matching.topK))
  // An empty list would render as `IN ()`, which is a syntax error.
  const types: ItemType[] = options.types.length > 0 ? options.types : ['LOST', 'FOUND']
  const statuses: string[] = [...(options.statuses ?? MATCHABLE_STATUSES)]
  // An empty string can never equal a cuid, so this always excludes the new row.
  const excludeItemId = options.excludeItemId ?? ''

  const rows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT
      i.id,
      i.name,
      i.description,
      i.type,
      i.color,
      i.location,
      i.status,
      i."imagePath",
      i."dateEvent",
      i."createdAt",
      i."reporterId",
      u.name AS "reporterName",
      1 - (i.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM "Item" i
    JOIN "User" u ON u.id = i."reporterId"
    WHERE i.type IN (${Prisma.join(types)})
      AND i.status IN (${Prisma.join(statuses)})
      AND i.embedding IS NOT NULL
      AND i.id <> ${excludeItemId}
    ORDER BY i.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((row) => {
    const rawSimilarity = Number(row.similarity)
    return { ...row, rawSimilarity, similarity: calibrateSimilarity(rawSimilarity) }
  })
}

/**
 * Logs one matching run, every candidate included — above *and* below the
 * threshold — because the threshold can only be tuned from real scores. The
 * `[match]` lines are the tuning surface: each line carries the candidate id,
 * the raw cosine and the calibrated score, so MATCH_BASELINE and
 * MATCH_THRESHOLD can be set from accumulated measurements instead of guesses.
 *
 *   [match] FOUND "Blue backpack" (cuid) vs 3 open LOST candidate(s), baseline=0.60, threshold=0.870
 *   [match]   raw=0.9126 calibrated=0.7815  colour~match  "Navy backpack, library" (cuid) -> MATCH (rank score 0.8015)
 *   [match]   raw=0.8370 calibrated=0.5925  colour=no     "Black headphones" (cuid) -> 0.2775 short of the threshold
 *   [match] FOUND "Blue backpack": 1 match row(s), 1 notice(s) written.
 */
function logMatchRun(run: {
  itemId: string
  type: ItemType
  name: string
  targetType: ItemType
  scored: ScoredCandidate[]
  matchCount: number
  notifiedCount: number
}): void {
  const threshold = config.matching.threshold
  console.log(
    `[match] ${run.type} "${run.name}" (${run.itemId}) vs ${run.scored.length} open ` +
      `${run.targetType} candidate(s), baseline=${MATCH_BASELINE.toFixed(2)}, threshold=${threshold.toFixed(3)}`,
  )

  for (const entry of run.scored) {
    const verdict = !entry.nameCompatible
      ? 'excluded: item name mismatch'
      : entry.similarity >= threshold
        ? `MATCH (rank score ${entry.score.toFixed(4)})`
        : `${(threshold - entry.similarity).toFixed(4)} short of the threshold`
    console.log(
      `[match]   raw=${entry.candidate.rawSimilarity.toFixed(4)} ` +
        `calibrated=${entry.similarity.toFixed(4)}  ` +
        `${entry.colorMatch ? 'colour~match' : 'colour=no   '}  ` +
        // Type and category sit next to the score so the dataset can answer
        // "would filtering on category separate true from false better than
        // similarity alone?" without re-running anything.
        `type=${entry.candidate.type} ` +
        `category="${categoryTokens(entry.candidate.name).join('|')}"  ` +
        `"${entry.candidate.name}" (${entry.candidate.id}) -> ${verdict}`,
    )
  }

  if (run.matchCount === 0) {
    const nearest = run.scored[0]
    console.log(
      nearest
        ? `[match] ${run.type} "${run.name}": no match rows; nearest candidate scored ` +
            `${nearest.similarity.toFixed(4)}, ${(threshold - nearest.similarity).toFixed(4)} below the threshold.`
        : `[match] ${run.type} "${run.name}": no open ${run.targetType} item has an embedding yet, ` +
            'so there was nothing to compare against.',
    )
    return
  }

  console.log(
    `[match] ${run.type} "${run.name}": ${run.matchCount} match row(s), ` +
      `${run.notifiedCount} notice(s) written to the lost side.`,
  )
}

/**
 * Runs the matching pipeline for a freshly reported item: finds opposite-type
 * candidates, stores Match rows, flips open items to POSSIBLE_MATCH and writes
 * the possible-match notice.
 *
 * The reporter of the new item gets the candidates straight back in the API
 * response. The *notice* always goes to the LOST side of the pair, because that
 * is the person looking for something:
 *
 *   - a newly reported found item that matches an open lost report notifies that
 *     lost report's owner — the "report a found item, the owner is alerted" flow;
 *   - a newly reported lost item that matches a found item already on file
 *     notifies the person who just reported it, so the result outlives the
 *     confirmation screen they are looking at.
 *
 * A finder is never sent a notice: their half of the flow ends with the turn-over
 * of the physical item to OSAS, which they already know to do. The notice's
 * `itemId` is always the recipient's own item, so "My Reports" can deep-link.
 */
export async function matchNewItem(options: {
  itemId: string
  type: ItemType
  name: string
  color: string | null
  embedding: number[]
  /** Who reported the new item; the recipient of a notice when it is the lost side. */
  reporterId: string
}): Promise<MatchOutcome> {
  const targetType: ItemType = options.type === 'LOST' ? 'FOUND' : 'LOST'

  const candidates = await findSimilarItems({
    embedding: options.embedding,
    types: [targetType],
    excludeItemId: options.itemId,
  })

  // Every candidate is scored and logged; only the ones at or above the
  // threshold become Match rows.
  const scored: ScoredCandidate[] = candidates
    .map((candidate) => {
      const similarity = Number(candidate.similarity)
      const colorMatch = colorsLookSimilar(options.color, candidate.color)
      return {
        candidate,
        similarity,
        colorMatch,
        score: similarity + (colorMatch ? config.matching.colorBoost : 0),
        // Hard gate: two items whose names describe different kinds of object
        // never become a Match row, however alike their photos look. The
        // exclusion is logged below so it can be audited.
        nameCompatible: namesLookCompatible(options.name, candidate.name),
      }
    })
    .sort((a, b) => b.score - a.score)

  const aboveThreshold = scored
    .filter((entry) => entry.similarity >= config.matching.threshold && entry.nameCompatible)
    .slice(0, config.matching.maxResults)

  const matches: MatchCandidate[] = []
  const notifications: NotificationInput[] = []
  let created = false

  for (const entry of aboveThreshold) {
    const { candidate } = entry
    // Match rows are always stored lost -> found so a pair stays unique.
    const lostItemId = options.type === 'LOST' ? options.itemId : candidate.id
    const foundItemId = options.type === 'FOUND' ? options.itemId : candidate.id

    const existing = await prisma.match.findUnique({
      where: { lostItemId_foundItemId: { lostItemId, foundItemId } },
      select: { id: true },
    })

    const match = existing
      ? await prisma.match.update({
          where: { id: existing.id },
          data: { similarity: entry.similarity },
          select: { id: true },
        })
      : await prisma.match.create({
          data: { lostItemId, foundItemId, similarity: entry.similarity },
          select: { id: true },
        })

    if (!existing) {
      created = true

      // Both sides of the pair are told, whichever item arrived second, and
      // each notice points at the OTHER item: the recipient's own report is what
      // they already know, the counterpart is the news. Naming the two sides
      // once here also keeps the wording right in both arrival orders.
      const percent = Math.round(entry.similarity * 100)
      const newIsLost = options.type === 'LOST'
      const lost = newIsLost
        ? { id: options.itemId, name: options.name, reporterId: options.reporterId }
        : { id: candidate.id, name: candidate.name, reporterId: candidate.reporterId }
      const found = newIsLost
        ? { id: candidate.id, name: candidate.name, reporterId: candidate.reporterId }
        : { id: options.itemId, name: options.name, reporterId: options.reporterId }
      const arrivedLost = newIsLost
        ? `a newly reported lost item "${lost.name}"`
        : `a lost item already on file, "${lost.name}",`
      const arrivedFound = newIsLost
        ? `a found item already on file, "${found.name}",`
        : `a newly reported found item "${found.name}"`

      const pairNotices: Omit<NotificationInput, 'type' | 'matchId'>[] = [
        {
          userId: lost.reporterId,
          itemId: found.id,
          message:
            `Possible match for your lost report "${lost.name}": ` +
            `${arrivedFound} is ${percent}% similar.`,
        },
        {
          userId: found.reporterId,
          itemId: lost.id,
          message:
            `Possible match for your found report "${found.name}": ` +
            `${arrivedLost} is ${percent}% similar.`,
        },
      ]

      const told = new Set<string>()
      for (const notice of pairNotices) {
        // One person can be both sides of a pair; they hear about it once.
        if (told.has(notice.userId)) continue
        told.add(notice.userId)
        notifications.push({ ...notice, type: 'POSSIBLE_MATCH', matchId: match.id })
      }
    }

    matches.push({
      matchId: match.id,
      itemId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      color: candidate.color,
      location: candidate.location,
      status: candidate.status,
      imagePath: candidate.imagePath,
      dateEvent: candidate.dateEvent,
      reporterName: candidate.reporterName,
      similarity: entry.similarity,
      raw: candidate.rawSimilarity,
      score: entry.score,
      colorMatch: entry.colorMatch,
    })
  }

  if (aboveThreshold.length > 0) {
    // Both sides of a match are now "possible match" material.
    await prisma.item.updateMany({
      where: {
        id: { in: [options.itemId, ...matches.map((match) => match.itemId)] },
        status: 'PENDING',
      },
      data: { status: 'POSSIBLE_MATCH' },
    })

    await notifyMany(notifications)
  }

  logMatchRun({
    itemId: options.itemId,
    type: options.type,
    name: options.name,
    targetType,
    scored,
    matchCount: matches.length,
    notifiedCount: notifications.length,
  })

  return { matches, created }
}

/**
 * Matches that involve one item, resolved to the opposite side so the UI can
 * render "your item <-> candidate item" rows with a similarity score.
 */
export async function listMatchesForItem(itemId: string): Promise<MatchCandidate[]> {
  const rows = await prisma.match.findMany({
    where: { OR: [{ lostItemId: itemId }, { foundItemId: itemId }] },
    orderBy: { similarity: 'desc' },
    include: {
      lostItem: { include: { reporter: { select: { name: true } } } },
      foundItem: { include: { reporter: { select: { name: true } } } },
    },
  })

  return rows.map((row) => {
    const other = row.lostItemId === itemId ? row.foundItem : row.lostItem
    return {
      matchId: row.id,
      itemId: other.id,
      name: other.name,
      type: other.type as ItemType,
      color: other.color,
      location: other.location,
      status: other.status,
      imagePath: other.imagePath,
      dateEvent: other.dateEvent,
      reporterName: other.reporter.name,
      similarity: row.similarity,
      // A stored Match row keeps only the calibrated score; recover the raw one
      // so the debug view can show both.
      raw: rawFromCalibrated(row.similarity),
      score: row.similarity,
      colorMatch: false,
    }
  })
}

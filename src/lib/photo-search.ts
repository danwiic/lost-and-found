import { config } from '@/lib/config'
import { embedImageBuffer } from '@/lib/embed'
import {
  findSimilarItems,
  MATCH_BASELINE,
  SEARCHABLE_STATUSES,
  type ItemType,
} from '@/lib/match'
import type { RecordRow } from '@/lib/records'
import type { SessionUser } from '@/lib/session'

/**
 * Read-only search: find items that look like an uploaded photo, without filing
 * a report. It shares the embedding pipeline, the similarity threshold and the
 * top-10 limit with report matching, so a score here means the same thing a score
 * means there.
 *
 * Nothing is written. No Match row, no Notification, no Item, and the uploaded
 * photo is never stored on disk.
 */

/** Which side of the ledger to look at. */
export type PhotoSearchScope = 'BOTH' | 'LOST' | 'FOUND'

export const PHOTO_SEARCH_SCOPES: readonly PhotoSearchScope[] = ['BOTH', 'LOST', 'FOUND']

/** A search result is a record plus the one thing the search adds: its score. */
export type PhotoMatch = RecordRow & {
  /** Calibrated similarity between the uploaded photo and this item's photo. */
  similarity: number
  /** Raw cosine the calibration came from — logging and tuning only. */
  rawSimilarity: number
}

export type PhotoSearchResult = {
  matches: PhotoMatch[]
  /**
   * The closest below-threshold candidates, present only when `matches` is
   * empty: leads for a person to judge, never a replacement for the bar.
   */
  nearMisses: PhotoMatch[]
  /** The similarity a candidate had to reach to be returned. */
  threshold: number
  /** Lowest similarity a near miss may have. */
  nearMissFloor: number
  /** How many candidates were asked of the vector index. */
  topK: number
  scope: PhotoSearchScope
  searchedTypes: ItemType[]
}

function typesForScope(scope: PhotoSearchScope): ItemType[] {
  return scope === 'BOTH' ? ['LOST', 'FOUND'] : [scope]
}

export async function searchItemsByPhoto(input: {
  viewer: SessionUser
  photoBuffer: Buffer
  scope: PhotoSearchScope
  topK?: number
}): Promise<PhotoSearchResult> {
  const embedding = await embedImageBuffer(input.photoBuffer)
  const searchedTypes = typesForScope(input.scope)
  const topK = Math.max(1, Math.floor(input.topK ?? config.matching.topK))

  const candidates = await findSimilarItems({
    embedding,
    types: searchedTypes,
    // Everything still in the office, including items already claimed.
    statuses: SEARCHABLE_STATUSES,
    topK,
  })

  const scored: PhotoMatch[] = candidates
    .map((candidate) => ({
      id: candidate.id,
      type: candidate.type,
      name: candidate.name,
      description: candidate.description,
      color: candidate.color,
      location: candidate.location,
      dateEvent: candidate.dateEvent.toISOString(),
      status: candidate.status,
      photoUrl: candidate.imagePath ? `/api/files/${candidate.imagePath}` : null,
      createdAt: candidate.createdAt.toISOString(),
      // Candidate counts are private to the item's owner and to OSAS staff, so a
      // search result never advertises someone else's matches (see lib/records.ts).
      // The score below is what this screen has to say about the item.
      matchCount: 0,
      isMine: candidate.reporterId === input.viewer.id,
      reporterName: candidate.reporterName,
      similarity: candidate.similarity,
      rawSimilarity: candidate.rawSimilarity,
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const matches = scored.filter((match) => match.similarity >= config.matching.threshold)

  // Every comparison is logged with both scales — this is the tuning surface:
  // run a batch of same-object and different-object pairs through search and
  // set MATCH_BASELINE and MATCH_THRESHOLD from these numbers.
  for (const candidate of scored) {
    console.log(
      `[photo-search] item=${candidate.id} raw=${candidate.rawSimilarity.toFixed(4)} ` +
        `calibrated=${candidate.similarity.toFixed(4)} "${candidate.name}"`,
    )
  }

  // Nothing cleared the bar. The closest few candidates are still worth showing
  // as leads for a person to judge — but they are not matches, and they never
  // cross the threshold line.
  if (matches.length === 0) {
    const nearMisses = scored
      .filter((match) => match.similarity >= config.matching.nearMissFloor)
      .slice(0, config.matching.nearMissCount)
    console.log(
      `[photo-search] 0 above threshold=${config.matching.threshold.toFixed(3)} ` +
        `(baseline=${MATCH_BASELINE.toFixed(2)}); showing ${nearMisses.length} near miss(es), ` +
        (nearMisses.length > 0
          ? `best ${nearMisses[0].similarity.toFixed(4)}.`
          : 'none above the near-miss floor.'),
    )
    return {
      matches,
      nearMisses,
      threshold: config.matching.threshold,
      nearMissFloor: config.matching.nearMissFloor,
      topK,
      scope: input.scope,
      searchedTypes,
    }
  }

  console.log(
    `[photo-search] ${matches.length} match(es) above threshold=${config.matching.threshold.toFixed(3)}, ` +
      `best ${matches[0].similarity.toFixed(4)}.`,
  )

  return {
    matches,
    nearMisses: [],
    threshold: config.matching.threshold,
    nearMissFloor: config.matching.nearMissFloor,
    topK,
    scope: input.scope,
    searchedTypes,
  }
}

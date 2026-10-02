import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { calibrateSimilarity, MATCH_BASELINE } from '@/lib/match'
import { config } from '@/lib/config'

/**
 * The matching lab: a labelled dataset of photo pairs, built up across sessions
 * so MATCH_BASELINE and MATCH_THRESHOLD can be set from measurements instead of
 * from one-off experiments that vanish into a chat log.
 *
 * Every pair is stored as one line of JSON (JSONL) under MATCHING_LAB_DIR —
 * append-only, human-readable, diffable, and safe to open with any tool. The
 * file is the dataset; the summary below is only a convenience view of it.
 *
 * Nothing here runs as part of normal matching: this module is used solely by
 * the dev-only endpoint behind `POST /api/dev/matching-lab` (ADMIN only).
 */

export type LabLabel = 'SAME' | 'DIFFERENT'

export type LabPhoto = {
  name: string
  bytes: number
  /** Identifies the same file across runs, so a pair is never double-counted by accident. */
  sha256: string
}

export type LabResult = {
  at: string
  label: LabLabel
  /** Free text — what kind of object this is ("wallet", "speaker"). Optional. */
  category: string | null
  note: string | null
  /** Raw cosine similarity between the two photo embeddings. */
  raw: number
  /** raw, rescaled from MATCH_BASELINE onto 0–1. */
  calibrated: number
  /** The constants in force when the pair was measured. */
  baseline: number
  threshold: number
  /** Whether this pair would have matched at the threshold in force. */
  wouldMatch: boolean
  /** Whether `wouldMatch` agrees with the human label (`SAME` -> true). */
  agrees: boolean
  photoA: LabPhoto
  photoB: LabPhoto
}

export type LabStats = {
  count: number
  mean: number
  min: number
  max: number
}

export type LabSummary = {
  pairs: number
  same: LabStats | null
  different: LabStats | null
  /**
   * A threshold that would separate the labelled sets, when they do not overlap:
   * the midpoint between the lowest SAME score and the highest DIFFERENT score.
   * Null while the sets overlap or one side has no data — never a guess.
   */
  suggested: number | null
  /** Highest DIFFERENT score seen: any threshold at or below it would admit a false match. */
  highestDifferent: number | null
  /** Lowest SAME score seen: any threshold above it would drop a true match. */
  lowestSame: number | null
  /** How many stored pairs the current threshold gets wrong. */
  disagreements: Array<{ at: string; label: LabLabel; calibrated: number; category: string | null }>
}

function labDir(): string {
  return path.resolve(process.env.MATCHING_LAB_DIR ?? './matching-lab')
}

function labFile(): string {
  return path.join(labDir(), 'results.jsonl')
}

/** Cosine similarity. Both vectors come from the embedder already L2-normalised. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function describePhoto(name: string, buffer: Buffer): LabPhoto {
  return {
    name,
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

/** Measures one labelled pair. Pure: nothing is stored here. */
export function measurePair(input: {
  label: LabLabel
  category: string | null
  note: string | null
  embeddingA: number[]
  embeddingB: number[]
  photoA: LabPhoto
  photoB: LabPhoto
}): LabResult {
  const raw = cosineSimilarity(input.embeddingA, input.embeddingB)
  const calibrated = calibrateSimilarity(raw)
  const threshold = config.matching.threshold
  const wouldMatch = calibrated >= threshold

  return {
    at: new Date().toISOString(),
    label: input.label,
    category: input.category,
    note: input.note,
    raw,
    calibrated,
    baseline: MATCH_BASELINE,
    threshold,
    wouldMatch,
    agrees: wouldMatch === (input.label === 'SAME'),
    photoA: input.photoA,
    photoB: input.photoB,
  }
}

/** Appends one measured pair to the dataset file, creating the folder if needed. */
export async function appendLabResult(result: LabResult): Promise<void> {
  await mkdir(labDir(), { recursive: true })
  await appendFile(labFile(), `${JSON.stringify(result)}\n`, 'utf8')
}

/** Every stored pair, oldest first. A missing file is an empty dataset, not an error. */
export async function readLabResults(): Promise<LabResult[]> {
  let contents: string
  try {
    contents = await readFile(labFile(), 'utf8')
  } catch {
    return []
  }

  const results: LabResult[] = []
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      results.push(JSON.parse(trimmed) as LabResult)
    } catch {
      // A half-written or hand-edited line must not take the whole dataset down.
    }
  }
  return results
}

function stats(scores: number[]): LabStats | null {
  if (scores.length === 0) return null
  const sum = scores.reduce((total, value) => total + value, 0)
  return {
    count: scores.length,
    mean: sum / scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
  }
}

export function summarizeLabResults(results: LabResult[]): LabSummary {
  const same = results.filter((result) => result.label === 'SAME').map((r) => r.calibrated)
  const different = results.filter((result) => result.label === 'DIFFERENT').map((r) => r.calibrated)

  const sameStats = stats(same)
  const differentStats = stats(different)
  const lowestSame = sameStats ? sameStats.min : null
  const highestDifferent = differentStats ? differentStats.max : null

  // Only suggest a value when the labelled sets are actually separable. When
  // they overlap there is no threshold that gets everything right, and the
  // honest answer is to say so rather than pick a number.
  const suggested =
    lowestSame !== null && highestDifferent !== null && lowestSame > highestDifferent
      ? (lowestSame + highestDifferent) / 2
      : null

  return {
    pairs: results.length,
    same: sameStats,
    different: differentStats,
    suggested,
    highestDifferent,
    lowestSame,
    disagreements: results
      .filter((result) => !result.agrees)
      .map((result) => ({
        at: result.at,
        label: result.label,
        calibrated: result.calibrated,
        category: result.category,
      })),
  }
}

import type { NextRequest } from 'next/server'
import { handleRoute, json, readBody } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { embedImageBuffer } from '@/lib/embed'
import {
  appendLabResult,
  describePhoto,
  measurePair,
  readLabResults,
  summarizeLabResults,
  type LabLabel,
} from '@/lib/matching-lab'
import { assertPhotoFile, preparePhotoBuffer } from '@/lib/uploads'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const LABELS = ['SAME', 'DIFFERENT'] as const

/**
 * The matching lab — a dev tool for building the labelled dataset that
 * MATCH_BASELINE and MATCH_THRESHOLD are tuned from.
 *
 * `GET` returns the summary of everything measured so far: how the labelled
 * scores are distributed, whether the two sets currently separate, and which
 * threshold would split them.
 *
 * `POST` takes two photos and a human label (SAME = both photos are the same
 * object, DIFFERENT = they are not), measures them with the *real* matching
 * pipeline — the same embedder, the same cosine, the same calibration — and
 * appends the measurement to `MATCHING_LAB_DIR/results.jsonl`.
 *
 * ADMIN-only, and deliberately not part of the product: it reads nothing from
 * the database, writes nothing to it (not one Item, Match or Notification), and
 * stores nothing but the numbers and the two file hashes.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin(request)
    const results = await readLabResults()
    return json({ summary: summarizeLabResults(results) })
  })
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin(request)
    const body = await readBody(request)
    const fields = new Fields(body)

    const label = fields.requiredEnum('label', 'Label', LABELS) as LabLabel
    const category = fields.optionalText('category', 'Category', { max: 60 })
    const note = fields.optionalText('note', 'Note', { max: 200 })

    const photoA = fields.files('photoA')[0]
    const photoB = fields.files('photoB')[0]
    if (!photoA || !photoB) {
      throw new ValidationError({
        ...(photoA ? {} : { photoA: 'Choose the first photo.' }),
        ...(photoB ? {} : { photoB: 'Choose the second photo.' }),
      })
    }
    fields.throwIfInvalid()

    // The same validation and normalisation every upload goes through, so a
    // measured score is comparable with a score the product would produce.
    assertPhotoFile(photoA)
    assertPhotoFile(photoB)
    const preparedA = await preparePhotoBuffer(Buffer.from(await photoA.arrayBuffer()))
    const preparedB = await preparePhotoBuffer(Buffer.from(await photoB.arrayBuffer()))

    const [embeddingA, embeddingB] = await Promise.all([
      embedImageBuffer(preparedA.buffer),
      embedImageBuffer(preparedB.buffer),
    ])

    const result = measurePair({
      label,
      category: category ?? null,
      note: note ?? null,
      embeddingA,
      embeddingB,
      photoA: describePhoto(photoA.name || 'photo-a', preparedA.buffer),
      photoB: describePhoto(photoB.name || 'photo-b', preparedB.buffer),
    })

    await appendLabResult(result)

    // Same shape as the [match] / [photo-search] lines, so one grep finds every
    // measurement the system has ever taken.
    console.log(
      `[matching-lab] label=${result.label} category="${result.category ?? ''}" ` +
        `raw=${result.raw.toFixed(4)} calibrated=${result.calibrated.toFixed(4)} ` +
        `baseline=${result.baseline.toFixed(2)} threshold=${result.threshold.toFixed(3)} ` +
        `-> ${result.wouldMatch ? 'would MATCH' : 'would NOT match'} (${result.agrees ? 'agrees' : 'disagrees'} with the label)`,
    )

    return json({ result, summary: summarizeLabResults(await readLabResults()) }, 201)
  })
}

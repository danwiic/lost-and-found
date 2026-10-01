import type { NextRequest } from 'next/server'
import { ApiError, badRequest, handleRoute, json, readBody } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import {
  PHOTO_SEARCH_SCOPES,
  searchItemsByPhoto,
  type PhotoSearchScope,
  type PhotoSearchResult,
} from '@/lib/photo-search'
import { assertPhotoFile, preparePhotoBuffer } from '@/lib/uploads'
import { Fields, ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/items/photo-search` — multipart with a `photo` part and an optional
 * `type` of LOST | FOUND | BOTH (default BOTH).
 *
 * Read-only on purpose: it embeds the upload with the same pipeline report
 * matching uses, searches open items of the selected types by cosine similarity
 * with the same threshold and the same top-10 limit, and returns them with their
 * scores. When nothing clears the bar it also returns the closest below-bar
 * candidates as `nearMisses` so a search never dead-ends. It writes nothing — no
 * Item, no Match row, no Notification — and the uploaded photo is never stored.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const viewer = await requireUser(request)
    const body = await readBody(request)
    const fields = new Fields(body)

    const rawScope = fields.optionalText('type', 'Item type', { max: 10 })
    const scope = (rawScope ?? 'BOTH').toUpperCase() as PhotoSearchScope
    if (!PHOTO_SEARCH_SCOPES.includes(scope)) {
      throw badRequest(`Type must be one of: ${PHOTO_SEARCH_SCOPES.join(', ')}.`)
    }

    const photo = fields.files('photo')[0]
    if (!photo) {
      throw new ValidationError({ photo: 'Choose a photo to search with.' })
    }
    fields.throwIfInvalid()

    // Same validation as reporting: a wrong Content-Type cannot smuggle a
    // non-image in, and the size cap is the one in config.
    assertPhotoFile(photo)
    const prepared = await preparePhotoBuffer(Buffer.from(await photo.arrayBuffer()))

    let result: PhotoSearchResult
    try {
      result = await searchItemsByPhoto({ viewer, photoBuffer: prepared.buffer, scope })
    } catch (error) {
      // The photo was readable; the model was not. Say which, and what to do.
      console.error('[photo-search] embedding or search failed:', error)
      throw new ApiError(
        503,
        "The matching service isn't answering right now. Try the search again in a moment.",
      )
    }

    return json({
      ...result,
      count: result.matches.length,
      nearMissCount: result.nearMisses.length,
    })
  })
}

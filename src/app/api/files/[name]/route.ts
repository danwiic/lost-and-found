import type { NextRequest } from 'next/server'
import { handleRoute, notFound } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { isSafePhotoName, photoContentType, readPhoto, renderPhotoVariant } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ name: string }> }

/**
 * Streams a stored photo from UPLOAD_DIR. Photos are private to signed-in users,
 * and `?w=480` returns a downscaled copy for list views.
 */
export async function GET(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    await requireUser(request)

    const { name } = await context.params
    if (!isSafePhotoName(name)) throw notFound('Photo not found.')

    const requestedWidth = Number(request.nextUrl.searchParams.get('w') ?? '')
    const width = Number.isFinite(requestedWidth) && requestedWidth > 0 ? Math.round(requestedWidth) : 0

    try {
      const buffer =
        width > 0
          ? await renderPhotoVariant(name, Math.min(width, 1600))
          : await readPhoto(name)

      return new Response(new Uint8Array(buffer), {
        headers: {
          'content-type': photoContentType(name),
          // File names are random UUIDs, so the content never changes.
          'cache-control': 'private, max-age=31536000, immutable',
        },
      })
    } catch {
      throw notFound('Photo not found.')
    }
  })
}

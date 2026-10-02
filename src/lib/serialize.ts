import type { AuthedUser } from '@/lib/auth'

/**
 * Structural input types: they describe the shape we read, so the serialisers do
 * not depend on how Prisma names its generated model types.
 */
export type ReporterLike = {
  id: string
  name: string
  email?: string
  studentId?: string | null
  contact?: string | null
}

export type ItemLike = {
  id: string
  type: string
  name: string
  description: string
  color: string | null
  dateEvent: Date
  location: string
  additionalDetails: string | null
  imagePath: string | null
  status: string
  finderName?: string | null
  finderContact?: string | null
  reporterId: string
  createdAt: Date
  updatedAt: Date
  reporter?: ReporterLike | null
}

export type ItemSummary = ReturnType<typeof toItemSummary>
export type ItemDetail = ReturnType<typeof toItemDetail>

function photoUrl(imagePath: string | null): string | null {
  return imagePath ? `/api/files/${imagePath}` : null
}

/**
 * The finder's identity is recorded for the office's chain of custody, not for
 * the public record: only OSAS staff and the account the report sits under see
 * it. Everyone else reads the report without it.
 */
function canSeeFinder(item: ItemLike, viewer?: AuthedUser | null): boolean {
  if (!viewer) return false
  return viewer.role === 'ADMIN' || viewer.id === item.reporterId
}

/** Shape used by browse lists, dashboards and My Reports. */
export function toItemSummary(item: ItemLike, viewer?: AuthedUser | null) {
  return {
    id: item.id,
    type: item.type as 'LOST' | 'FOUND',
    name: item.name,
    description: item.description,
    color: item.color,
    dateEvent: item.dateEvent.toISOString(),
    location: item.location,
    status: item.status,
    photoUrl: photoUrl(item.imagePath),
    finderName: canSeeFinder(item, viewer) ? (item.finderName ?? null) : null,
    finderContact: canSeeFinder(item, viewer) ? (item.finderContact ?? null) : null,
    reporterId: item.reporterId,
    reporterName: item.reporter?.name ?? null,
    isMine: viewer?.id === item.reporterId,
    createdAt: item.createdAt.toISOString(),
  }
}

/**
 * Full record for the Item Details page. Contact details of the reporter are
 * only exposed to the owner and to OSAS staff.
 */
export function toItemDetail(item: ItemLike, viewer?: AuthedUser | null) {
  const isOwner = viewer?.id === item.reporterId
  const isAdmin = viewer?.role === 'ADMIN'
  const canSeeContact = Boolean(viewer) && (isOwner || isAdmin)

  return {
    ...toItemSummary(item, viewer),
    additionalDetails: item.additionalDetails,
    reporter: item.reporter
      ? {
          id: item.reporter.id,
          name: item.reporter.name,
          email: canSeeContact ? (item.reporter.email ?? null) : null,
          studentId: canSeeContact ? (item.reporter.studentId ?? null) : null,
          contact: canSeeContact ? (item.reporter.contact ?? null) : null,
        }
      : null,
    updatedAt: item.updatedAt.toISOString(),
    /** The owner of a found item, or anyone looking at a lost item, may claim. */
    canSubmitClaim: Boolean(viewer) && !isOwner && item.status !== 'RETURNED' && item.status !== 'CLOSED',
  }
}

/**
 * Typed client-side calls for every interaction that happens on demand.
 * Everything that can be rendered on the server is rendered on the server from
 * the same data layer the API uses; this module is only for writes and for the
 * fetches a drawer performs after it opens.
 */

export type MatchCandidate = {
  matchId: string
  itemId: string
  name: string
  type: 'LOST' | 'FOUND'
  color: string | null
  location: string
  status: string
  dateEvent: string
  /** File name on the photo route; build the URL with matchPhotoUrl(). */
  imagePath: string | null
  reporterName: string
  similarity: number
  colorMatch: boolean
}

/** Matches arrive with the stored file name, so the URL is built here once. */
export function matchPhotoUrl(match: Pick<MatchCandidate, 'imagePath'>): string | null {
  return match.imagePath ? `/api/files/${match.imagePath}` : null
}

export type MatchResponse = { threshold: number; matches: MatchCandidate[] }

/**
 * A failed request that carries whatever the API actually said. Field-level
 * problems arrive keyed by field name from the validator, so a form can put the
 * message next to the control instead of replacing it with "Something went
 * wrong" (agents/UX.md §5.3).
 */
export class RequestError extends Error {
  readonly status: number
  readonly fields: Record<string, string>

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.fields = fields
  }
}

function readFields(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object') return {}
  const raw = (body as { fields?: unknown }).fields
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') fields[key] = value
  }
  return fields
}

/** Turns any non-ok response into a RequestError with a message worth reading. */
export async function parseFailure(response: Response): Promise<RequestError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // No JSON body: fall back to a message chosen by status.
  }

  const stated =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : null

  if (stated) return new RequestError(stated, response.status, readFields(body))

  if (response.status === 401) {
    return new RequestError('Your session has expired. Sign in again to continue.', 401)
  }
  if (response.status === 403) return new RequestError('You do not have access to that record.', 403)
  if (response.status === 404) return new RequestError('That record is no longer available.', 404)

  return new RequestError(
    "We couldn't reach the server. Check your connection and try again.",
    response.status,
  )
}

async function failureMessage(response: Response): Promise<string> {
  return (await parseFailure(response)).message
}

export async function fetchItemMatches(itemId: string, signal?: AbortSignal): Promise<MatchResponse> {
  const response = await fetch(`/api/items/${itemId}/matches`, {
    headers: { accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(await failureMessage(response))

  const data = (await response.json()) as Partial<MatchResponse>
  return { threshold: data.threshold ?? 0, matches: data.matches ?? [] }
}

export async function setNotificationRead(
  id: string,
  read = true,
): Promise<{ unreadCount: number }> {
  const response = await fetch(`/api/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ read }),
  })
  if (!response.ok) throw new Error(await failureMessage(response))

  const data = (await response.json()) as { unreadCount?: number }
  return { unreadCount: data.unreadCount ?? 0 }
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'READ_ALL' }),
  })
  if (!response.ok) throw await parseFailure(response)
}

/** The shape POST /api/items answers with — the stored row plus its candidates. */
export type ReportResponse = {
  item: { id: string; name: string; type: 'LOST' | 'FOUND'; status: string }
  matches: MatchCandidate[]
  /** Present when the photo was stored but image matching could not run. */
  warning?: string
}

/**
 * Submits a lost or found report as multipart/form-data so the photo travels
 * with the fields. The API answers 201 with the item and any candidates the
 * matching system found.
 */
export async function submitReport(form: FormData): Promise<ReportResponse> {
  const response = await fetch('/api/items', { method: 'POST', body: form })
  if (!response.ok) throw await parseFailure(response)

  const data = (await response.json()) as Partial<ReportResponse>
  return {
    item: data.item as ReportResponse['item'],
    matches: data.matches ?? [],
    ...(data.warning ? { warning: data.warning } : {}),
  }
}

export type ClaimInput = {
  claimantName: string
  studentId: string
  contact: string
  additionalDetails: string
  proof: string
}

/** Files a claim. It always starts PENDING — this never implies approval. */
export async function submitClaim(
  itemId: string,
  input: ClaimInput,
): Promise<{ claimId: string; message: string }> {
  const response = await fetch(`/api/items/${itemId}/claims`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await parseFailure(response)

  const data = (await response.json()) as { claim?: { id?: string }; message?: string }
  return {
    claimId: data.claim?.id ?? '',
    message: data.message ?? 'Your claim was submitted and is now pending verification by OSAS.',
  }
}

/** OSAS decides a pending claim. Only a PENDING claim can be decided. */
export async function decideClaim(
  claimId: string,
  action: 'APPROVE' | 'REJECT',
  decisionNote: string,
): Promise<{ message: string }> {
  const response = await fetch(`/api/claims/${claimId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...(decisionNote.trim() ? { decisionNote: decisionNote.trim() } : {}) }),
  })
  if (!response.ok) throw await parseFailure(response)

  const data = (await response.json()) as { message?: string }
  return { message: data.message ?? 'Decision recorded.' }
}

/** Records the physical hand-over. A separate step from approving a claim. */
export async function recordReturn(
  claimId: string,
  input: { returnDate: string; notes: string },
): Promise<{ message: string }> {
  const response = await fetch(`/api/claims/${claimId}/return`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      returnDate: input.returnDate,
      ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    }),
  })
  if (!response.ok) throw await parseFailure(response)

  const data = (await response.json()) as { message?: string }
  return { message: data.message ?? 'Return recorded.' }
}

/** Withdraws one of your own reports. Blocked once a claim process has begun. */
export async function deleteItem(itemId: string): Promise<void> {
  const response = await fetch(`/api/items/${itemId}`, { method: 'DELETE' })
  if (!response.ok) throw await parseFailure(response)
}

/**
 * OSAS correcting a record's status. Only staff may do this — the API throws a
 * 403 for anyone else — and the ordinary path to Returned is recording a
 * return, not setting the status by hand (agents/UX.md §12, Rule 2).
 */
export async function setItemStatus(
  itemId: string,
  status: string,
): Promise<{ item: { id: string; status: string } }> {
  const response = await fetch(`/api/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!response.ok) throw await parseFailure(response)

  const data = (await response.json()) as { item?: { id?: string; status?: string } }
  return { item: { id: data.item?.id ?? itemId, status: data.item?.status ?? status } }
}

/** Which side of the ledger a photo search looks at. */
export type PhotoSearchScope = 'BOTH' | 'LOST' | 'FOUND'

/** A search result: what the card grid renders, plus the similarity it scored. */
export type PhotoSearchMatch = {
  id: string
  type: 'LOST' | 'FOUND'
  name: string
  description: string
  color: string | null
  location: string
  dateEvent: string
  status: string
  photoUrl: string | null
  createdAt: string
  matchCount: number
  isMine: boolean
  reporterName: string | null
  /** Calibrated similarity — the only score the UI shows. */
  similarity: number
  /** Raw cosine the calibration came from — logging and tuning only. */
  rawSimilarity: number
}

export type PhotoSearchResponse = {
  matches: PhotoSearchMatch[]
  count: number
  /**
   * The closest below-threshold candidates, present only when `matches` is
   * empty. Leads for a person to judge — the UI must keep them below the bar.
   */
  nearMisses: PhotoSearchMatch[]
  nearMissCount: number
  /** The similarity a candidate had to reach to be returned. */
  threshold: number
  /** Lowest similarity a near miss may have. */
  nearMissFloor: number
  topK: number
  scope: PhotoSearchScope
  searchedTypes: string[]
}

/**
 * Read-only photo search. It files nothing — no report, no match, no
 * notification — and the server never stores the photo. It always searches both
 * Lost and Found; narrowing by type is the browse filter row's job.
 */
export async function searchItemsByPhoto(file: File): Promise<PhotoSearchResponse> {
  const form = new FormData()
  form.set('photo', file)

  const response = await fetch('/api/items/photo-search', { method: 'POST', body: form })
  if (!response.ok) throw await parseFailure(response)

  return (await response.json()) as PhotoSearchResponse
}

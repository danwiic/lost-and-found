/**
 * Status vocabulary and formatting shared by every surface.
 *
 * The labels here are the product's own words (see agents/UX.md §18) and must
 * stay identical between user and admin screens, so they live in one place.
 */

export type Tone = 'neutral' | 'muted' | 'attention' | 'accent' | 'verified' | 'refused'

export type ItemStatusCode = 'PENDING' | 'POSSIBLE_MATCH' | 'CLAIM_PENDING' | 'RETURNED' | 'CLOSED'
export type ClaimStatusCode = 'PENDING' | 'APPROVED' | 'REJECTED'

type StatusEntry = { label: string; tone: Tone; meaning: string }

const ITEM_STATUS: Record<ItemStatusCode, StatusEntry> = {
  PENDING: {
    label: 'Pending',
    tone: 'neutral',
    meaning: 'The report is waiting for the next system or OSAS action.',
  },
  POSSIBLE_MATCH: {
    label: 'Possible Match',
    tone: 'attention',
    meaning:
      'The matching system found a visually similar item. Similarity is not proof of ownership — a person still has to verify it.',
  },
  CLAIM_PENDING: {
    label: 'Claim Pending',
    tone: 'accent',
    meaning: 'A claim was submitted for this item and is awaiting OSAS verification.',
  },
  RETURNED: {
    label: 'Returned',
    tone: 'verified',
    meaning: 'OSAS recorded that the item was physically released to its claimant.',
  },
  CLOSED: {
    label: 'Closed',
    tone: 'muted',
    meaning: 'The item workflow is complete.',
  },
}

const CLAIM_STATUS: Record<ClaimStatusCode, StatusEntry> = {
  PENDING: {
    label: 'Pending',
    tone: 'attention',
    meaning: 'Your claim is awaiting OSAS verification.',
  },
  APPROVED: {
    label: 'Approved',
    tone: 'verified',
    meaning:
      'OSAS approved the claim. The item is released once the return is recorded at the office.',
  },
  REJECTED: {
    label: 'Rejected',
    tone: 'refused',
    meaning: 'OSAS did not verify this claim.',
  },
}

function pick(table: Record<string, StatusEntry>, status: string, fallback: StatusEntry) {
  return table[status] ?? fallback
}

export function itemStatusLabel(status: string): string {
  return pick(ITEM_STATUS, status, ITEM_STATUS.PENDING).label
}

export function itemStatusTone(status: string): Tone {
  return pick(ITEM_STATUS, status, ITEM_STATUS.PENDING).tone
}

export function itemStatusMeaning(status: string): string {
  return pick(ITEM_STATUS, status, ITEM_STATUS.PENDING).meaning
}

export function claimStatusLabel(status: string): string {
  return pick(CLAIM_STATUS, status, CLAIM_STATUS.PENDING).label
}

export function claimStatusTone(status: string): Tone {
  return pick(CLAIM_STATUS, status, CLAIM_STATUS.PENDING).tone
}

export function claimStatusMeaning(status: string): string {
  return pick(CLAIM_STATUS, status, CLAIM_STATUS.PENDING).meaning
}

export function itemTypeLabel(type: string): 'Lost' | 'Found' {
  return type === 'LOST' ? 'Lost' : 'Found'
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * A calendar day on the viewer's own clock, as YYYY-MM-DD — the value a
 * `<input type="date">` reads and writes. Deliberately never
 * `toISOString().slice(0, 10)`, which is UTC and would call 3am on 1 October
 * "30 September" for a UTC+8 viewer.
 */
export function localDay(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** "2 days ago", "yesterday", "just now" — for notices and report rows. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(date)
}

/**
 * Visual similarity as a whole percentage. Never phrase this as a chance of
 * ownership — see agents/UX.md §7.1.
 */
export function formatSimilarity(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** Initials for the account chip, e.g. "Ama Cruz" -> "AC". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

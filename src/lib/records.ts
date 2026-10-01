import { ClaimStatus, ItemStatus } from '@/generated/prisma/enums'
import { prisma } from '@/lib/db'
import type { SessionUser } from '@/lib/session'

/**
 * Server-side reads for the surfaces beyond the desk. They query the same
 * tables the API serves, so a page and its endpoint can never disagree about
 * what exists; writes still go through `/api/**`.
 */

function photoUrl(imagePath: string | null): string | null {
  return imagePath ? `/api/files/${imagePath}` : null
}

/*
 * Filters arrive from the URL as plain strings, but Prisma only accepts the
 * generated enum. Narrowing here means an unknown `?status=whatever` is quietly
 * ignored — the alternative is a 500 from a hand-typed query string. The lists
 * come from the schema itself, so they cannot drift from it.
 */
function reader<T extends string>(allowed: readonly T[]) {
  return (value: string): T | undefined => {
    const upper = value.toUpperCase()
    return (allowed as readonly string[]).includes(upper) ? (upper as T) : undefined
  }
}

const readItemStatus = reader(Object.values(ItemStatus))
const readClaimStatus = reader(Object.values(ClaimStatus))

export type RecordRow = {
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
  /** The viewer filed this report. Browse mixes in other people's records. */
  isMine: boolean
  reporterName: string | null
}

const RECORD_SELECT = {
  id: true,
  type: true,
  name: true,
  description: true,
  color: true,
  location: true,
  dateEvent: true,
  status: true,
  imagePath: true,
  createdAt: true,
  reporterId: true,
  reporter: { select: { name: true } },
  _count: { select: { lostMatches: true, foundMatches: true } },
} as const

type RecordShape = {
  id: string
  type: string
  name: string
  description: string
  color: string | null
  location: string
  dateEvent: Date
  status: string
  imagePath: string | null
  createdAt: Date
  reporterId: string
  reporter: { name: string } | null
  _count: { lostMatches: number; foundMatches: number }
}

type Viewer = { id: string; role: string }

/**
 * Matches are only visible to the reporter and to OSAS staff, so the candidate
 * count is suppressed everywhere else rather than advertising that some other
 * person's item has candidates.
 */
function toRecord(item: RecordShape, viewer: Viewer | null): RecordRow {
  const isMine = viewer !== null && item.reporterId === viewer.id
  const maySeeMatches = isMine || viewer?.role === 'ADMIN'

  return {
    id: item.id,
    type: item.type as 'LOST' | 'FOUND',
    name: item.name,
    description: item.description,
    color: item.color,
    location: item.location,
    dateEvent: item.dateEvent.toISOString(),
    status: item.status,
    photoUrl: photoUrl(item.imagePath),
    createdAt: item.createdAt.toISOString(),
    matchCount: maySeeMatches ? item._count.lostMatches + item._count.foundMatches : 0,
    isMine,
    reporterName: item.reporter?.name ?? null,
  }
}

/* ------------------------------------------------------------------ *
 * My Reports
 * ------------------------------------------------------------------ */

export type ReportTallies = { lost: number; found: number; matched: number; returned: number }

export async function loadMyReports(
  user: SessionUser,
): Promise<{ records: RecordRow[]; tallies: ReportTallies }> {
  const items = await prisma.item.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: RECORD_SELECT,
  })

  const records = items.map((item) => toRecord(item, user))

  return {
    records,
    tallies: {
      lost: records.filter((record) => record.type === 'LOST').length,
      found: records.filter((record) => record.type === 'FOUND').length,
      matched: records.filter((record) => record.matchCount > 0).length,
      returned: records.filter((record) => record.status === 'RETURNED').length,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Browse
 * ------------------------------------------------------------------ */

export type BrowseFilters = {
  q: string
  type: '' | 'LOST' | 'FOUND'
  status: string
  color: string
  page: number
}

const BROWSE_PAGE_SIZE = 12

export function readBrowseFilters(params: URLSearchParams): BrowseFilters {
  const type = (params.get('type') ?? '').toUpperCase()
  const page = Number(params.get('page') ?? '1')

  return {
    q: (params.get('q') ?? '').trim(),
    type: type === 'LOST' || type === 'FOUND' ? type : '',
    status: (params.get('status') ?? '').toUpperCase(),
    color: (params.get('color') ?? '').trim(),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  }
}

export function hasActiveFilters(filters: BrowseFilters): boolean {
  return Boolean(filters.q || filters.type || filters.status || filters.color)
}

export async function loadBrowse(
  viewer: SessionUser,
  filters: BrowseFilters,
): Promise<{ records: RecordRow[]; total: number; pageCount: number }> {
  const status = readItemStatus(filters.status)

  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(status ? { status } : {}),
    ...(filters.color ? { color: { contains: filters.color, mode: 'insensitive' as const } } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' as const } },
            { description: { contains: filters.q, mode: 'insensitive' as const } },
            { color: { contains: filters.q, mode: 'insensitive' as const } },
            { location: { contains: filters.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * BROWSE_PAGE_SIZE,
      take: BROWSE_PAGE_SIZE,
      select: RECORD_SELECT,
    }),
  ])

  return {
    records: items.map((item) => toRecord(item, viewer)),
    total,
    pageCount: Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE)),
  }
}

/* ------------------------------------------------------------------ *
 * One item, in full
 * ------------------------------------------------------------------ */

export type ClaimSummary = {
  id: string
  status: string
  createdAt: string
  decisionNote: string | null
  claimantName: string
  studentId: string | null
  contact: string
  additionalDetails: string | null
  /** Nullable in the schema; the API always requires it, so it is present in practice. */
  proof: string | null
  decidedByName: string | null
  decidedAt: string | null
  returnRecord: { id: string; returnDate: string; notes: string | null } | null
}

export type ItemDetail = RecordRow & {
  additionalDetails: string | null
  updatedAt: string
  reporter: { id: string; name: string; email: string | null; studentId: string | null; contact: string | null }
  /** Another person's report on an item that is still open. */
  claimable: boolean
  /** The viewer already has a claim under verification for this item. */
  myPendingClaim: ClaimSummary | null
  /** The viewer reported this item, so they may withdraw it. */
  canWithdraw: boolean
}

export async function loadItem(
  viewer: SessionUser,
  id: string,
): Promise<{ item: ItemDetail; claimsCount: number; claims: ClaimSummary[] } | null> {
  const item = await prisma.item.findUnique({
    where: { id },
    select: { ...RECORD_SELECT, additionalDetails: true, updatedAt: true },
  })
  if (!item) return null

  const isOwner = item.reporterId === viewer.id
  const isAdmin = viewer.role === 'ADMIN'

  const [claims, claimsCount] = await Promise.all([
    isOwner || isAdmin
      ? prisma.claim.findMany({
          where: { itemId: id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            decisionNote: true,
            claimantName: true,
            studentId: true,
            contact: true,
            additionalDetails: true,
            proof: true,
            decidedAt: true,
            decidedBy: { select: { name: true } },
            returns: { select: { id: true, returnDate: true, notes: true } },
          },
        })
      : prisma.claim.findMany({
          // A claimant can always see their own claim, and nothing else.
          where: { itemId: id, claimantId: viewer.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            decisionNote: true,
            claimantName: true,
            studentId: true,
            contact: true,
            additionalDetails: true,
            proof: true,
            decidedAt: true,
            decidedBy: { select: { name: true } },
            returns: { select: { id: true, returnDate: true, notes: true } },
          },
        }),
    prisma.claim.count({ where: { itemId: id } }),
  ])

  const summaries: ClaimSummary[] = claims.map((claim) => ({
    id: claim.id,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    decisionNote: claim.decisionNote,
    claimantName: claim.claimantName,
    studentId: claim.studentId,
    contact: claim.contact,
    additionalDetails: claim.additionalDetails,
    proof: claim.proof,
    decidedByName: claim.decidedBy?.name ?? null,
    decidedAt: claim.decidedAt ? claim.decidedAt.toISOString() : null,
    returnRecord: claim.returns[0]
      ? {
          id: claim.returns[0].id,
          returnDate: claim.returns[0].returnDate.toISOString(),
          notes: claim.returns[0].notes,
        }
      : null,
  }))

  const myPendingClaim =
    summaries.find((claim) => claim.status === 'PENDING') ?? null

  const open = item.status !== 'RETURNED' && item.status !== 'CLOSED'

  const reporter = await prisma.user.findUnique({
    where: { id: item.reporterId },
    select: { id: true, name: true, email: true, studentId: true, contact: true },
  })

  const canSeeContact = isOwner || isAdmin

  return {
    item: {
      ...toRecord(item, viewer),
      additionalDetails: item.additionalDetails,
      updatedAt: item.updatedAt.toISOString(),
      reporter: {
        id: reporter?.id ?? item.reporterId,
        name: reporter?.name ?? 'Unknown',
        email: canSeeContact ? (reporter?.email ?? null) : null,
        studentId: canSeeContact ? (reporter?.studentId ?? null) : null,
        contact: canSeeContact ? (reporter?.contact ?? null) : null,
      },
      // Only the reporter and OSAS staff see the claims list, and the API
      // refuses a claim on your own report.
      claimable: !isOwner && open && myPendingClaim === null,
      myPendingClaim: isOwner || isAdmin ? null : myPendingClaim,
      canWithdraw: isOwner && item.status !== 'CLAIM_PENDING' && item.status !== 'RETURNED',
    },
    claimsCount,
    claims: isOwner || isAdmin ? summaries : summaries.filter((c) => c.status !== 'PENDING'),
  }
}

/* ------------------------------------------------------------------ *
 * My Claims
 * ------------------------------------------------------------------ */

export type ClaimListRow = {
  id: string
  status: string
  createdAt: string
  decisionNote: string | null
  decidedAt: string | null
  decidedByName: string | null
  claimantName: string
  studentId: string | null
  contact: string
  item: {
    id: string
    name: string
    type: 'LOST' | 'FOUND'
    status: string
    location: string
    dateEvent: string
    photoUrl: string | null
    reporterName: string | null
  }
  returnRecord: { id: string; returnDate: string; notes: string | null } | null
}

type ClaimListShape = {
  id: string
  status: string
  createdAt: Date
  decisionNote: string | null
  decidedAt: Date | null
  claimantName: string
  studentId: string | null
  contact: string
  decidedBy: { name: string } | null
  item: {
    id: string
    name: string
    type: string
    status: string
    location: string
    dateEvent: Date
    imagePath: string | null
    reporter: { name: string } | null
  }
  returns: Array<{ id: string; returnDate: Date; notes: string | null }>
}

function toClaimRow(claim: ClaimListShape): ClaimListRow {
  return {
    id: claim.id,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    decisionNote: claim.decisionNote,
    decidedAt: claim.decidedAt ? claim.decidedAt.toISOString() : null,
    decidedByName: claim.decidedBy?.name ?? null,
    claimantName: claim.claimantName,
    studentId: claim.studentId,
    contact: claim.contact,
    item: {
      id: claim.item.id,
      name: claim.item.name,
      type: claim.item.type as 'LOST' | 'FOUND',
      status: claim.item.status,
      location: claim.item.location,
      dateEvent: claim.item.dateEvent.toISOString(),
      photoUrl: photoUrl(claim.item.imagePath),
      reporterName: claim.item.reporter?.name ?? null,
    },
    returnRecord: claim.returns[0]
      ? {
          id: claim.returns[0].id,
          returnDate: claim.returns[0].returnDate.toISOString(),
          notes: claim.returns[0].notes,
        }
      : null,
  }
}

const CLAIM_LIST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  decisionNote: true,
  decidedAt: true,
  claimantName: true,
  studentId: true,
  contact: true,
  decidedBy: { select: { name: true } },
  item: {
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      location: true,
      dateEvent: true,
      imagePath: true,
      reporter: { select: { name: true } },
    },
  },
  returns: { select: { id: true, returnDate: true, notes: true } },
} as const

export async function loadMyClaims(user: SessionUser): Promise<ClaimListRow[]> {
  const claims = await prisma.claim.findMany({
    where: { claimantId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: CLAIM_LIST_SELECT,
  })
  return claims.map(toClaimRow)
}

/* ------------------------------------------------------------------ *
 * OSAS side
 * ------------------------------------------------------------------ */

export type AdminTotals = {
  totalLostItems: number
  totalFoundItems: number
  pendingClaims: number
  possibleMatches: number
  returnedItems: number
  openItems: number
}

export async function loadAdminOverview(viewer: Viewer): Promise<{
  totals: AdminTotals
  recentItems: RecordRow[]
  recentClaims: ClaimListRow[]
}> {
  const [totalLost, totalFound, pendingClaims, possibleMatches, returnedItems, openItems, recentItems, recentClaims] =
    await Promise.all([
      prisma.item.count({ where: { type: 'LOST' } }),
      prisma.item.count({ where: { type: 'FOUND' } }),
      prisma.claim.count({ where: { status: 'PENDING' } }),
      prisma.match.count(),
      prisma.item.count({ where: { status: 'RETURNED' } }),
      prisma.item.count({
        where: { status: { in: ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING'] } },
      }),
      prisma.item.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: RECORD_SELECT }),
      prisma.claim.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 6,
        select: CLAIM_LIST_SELECT,
      }),
    ])

  return {
    totals: { totalLostItems: totalLost, totalFoundItems: totalFound, pendingClaims, possibleMatches, returnedItems, openItems },
    recentItems: recentItems.map((item) => toRecord(item, viewer)),
    recentClaims: recentClaims.map(toClaimRow),
  }
}

export async function loadAdminItems(
  viewer: Viewer,
  type: 'LOST' | 'FOUND',
  filters: { q: string; status: string; page: number },
): Promise<{ records: RecordRow[]; total: number; pageCount: number }> {
  const status = readItemStatus(filters.status)

  const where = {
    type,
    ...(status ? { status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' as const } },
            { description: { contains: filters.q, mode: 'insensitive' as const } },
            { color: { contains: filters.q, mode: 'insensitive' as const } },
            { location: { contains: filters.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * BROWSE_PAGE_SIZE,
      take: BROWSE_PAGE_SIZE,
      select: RECORD_SELECT,
    }),
  ])

  return {
    records: items.map((item) => toRecord(item, viewer)),
    total,
    pageCount: Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE)),
  }
}

export async function loadAdminClaims(filters: {
  status: string
  page: number
}): Promise<{ claims: ClaimListRow[]; total: number; pageCount: number }> {
  const status = readClaimStatus(filters.status)
  const where = status ? { status } : {}

  const [total, claims] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      // Oldest first: the queue is worked from the bottom up.
      orderBy: { createdAt: 'asc' },
      skip: (filters.page - 1) * BROWSE_PAGE_SIZE,
      take: BROWSE_PAGE_SIZE,
      select: CLAIM_LIST_SELECT,
    }),
  ])

  return {
    claims: claims.map(toClaimRow),
    total,
    pageCount: Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE)),
  }
}

export type ClaimCounts = { total: number; pending: number; approved: number; rejected: number }

/**
 * Claim counts across the whole queue, independent of the page or filter being
 * viewed — the returns queue needs the pending figure even while it is showing
 * approved claims.
 */
export async function loadClaimCounts(): Promise<ClaimCounts> {
  const grouped = await prisma.claim.groupBy({ by: ['status'], _count: { _all: true } })

  const counts: ClaimCounts = { total: 0, pending: 0, approved: 0, rejected: 0 }
  for (const row of grouped) {
    const n = row._count._all
    counts.total += n
    if (row.status === 'PENDING') counts.pending += n
    else if (row.status === 'APPROVED') counts.approved += n
    else if (row.status === 'REJECTED') counts.rejected += n
  }
  return counts
}

export type ClaimDetail = ClaimListRow & {
  additionalDetails: string | null
  /** Nullable in the schema; the API always requires it, so it is present in practice. */
  proof: string | null
  item: ClaimListRow['item'] & {
    description: string
    color: string | null
    additionalDetails: string | null
    reporter: { id: string; name: string; email: string; contact: string | null }
  }
}

/** One claim in full, for OSAS verification. */
export async function loadClaim(id: string): Promise<ClaimDetail | null> {
  const claim = await prisma.claim.findUnique({
    where: { id },
    select: {
      ...CLAIM_LIST_SELECT,
      additionalDetails: true,
      proof: true,
      item: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          description: true,
          color: true,
          additionalDetails: true,
          location: true,
          dateEvent: true,
          imagePath: true,
          reporter: { select: { id: true, name: true, email: true, contact: true } },
        },
      },
    },
  })
  if (!claim) return null

  return {
    ...toClaimRow(claim),
    additionalDetails: claim.additionalDetails,
    proof: claim.proof,
    item: {
      ...toClaimRow(claim).item,
      description: claim.item.description,
      color: claim.item.color,
      additionalDetails: claim.item.additionalDetails,
      reporter: claim.item.reporter,
    },
  }
}

export type ReturnRow = {
  id: string
  returnDate: string
  notes: string | null
  releasedByName: string | null
  claimantName: string | null
  claimantStudentId: string | null
  claimantContact: string | null
  item: { id: string; name: string; type: 'LOST' | 'FOUND'; location: string; photoUrl: string | null }
}

export async function loadReturns(): Promise<ReturnRow[]> {
  const records = await prisma.returnRecord.findMany({
    orderBy: { returnDate: 'desc' },
    take: 100,
    select: {
      id: true,
      returnDate: true,
      notes: true,
      releasedBy: { select: { name: true } },
      claim: { select: { claimantName: true, studentId: true, contact: true } },
      item: { select: { id: true, name: true, type: true, location: true, imagePath: true } },
    },
  })

  return records.map((record) => ({
    id: record.id,
    returnDate: record.returnDate.toISOString(),
    notes: record.notes,
    releasedByName: record.releasedBy?.name ?? null,
    claimantName: record.claim?.claimantName ?? null,
    claimantStudentId: record.claim?.studentId ?? null,
    claimantContact: record.claim?.contact ?? null,
    item: {
      id: record.item.id,
      name: record.item.name,
      type: record.item.type as 'LOST' | 'FOUND',
      location: record.item.location,
      photoUrl: photoUrl(record.item.imagePath),
    },
  }))
}

/**
 * Items that still need OSAS attention: open, with a claim or a match waiting.
 * Used for the dashboard's "waiting on OSAS" panel.
 */
export async function loadAdminAttention(
  viewer: Viewer,
  limit = 6,
): Promise<{
  claims: ClaimListRow[]
  matched: RecordRow[]
}> {
  const [claims, matched] = await Promise.all([
    prisma.claim.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: CLAIM_LIST_SELECT,
    }),
    prisma.item.findMany({
      where: { status: { in: ['CLAIM_PENDING'] } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: RECORD_SELECT,
    }),
  ])

  return { claims: claims.map(toClaimRow), matched: matched.map((item) => toRecord(item, viewer)) }
}

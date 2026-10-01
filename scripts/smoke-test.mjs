/**
 * End-to-end smoke test for the Lost and Found backend.
 *
 * Nothing is assumed to exist except the seeded OSAS admin account: the script
 * registers the two people it needs and creates every report itself, with
 * photographs drawn on the spot. It therefore walks the same path a real
 * deployment takes — registrations and reports, no demo data.
 *
 *   npm run smoke        (with the app running: npm run dev, or npm run build && npm run start)
 *
 * Flow: report a lost item with a photo -> report a found item with a different
 * photo of the same object -> match + owner notification -> claim -> OSAS
 * approval -> return record, plus the rejection path, photo serving and the
 * authentication / authorisation rules.
 */
import { createSession, request, reportForm, uniqueEmail } from './lib/api-client.mjs'
import { createChecker } from './lib/checks.mjs'
import { photoPair } from './lib/fixtures.mjs'

/** The one account the seed creates. */
const ADMIN = { email: 'admin@cvsu.test', password: 'admin123' }

const { check, section, note, finish } = createChecker()
const PASSWORD = 'smoke-pass-1234'

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Registers a real account and returns it with its signed-in session. */
async function register(session, name, prefix) {
  const email = uniqueEmail(prefix)
  const response = await request(session, '/api/auth/register', {
    json: {
      name,
      email,
      password: PASSWORD,
      studentId: `S-${Date.now() % 100000}`,
      contact: '0917 000 0000',
    },
  })

  if (response.status !== 201) {
    throw new Error(
      `Could not register ${name}: ${response.status} ${JSON.stringify(response.data)}`,
    )
  }
  return { session, id: response.data.user.id, name, email }
}

/** Reports an item with a photo drawn by the fixture renderer. */
async function reportItem(session, { type, name, color, description, location, photo }) {
  return request(session, '/api/items', {
    form: reportForm(photo, {
      type,
      name,
      color,
      description,
      location,
      dateEvent: today(),
    }),
  })
}

/** Health, the two accounts, and the lost/found pair that has to match. */
async function coreFlow() {
  const admin = createSession('admin')

  section('Health and access control')
  const health = await request(createSession(), '/api/health')
  const threshold = Number(health.data?.matchThreshold ?? 0)
  check(
    'GET /api/health reports a healthy database',
    health.status === 200 && health.data?.database === 'ok',
    `items=${health.data?.items} embedder=${health.data?.embedder} threshold=${threshold}`,
  )
  const anonymousBrowse = await request(createSession(), '/api/items')
  check(
    'browsing without a session is rejected',
    anonymousBrowse.status === 401,
    String(anonymousBrowse.status),
  )

  section('Accounts (registered here, not seeded)')
  const adminLogin = await request(admin, '/api/auth/login', { json: ADMIN })
  check(
    'the seeded OSAS admin account can sign in',
    adminLogin.status === 200 && adminLogin.data?.user?.role === 'ADMIN',
    JSON.stringify(adminLogin.data?.user?.email ?? adminLogin.data),
  )

  const owner = await register(createSession('owner'), 'Smoke Owner', 'smoke.owner')
  check('a student can register and is signed in', Boolean(owner.id), owner.email)

  const duplicate = await request(createSession('duplicate'), '/api/auth/register', {
    json: { name: owner.name, email: owner.email, password: PASSWORD },
  })
  check(
    'registering the same email twice is refused',
    duplicate.status === 409,
    String(duplicate.status),
  )

  const badLogin = await request(createSession('bad-password'), '/api/auth/login', {
    json: { email: owner.email, password: 'definitely-wrong' },
  })
  check('a wrong password is rejected', badLogin.status === 401, String(badLogin.status))

  const finder = await register(createSession('finder'), 'Smoke Finder', 'smoke.finder')
  check(
    'a second student can register',
    Boolean(finder.id) && finder.id !== owner.id,
    finder.email,
  )

  const forbiddenStats = await request(owner.session, '/api/admin/stats')
  check(
    'students cannot reach the OSAS dashboard',
    forbiddenStats.status === 403,
    String(forbiddenStats.status),
  )

  section('A lost report, then a found report of the same object')
  // A database that already holds an open found item of the same object will
  // legitimately match this lost report, so "nothing to match yet" is only
  // assertable on a fresh database.
  const itemsBefore = Number(health.data?.items ?? 0)
  const photos = await photoPair('backpack')
  const lostReport = await reportItem(owner.session, {
    type: 'LOST',
    name: 'Blue backpack with laptop sleeve',
    color: 'blue',
    description: 'Blue backpack, two compartments, left in the reading room.',
    location: 'Library, 2nd floor',
    photo: photos.lost,
  })
  const lostItem = lostReport.data?.item ?? {}
  check(
    'the lost report is stored',
    lostReport.status === 201 && Boolean(lostItem.id),
    lostReport.status === 201 ? undefined : JSON.stringify(lostReport.data),
  )

  const firstReportMatches = (lostReport.data?.matches ?? []).length
  if (itemsBefore === 0) {
    check(
      'the first report matches nothing, because nothing was on file',
      firstReportMatches === 0,
      `matches=${firstReportMatches}`,
    )
  } else {
    note(
      `the database already held ${itemsBefore} item(s), and this report matched ${firstReportMatches} of them — ` +
        'run against an empty database to assert the no-match case.',
    )
  }

  const foundReport = await reportItem(finder.session, {
    type: 'FOUND',
    name: 'Blue backpack handed in',
    color: 'blue',
    description: 'Blue backpack turned over to the front desk, front pocket empty.',
    location: 'Main lobby',
    photo: photos.found,
  })
  const foundItem = foundReport.data?.item ?? {}
  check(
    'reporting a found item with a photo returns 201',
    foundReport.status === 201 && Boolean(foundItem.id),
    foundReport.status === 201 ? undefined : JSON.stringify(foundReport.data),
  )
  check(
    'the new report exposes a photo URL',
    typeof foundItem.photoUrl === 'string' && foundItem.photoUrl.startsWith('/api/files/'),
    foundItem.photoUrl,
  )

  const matches = foundReport.data?.matches ?? []
  const backpackMatch = matches.find((match) => match.itemId === lostItem.id)
  check(
    'image matching returns the lost report',
    Boolean(backpackMatch),
    backpackMatch
      ? `similarity=${backpackMatch.similarity.toFixed(4)}`
      : `matches=${matches.length}`,
  )
  check(
    'the match clears the configured threshold',
    Number(backpackMatch?.similarity ?? 0) >= threshold,
    `similarity=${Number(backpackMatch?.similarity ?? 0).toFixed(4)} >= ${threshold}`,
  )

  section('Possible-match notification (View Match)')
  const notifications = await request(owner.session, '/api/notifications?unread=1')
  const matchNotification = (notifications.data?.notifications ?? []).find(
    (notification) => notification.type === 'POSSIBLE_MATCH',
  )
  check(
    'the lost owner is notified about the possible match',
    Boolean(matchNotification),
    matchNotification?.message?.slice(0, 72),
  )
  check(
    'the notification carries a match id for "View Match"',
    Boolean(matchNotification?.matchId),
  )

  const ownerMatches = await request(owner.session, `/api/items/${lostItem.id}/matches`)
  check(
    'the owner can open the possible matches view',
    ownerMatches.status === 200 &&
      (ownerMatches.data?.matches ?? []).some((match) => match.itemId === foundItem.id),
    String(ownerMatches.status),
  )

  section('Claim submission')
  const claimResponse = await request(owner.session, `/api/items/${foundItem.id}/claims`, {
    json: {
      contact: '0917 000 0000',
      additionalDetails: 'A statistics reviewer and a blue pencil case are inside.',
      proof: 'My initials are written inside the laptop sleeve.',
    },
  })
  const claim = claimResponse.data?.claim ?? {}
  check(
    'the claim is accepted as pending verification',
    claimResponse.status === 201 && claim.status === 'PENDING',
    claimResponse.status === 201 ? undefined : JSON.stringify(claimResponse.data),
  )

  const ownItemClaim = await request(owner.session, `/api/items/${lostItem.id}/claims`, {
    json: { contact: '0917 000 0000', proof: 'claiming my own report' },
  })
  check(
    'a claim on your own report is refused',
    ownItemClaim.status === 400,
    String(ownItemClaim.status),
  )

  const duplicateClaim = await request(owner.session, `/api/items/${foundItem.id}/claims`, {
    json: { contact: '0917 000 0000', proof: 'the same claimant again' },
  })
  check(
    'a duplicate pending claim is refused',
    duplicateClaim.status === 409,
    String(duplicateClaim.status),
  )

  const afterClaim = await request(finder.session, `/api/items/${foundItem.id}`)
  check(
    'the item moves to CLAIM_PENDING',
    afterClaim.data?.item?.status === 'CLAIM_PENDING',
    afterClaim.data?.item?.status,
  )

  return { owner, admin, finder, lostItem, foundItem, claim, threshold }
}

/** OSAS verification, the return record and the resulting notifications. */
async function osasFlow({ owner, admin, foundItem, claim }) {
  section('OSAS verification')
  const queue = await request(admin, '/api/claims?status=PENDING')
  check(
    'the claim shows up in the OSAS queue',
    (queue.data?.claims ?? []).some((row) => row.id === claim.id),
  )

  const studentDecision = await request(owner.session, `/api/claims/${claim.id}`, {
    method: 'PATCH',
    json: { action: 'APPROVE' },
  })
  check(
    'only OSAS staff can decide a claim',
    studentDecision.status === 403,
    String(studentDecision.status),
  )

  const invalidDecision = await request(admin, `/api/claims/${claim.id}`, {
    method: 'PATCH',
    json: { action: 'MAYBE' },
  })
  check(
    'an unknown decision is rejected',
    invalidDecision.status === 422,
    String(invalidDecision.status),
  )

  const approval = await request(admin, `/api/claims/${claim.id}`, {
    method: 'PATCH',
    json: { action: 'APPROVE', decisionNote: 'Ownership verified at the OSAS office.' },
  })
  check(
    'the claim can be approved',
    approval.status === 200 && approval.data?.claim?.status === 'APPROVED',
    JSON.stringify(approval.data?.claim?.status ?? approval.data),
  )

  const reApproval = await request(admin, `/api/claims/${claim.id}`, {
    method: 'PATCH',
    json: { action: 'APPROVE' },
  })
  check(
    'an already decided claim cannot be decided twice',
    reApproval.status === 409,
    String(reApproval.status),
  )

  section('Record the item return')
  const returnRecord = await request(admin, `/api/claims/${claim.id}/return`, {
    json: { notes: 'Released to the claimant after presenting a student ID.' },
  })
  check(
    'the return is recorded',
    returnRecord.status === 201 && Boolean(returnRecord.data?.returnRecord?.id),
    returnRecord.data?.returnRecord?.returnDate,
  )

  const afterReturn = await request(admin, `/api/items/${foundItem.id}`)
  check(
    'the item is now RETURNED / closed',
    afterReturn.data?.item?.status === 'RETURNED',
    afterReturn.data?.item?.status,
  )

  const returns = await request(admin, '/api/returns')
  check(
    'the return appears in the return records',
    (returns.data?.returns ?? []).some((row) => row.claim?.id === claim.id),
  )

  const claimantNotifications = await request(owner.session, '/api/notifications')
  const types = new Set(
    (claimantNotifications.data?.notifications ?? []).map((row) => row.type),
  )
  check('the claimant was notified that the claim was approved', types.has('CLAIM_APPROVED'))
  check('the claimant was notified that the item was returned', types.has('ITEM_RETURNED'))

  const readAll = await request(owner.session, '/api/notifications', {
    method: 'POST',
    json: { action: 'READ_ALL' },
  })
  check(
    'notifications can be marked as read',
    readAll.status === 200 && readAll.data?.unreadCount === 0,
  )
}

/** Report -> match -> claim -> reject: the item goes back on the list. */
async function rejectedClaimFlow({ owner, finder, admin }) {
  section('Rejected claim path')
  const photos = await photoPair('bottle')

  const lostReport = await reportItem(owner.session, {
    type: 'LOST',
    name: 'Teal insulated water bottle',
    color: 'teal',
    description: 'Teal stainless steel bottle, small dent near the base.',
    location: 'Gymnasium bleachers',
    photo: photos.lost,
  })
  const lostItem = lostReport.data?.item ?? {}

  const foundReport = await reportItem(finder.session, {
    type: 'FOUND',
    name: 'Teal bottle left at the gym',
    color: 'teal',
    description: 'Teal insulated bottle with a dent near the base, found on the bleachers.',
    location: 'Gymnasium',
    photo: photos.found,
  })
  const foundItem = foundReport.data?.item ?? {}

  const secondMatches = foundReport.data?.matches ?? []
  check(
    'the second found report also matches a lost report',
    Boolean(lostItem.id) && secondMatches.some((match) => match.itemId === lostItem.id),
    secondMatches.map((match) => `${match.name} @ ${match.similarity.toFixed(3)}`).join(', '),
  )

  if (!foundItem.id) return

  const secondClaimResponse = await request(owner.session, `/api/items/${foundItem.id}/claims`, {
    json: { contact: '0917 000 0000', proof: 'I lost it at the gym last week.' },
  })
  const secondClaimId = secondClaimResponse.data?.claim?.id
  check(
    'the second claim is pending verification',
    secondClaimResponse.status === 201 && Boolean(secondClaimId),
  )

  const rejection = await request(admin, `/api/claims/${secondClaimId}`, {
    method: 'PATCH',
    json: { action: 'REJECT', decisionNote: 'Proof of ownership did not match the item.' },
  })
  check(
    'the claim can be rejected',
    rejection.status === 200 && rejection.data?.claim?.status === 'REJECTED',
  )

  const afterRejection = await request(finder.session, `/api/items/${foundItem.id}`)
  check(
    'the rejected item is listed again as a possible match',
    afterRejection.data?.item?.status === 'POSSIBLE_MATCH',
    afterRejection.data?.item?.status,
  )
}

/** Photo serving, dashboard counters and signing out. */
async function wrapUpFlow({ owner, admin, foundItem }) {
  section('Photo serving')
  const photoName = String(foundItem.photoUrl ?? '').split('/').pop()
  const photo = await request(owner.session, `/api/files/${photoName}`)
  check('the stored photo is served back', photo.status === 200, `status=${photo.status}`)

  const thumbnail = await request(owner.session, `/api/files/${photoName}?w=240`)
  check(
    'a downscaled thumbnail can be requested',
    thumbnail.status === 200,
    `status=${thumbnail.status}`,
  )

  const traversal = await request(owner.session, '/api/files/..%2F..%2Fpackage.json')
  check(
    'path traversal on the photo route is blocked',
    traversal.status === 400 || traversal.status === 404,
    `status=${traversal.status}`,
  )

  section('Dashboard counters')
  const stats = await request(admin, '/api/admin/stats')
  const totals = stats.data?.totals ?? {}
  check(
    'the OSAS dashboard returns counters',
    stats.status === 200 && typeof totals.pendingClaims === 'number',
    JSON.stringify(totals),
  )
  check(
    'returned items are counted',
    Number(totals.returnedItems ?? 0) >= 1,
    `returnedItems=${totals.returnedItems}`,
  )

  section('Sign out')
  const logout = await request(owner.session, '/api/auth/logout', { method: 'POST' })
  check('signing out clears the session', logout.status === 200)
  const afterLogout = await request(owner.session, '/api/items')
  check('the session no longer works', afterLogout.status === 401, String(afterLogout.status))
}

async function main() {
  const context = await coreFlow()
  await osasFlow(context)
  await rejectedClaimFlow(context)
  await wrapUpFlow(context)
  finish('Backend smoke test passed.')
}

main().catch((error) => {
  console.error('Smoke test crashed:', error)
  process.exitCode = 1
})

/**
 * Proves the image-matching pipeline works on real data only.
 *
 * Two people register through the public API, and the script proves both arrival
 * orders of a match:
 *
 *   Case 1 — a lost report first, then a found report of the same object: the
 *            lost owner is notified, the finder is not.
 *   Case 2 — a found report first, then a lost report of the same object: the
 *            lost reporter gets the candidates on the report response *and* a
 *            stored notification, so the result outlives the confirmation screen.
 *
 * It then checks, through the API, that
 *
 *   1. a Match row exists and resolves from both reports,
 *   2. the lost side of the pair received a POSSIBLE_MATCH notification,
 *   3. the finder received none in either order,
 *   4. a report of a different object stays below the threshold (no false match),
 *
 * and it prints every similarity score it sees, so MATCH_THRESHOLD can be tuned
 * from measurements. Candidates that stayed *below* the threshold are visible in
 * the server log's `[match]` lines; set MATCH_LOG_FILE and this script echoes the
 * tail of them back.
 *
 *   npm run verify:match
 *   $env:MATCH_LOG_FILE='./server.log'; npm run verify:match
 *   $env:VERIFY_CLEANUP='1'; npm run verify:match      # delete the reports it made
 */
import { createSession, request, reportForm, uniqueEmail } from './lib/api-client.mjs'
import { createChecker } from './lib/checks.mjs'
import { photoPair } from './lib/fixtures.mjs'

/** The object both reports describe: two photographs, one object. */
const OBJECT = process.env.VERIFY_OBJECT ?? 'backpack'
/** A clearly different object, reported last as the false-positive baseline. */
const OTHER_OBJECT = process.env.VERIFY_OTHER_OBJECT ?? 'headphones'

const { check, section, note, finish } = createChecker()
const PASSWORD = 'verify-pass-1234'

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** A real registration through the public endpoint. */
async function register(session, name, prefix) {
  const email = uniqueEmail(prefix)
  const response = await request(session, '/api/auth/register', {
    json: {
      name,
      email,
      password: PASSWORD,
      studentId: `V-${Math.floor(Math.random() * 90000) + 10000}`,
      contact: '0917 000 0000',
    },
  })

  if (response.status !== 201) {
    throw new Error(
      `Could not register ${name}: ${response.status} ${JSON.stringify(response.data)}`,
    )
  }
  return { id: response.data.user.id, name, email }
}

/** A real report through the public endpoint, photograph included. */
async function report(session, { type, name, color, description, location, photo }) {
  return request(session, '/api/items', {
    form: reportForm(photo, {
      type,
      name,
      color,
      description,
      location,
      dateEvent: today(),
      additionalDetails: 'Created by npm run verify:match.',
    }),
  })
}

/** Reads back the tuning lines the server wrote, so sub-threshold scores are visible. */
async function echoMatchLog(logFile) {
  if (!logFile) return
  const { readFile } = await import('node:fs/promises')
  const text = await readFile(logFile, 'utf8').catch(() => '')
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.includes('[match]'))
    .slice(-20)

  if (lines.length === 0) {
    note(`(no [match] lines in ${logFile} yet — is the server writing to that file?)`)
    return
  }
  note(`last [match] lines from ${logFile}:`)
  for (const line of lines) note(`  ${line.trim()}`)
}

async function main() {
  const lostReporter = createSession('lost reporter')
  const finder = createSession('finder')

  section('Server and threshold')
  const health = await request(createSession(), '/api/health')
  const threshold = Number(health.data?.matchThreshold ?? process.env.MATCH_THRESHOLD ?? 0.87)
  check(
    'the server is up and the database answers',
    health.status === 200 && health.data?.database === 'ok',
    `status=${health.status} items=${health.data?.items} embedder=${health.data?.embedder}`,
  )
  note(`MATCH_THRESHOLD in force: ${threshold}`)

  section('Two real registrations')
  const owner = await register(lostReporter, 'Verify Lost Reporter', 'verify.lost')
  check('the lost reporter registers and is signed in', Boolean(owner.id), owner.email)
  const second = await register(finder, 'Verify Finder', 'verify.found')
  check(
    'the finder registers separately',
    Boolean(second.id) && second.id !== owner.id,
    second.email,
  )
  note(`lost reporter=${owner.id}  finder=${second.id}`)

  const photos = await photoPair(OBJECT)
  note(
    `photo 1: ${photos.lost.fileName} ${photos.lost.contentType} ${photos.lost.buffer.length} B` +
      ` — photo 2: ${photos.found.fileName} ${photos.found.contentType} ${photos.found.buffer.length} B`,
  )
  check(
    'the two photographs are genuinely different images',
    !photos.lost.buffer.equals(photos.found.buffer) &&
      photos.lost.fileName !== photos.found.fileName,
  )

  section('Report 1 of 2: a lost item, with a photo')
  const lostReport = await report(lostReporter, {
    type: 'LOST',
    name: `${OBJECT} lost at the library`,
    color: 'blue',
    description: `A blue ${OBJECT} with a padded sleeve, left on the second floor.`,
    location: 'University Library, 2nd floor',
    photo: photos.lost,
  })
  const lostItem = lostReport.data?.item ?? {}
  check(
    'the lost report is stored',
    lostReport.status === 201 && Boolean(lostItem.id),
    lostReport.status === 201 ? `id=${lostItem.id}` : JSON.stringify(lostReport.data),
  )
  check(
    'the lost report matched nothing, because no found item exists yet',
    (lostReport.data?.matches ?? []).length === 0,
    `matches=${(lostReport.data?.matches ?? []).length}`,
  )
  if (!lostItem.id) {
    finish()
    return
  }

  section('Report 2 of 2: a found item, a different photo of the same object')
  const foundReport = await report(finder, {
    type: 'FOUND',
    name: `${OBJECT} found in the lobby`,
    color: 'blue',
    description: `A blue ${OBJECT} handed in at the front desk, front pocket empty.`,
    location: 'Main lobby',
    photo: photos.found,
  })
  const foundItem = foundReport.data?.item ?? {}
  check(
    'the found report is stored',
    foundReport.status === 201 && Boolean(foundItem.id),
    foundReport.status === 201 ? `id=${foundItem.id}` : JSON.stringify(foundReport.data),
  )
  if (!foundItem.id) {
    finish()
    return
  }

  const inline = (foundReport.data?.matches ?? []).find((match) => match.itemId === lostItem.id)
  const similarity = Number(inline?.similarity ?? 0)
  check(
    'the finder gets the possible match back with the report',
    Boolean(inline),
    `matches=${(foundReport.data?.matches ?? []).length}`,
  )
  check(
    'the measured similarity clears the threshold',
    similarity >= threshold,
    `similarity=${similarity.toFixed(4)} >= threshold=${threshold} (margin +${(similarity - threshold).toFixed(4)})`,
  )

  section('The Match row resolves from both reports')
  const finderMatches = await request(finder, `/api/items/${foundItem.id}/matches`)
  const finderRow = (finderMatches.data?.matches ?? []).find((match) => match.itemId === lostItem.id)
  check(
    'the found report lists the lost item, with a match id',
    Boolean(finderRow?.matchId),
    finderRow
      ? `matchId=${finderRow.matchId} similarity=${Number(finderRow.similarity).toFixed(4)}`
      : 'absent',
  )

  const ownerMatches = await request(lostReporter, `/api/items/${lostItem.id}/matches`)
  const ownerRow = (ownerMatches.data?.matches ?? []).find((match) => match.itemId === foundItem.id)
  check(
    'the lost report lists the found item, under the same match id',
    Boolean(ownerRow?.matchId) && ownerRow?.matchId === finderRow?.matchId,
    ownerRow ? `matchId=${ownerRow.matchId}` : 'absent',
  )

  const lostDetail = await request(lostReporter, `/api/items/${lostItem.id}`)
  const foundDetail = await request(finder, `/api/items/${foundItem.id}`)
  check(
    'both reports are now POSSIBLE_MATCH',
    lostDetail.data?.item?.status === 'POSSIBLE_MATCH' &&
      foundDetail.data?.item?.status === 'POSSIBLE_MATCH',
    `lost=${lostDetail.data?.item?.status} found=${foundDetail.data?.item?.status}`,
  )

  section('The notification fired for the other side')
  const notices = await request(lostReporter, '/api/notifications?unread=1')
  const matchNotice = (notices.data?.notifications ?? []).find(
    (notice) => notice.type === 'POSSIBLE_MATCH' && notice.itemId === lostItem.id,
  )
  check(
    'the lost reporter is notified about the possible match',
    Boolean(matchNotice),
    matchNotice?.message?.slice(0, 90),
  )
  check(
    'the notification carries the match id, so "View Match" can open it',
    Boolean(matchNotice?.matchId) && matchNotice?.matchId === finderRow?.matchId,
    matchNotice ? `matchId=${matchNotice.matchId}` : undefined,
  )
  const finderNotices = await request(finder, '/api/notifications')
  check(
    'the finder is not notified, having already received the result inline',
    (finderNotices.data?.notifications ?? []).filter(
      (notice) => notice.type === 'POSSIBLE_MATCH',
    ).length === 0,
    `notifications=${(finderNotices.data?.notifications ?? []).length}`,
  )

  section('Case 2: a found item first, the lost report later')
  const reversed = await photoPair('umbrella')
  const foundFirst = await report(finder, {
    type: 'FOUND',
    name: 'maroon umbrella found in the lobby',
    color: 'maroon',
    description: 'A maroon folding umbrella handed in at the front desk.',
    location: 'Main lobby',
    photo: reversed.found,
  })
  const foundFirstItem = foundFirst.data?.item ?? {}
  check(
    'the found report is stored and matched nothing yet',
    foundFirst.status === 201 && (foundFirst.data?.matches ?? []).length === 0,
    `status=${foundFirst.status} matches=${(foundFirst.data?.matches ?? []).length}`,
  )

  const lostLater = await report(lostReporter, {
    type: 'LOST',
    name: 'maroon umbrella lost at the library',
    color: 'maroon',
    description: 'A maroon folding umbrella left in the reading room.',
    location: 'Library',
    photo: reversed.lost,
  })
  const lostLaterItem = lostLater.data?.item ?? {}
  check(
    'the lost report is stored',
    lostLater.status === 201 && Boolean(lostLaterItem.id),
    lostLater.status === 201 ? `id=${lostLaterItem.id}` : JSON.stringify(lostLater.data),
  )
  if (!foundFirstItem.id || !lostLaterItem.id) {
    finish()
    return
  }

  const laterMatches = lostLater.data?.matches ?? []
  const laterMatch = laterMatches.find((match) => match.itemId === foundFirstItem.id)
  const laterSimilarity = Number(laterMatch?.similarity ?? 0)
  check(
    'the lost report shows the found item already on file',
    Boolean(laterMatch),
    `matches=${laterMatches.length}`,
  )
  check(
    'that match clears the threshold too',
    laterSimilarity >= threshold,
    `similarity=${laterSimilarity.toFixed(4)} >= threshold=${threshold}`,
  )

  // The notice is what makes the candidates outlive the confirmation screen.
  const laterNotices = await request(lostReporter, '/api/notifications?unread=1')
  const laterNotice = (laterNotices.data?.notifications ?? []).find(
    (notice) => notice.type === 'POSSIBLE_MATCH' && notice.itemId === lostLaterItem.id,
  )
  check(
    'the lost reporter is notified, so the result persists after the response',
    Boolean(laterNotice),
    laterNotice?.message?.slice(0, 90),
  )
  check(
    "the notice points at the reporter's own item and at the match row",
    laterNotice?.itemId === lostLaterItem.id && laterNotice?.matchId === laterMatch?.matchId,
    `itemId=${laterNotice?.itemId} matchId=${laterNotice?.matchId}`,
  )

  const reopened = await request(lostReporter, `/api/items/${lostLaterItem.id}`)
  check(
    'the match is still there when the report is reopened',
    (reopened.data?.matches ?? []).some((match) => match.itemId === foundFirstItem.id),
    `matches=${(reopened.data?.matches ?? []).length}`,
  )

  const finderAfterBoth = await request(finder, '/api/notifications')
  check(
    'the finder is not notified in either order',
    (finderAfterBoth.data?.notifications ?? []).filter(
      (notice) => notice.type === 'POSSIBLE_MATCH',
    ).length === 0,
    `notifications=${(finderAfterBoth.data?.notifications ?? []).length}`,
  )

  section('A different object must not match')
  const otherPhotos = await photoPair(OTHER_OBJECT)
  const otherReport = await report(finder, {
    type: 'FOUND',
    name: `${OTHER_OBJECT} found near the gym`,
    color: 'black',
    description: `A pair of black ${OTHER_OBJECT} left on the bleachers.`,
    location: 'Gymnasium',
    photo: otherPhotos.found,
  })
  check(
    'the unrelated report is stored and matched nothing',
    otherReport.status === 201 && (otherReport.data?.matches ?? []).length === 0,
    `status=${otherReport.status} matches=${(otherReport.data?.matches ?? []).length}`,
  )
  if (otherReport.data?.item?.id) {
    const otherMatches = await request(finder, `/api/items/${otherReport.data.item.id}/matches`)
    check(
      'no Match row was written for the unrelated item',
      (otherMatches.data?.matches ?? []).length === 0,
      `rows=${(otherMatches.data?.matches ?? []).length}`,
    )
  }

  section('Measured scores — the tuning data')
  note(`true pair : ${photos.lost.fileName} <-> ${photos.found.fileName}`)
  note(
    `            similarity ${similarity.toFixed(4)}, threshold ${threshold}, margin +${(similarity - threshold).toFixed(4)}`,
  )
  note(
    `unrelated : "${OTHER_OBJECT}" reported while a "${OBJECT}" was open — no match row written.`,
  )
  note(
    `case 2    : found reported first, lost report later — similarity ${laterSimilarity.toFixed(4)}, ` +
      'notice written to the lost reporter.',
  )
  note('  The sub-threshold score of every candidate is in the server log, e.g.:')
  note('  [match] FOUND "backpack found in the lobby" (cuid) vs 1 open LOST candidate(s), threshold=0.870')
  note('  [match]   0.9126  colour~match  "backpack lost at the library" (cuid) -> MATCH (rank score 0.9326)')
  note('  [match]   0.8370  colour=no     "other item" (cuid) -> 0.0330 short of the threshold')
  note(`re-tune with: npm run match:matrix -- "${process.env.UPLOAD_DIR ?? './uploads'}" --pair <lost photo>,<found photo>`)
  await echoMatchLog(process.env.MATCH_LOG_FILE)

  if (['1', 'true', 'yes'].includes((process.env.VERIFY_CLEANUP ?? '').toLowerCase())) {
    section('Cleanup')
    const deletedLost = await request(lostReporter, `/api/items/${lostItem.id}`, {
      method: 'DELETE',
    })
    const deletedFound = await request(finder, `/api/items/${foundItem.id}`, { method: 'DELETE' })
    check(
      'the two verification reports and their matches were deleted',
      deletedLost.status === 200 && deletedFound.status === 200,
      `${deletedLost.status}/${deletedFound.status}`,
    )
    if (otherReport.data?.item?.id) {
      await request(finder, `/api/items/${otherReport.data.item.id}`, { method: 'DELETE' })
    }
    const deletedReverseFound = await request(finder, `/api/items/${foundFirstItem.id}`, {
      method: 'DELETE',
    })
    const deletedReverseLost = await request(lostReporter, `/api/items/${lostLaterItem.id}`, {
      method: 'DELETE',
    })
    check(
      'the case 2 pair was deleted as well',
      deletedReverseFound.status === 200 && deletedReverseLost.status === 200,
      `${deletedReverseFound.status}/${deletedReverseLost.status}`,
    )
    note('the two verification accounts remain — this script does not delete registrations.')
  } else {
    note('the two accounts, both reports, the Match row and the notification were kept as real data.')
    note('re-run with VERIFY_CLEANUP=1 to delete the reports and their matches again.')
  }

  finish('Matching pipeline verified.')
}

main().catch((error) => {
  console.error('verify:match crashed:', error)
  process.exitCode = 1
})

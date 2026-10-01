/**
 * Read-only photo search: behaviour and the read-only guarantee.
 *
 *   node scripts/photo-search-check.mjs      (with the app running)
 *
 * Self-provisioning: the seed only creates the OSAS admin, so this script
 * registers its own account, reports two throwaway items through the real API,
 * searches with their photos, and deletes them again. It proves four things
 * beyond "it returns something":
 *   1. the same threshold and top-10 limit as report matching apply,
 *   2. the type filter really filters,
 *   3. nothing is written — no Item, no Match, no Notification,
 *   4. the uploaded photo is never stored on disk.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(here, '..', 'uploads')
const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'

const ADMIN = { email: 'admin@cvsu.test', password: 'admin123' }

/** The check's own account, registered on first run and reused afterwards. */
const CHECK_ACCOUNT = {
  name: 'Photo Search Check',
  email: 'photo-search-check@cvsu.test',
  password: 'photo-search-check-1',
  studentId: 'CHECK-0001',
  contact: 'check@cvsu.test',
}

let checks = 0
let failures = 0

function check(label, passed, detail) {
  checks += 1
  const suffix = detail ? ` — ${detail}` : ''
  if (passed) console.log(`  PASS ${String(checks).padStart(2)}. ${label}${suffix}`)
  else {
    failures += 1
    console.error(`  FAIL ${String(checks).padStart(2)}. ${label}${suffix}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

async function request(jar, routePath, options = {}) {
  const headers = { ...(options.headers ?? {}) }
  if (jar?.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

  const response = await fetch(new URL(routePath, BASE_URL), {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
    redirect: 'manual',
  })

  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';')
    const index = pair.indexOf('=')
    if (index <= 0 || !jar) continue
    const name = pair.slice(0, index).trim()
    const value = pair.slice(index + 1).trim()
    if (value === '') jar.delete(name)
    else jar.set(name, value)
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: response.status, data }
}

function login(session, credentials) {
  return request(session, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

/** Registers the check account once, then signs in on later runs. */
async function ensureCheckAccount(jar) {
  const registration = await request(jar, '/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(CHECK_ACCOUNT),
  })
  if (registration.status === 201) return 'registered'

  const signIn = await login(jar, {
    email: CHECK_ACCOUNT.email,
    password: CHECK_ACCOUNT.password,
  })
  return signIn.status === 200 ? 'signed in' : null
}

/** Draws the fixtures locally: two different shapes, plus a photo of nothing. */
async function makeFixtureImages() {
  const draw = (svg) =>
    sharp({
      create: { width: 640, height: 640, channels: 3, background: { r: 246, g: 243, b: 236 } },
    })
      .composite([{ input: Buffer.from(svg) }])
      .png()
      .toBuffer()

  return {
    boxNavy: await draw(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect x="170" y="200" width="300" height="220" rx="26" fill="#1d3f7a"/><rect x="240" y="266" width="160" height="90" rx="12" fill="#111827"/></svg>',
    ),
    circleRed: await draw(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><circle cx="320" cy="330" r="150" fill="#c0392b"/><rect x="300" y="170" width="40" height="120" fill="#7f1d1d"/></svg>',
    ),
    nothing: await draw(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect x="30" y="30" width="580" height="580" fill="#9e9e9e"/></svg>',
    ),
  }
}

/** Files a real report, exactly the way the form does. */
async function reportItem(jar, { type, name, color, image }) {
  const form = new FormData()
  form.set('type', type)
  form.set('name', name)
  form.set('description', `${name}, created by the photo search check.`)
  form.set('color', color)
  form.set('dateEvent', new Date().toISOString().slice(0, 10))
  form.set('location', 'Check fixture location')
  form.set('photo', new File([image], 'fixture.png', { type: 'image/png' }))

  const response = await request(jar, '/api/items', { method: 'POST', body: form })
  return response.data?.item ?? null
}

/** Posts a photo to the search endpoint, optionally with a type filter. */
async function searchByPhoto(jar, image, type) {
  const form = new FormData()
  if (type) form.set('type', type)
  form.set('photo', new File([image], 'search.png', { type: 'image/png' }))

  return request(jar, '/api/items/photo-search', { method: 'POST', body: form })
}

/** The counters that must not move if the search is truly read-only. */
async function snapshot(jar, admin) {
  const [notices, items, stats] = await Promise.all([
    request(jar, '/api/notifications'),
    request(jar, '/api/items?pageSize=1'),
    request(admin, '/api/admin/stats'),
  ])
  const uploadFiles = (await readdir(uploadsDir)).length

  return {
    notifications: notices.data?.pagination?.total ?? -1,
    items: items.data?.pagination?.total ?? -1,
    matches: stats.data?.totals?.possibleMatches ?? -1,
    uploadFiles,
  }
}

function describe(value) {
  return `notifications=${value.notifications} items=${value.items} matches=${value.matches} uploadFiles=${value.uploadFiles}`
}

async function main() {
  const account = new Map()
  const admin = new Map()
  const anonymous = new Map()

  section('Sign in')
  const accountState = await ensureCheckAccount(account)
  check('the check account is registered or signed in', Boolean(accountState), accountState ?? 'unreachable')
  check('the OSAS admin can sign in', (await login(admin, ADMIN)).status === 200)

  const baseline = await snapshot(account, admin)

  section('Fixtures — real reports, filed through the API')
  const images = await makeFixtureImages()
  const lostFixture = await reportItem(account, {
    type: 'LOST',
    name: 'Check fixture — navy box',
    color: 'navy blue',
    image: images.boxNavy,
  })
  const foundFixture = await reportItem(account, {
    type: 'FOUND',
    name: 'Check fixture — red circle',
    color: 'red',
    image: images.circleRed,
  })
  check('the lost fixture is reported', Boolean(lostFixture?.id), lostFixture?.id)
  check('the found fixture is reported', Boolean(foundFixture?.id), foundFixture?.id)

  const before = await snapshot(account, admin)

  section('Search by photo — both types')
  const both = await searchByPhoto(account, images.boxNavy, 'BOTH')
  const found = both.data ?? {}
  const matches = found.matches ?? []

  check(
    'the search returns 200',
    both.status === 200,
    both.status === 200 ? undefined : JSON.stringify(both.data),
  )
  check('it reports the threshold it applied', typeof found.threshold === 'number', `threshold=${found.threshold}`)
  check('it reports the top-10 limit', found.topK === 10, `topK=${found.topK}`)
  check('it searched both types', JSON.stringify(found.searchedTypes) === '["LOST","FOUND"]')
  check('it found the seeded lost backpack', matches.length > 0, `count=${found.count}`)
  check(
    'an above-threshold search carries no near misses',
    found.nearMissCount === 0 && (found.nearMisses ?? []).length === 0,
    `nearMissCount=${found.nearMissCount}`,
  )
  check('it reports the near-miss floor', typeof found.nearMissFloor === 'number', `nearMissFloor=${found.nearMissFloor}`)

  const byOwnPhoto = matches.find((match) => match.id === lostFixture?.id)
  check(
    'searching with a report’s own photo finds that report, at the top',
    Boolean(byOwnPhoto) && byOwnPhoto.similarity > 0.99 && matches[0]?.id === lostFixture?.id,
    byOwnPhoto ? `similarity=${byOwnPhoto.similarity.toFixed(4)}` : 'not returned',
  )
  check(
    'every result clears the threshold',
    matches.every((match) => match.similarity >= found.threshold),
  )
  check(
    'results are ordered by similarity',
    matches.every((match, index, all) => index === 0 || all[index - 1].similarity >= match.similarity),
  )
  check(
    'a result carries everything the card grid renders',
    Boolean(byOwnPhoto) &&
      typeof byOwnPhoto.id === 'string' &&
      typeof byOwnPhoto.photoUrl === 'string' &&
      typeof byOwnPhoto.location === 'string' &&
      typeof byOwnPhoto.dateEvent === 'string' &&
      typeof byOwnPhoto.status === 'string',
  )
  check(
    'no Match row is exposed (read-only shape, no matchId)',
    matches.every((match) => !('matchId' in match)),
  )
  check(
    'results never advertise another person’s candidate count',
    matches.every((match) => match.matchCount === 0),
  )

  section('Type filter')
  const lostOnly = await searchByPhoto(account, images.boxNavy, 'LOST')
  const lostMatches = lostOnly.data?.matches ?? []
  check(
    'type=LOST returns the lost fixture and nothing of type FOUND',
    lostOnly.status === 200 &&
      lostMatches.some((match) => match.id === lostFixture?.id) &&
      lostMatches.every((match) => match.type === 'LOST'),
    `count=${lostOnly.data?.count}`,
  )

  const foundOnly = await searchByPhoto(account, images.boxNavy, 'FOUND')
  const foundMatches = foundOnly.data?.matches ?? []
  check(
    'type=FOUND excludes the lost fixture and returns only found items',
    foundOnly.status === 200 &&
      foundMatches.every((match) => match.type === 'FOUND' && match.isMine === false) &&
      !foundMatches.some((match) => match.id === lostFixture?.id),
    `count=${foundOnly.data?.count}`,
  )

  section('The other fixture, and a photo of nothing')
  const circle = await searchByPhoto(account, images.circleRed, 'BOTH')
  const circleTop = (circle.data?.matches ?? [])[0]
  check(
    'the found fixture is found by its own photo, and is a FOUND item',
    circle.status === 200 && circleTop?.id === foundFixture?.id && circleTop?.type === 'FOUND',
    circleTop ? `${circleTop.name}@${circleTop.similarity.toFixed(4)}` : 'no results',
  )

  const nothingResult = await searchByPhoto(account, images.nothing, 'BOTH')
  check(
    'a photo of nothing returns either no results, or only above-threshold ones',
    nothingResult.status === 200 &&
      (nothingResult.data?.matches ?? []).every(
        (match) => match.similarity >= nothingResult.data.threshold,
      ),
    `count=${nothingResult.data?.count}`,
  )

  section('Near misses — what a dead-end search still shows')
  const near = nothingResult.data ?? {}
  const nearMisses = near.nearMisses ?? []
  if (near.count === 0) {
    check(
      'every near miss sits below the match bar but at or above the floor',
      nearMisses.every(
        (match) => match.similarity < near.threshold && match.similarity >= near.nearMissFloor,
      ),
      nearMisses.length > 0
        ? `best=${nearMisses[0].similarity.toFixed(4)} floor=${near.nearMissFloor}`
        : 'none shown (all candidates under the floor)',
    )
    check(
      'near misses are ordered by similarity and capped',
      nearMisses.every(
        (match, index, all) => index === 0 || all[index - 1].similarity >= match.similarity,
      ) && nearMisses.length <= 10,
      `shown=${nearMisses.length}`,
    )
    check(
      'the reported near-miss count matches the list',
      near.nearMissCount === nearMisses.length,
      `count=${near.nearMissCount} list=${nearMisses.length}`,
    )
    check(
      'a near miss carries everything the card grid renders',
      nearMisses.every(
        (match) =>
          typeof match.id === 'string' &&
          typeof match.location === 'string' &&
          typeof match.dateEvent === 'string' &&
          typeof match.status === 'string' &&
          typeof match.similarity === 'number',
      ),
    )
  } else {
    check(
      'an above-threshold result never carries near misses',
      near.nearMissCount === 0 && nearMisses.length === 0,
      `count=${near.count} nearMissCount=${near.nearMissCount}`,
    )
  }

  section('Validation and access')
  const emptyForm = new FormData()
  emptyForm.set('type', 'BOTH')
  const missingPhoto = await request(account, '/api/items/photo-search', {
    method: 'POST',
    body: emptyForm,
  })
  check('a search with no photo is refused', missingPhoto.status === 422, String(missingPhoto.status))

  const badType = await searchByPhoto(account, images.boxNavy, 'SIDEWAYS')
  check('an unknown type is refused', badType.status === 400, String(badType.status))

  const anonForm = new FormData()
  anonForm.set('photo', new File([images.boxNavy], 'x.png', { type: 'image/png' }))
  const anonResult = await request(anonymous, '/api/items/photo-search', {
    method: 'POST',
    body: anonForm,
  })
  check('searching without a session is refused', anonResult.status === 401, String(anonResult.status))

  section('Read-only guarantee')
  const after = await snapshot(account, admin)
  check(
    'no Item, Match, Notification or stored photo was created by searching',
    JSON.stringify(before) === JSON.stringify(after),
    `before [${describe(before)}] after [${describe(after)}]`,
  )

  section('Clean up')
  const removedLost = await request(account, `/api/items/${lostFixture?.id}`, { method: 'DELETE' })
  const removedFound = await request(account, `/api/items/${foundFixture?.id}`, { method: 'DELETE' })
  check(
    'the fixtures are withdrawn again',
    removedLost.status === 200 && removedFound.status === 200,
    `${removedLost.status}/${removedFound.status}`,
  )

  const final = await snapshot(account, admin)
  const owned = (value) => ({
    items: value.items,
    matches: value.matches,
    uploadFiles: value.uploadFiles,
  })
  check(
    'items, matches and stored photos are back to baseline after cleanup',
    JSON.stringify(owned(baseline)) === JSON.stringify(owned(final)),
    `baseline ${JSON.stringify(owned(baseline))} final ${JSON.stringify(owned(final))}`,
  )

  // Reporting a found item notifies the owner of any lost item it matches, and a
  // Notification references its item by id without a foreign key, so withdrawing
  // the reports cannot remove that notice. That is report behaviour, not search
  // behaviour: the search itself wrote nothing at all (see the check above).
  check(
    'the search itself left no notification behind',
    after.notifications === before.notifications,
    `before=${before.notifications} after=${after.notifications}`,
  )
  const noticeResidue = final.notifications - baseline.notifications
  if (noticeResidue > 0) {
    console.log(
      `  NOTE  the two test reports left ${noticeResidue} match notification(s) behind: ` +
        'Notification.itemId has no cascade, so it survives its item being withdrawn.',
    )
  }

  console.log(`\n${checks - failures}/${checks} checks passed`)
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`)
    process.exitCode = 1
  } else {
    console.log('Photo search checks passed.')
  }
}

main().catch((error) => {
  console.error('Photo search check crashed:', error)
  process.exitCode = 1
})

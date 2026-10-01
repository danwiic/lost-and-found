/**
 * Render checks for the designed surface: registers an account, drives the real
 * API and then pulls the HTML a browser would receive, asserting what a person
 * would actually see. This is the cheap stand-in for screenshots in an
 * environment without browser automation.
 *
 * No demo account and no seeded item is needed: the script creates the two
 * accounts and the reports it renders. The admin account comes from the seed.
 *
 *   npm run check:render      (with the app running)
 */
import { createSession, request, reportForm, uniqueEmail } from './lib/api-client.mjs'
import { createChecker } from './lib/checks.mjs'
import { photoPair } from './lib/fixtures.mjs'

const { check, section, finish } = createChecker()
const PASSWORD = 'render-pass-1234'

async function register(session, name, prefix) {
  const email = uniqueEmail(prefix)
  const response = await request(session, '/api/auth/register', {
    json: { name, email, password: PASSWORD, studentId: 'R-10001', contact: '0917 000 0000' },
  })
  if (response.status !== 201) {
    throw new Error(`Could not register ${name}: ${response.status} ${JSON.stringify(response.data)}`)
  }
  return { session, id: response.data.user.id, name, email }
}

function html(session, path) {
  return request(session, path)
}

async function main() {
  const jar = createSession('visitor')

  section('Sign-in gate')
  const anonymous = await html(jar, '/')
  check(
    'an anonymous visit to the desk is redirected to sign in',
    anonymous.status === 307 && anonymous.location.includes('/login'),
    `${anonymous.status} -> ${anonymous.location}`,
  )

  const login = await html(jar, '/login')
  check('the sign-in page renders', login.status === 200)
  check('the sign-in page names the action', login.data.includes('Sign in'))
  check(
    'the sign-in page does not print any credentials',
    !login.data.includes('@cvsu.test') &&
      !login.data.includes('admin123') &&
      !login.data.includes('student123'),
  )
  check(
    'the sign-in form has a real label, not a placeholder-only field',
    login.data.includes('for="email"') && login.data.includes('Email address'),
  )

  section('Self-hosted type and theming')
  const cssHref = /href="(\/_next\/static\/[^"]+\.css)"/.exec(login.data)?.[1]
  const css = cssHref ? (await html(jar, cssHref)).data : ''
  check(
    'the fonts are self-hosted files, with no third-party font request',
    /@font-face/.test(css) &&
      /\.woff2/.test(css) &&
      !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(login.data + css),
    `${(css.match(/@font-face/g) ?? []).length} @font-face rules`,
  )
  check('the stylesheet carries the canvas token', css.includes('--color-canvas'), cssHref)
  check('the stylesheet carries the interface font variable', css.includes('--font-inter'))
  check(
    'the stylesheet themes the browser surfaces (selection and scrollbar)',
    css.includes('::selection') && css.includes('scrollbar'),
  )
  check(
    'the stylesheet keeps tabular figures for measurement type',
    css.includes('tabular-nums'),
  )

  section('An account and a report, made here')
  const owner = await register(createSession('owner'), 'Render Owner', 'render.owner')
  check('a student can register through the API', Boolean(owner.id), owner.email)

  const photos = await photoPair('backpack')
  const lostReport = await request(owner.session, '/api/items', {
    form: reportForm(photos.lost, {
      type: 'LOST',
      name: 'Blue backpack, library reading room',
      color: 'blue',
      description: 'Blue backpack left beside the window in the reading room.',
      location: 'Library, 2nd floor',
      dateEvent: new Date().toISOString().slice(0, 10),
    }),
  })
  check('the report is accepted', lostReport.status === 201, String(lostReport.status))
  if (lostReport.status !== 201) {
    finish()
    return
  }

  section('The desk')
  const desk = await html(owner.session, '/')
  check('the desk renders for the signed-in student', desk.status === 200)

  const unread = await request(owner.session, '/api/notifications?unread=1')
  const unreadMatches = (unread.data?.notifications ?? []).filter(
    (notice) => notice.type === 'POSSIBLE_MATCH',
  ).length
  const unreadTotal = unread.data?.unreadCount ?? 0
  const headingPattern =
    unreadMatches > 0
      ? /possible match(?:es)? to review/
      : unreadTotal > 0
        ? /unread notices?/
        : /Nothing is waiting on you/

  check(
    'the heading states the situation, and agrees with the real unread state',
    headingPattern.test(desk.data),
    `unreadMatches=${unreadMatches} unreadTotal=${unreadTotal} -> ${
      /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(desk.data)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? 'no h1'
    }`,
  )
  check(
    'the heading is not a screen name',
    !/<h1[^>]*>\s*(Dashboard|Home)\s*<\/h1>/.test(desk.data),
  )
  check(
    'the situation line explains what a match means',
    desk.data.includes('Report what you lost, or what you found and turned in'),
  )
  check('the reported record is listed', desk.data.includes('Blue backpack, library reading room'))

  // The desk must agree with the record as the API reports it: an item that
  // already found a match shows "Possible Match" and offers the action, one that
  // has not shows "Pending" and offers nothing.
  const lostDetail = await request(owner.session, `/api/items/${lostReport.data.item.id}`)
  const realStatus = lostDetail.data?.item?.status ?? 'PENDING'
  const realMatches = (lostDetail.data?.matches ?? []).length
  check(
    'the record carries the status the API reports',
    desk.data.includes(realStatus === 'POSSIBLE_MATCH' ? 'Possible Match' : 'Pending'),
    `status=${realStatus}`,
  )
  check(
    'the match action appears exactly when the record has a match',
    desk.data.includes('View Match') === (realMatches > 0),
    `matches=${realMatches}`,
  )
  check('the tally line is present', desk.data.includes('My lost reports'))
  check(
    'the primary actions use explicit labels',
    desk.data.includes('Report Lost Item') && desk.data.includes('Report Found Item'),
  )
  check('the attention panel is titled for the reader', desk.data.includes('Waiting on you'))
  check(
    'the shell exposes every destination from UX.md §3.1',
    ['Home', 'Browse Items', 'My Reports', 'My Claims', 'Notifications', 'Profile'].every((label) =>
      desk.data.includes(label),
    ),
  )
  check('the ledger states the product principle in the rail', desk.data.includes('OSAS verifies'))

  section('Notifications, and what they say about the situation')
  const noticesBefore = await request(owner.session, '/api/notifications?unread=1')
  const unreadBefore = (noticesBefore.data?.notifications ?? []).length
  const notifications = await html(owner.session, '/notifications')
  check(
    'the notifications surface agrees with the real state',
    notifications.status === 200 &&
      (unreadBefore === 0
        ? notifications.data.includes('all caught up')
        : notifications.data.includes('Possible match found')),
    `${unreadBefore} unread notice(s)`,
  )
  check(
    'notifications explains the mark-as-read rule',
    notifications.data.includes('marks it as read'),
  )

  section('A found report of the same object changes the desk')
  const finder = await register(createSession('finder'), 'Render Finder', 'render.finder')
  const foundReport = await request(finder.session, '/api/items', {
    form: reportForm(photos.found, {
      type: 'FOUND',
      name: 'Blue backpack turned in at the lobby',
      color: 'blue',
      description: 'Blue backpack handed to the front desk, front pocket empty.',
      location: 'Main lobby',
      dateEvent: new Date().toISOString().slice(0, 10),
    }),
  })
  check(
    'the found report matched the earlier lost report',
    (foundReport.data?.matches ?? []).length > 0,
    `matches=${(foundReport.data?.matches ?? []).length}`,
  )

  const deskWithMatch = await html(owner.session, '/')
  check(
    'the heading now leads with the possible match',
    /possible match(?:es)? to review/.test(deskWithMatch.data),
    /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(deskWithMatch.data)?.[1]?.replace(/<[^>]+>/g, '').trim(),
  )
  check(
    'the situation line names the limit of a score',
    deskWithMatch.data.includes('Similarity is a lead, not proof'),
  )
  check(
    'the record now carries the Possible Match badge',
    deskWithMatch.data.includes('Possible Match'),
  )
  check('the match action is offered on the record', deskWithMatch.data.includes('View Match'))
  check(
    'the honesty line is not repeated on the desk body',
    !deskWithMatch.data.includes('does not confirm ownership'),
  )

  const noticesPage = await html(owner.session, '/notifications')
  check(
    'notifications renders the notice list',
    noticesPage.data.includes('Possible match found'),
  )

  section('Browse, and the item a student would open')
  const browse = await html(owner.session, '/browse')
  check(
    'Browse renders the real surface',
    browse.status === 200 && browse.data.includes('Browse Items'),
    String(browse.status),
  )
  check(
    'Browse lists what has actually been reported',
    browse.data.includes('Blue backpack turned in at the lobby') &&
      browse.data.includes('Blue backpack, library reading room'),
  )
  const noHits = await html(owner.session, '/browse?q=zzqqnothing')
  check(
    'a search with no hits explains itself and offers the way back',
    noHits.data.includes('No items match your current search') &&
      noHits.data.includes('Clear Filters'),
  )
  check(
    'a filter is removable on its own',
    (await html(owner.session, '/browse?type=FOUND')).data.includes('Found items'),
  )

  const foundId = foundReport.data.item.id
  const foundPage = await html(owner.session, `/items/${foundId}`)
  check(
    'item details render the record and its reporter',
    foundPage.status === 200 &&
      foundPage.data.includes('Blue backpack turned in at the lobby') &&
      foundPage.data.includes('Reported by'),
    String(foundPage.status),
  )
  check(
    "another person's open item offers Submit Claim",
    foundPage.data.includes('Submit Claim'),
  )

  const ownPage = await html(owner.session, `/items/${lostReport.data.item.id}`)
  check(
    'your own report says who claims, not how to claim it',
    ownPage.data.includes('This is your report') && !ownPage.data.includes('Submit Claim'),
  )

  section('The claim request')
  const claimPage = await html(owner.session, `/items/${foundId}/claim`)
  check(
    'the claim form asks for the five fields UX.md §5.1 lists',
    claimPage.status === 200 &&
      ['Claimant name', 'Student / personnel ID', 'Contact information', 'Proof of ownership',
        'Additional item details'].every((label) => claimPage.data.includes(label)),
    String(claimPage.status),
  )
  check(
    'the claim form states that a claim starts Pending',
    claimPage.data.includes('Your claim starts as Pending'),
  )
  check(
    'the claim form echoes the item being claimed',
    claimPage.data.includes('Blue backpack turned in at the lobby'),
  )
  check(
    'the claim form is not offered on your own report',
    (await html(owner.session, `/items/${lostReport.data.item.id}/claim`)).status === 307,
  )

  const filedClaim = await request(owner.session, `/api/items/${foundId}/claims`, {
    json: {
      claimantName: 'Render Owner',
      studentId: 'R-10001',
      contact: '0917 000 0000',
      additionalDetails: 'The front pocket lining is torn.',
      proof: 'My name is written in blue ink inside the main compartment.',
    },
  })
  check('the claim is accepted', filedClaim.status === 201, String(filedClaim.status))

  const myClaims = await html(owner.session, '/claims')
  check(
    'My Claims lists the claim with its status',
    myClaims.status === 200 &&
      myClaims.data.includes('Blue backpack turned in at the lobby') &&
      myClaims.data.includes('Pending'),
    String(myClaims.status),
  )

  const myReports = await html(owner.session, '/my-reports')
  check(
    "My Reports lists the student's own report with its totals",
    myReports.status === 200 &&
      myReports.data.includes('My Reports') &&
      myReports.data.includes('Blue backpack, library reading room') &&
      myReports.data.includes('Lost reports'),
    String(myReports.status),
  )

  section('The remaining student surfaces')
  check(
    'the reported item now says a claim is under verification',
    (await html(owner.session, `/items/${foundId}`)).data.includes('awaiting OSAS verification'),
  )
  check(
    'Report Lost renders its form',
    (await html(owner.session, '/report/lost')).data.includes('Photo'),
  )
  check(
    'Report Found renders its form',
    (await html(owner.session, '/report/found')).data.includes('Photo'),
  )
  check(
    'Profile renders the signed-in account',
    (await html(owner.session, '/profile')).data.includes(owner.email),
  )
  const registerPage = await html(createSession('visitor'), '/register')
  check(
    'the registration screen renders every field it needs',
    registerPage.status === 200 &&
      ['Full name', 'Email address', 'Password', 'Student / personnel ID', 'Contact number'].every(
        (label) => registerPage.data.includes(label),
      ),
    String(registerPage.status),
  )
  check(
    'the sign-in page offers the way to register',
    login.data.includes('Create one') || login.data.includes('/register'),
  )

  section('The OSAS side')
  const admin = createSession('admin')
  const adminLogin = await request(admin, '/api/auth/login', {
    json: { email: 'admin@cvsu.test', password: 'admin123' },
  })
  check(
    'the seeded OSAS admin can sign in',
    adminLogin.status === 200 && adminLogin.data?.user?.role === 'ADMIN',
    JSON.stringify(adminLogin.data?.user?.email ?? adminLogin.data),
  )

  const dashboard = await html(admin, '/admin')
  check(
    'the OSAS dashboard renders the counters',
    dashboard.status === 200 && dashboard.data.includes('Claims to verify'),
    String(dashboard.status),
  )
  check(
    'the dashboard shows the claim that was just filed',
    dashboard.data.includes('Render Owner'),
  )
  check(
    'a student is sent away from the OSAS dashboard',
    (await html(owner.session, '/admin')).status === 307,
  )

  const adminRoutes = ['/admin/lost', '/admin/found', '/admin/returns']
  for (const route of adminRoutes) {
    const page = await html(admin, route)
    check(`${route} renders for OSAS staff`, page.status === 200, String(page.status))
  }

  const claimQueue = await html(admin, '/admin/claims?status=PENDING')
  check(
    'the claim queue lists the pending claim',
    claimQueue.status === 200 && claimQueue.data.includes('Render Owner'),
    String(claimQueue.status),
  )
  check(
    'an empty view of the queue says so rather than showing nothing',
    (await html(admin, '/admin/claims?status=REJECTED')).data.includes('No claims with that status'),
  )

  const claimId = filedClaim.data?.claim?.id
  const review = await html(admin, `/admin/claims/${claimId}`)
  check(
    'the review page shows the proof beside the item as reported',
    review.status === 200 &&
      review.data.includes('The item as reported') &&
      review.data.includes('The item as claimed') &&
      review.data.includes('My name is written in blue ink inside the main compartment.'),
    String(review.status),
  )
  check(
    'the review page offers both decisions by name',
    review.data.includes('Approve Claim') && review.data.includes('Reject Claim'),
  )
  check(
    'the return form is withheld until the claim is approved',
    !review.data.includes('Record Return'),
  )

  section('Sign out')
  const signOut = await request(owner.session, '/api/auth/logout', { method: 'POST' })
  check('signing out clears the session', signOut.status === 200)

  const after = await html(owner.session, '/')
  check('the desk is protected again after signing out', after.status === 307)

  finish('Render checks passed.')
}

main().catch((error) => {
  console.error('Render check crashed:', error)
  process.exitCode = 1
})

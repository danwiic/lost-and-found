/**
 * Matching lab — measure labelled photo pairs and build the dataset that
 * MATCH_BASELINE and MATCH_THRESHOLD are tuned from.
 *
 * Every pair you measure is appended to the dataset file, so this session's
 * numbers survive into the next one instead of living in a chat log.
 *
 *   npm run match:lab -- --a photo1.jpg --b photo2.jpg --label same --category wallet
 *   npm run match:lab -- --a photo1.jpg --b photo2.jpg --label different --category wallet
 *   npm run match:lab -- --summary            # just show where the dataset stands
 *
 *   SMOKE_BASE_URL=http://127.0.0.1:3000 npm run match:lab -- ...   # other server
 *
 * It talks to the running app (`POST /api/dev/matching-lab`, ADMIN only), which
 * embeds both photos with the real matching pipeline and stores one JSONL row.
 * Nothing is written to the database, and the photos are not stored.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const USAGE = `
Usage: npm run match:lab -- --a <photo> --b <photo> --label same|different [options]

  --a <file>            first photo (required unless --summary)
  --b <file>            second photo (required unless --summary)
  --label <same|different>   what the pair actually is (required unless --summary)
  --category <text>     optional: what kind of object ("wallet", "speaker")
  --note <text>         optional: anything worth recording about the pair
  --summary             print the dataset summary and exit (measures nothing)
  --base <url>          server to talk to (default http://127.0.0.1:3000)
  --email/--password    admin credentials (default admin@cvsu.test / admin123)
`.trim()

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      i += 1
    }
  }
  return options
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`)
  process.exit(1)
}

const n = (value) => Number(value).toFixed(4)

function printSummary(summary) {
  console.log('\n  Dataset')
  console.log(`    pairs measured        ${summary.pairs}`)
  const line = (name, stats) =>
    stats
      ? `    ${name.padEnd(21)} n=${String(stats.count).padEnd(4)} mean=${n(stats.mean)}  min=${n(stats.min)}  max=${n(stats.max)}`
      : `    ${name.padEnd(21)} —`
  console.log(line('same object', summary.same))
  console.log(line('different objects', summary.different))

  if (summary.lowestSame !== null && summary.highestDifferent !== null) {
    const gap = summary.lowestSame - summary.highestDifferent
    console.log(`\n    lowest SAME ${n(summary.lowestSame)}  |  highest DIFFERENT ${n(summary.highestDifferent)}`)
    if (gap > 0) {
      console.log(`    clean gap of ${n(gap)} → a threshold of ${n(summary.suggested)} separates them`)
    } else {
      console.log(
        `    the sets OVERLAP by ${n(-gap)} — no threshold separates them; category or colour filtering is what to look at next`,
      )
    }
  }

  if (summary.disagreements.length > 0) {
    console.log(`\n    the threshold in force now gets ${summary.disagreements.length} pair(s) wrong:`)
    for (const row of summary.disagreements) {
      console.log(`      ${row.at.slice(0, 10)}  ${row.label.padEnd(9)} ${n(row.calibrated)}  ${row.category ?? ''}`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
    return
  }

  const base = typeof options.base === 'string' ? options.base : process.env.SMOKE_BASE_URL
  if (base) process.env.SMOKE_BASE_URL = base

  // Imported after the base URL is settled: the client reads it once, at load.
  const { request, createSession, BASE_URL } = await import('./lib/api-client.mjs')
  const email = typeof options.email === 'string' ? options.email : 'admin@cvsu.test'
  const password = typeof options.password === 'string' ? options.password : 'admin123'

  const session = createSession('matching-lab')
  const login = await request(session, '/api/auth/login', { json: { email, password } })
  if (login.status !== 200) {
    fail(`Could not sign in as ${email} at ${BASE_URL} (HTTP ${login.status}). Is the app running?`)
  }

  if (options.summary) {
    const response = await request(session, '/api/dev/matching-lab')
    if (response.status !== 200) fail(`Could not read the dataset (HTTP ${response.status}).`)
    console.log(`\n  Matching lab — ${BASE_URL}`)
    printSummary(response.data.summary)
    console.log('')
    return
  }

  const { a, b, label, category, note } = options
  if (typeof a !== 'string' || typeof b !== 'string') fail('Both --a and --b are required.')
  if (label !== 'same' && label !== 'different') fail('--label must be "same" or "different".')

  const [bufferA, bufferB] = await Promise.all([
    readFile(a).catch(() => fail(`Could not read ${a}`)),
    readFile(b).catch(() => fail(`Could not read ${b}`)),
  ])

  const form = new FormData()
  form.set('label', label)
  if (typeof category === 'string') form.set('category', category)
  if (typeof note === 'string') form.set('note', note)
  form.set('photoA', new File([bufferA], path.basename(a), { type: 'image/jpeg' }))
  form.set('photoB', new File([bufferB], path.basename(b), { type: 'image/jpeg' }))

  const response = await request(session, '/api/dev/matching-lab', { form })
  if (response.status !== 201) {
    const detail =
      response.data && typeof response.data === 'object'
        ? JSON.stringify(response.data)
        : String(response.data)
    fail(`Measurement failed (HTTP ${response.status}): ${detail}`)
  }

  const { result, summary } = response.data
  console.log(`\n  Matching lab — ${BASE_URL}`)
  console.log(`    pair      ${path.basename(a)}  vs  ${path.basename(b)}`)
  console.log(`    label     ${result.label}${result.category ? `  (${result.category})` : ''}`)
  console.log(`    raw       ${n(result.raw)}`)
  console.log(`    calibrated ${n(result.calibrated)}   (baseline ${result.baseline.toFixed(2)})`)
  console.log(`    threshold ${result.threshold.toFixed(3)} → ${result.wouldMatch ? 'would MATCH' : 'would NOT match'}`)
  console.log(`    label says ${result.agrees ? 'the same thing ✓' : 'something else ✗'}`)
  if (result.note) console.log(`    note      ${result.note}`)

  printSummary(summary)
  console.log('')
}

await main()

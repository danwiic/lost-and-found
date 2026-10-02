/**
 * Page-header audit.
 *
 * Visual hierarchy is only as stable as its weakest page: one page that
 * hand-rolls an <h1> at its own size, or grows a three-line introduction, drags
 * the whole system with it. The title scale, the description's size and the way
 * back to a parent page live in src/components/layout/PageHeader.tsx, and every
 * page under (app) has to use them.
 *
 * Two rules:
 *   1. No page under src/app/(app) may contain its own <h1> element.
 *   2. A static description must stay on one line and under 96 characters.
 *      (Dynamic descriptions — the desk's situation line, the claim's "filed by"
 *      line — cannot be measured here; they are short by construction.)
 *
 * The one exception is the item record page, where the title belongs inside the
 * photo grid rather than above it; it is listed below with its reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const appDir = join(root, 'src', 'app', '(app)')

/** Pages whose title is not a page header, with the reason. */
const EXEMPT = new Map([
  [
    join('src', 'app', '(app)', 'items', '[id]', 'page.tsx'),
    'the record page titles itself inside the photo grid, beside the item photo',
  ],
])

const DESCRIPTION_LIMIT = 96

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...walk(path))
    else if (entry === 'page.tsx') found.push(path)
  }
  return found
}

const problems = []
let checked = 0

for (const path of walk(appDir).sort()) {
  const name = relative(root, path)
  if (EXEMPT.has(name)) continue
  checked += 1

  const source = readFileSync(path, 'utf8')

  if (!source.includes('<PageHeader')) {
    problems.push(`${name}: does not use <PageHeader>`)
  }
  if (/<h1[\s>]/.test(source)) {
    problems.push(`${name}: declares its own <h1> (the title scale belongs in PageHeader)`)
  }

  for (const match of source.matchAll(/description="([^"]*)"/g)) {
    const text = match[1]
    if (text.length > DESCRIPTION_LIMIT) {
      problems.push(
        `${name}: description is ${text.length} characters (limit ${DESCRIPTION_LIMIT}) — “${text.slice(0, 48)}…”`,
      )
    }
  }
}

console.log('Page-header audit — one header, one scale\n')
console.log(`  ${checked} page(s) checked, ${EXEMPT.size} exempt`)
for (const [name, reason] of EXEMPT) {
  console.log(`  · ${name.split(sep).join('/')} — ${reason}`)
}

if (problems.length > 0) {
  console.log('')
  for (const problem of problems) console.log(`  FAIL  ${problem}`)
  console.log(`\n${problems.length} problem(s).`)
  process.exit(1)
}

console.log('\n  Every page header is the shared one, and every description is one line.')

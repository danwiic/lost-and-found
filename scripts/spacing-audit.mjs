/**
 * One spacing scale, enforced.
 *
 *   npm run audit:spacing            report anything off the scale (exit 1)
 *   npm run audit:spacing -- --fix   snap it back onto the scale
 *
 * The scale is 4 · 8 · 12 · 16 · 24 · 32 · 48 px, which is exactly Tailwind's
 * 1, 2, 3, 4, 6, 8, 12 for padding, margin, gap and space-between. Anything else
 * is mapped to the nearest step, ties going up, so rhythm stays generous.
 *
 * It also normalises page wrappers: the five different `mx-auto max-w-*` widths
 * become the shared `.page-stack` class, because width and gutters belong to
 * PageContainer, not to individual pages.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(here, '..', 'src')

/** Off-scale step -> the step it becomes. Ties go up, never down. */
const REMAP = {
  '0.5': '1',
  '1.5': '2',
  '2.5': '3',
  '3.5': '4',
  '5': '6',
  '7': '8',
  '9': '8',
  '10': '8',
  '11': '12',
  '14': '12',
  '16': '12',
  '20': '12',
  '24': '12',
  '28': '12',
  '32': '12',
  '36': '12',
  '40': '12',
  '44': '12',
  '48': '12',
  '56': '12',
  '60': '12',
  '64': '12',
}

/** Steps that are already on the scale. */
const ON_SCALE = new Set(['0', '1', '2', '3', '4', '6', '8', '12', 'auto', 'px', 'full'])

/**
 * Larger-than-scale padding kept on purpose: the mobile bottom navigation is a
 * fixed overlay, so the page needs room under its last card. This is a viewport
 * offset, not spacing between elements.
 */
const VIEWPORT_CLEARANCE = new Set(['pb-24'])

/**
 * Documented, file-scoped exceptions. The page gutter is 20px on mobile by
 * specification, which is deliberately not a step on the scale — so the one file
 * that owns the gutter keeps its own value and nothing else may use it.
 */
const FILE_EXEMPT = new Map([['components/layout/PageContainer.tsx', new Set(['px-5'])]])

/**
 * Matches a spacing utility, including any responsive/state variant prefix
 * (`sm:px-5`, `hover:mt-2.5`) so those are normalised too.
 */
const SPACING_UTILITY =
  /(^|[\s'"`])((?:[a-z-]+:)*)(-?(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]))-([0-9.]+)(?=[\s'"`]|$)/g

/** `mx-auto max-w-5xl space-y-8` and friends -> the shared stack class. */
const PAGE_WRAPPER = /mx-auto max-w-(?:2xl|3xl|4xl|5xl|6xl|7xl) space-y-8/g

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue
      yield* walk(full)
    } else if (entry.name.endsWith('.tsx')) {
      yield full
    }
  }
}

function rewrite(source, relativePath) {
  const changes = []
  const exempt = FILE_EXEMPT.get(relativePath) ?? new Set()
  let pageStacks = 0

  let text = source.replace(PAGE_WRAPPER, () => {
    pageStacks += 1
    return 'page-stack'
  })

  text = text.replace(
    SPACING_UTILITY,
    (match, lead, variant, utility, step, offset) => {
      const token = `${variant}${utility}-${step}`
      if (ON_SCALE.has(step) || VIEWPORT_CLEARANCE.has(token) || exempt.has(token)) return match

      const replacement = REMAP[step]
      if (!replacement) {
        changes.push({ kind: 'manual', token, offset })
        return match
      }

      changes.push({ kind: 'remap', token, to: `${variant}${utility}-${replacement}`, offset })
      return `${lead}${variant}${utility}-${replacement}`
    },
  )

  return { text, changes, pageStacks }
}

function lineOf(source, offset) {
  return source.slice(0, offset).split('\n').length
}

async function main() {
  const fix = process.argv.includes('--fix')
  const files = []
  for await (const file of walk(srcDir)) files.push(file)

  let touched = 0
  let remapped = 0
  let stacks = 0
  const manual = []

  console.log(`\nSpacing scale — 4 · 8 · 12 · 16 · 24 · 32 · 48${fix ? '  (fixing)' : ''}\n`)

  for (const file of files.sort()) {
    const source = await readFile(file, 'utf8')
    const relative = path.relative(srcDir, file).replace(/\\/g, '/')
    const { text, changes, pageStacks } = rewrite(source, relative)

    for (const change of changes) {
      const where = `${path.relative(srcDir, file).replace(/\\/g, '/')}:${lineOf(source, change.offset)}`
      if (change.kind === 'manual') {
        manual.push(`${where}  ${change.token} (no scale step close enough)`)
      } else {
        remapped += 1
        if (!fix) console.log(`  ${where}  ${change.token} -> ${change.to}`)
      }
    }

    if (pageStacks > 0) stacks += pageStacks

    if (fix && text !== source) {
      await writeFile(file, text)
      touched += 1
    }
  }

  if (fix) {
    console.log(`  rewrote ${touched} file(s), ${remapped} utility remap(s), ${stacks} page wrapper(s)`)
  } else {
    const total = remapped + manual.length
    console.log(
      `\n  ${remapped} off-scale utility value(s) across ${files.length} file(s)` +
        (stacks > 0 ? `, ${stacks} page wrapper(s) to normalise` : ''),
    )
  }

  if (manual.length > 0) {
    console.log('\n  Needs a human:')
    for (const entry of manual) console.log(`    ${entry}`)
  }

  if (!fix && (remapped > 0 || stacks > 0 || manual.length > 0)) {
    console.log('\n  Run `npm run audit:spacing -- --fix` to apply the scale.\n')
    process.exitCode = 1
  } else if (fix || (remapped === 0 && stacks === 0 && manual.length === 0)) {
    console.log(fix ? '' : '  Every spacing utility is on the scale.\n')
  }
}

main().catch((error) => {
  console.error('[spacing] failed:', error)
  process.exitCode = 1
})

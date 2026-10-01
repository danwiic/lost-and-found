/**
 * Prints the pairwise CLIP similarity matrix for a folder of photographs and
 * suggests a match threshold from it.
 *
 *   npm run match:matrix                      # the photos real reports uploaded
 *   npm run match:matrix -- ./some/folder
 *   npm run match:matrix -- ./uploads --pair backpack-a.jpg,backpack-b.jpg
 *
 * Embedding happens in the embedder sidecar (embedder/, POST /embed), so that
 * service must be reachable. Inside compose it is `http://embedder:8000`; from
 * the host, publish it for the run:
 *
 *   docker run --rm -p 8000:8000 $(docker compose images -q embedder)
 *   EMBEDDER_URL=http://localhost:8000 npm run match:matrix
 *
 * Real uploads are named by uuid, so nothing in the folder says which photo
 * shows which object. Label the pairs you know with `--pair <a>,<b>`
 * (repeatable); the suggestion then has a "worst true pair" and a "best
 * unrelated pair" to sit between.
 *
 * The matrix prints RAW cosine similarity (the measurable quantity). The
 * threshold suggestion is printed in CALIBRATED units — the scale the app
 * thresholds and displays — using the same MATCH_BASELINE the server uses.
 */
import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const IMAGE_PATTERN = /\.(?:jpe?g|png|webp)$/i
const MATRIX_LIMIT = 12
const EMBEDDER_URL = process.env.EMBEDDER_URL ?? 'http://localhost:8000'
const BASELINE = Number(process.env.MATCH_BASELINE ?? 0.6)

/** Same rescaling the app applies before thresholding or display. */
const calibrate = (raw) => Math.max(0, (raw - BASELINE) / (1 - BASELINE))

function parseArgs(argv) {
  const options = { dir: null, pairs: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--pair') {
      const value = argv[index + 1] ?? ''
      const [left, right] = value.split(',').map((name) => name.trim().toLowerCase())
      if (!left || !right) throw new Error(`--pair needs two file names, received "${value}"`)
      options.pairs.push([left, right])
      index += 1
    } else if (!options.dir) {
      options.dir = argument
    }
  }
  return options
}

/** One image file -> normalised 768-dim vector, via the embedder service. */
async function embed(file) {
  const imageBase64 = (await readFile(file)).toString('base64')
  let response
  try {
    response = await fetch(`${EMBEDDER_URL}/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    })
  } catch (error) {
    throw new Error(
      `The embedder service at ${EMBEDDER_URL} is unreachable. Start it with ` +
        `docker compose up -d embedder (or publish a port and set EMBEDDER_URL).`,
      { cause: error },
    )
  }
  if (!response.ok) {
    throw new Error(`The embedder service returned ${response.status} for ${file}`)
  }
  const data = await response.json()
  if (!Array.isArray(data.embedding)) {
    throw new Error(`The embedder service returned no embedding for ${file}`)
  }
  return data.embedding
}

const cosine = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0)

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const dir = path.resolve(options.dir ?? process.env.UPLOAD_DIR ?? './uploads')

  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && IMAGE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  if (files.length === 0) {
    console.log(`No photographs in ${dir}.`)
    console.log('Report an item with a photo first, or write fixtures with:')
    console.log('  node scripts/lib/fixtures.mjs ./tmp-fixtures')
    return
  }
  if (files.length === 1) {
    console.log(`${dir} holds a single photograph, so there is nothing to compare it with yet.`)
    return
  }

  const names = files.map((file) => file.toLowerCase())
  const labels = files.map((file) => file.replace(IMAGE_PATTERN, ''))

  const truePairs = options.pairs.map(([left, right]) => {
    const leftIndex = names.indexOf(left)
    const rightIndex = names.indexOf(right)
    if (leftIndex < 0 || rightIndex < 0) {
      throw new Error(`--pair ${left},${right} does not match two files in ${dir}`)
    }
    return [leftIndex, rightIndex]
  })
  const isTruePair = (row, column) =>
    truePairs.some(
      ([left, right]) =>
        (row === left && column === right) || (row === right && column === left),
    )

  console.log(`\nEmbedding ${files.length} photograph(s) from ${dir} via ${EMBEDDER_URL}…`)
  const vectors = []
  for (const file of files) {
    vectors.push(await embed(path.join(dir, file)))
  }

  const pairs = []
  for (let row = 0; row < names.length; row += 1) {
    for (let column = row + 1; column < names.length; column += 1) {
      pairs.push({
        score: cosine(vectors[row], vectors[column]),
        pair: `${labels[row]} <-> ${labels[column]}`,
        row,
        column,
      })
    }
  }
  pairs.sort((left, right) => right.score - left.score)

  if (names.length <= MATRIX_LIMIT) {
    const width = Math.max(...labels.map((label) => label.length))
    console.log('\nPairwise raw cosine similarity\n')
    console.log(' '.repeat(width + 2) + labels.map((_, index) => String(index).padStart(6)).join(''))
    labels.forEach((label, row) => {
      const cells = labels
        .map((_, column) => cosine(vectors[row], vectors[column]).toFixed(3).padStart(6))
        .join('')
      console.log(label.padEnd(width + 2) + cells)
    })
  } else {
    console.log(
      `\n${names.length} photographs is too many for a readable matrix; showing ranked pairs instead.`,
    )
  }

  const shown = names.length <= MATRIX_LIMIT ? pairs.length : Math.min(pairs.length, 15)
  console.log(`\nRanked pairs (showing ${shown} of ${pairs.length})\n`)
  for (const row of pairs.slice(0, shown)) {
    const label =
      truePairs.length > 0 ? (isTruePair(row.row, row.column) ? '  true pair' : '  unrelated') : ''
    console.log(
      `  raw ${row.score.toFixed(4)}  calibrated ${calibrate(row.score).toFixed(4)}  ${row.pair}${label}`,
    )
  }

  const threshold = Number(process.env.MATCH_THRESHOLD ?? 0.87)
  console.log('\nThreshold (calibrated units — the scale the app thresholds and shows)')
  console.log(`  baseline                 : ${BASELINE}`)
  if (truePairs.length === 0) {
    console.log(`  current MATCH_THRESHOLD  : ${threshold}`)
    console.log('  no pairs labelled, so no suggestion — pass --pair <a>,<b> for each pair you know.')
    return
  }

  const trueScores = pairs.filter((row) => isTruePair(row.row, row.column))
  const unrelatedScores = pairs.filter((row) => !isTruePair(row.row, row.column))
  const worstTrue = trueScores.reduce((lowest, row) => (row.score < lowest.score ? row : lowest))
  const bestUnrelated = unrelatedScores.reduce(
    (highest, row) => (row.score > highest.score ? row : highest),
    { score: 0, pair: 'none — every photograph belongs to a labelled pair' },
  )

  console.log(
    `  worst true pair          : raw ${worstTrue.score.toFixed(4)}  calibrated ${calibrate(worstTrue.score).toFixed(4)}  ${worstTrue.pair}`,
  )
  if (unrelatedScores.length > 0) {
    console.log(
      `  best unrelated pair      : raw ${bestUnrelated.score.toFixed(4)}  calibrated ${calibrate(bestUnrelated.score).toFixed(4)}  ${bestUnrelated.pair}`,
    )
    const suggested = (calibrate(worstTrue.score) + calibrate(bestUnrelated.score)) / 2
    console.log(`  suggested MATCH_THRESHOLD: ${suggested.toFixed(3)}`)
    if (threshold > calibrate(worstTrue.score)) {
      console.log(
        `  WARNING: ${threshold} sits above the worst true pair (${calibrate(worstTrue.score).toFixed(4)} calibrated), so that pair would be missed.`,
      )
    } else if (threshold < calibrate(bestUnrelated.score)) {
      console.log(
        `  WARNING: ${threshold} sits below the best unrelated pair (${calibrate(bestUnrelated.score).toFixed(4)} calibrated), so that pair would be a false positive.`,
      )
    }
  }
  console.log(`  current MATCH_THRESHOLD  : ${threshold}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

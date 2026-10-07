/**
 * Fetches the CLIP ViT-L/14 weights that the embedder bakes into its image at
 * build time.
 *
 * `embedder/model-cache/` is gitignored — 1.7 GB has no business in a repo — so
 * a fresh clone has no model, and `docker compose up --build` then fails on the
 * embedder's `COPY model-cache/clip-ViT-L-14`. Run this once per machine,
 * before the first build:
 *
 *   npm run model:fetch              # download whatever is missing
 *   npm run model:fetch -- --check   # verify the local copy, download nothing
 *   npm run model:fetch -- --force   # download every file again
 *
 * Every file is pinned to an exact HuggingFace revision and checked against a
 * recorded size (and sha256 for the 1.7 GB weights), so the model that reaches
 * the image is byte-for-byte the one the matching thresholds were tuned
 * against. Downloads land in `<file>.part` and are renamed only after the
 * checksum passes: an interrupted run can never leave a truncated file that
 * looks complete.
 *
 * `0_CLIPModel/pytorch_model.bin` exists upstream but is deliberately NOT
 * fetched — it is the same weights in the older format (another 1.7 GB), and
 * transformers prefers the safetensors copy that is already there.
 *
 * Only Node builtins are used, so this runs before `npm install` (handy on a
 * machine that has just been cloned).
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const MODEL_ID = 'sentence-transformers/clip-ViT-L-14'
const REVISION = '1b4b2e899178706d1b9905460ac21de1e0ba86a5'
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}`

/** Written into, and read back from, the embedder's build context. */
const DEST = path.join(fileURLToPath(new URL('..', import.meta.url)), 'embedder', 'model-cache', 'clip-ViT-L-14')

/**
 * The complete contents of REVISION, as reported by the HuggingFace API
 * (`/api/models/sentence-transformers/clip-ViT-L-14/revision/<rev>?blobs=true`).
 * Kept inline so `--check` works offline and the download never depends on the
 * API being up. Bumping REVISION means refreshing this list.
 */
const FILES = [
  { name: '0_CLIPModel/config.json', size: 4541 },
  { name: '0_CLIPModel/merges.txt', size: 524657 },
  {
    name: '0_CLIPModel/model.safetensors',
    size: 1710540580,
    sha256: 'a2bf730a0c7debf160f7a6b50b3aaf3703e7e88ac73de7a314903141db026dcb',
  },
  { name: '0_CLIPModel/preprocessor_config.json', size: 354 },
  { name: '0_CLIPModel/special_tokens_map.json', size: 389 },
  { name: '0_CLIPModel/tokenizer.json', size: 2224003 },
  { name: '0_CLIPModel/tokenizer_config.json', size: 733 },
  { name: '0_CLIPModel/vocab.json', size: 862328 },
  // Model card, not read by SentenceTransformer: kept in the list so a fetched
  // cache is a full copy of the revision, but never a hard failure (see `doc`).
  { name: 'README.md', size: 1912, doc: true },
  { name: 'config_sentence_transformers.json', size: 118 },
  { name: 'modules.json', size: 122 },
]

const TOTAL_BYTES = FILES.reduce((sum, file) => sum + file.size, 0)

const args = new Set(process.argv.slice(2))
const check = args.has('--check')
const force = args.has('--force')

/** Bytes as the model is quoted everywhere else: GB for weights, KB for config. */
function human(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(1)} KB`
}

async function sizeOf(file) {
  try {
    return (await stat(file)).size
  } catch {
    return null
  }
}

/** sha256 of a file, or null when it cannot be read. */
async function hashOf(file) {
  const hash = createHash('sha256')
  try {
    await pipeline(createReadStream(file), hash)
  } catch {
    return null
  }
  return hash.digest('hex')
}

/** Downloads one file to `<name>.part`, hashing as it goes, then renames it. */
async function download(entry) {
  const target = path.join(DEST, entry.name)
  const part = `${target}.part`
  await mkdir(path.dirname(target), { recursive: true })

  const response = await fetch(`${BASE_URL}/${entry.name}`)
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${entry.name}`)
  }

  const hash = createHash('sha256')
  let seen = 0
  let step = 10
  const big = entry.size > 64e6

  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      seen += chunk.length
      if (big) {
        const percent = Math.floor((seen / entry.size) * 100)
        while (percent >= step) {
          console.log(`[model]   ${entry.name}: ${step}% (${human(seen)})`)
          step += 10
        }
      }
      callback(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(part))
  } catch (error) {
    await rm(part, { force: true })
    throw error
  }

  const digest = hash.digest('hex')
  if (seen !== entry.size) {
    await rm(part, { force: true })
    throw new Error(`${entry.name}: got ${seen} bytes, expected ${entry.size}`)
  }
  if (entry.sha256 && digest !== entry.sha256) {
    await rm(part, { force: true })
    throw new Error(`${entry.name}: sha256 ${digest}, expected ${entry.sha256}`)
  }

  await rename(part, target)
  return { bytes: seen }
}

async function main() {
  console.log(`[model] ${MODEL_ID} @ ${REVISION.slice(0, 12)} -> ${DEST}`)
  console.log(`[model] ${FILES.length} files, ${human(TOTAL_BYTES)} (pytorch_model.bin is skipped)`)

  if (check) {
    const problems = []
    for (const entry of FILES) {
      const target = path.join(DEST, entry.name)
      const size = await sizeOf(target)
      if (size === null) {
        problems.push(`${entry.name}: missing`)
        console.log(`[model] MISSING  ${entry.name}`)
        continue
      }
      if (size !== entry.size) {
        if (entry.doc) {
          console.log(`[model] note     ${entry.name}: local copy differs from upstream (not loaded — harmless)`)
          continue
        }
        problems.push(`${entry.name}: ${size} bytes, expected ${entry.size}`)
        console.log(`[model] BAD SIZE ${entry.name} (${size} bytes)`)
        continue
      }
      if (entry.sha256) {
        const digest = await hashOf(target)
        if (digest !== entry.sha256) {
          problems.push(`${entry.name}: sha256 mismatch`)
          console.log(`[model] BAD HASH ${entry.name}`)
          continue
        }
        console.log(`[model] OK       ${entry.name} (sha256 verified)`)
      } else {
        console.log(`[model] OK       ${entry.name}`)
      }
    }

    if (problems.length) {
      console.error(`[model] cache is incomplete — run 'npm run model:fetch':`)
      for (const problem of problems) console.error(`[model]   ${problem}`)
      process.exitCode = 1
      return
    }
    console.log('[model] complete: the embedder image can be built')
    return
  }

  let downloaded = 0
  let skipped = 0
  let bytes = 0

  for (const entry of FILES) {
    const target = path.join(DEST, entry.name)
    if (!force && (await sizeOf(target)) === entry.size) {
      skipped += 1
      continue
    }
    console.log(`[model] fetching ${entry.name} (${human(entry.size)})`)
    const result = await download(entry)
    downloaded += 1
    bytes += result.bytes
    console.log(`[model] saved    ${entry.name} (${human(result.bytes)})`)
  }

  console.log(`[model] ${downloaded} downloaded, ${skipped} already present (${human(bytes)} fetched)`)
  console.log(`[model] next: docker compose up --build`)
}

// Nothing in the script writes outside DEST, so a failure is always safe to
// retry — but it must not look like success.
main().catch((error) => {
  const cause = error?.cause?.code ? ` (${error.cause.code})` : ''
  console.error(`[model] failed: ${error.message}${cause}`)
  console.error('[model] nothing was written outside the model cache; re-run to retry')
  process.exitCode = 1
})

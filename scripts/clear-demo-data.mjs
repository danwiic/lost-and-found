/**
 * Clears the demo data — every report, match, claim, return record and
 * notification — and wipes the uploaded photos, while leaving every account
 * untouched.
 *
 * This is the "hand the laptop to the client" reset: the operators keep their
 * sign-ins, the database goes back to the empty-list state the app was designed
 * to start from, and nothing has to be re-registered. Accounts, security
 * questions and password-reset history are deliberately out of scope.
 *
 * What it does, in one transaction:
 *   - DELETE FROM "Notification"        (notices reference deleted records)
 *   - DELETE FROM "Item"                (cascades Match, Claim, ReturnRecord)
 * Then it removes every file inside UPLOAD_DIR (every stored file belongs to an
 * item or a claim proof, and all of those rows are now gone).
 *
 * Usage:
 *   npm run demo:reset                 # against DATABASE_URL, photos and all
 *   npm run demo:reset -- --dry-run    # report what would go, change nothing
 *   npm run demo:reset -- --keep-photos
 *   npm run demo:reset -- --keep-notifications
 *
 * Inside the compose stack (the DB has no published host port):
 *   docker compose exec app node scripts/clear-demo-data.mjs
 */
import 'dotenv/config'
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const keepPhotos = args.has('--keep-photos')
const keepNotifications = args.has('--keep-notifications')

const TABLES = ['Item', 'Match', 'Claim', 'ReturnRecord', 'Notification', 'User']

/** The tables the reset empties, in the order the summary prints them. */
const CLEARED = ['Item', 'Match', 'Claim', 'ReturnRecord', 'Notification']

async function counts(client) {
  const result = {}
  for (const table of TABLES) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${table}"`)
    result[table] = rows[0].n
  }
  return result
}

function report(label, counts) {
  const parts = TABLES.filter((t) => !keepNotifications || t !== 'Notification').map(
    (t) => `${t.toLowerCase()}=${counts[t]}`,
  )
  console.log(`[reset] ${label}: ${parts.join(' ')}`)
}

/** Every stored file belongs to a deleted row, so the directory itself is stale. */
async function clearUploads() {
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads')

  // A typo in UPLOAD_DIR must never turn into "delete a filesystem root".
  if (dir === path.parse(dir).root || !dir.trim()) {
    console.warn(`[reset] refusing to clear uploads: UPLOAD_DIR resolves to ${dir}`)
    return
  }

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    console.log(`[reset] uploads: ${dir} does not exist — nothing to remove`)
    return
  }

  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(dir, entry.name))
  if (dryRun) {
    console.log(`[reset] uploads: would remove ${files.length} file(s) from ${dir}`)
    return
  }

  let removed = 0
  let bytes = 0
  for (const file of files) {
    try {
      const info = await stat(file)
      await rm(file)
      removed += 1
      bytes += info.size
    } catch (error) {
      console.warn(`[reset] could not remove ${file}: ${error.message}`)
    }
  }
  const mb = (bytes / (1024 * 1024)).toFixed(1)
  console.log(`[reset] uploads: removed ${removed} file(s), ${mb} MB, from ${dir}`)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run this where the app runs, or fix .env.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    const before = await counts(client)

    if (dryRun) {
      report('would clear', before)
      await clearUploads()
      console.log('[reset] dry run — nothing was changed')
      return
    }

    await client.query('BEGIN')
    try {
      if (!keepNotifications) await client.query('DELETE FROM "Notification"')
      // Item is the parent of Match, Claim and ReturnRecord; the FKs cascade.
      await client.query('DELETE FROM "Item"')
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    const after = await counts(client)

    report('before', before)
    report('after ', after)
    const cleared = CLEARED.filter((t) => !(keepNotifications && t === 'Notification')).map(
      (t) => `${before[t] - after[t]} ${t.toLowerCase()}`,
    )
    console.log(`[reset] removed: ${cleared.join(', ')}`)
    console.log(
      `[reset] accounts kept: ${after.User} user(s) — sign-ins, security questions and reset history untouched`,
    )

    if (!keepPhotos) await clearUploads()
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[reset] failed:', error.message)
  process.exitCode = 1
})

/**
 * The tiny PASS/FAIL reporter shared by the verification scripts. Kept in one
 * place so every script prints the same counters a reviewer reads.
 */
export function createChecker() {
  let checks = 0
  let failures = 0

  return {
    check(label, passed, detail) {
      checks += 1
      const suffix = detail ? ` — ${detail}` : ''
      if (passed) {
        console.log(`  PASS ${String(checks).padStart(2)}. ${label}${suffix}`)
      } else {
        failures += 1
        console.error(`  FAIL ${String(checks).padStart(2)}. ${label}${suffix}`)
      }
      return Boolean(passed)
    },

    section(title) {
      console.log(`\n${title}`)
    },

    note(line) {
      console.log(`  ${line}`)
    },

    /** Prints the tally and fails the process when anything did not pass. */
    finish(label) {
      console.log(`\n${checks - failures}/${checks} checks passed`)
      if (failures > 0) {
        console.error(`${failures} check(s) FAILED`)
        process.exitCode = 1
        return false
      }
      if (label) console.log(label)
      return true
    },

    get counts() {
      return { checks, failures }
    },
  }
}

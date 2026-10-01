/**
 * Verifies every token pair that carries text against WCAG AA.
 *
 * It reads the real values out of src/app/globals.css, so the audit cannot drift
 * from the design system:
 *
 *   npm run audit:contrast
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.join(here, '..', 'src', 'app', 'globals.css')

function channelToLinear(value) {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** [what it is, foreground token, background token, required ratio] */
const PAIRS = [
  ['Body text on the canvas', 'ink', 'canvas', 4.5],
  ['Body text on a card', 'ink', 'surface', 4.5],
  ['Body text on a sunken surface', 'ink', 'surface-sunk', 4.5],
  ['Secondary text on the canvas', 'ink-muted', 'canvas', 4.5],
  ['Secondary text on a card', 'ink-muted', 'surface', 4.5],
  ['Secondary text on the nav rail', 'ink-muted', 'rail', 4.5],
  ['Placeholder text on a card', 'ink-subtle', 'surface', 4.5],
  ['Placeholder text on the canvas', 'ink-subtle', 'canvas', 4.5],
  ['Badge: possible match', 'attention', 'attention-soft', 4.5],
  ['Badge: claim pending', 'accent', 'accent-soft', 4.5],
  ['Badge: approved or returned', 'verified', 'verified-soft', 4.5],
  ['Badge: rejected', 'refused', 'refused-soft', 4.5],
  ['Badge: pending or closed', 'ink-muted', 'surface-sunk', 4.5],
  ['Attention figure on a card', 'attention', 'surface', 4.5],
  ['Link on the canvas', 'accent', 'canvas', 4.5],
  ['Primary button label', 'on-accent', 'accent', 4.5],
  ['Danger button label', 'on-accent', 'refused', 4.5],
  ['Nav wordmark on the rail', 'ink', 'rail', 4.5],
]

const css = await readFile(cssPath, 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((match) => [match[1], match[2]]),
)

let failures = 0
console.log('\nContrast audit — WCAG 2.1 AA\n')

for (const [label, foreground, background, required] of PAIRS) {
  const fg = tokens[foreground]
  const bg = tokens[background]

  if (!fg || !bg) {
    failures += 1
    console.error(`  MISSING  ${label} — unknown token ${!fg ? foreground : background}`)
    continue
  }

  const ratio = contrast(fg, bg)
  const pass = ratio >= required
  if (!pass) failures += 1

  const verdict = pass ? 'PASS' : 'FAIL'
  console.log(
    `  ${verdict}  ${ratio.toFixed(2)}:1  (needs ${required})  ${label}  ${fg} on ${bg}`,
  )
}

console.log(
  failures === 0
    ? `\nAll ${PAIRS.length} text pairs meet AA.\n`
    : `\n${failures} pair(s) below AA.\n`,
)

if (failures > 0) process.exitCode = 1

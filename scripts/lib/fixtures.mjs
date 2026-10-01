/**
 * Photo fixtures for the verification scripts.
 *
 * The repository ships no sample photographs and the seeded database holds no
 * sample items, so a script that needs an image draws one: an SVG rasterised
 * with sharp. Nothing is downloaded and no third-party photo is involved.
 *
 * A fixture is "the same object, photographed twice". `variant: 'a'` and
 * `variant: 'b'` change the camera (angle, distance, framing), the setting
 * (wall, surface tone, glare) and the camera itself (exposure, focus, file
 * format and compression) while the object stays the same — the variation the
 * matcher has to survive, and the reason a score is a lead rather than a verdict.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SIZE = 640
const INK = '#0f172a'
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

/** Object outlines. Each takes a palette so one shape can be several colours. */
const SHAPES = {
  backpack: (c) => `
    <path d="M200 300 q0 -95 120 -95 q120 0 120 95 v180 q0 45 -45 45 h-150 q-45 0 -45 -45 z" fill="${c.body}"/>
    <path d="M252 215 q68 -55 136 0" fill="none" stroke-width="12"/>
    <rect x="245" y="360" width="150" height="120" rx="16" fill="${c.accent}"/>
    <rect x="300" y="360" width="40" height="120" fill="${c.trim}"/>
    <rect x="200" y="325" width="240" height="18" fill="${c.trim}"/>`,

  bottle: (c) => `
    <rect x="265" y="180" width="110" height="58" rx="14" fill="${c.accent}"/>
    <path d="M250 238 h140 v256 q0 52 -52 52 h-36 q-52 0 -52 -52 z" fill="${c.body}"/>
    <rect x="250" y="330" width="140" height="92" fill="${c.trim}"/>
    <path d="M300 180 v-46 h40 v46" fill="${c.trim}"/>`,

  umbrella: (c) => `
    <path d="M320 128 v328 q0 62 -72 52" fill="none" stroke-width="13"/>
    <path d="M110 336 q210 -215 420 0 q-60 -62 -105 0 q-52 -64 -105 0 q-52 -64 -105 0 q-45 -60 -105 0 z" fill="${c.body}"/>
    <circle cx="320" cy="118" r="15" fill="${c.accent}"/>`,

  headphones: (c) => `
    <path d="M170 382 v-72 a150 150 0 0 1 300 0 v72" fill="none" stroke="${c.body}" stroke-width="30"/>
    <rect x="138" y="360" width="82" height="146" rx="30" fill="${c.accent}"/>
    <rect x="420" y="360" width="82" height="146" rx="30" fill="${c.accent}"/>
    <rect x="158" y="392" width="42" height="82" rx="18" fill="${c.trim}"/>
    <rect x="440" y="392" width="42" height="82" rx="18" fill="${c.trim}"/>`,
}

/** One colour identity per object, so a fixture reads as a single item. */
const OBJECTS = {
  backpack: { shape: 'backpack', body: '#2f4a7d', accent: '#16233d', trim: '#9fb0cc' },
  bottle: { shape: 'bottle', body: '#0f8b82', accent: '#134e4a', trim: '#8ed9d2' },
  umbrella: { shape: 'umbrella', body: '#7a1f2b', accent: '#4c1119', trim: '#c98a92' },
  headphones: { shape: 'headphones', body: '#2f3339', accent: '#1b1e22', trim: '#b6bbc4' },
}

export const OBJECT_KEYS = Object.keys(OBJECTS)

/**
 * Two photographs of the same object. `a` is a cool, bright, in-focus frame;
 * `b` is warmer, slightly dimmer, softer, shot from further away at a different
 * angle, and saved as JPEG — different pixels, same object.
 */
const CAMERAS = {
  a: {
    rotation: -6,
    scale: 1,
    dx: 0,
    dy: 0,
    wallTop: '#eef2fc',
    wallBottom: '#c9d6f0',
    surface: '#b7c4dd',
    glareX: 0.3,
    glareY: 0.2,
    glare: 0.32,
    brightness: 1,
    blur: 0,
    format: 'png',
    quality: 100,
  },
  b: {
    rotation: 8,
    scale: 0.86,
    dx: 42,
    dy: -28,
    wallTop: '#f7f2e7',
    wallBottom: '#ded3c0',
    surface: '#c9b99e',
    glareX: 0.72,
    glareY: 0.74,
    glare: 0.18,
    brightness: 1.07,
    blur: 0.7,
    format: 'jpeg',
    quality: 80,
  },
}

/** The object alone, on transparency, so the camera sets the background. */
function objectSvg(key) {
  const palette = OBJECTS[key]
  if (!palette) {
    throw new Error(`Unknown fixture object "${key}". Use one of: ${OBJECT_KEYS.join(', ')}`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<g stroke="${INK}" stroke-width="7" stroke-linejoin="round">${SHAPES[palette.shape](palette)}</g>
</svg>`
}

/** The setting the object stands in: wall gradient, glare and surface band. */
function settingSvg(camera) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="${camera.wallTop}"/>
    <stop offset="1" stop-color="${camera.wallBottom}"/>
  </linearGradient>
  <radialGradient id="glare" cx="${camera.glareX}" cy="${camera.glareY}" r="0.8">
    <stop offset="0" stop-color="#ffffff" stop-opacity="${camera.glare}"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#wall)"/>
<rect width="${SIZE}" height="${SIZE}" fill="url(#glare)"/>
<rect y="${Math.round(SIZE * 0.8)}" width="${SIZE}" height="${Math.round(SIZE * 0.2)}" fill="${camera.surface}" opacity="0.6"/>
</svg>`
}

/**
 * Renders one fixture photo and returns
 * `{ fileName, buffer, contentType, object, variant }`, so callers can post it
 * straight into a multipart report form.
 */
export async function photo({ object, variant = 'a' }) {
  const camera = CAMERAS[variant]
  if (!camera) {
    throw new Error(
      `Unknown fixture variant "${variant}". Use one of: ${Object.keys(CAMERAS).join(', ')}`,
    )
  }

  const framed = await sharp(Buffer.from(objectSvg(object)), { density: 144 })
    .rotate(camera.rotation, { background: TRANSPARENT })
    .resize({
      width: Math.round(SIZE * camera.scale),
      height: Math.round(SIZE * camera.scale),
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toBuffer()

  const { width = SIZE, height = SIZE } = await sharp(framed).metadata()
  const left = Math.round((SIZE - width) / 2 + camera.dx)
  const top = Math.round((SIZE - height) / 2 + camera.dy)

  let image = sharp(Buffer.from(settingSvg(camera))).composite([{ input: framed, left, top }])
  if (camera.blur > 0) image = image.blur(camera.blur)

  const rendered = image.modulate({ brightness: camera.brightness })
  const buffer = await (camera.format === 'jpeg'
    ? rendered.jpeg({ quality: camera.quality })
    : rendered.png()
  ).toBuffer()

  const jpeg = camera.format === 'jpeg'
  return {
    object,
    variant,
    fileName: `${object}-${variant}.${jpeg ? 'jpg' : 'png'}`,
    contentType: jpeg ? 'image/jpeg' : 'image/png',
    buffer,
  }
}

/**
 * The two photographs a verification posts: `lost` is variant `a`, `found` is
 * variant `b` — the same object, a different picture of it.
 */
export async function photoPair(object) {
  const [lost, found] = await Promise.all([
    photo({ object, variant: 'a' }),
    photo({ object, variant: 'b' }),
  ])
  return { lost, found }
}

/** `node scripts/lib/fixtures.mjs [outDir]` writes every fixture to disk. */
async function writeAll(outDir) {
  await mkdir(outDir, { recursive: true })
  const written = []

  for (const object of OBJECT_KEYS) {
    for (const variant of Object.keys(CAMERAS)) {
      const fixture = await photo({ object, variant })
      await writeFile(path.join(outDir, fixture.fileName), fixture.buffer)
      written.push(fixture.fileName)
    }
  }

  console.log(`Wrote ${written.length} fixtures to ${outDir}:`)
  for (const name of written) console.log(`  ${name}`)
  console.log('\nMeasure them against each other with:')
  console.log(
    `  npm run match:matrix -- "${outDir}" --pair backpack-a.png,backpack-b.png --pair bottle-a.png,bottle-b.png`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeAll(path.resolve(process.argv[2] ?? './uploads-fixtures')).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

/**
 * Minimal HTTP client for the verification scripts: a cookie jar per "browser",
 * JSON and multipart bodies, and photo uploads straight from a Buffer.
 *
 * Everything here talks to the app the way a student's browser does — no direct
 * database access — so a passing script is evidence about the real product.
 */
export const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'

/** A separate cookie jar, i.e. a separate signed-in person. */
export function createSession(label = 'session') {
  return { label, cookies: new Map() }
}

export async function request(session, routePath, options = {}) {
  const headers = {}
  if (session.cookies.size > 0) {
    headers.cookie = [...session.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  let body
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(options.json)
  } else if (options.form !== undefined) {
    body = options.form
  }

  // Default to POST when a body is supplied, GET otherwise.
  const method =
    options.method ?? (options.json !== undefined || options.form !== undefined ? 'POST' : 'GET')

  const response = await fetch(new URL(routePath, BASE_URL), {
    method,
    headers,
    body,
    redirect: 'manual',
  })

  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';')
    const separator = pair.indexOf('=')
    if (separator <= 0) continue
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    if (value === '') session.cookies.delete(name)
    else session.cookies.set(name, value)
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  return { status: response.status, data, location: response.headers.get('location') ?? '' }
}

/** multipart/form-data body carrying the report fields and the photo. */
export function reportForm(photo, fields) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    form.set(key, String(value))
  }
  form.set('photo', new File([photo.buffer], photo.fileName, { type: photo.contentType }))
  return form
}

/** A unique email so repeated runs never collide on the unique index. */
export function uniqueEmail(prefix) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  return `${prefix}.${stamp}@verify.local`
}

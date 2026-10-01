import { NextResponse } from 'next/server'
import { UploadError } from '@/lib/uploads'
import { ValidationError } from '@/lib/validation'

/** Any expected, client-facing failure. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, details)
export const unauthorized = (message = 'You must sign in to do that.') =>
  new ApiError(401, message)
export const forbidden = (message = 'You are not allowed to do that.') =>
  new ApiError(403, message)
export const notFound = (message = 'Not found.') => new ApiError(404, message)
export const conflict = (message: string) => new ApiError(409, message)

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, ...(error.details ? { details: error.details } : {}) },
      { status: error.status },
    )
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, fields: error.fields },
      { status: 422 },
    )
  }

  if (error instanceof UploadError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  switch (prismaErrorCode(error)) {
    case 'P2002':
      return NextResponse.json({ error: 'That record already exists.' }, { status: 409 })
    case 'P2025':
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    case 'P2003':
      return NextResponse.json(
        { error: 'That change conflicts with related records.' },
        { status: 409 },
      )
    default:
      break
  }

  console.error('[api] Unhandled error:', error)
  return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 })
}

/** Wraps a route handler so every failure becomes a clean JSON response. */
export async function handleRoute(
  handler: () => Promise<NextResponse | Response>,
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    return toErrorResponse(error)
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

function formDataToObject(form: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    const existing = result[key]
    if (existing === undefined) {
      result[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      result[key] = [existing, value]
    }
  }
  return result
}

/**
 * Accepts either JSON or multipart/form-data so the same endpoint serves fetch()
 * calls and native <form> submissions (which carry the photo).
 */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('Expected a JSON object as the request body.')
    }
    return body as Record<string, unknown>
  }

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    return formDataToObject(await request.formData())
  }

  throw badRequest('Send the body as application/json or multipart/form-data.')
}

export type Pagination = { page: number; pageSize: number; skip: number; take: number }

export function parsePagination(
  searchParams: URLSearchParams,
  defaultPageSize = 24,
): Pagination {
  const rawPage = Number(searchParams.get('page') ?? '1')
  const rawSize = Number(searchParams.get('pageSize') ?? String(defaultPageSize))
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const pageSize =
    Number.isFinite(rawSize) && rawSize > 0 ? Math.min(Math.floor(rawSize), 60) : defaultPageSize
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

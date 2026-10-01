export type FieldErrors = Record<string, string>

/** Thrown when the submitted payload is invalid; surfaces as HTTP 422. */
export class ValidationError extends Error {
  readonly fields: FieldErrors

  constructor(fields: FieldErrors) {
    super('The submitted data is invalid.')
    this.name = 'ValidationError'
    this.fields = fields
  }
}

type LengthOptions = { min?: number; max?: number }

type DateOptions = {
  /**
   * Reject calendar dates after today (server clock). One day of tolerance is
   * applied on purpose: a date-only value parses to UTC midnight, and a user
   * ahead of the server legitimately reports their own "today", which can be
   * the server's tomorrow. Browsers enforce the exact boundary with their own
   * clock (the picker's `max` and the form validator), so real users never
   * meet this line — this is the API-level guard against a hand-posted future
   * date, and one day of tolerance keeps honest clients working.
   */
  notFuture?: boolean
  /** Reject calendar dates before this day. */
  min?: Date
}

/** The calendar day of a timestamp, as whole UTC days since the epoch. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000)
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Tiny dependency-free form/JSON validator that collects *every* problem at once
 * and reports them keyed by field name.
 */
export class Fields {
  private readonly errors: FieldErrors = {}

  constructor(private readonly input: Record<string, unknown>) {}

  private raw(field: string): string | undefined {
    const value = this.input[field]
    if (value === undefined || value === null) return undefined
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return undefined
  }

  private fail(field: string, message: string): void {
    this.errors[field] ??= message
  }

  private checkLength(field: string, label: string, value: string, options: LengthOptions): string {
    const { min = 1, max = 4000 } = options
    if (value.length < min) {
      this.fail(field, `${label} must be at least ${min} characters.`)
    } else if (value.length > max) {
      this.fail(field, `${label} must be at most ${max} characters.`)
    }
    return value
  }

  requiredText(field: string, label: string, options: LengthOptions = {}): string {
    const value = this.raw(field)
    if (!value) {
      this.fail(field, `${label} is required.`)
      return ''
    }
    return this.checkLength(field, label, value, options)
  }

  optionalText(field: string, label: string, options: LengthOptions = {}): string | undefined {
    const value = this.raw(field)
    if (!value) return undefined
    return this.checkLength(field, label, value, options)
  }

  requiredEnum<T extends string>(field: string, label: string, allowed: readonly T[]): T {
    const value = (this.raw(field) ?? '').toUpperCase()
    if (!value) {
      this.fail(field, `${label} is required.`)
      return allowed[0]
    }
    if (!allowed.includes(value as T)) {
      this.fail(field, `${label} must be one of: ${allowed.join(', ')}.`)
      return allowed[0]
    }
    return value as T
  }

  optionalDate(field: string, label: string, options: DateOptions = {}): Date | undefined {
    const value = this.raw(field)
    if (!value) return undefined
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      this.fail(field, `${label} must be a valid date, for example 2026-03-14.`)
      return undefined
    }
    if (options.notFuture && dayNumber(parsed) > dayNumber(new Date()) + 1) {
      this.fail(field, `${label} can't be in the future.`)
      return undefined
    }
    if (options.min && dayNumber(parsed) < dayNumber(options.min)) {
      this.fail(field, `${label} can't be before ${DAY_FORMAT.format(options.min)}.`)
      return undefined
    }
    return parsed
  }

  requiredDate(field: string, label: string, options: DateOptions = {}): Date {
    const parsed = this.optionalDate(field, label, options)
    if (!parsed) {
      if (!this.errors[field]) this.fail(field, `${label} is required.`)
      return new Date(0)
    }
    return parsed
  }

  email(field: string, label: string, options: { required?: boolean } = {}): string | undefined {
    const value = this.raw(field)
    if (!value) {
      if (options.required) this.fail(field, `${label} is required.`)
      return undefined
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      this.fail(field, `${label} must be a valid email address.`)
      return undefined
    }
    return value.toLowerCase()
  }

  password(field: string, label: string): string {
    const value = this.input[field]
    // Never trim passwords: spaces are legitimate characters.
    const text = typeof value === 'string' ? value : ''
    if (!text) {
      this.fail(field, `${label} is required.`)
      return ''
    }
    if (text.length < 8) this.fail(field, `${label} must be at least 8 characters.`)
    else if (text.length > 200) this.fail(field, `${label} must be at most 200 characters.`)
    return text
  }

  /** Every non-empty File attached to the given field name. */
  files(field: string): File[] {
    const value = this.input[field]
    if (value instanceof File) return value.size > 0 ? [value] : []
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is File => entry instanceof File && entry.size > 0,
      )
    }
    return []
  }

  throwIfInvalid(): void {
    if (Object.keys(this.errors).length > 0) {
      throw new ValidationError(this.errors)
    }
  }
}

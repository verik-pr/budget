export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  return typeof value === "string" ? value.trim() || null : null
}

export function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function asPositiveNumber(value: unknown): number | null {
  const number = asFiniteNumber(value)
  return number !== null && number > 0 ? number : null
}

export function asNonNegativeNumber(value: unknown): number | null {
  const number = asFiniteNumber(value)
  return number !== null && number >= 0 ? number : null
}

export function asIntegerInRange(value: unknown, min: number, max: number): number | null {
  const number = asFiniteNumber(value)
  if (number === null || !Number.isInteger(number)) return null
  return number >= min && number <= max ? number : null
}

export function asValidDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function asDateOnlyString(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : value
}

export function asMonthString(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null
}

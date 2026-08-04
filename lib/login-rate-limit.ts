const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const BASE_LOCK_MS = 60 * 1000
const MAX_LOCK_MS = 15 * 60 * 1000
const FAILED_LOGIN_DELAY_MS = 750

type LoginAttempt = {
  failures: number
  firstFailureAt: number
  lockedUntil: number
}

const globalForLoginRateLimit = globalThis as typeof globalThis & {
  loginRateLimit?: Map<string, LoginAttempt>
}

const attempts = globalForLoginRateLimit.loginRateLimit ?? new Map<string, LoginAttempt>()
globalForLoginRateLimit.loginRateLimit = attempts

function keyFor(email: string) {
  return email.trim().toLowerCase()
}

function currentAttempt(key: string, now: number): LoginAttempt | null {
  const attempt = attempts.get(key)
  if (!attempt) return null
  if (now - attempt.firstFailureAt > WINDOW_MS && attempt.lockedUntil <= now) {
    attempts.delete(key)
    return null
  }
  return attempt
}

export function isLoginRateLimited(email: string): boolean {
  const key = keyFor(email)
  const now = Date.now()
  const attempt = currentAttempt(key, now)
  return !!attempt && attempt.lockedUntil > now
}

const MAX_TRACKED_KEYS = 500

export function recordFailedLogin(email: string) {
  const key = keyFor(email)
  const now = Date.now()

  // Map begrenzen: abgelaufene Einträge räumen, sonst ältesten verdrängen
  if (!attempts.has(key) && attempts.size >= MAX_TRACKED_KEYS) {
    for (const [k, a] of attempts) {
      if (now - a.firstFailureAt > WINDOW_MS && a.lockedUntil <= now) attempts.delete(k)
    }
    if (attempts.size >= MAX_TRACKED_KEYS) {
      const oldest = attempts.keys().next().value
      if (oldest !== undefined) attempts.delete(oldest)
    }
  }
  const attempt = currentAttempt(key, now) ?? {
    failures: 0,
    firstFailureAt: now,
    lockedUntil: 0,
  }

  attempt.failures += 1
  if (attempt.failures >= MAX_FAILURES) {
    const lockMultiplier = attempt.failures - MAX_FAILURES + 1
    attempt.lockedUntil = now + Math.min(BASE_LOCK_MS * lockMultiplier, MAX_LOCK_MS)
  }
  attempts.set(key, attempt)
}

export function clearFailedLogins(email: string) {
  attempts.delete(keyFor(email))
}

export function slowFailedLogin() {
  return new Promise(resolve => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))
}

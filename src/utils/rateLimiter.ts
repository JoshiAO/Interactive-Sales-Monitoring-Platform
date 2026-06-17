/**
 * Client-side rate limiter and login lockout system.
 * Protects against brute-force login attempts and rapid form spam.
 */

// ─── Token Bucket Rate Limiter ───────────────────────────────────────────────

interface RateLimiterConfig {
  maxTokens: number;      // Maximum burst size
  refillRate: number;     // Tokens added per second
  storageKey: string;     // localStorage key for persistence
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  private getState(): BucketState {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { tokens: this.config.maxTokens, lastRefill: Date.now() };
  }

  private setState(state: BucketState): void {
    localStorage.setItem(this.config.storageKey, JSON.stringify(state));
  }

  /**
   * Attempts to consume one token.
   * Returns { allowed, retryAfterMs } — retryAfterMs is 0 if allowed.
   */
  consume(): { allowed: boolean; retryAfterMs: number } {
    const state = this.getState();
    const now = Date.now();
    const elapsed = (now - state.lastRefill) / 1000;

    // Refill tokens
    state.tokens = Math.min(
      this.config.maxTokens,
      state.tokens + elapsed * this.config.refillRate
    );
    state.lastRefill = now;

    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.setState(state);
      return { allowed: true, retryAfterMs: 0 };
    }

    // Calculate wait time until 1 token is available
    const deficit = 1 - state.tokens;
    const retryAfterMs = Math.ceil((deficit / this.config.refillRate) * 1000);
    this.setState(state);
    return { allowed: false, retryAfterMs };
  }
}

// ─── Login Lockout (Exponential Backoff) ─────────────────────────────────────

const LOGIN_LOCKOUT_KEY = 'login_lockout';
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const BASE_LOCKOUT_MS = 30_000; // 30 seconds
const MAX_LOCKOUT_MS = 600_000; // 10 minutes cap

interface LockoutState {
  attempts: number;
  lockedUntil: number; // timestamp
}

function getLockoutState(): LockoutState {
  try {
    const raw = localStorage.getItem(LOGIN_LOCKOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: 0 };
}

function setLockoutState(state: LockoutState): void {
  localStorage.setItem(LOGIN_LOCKOUT_KEY, JSON.stringify(state));
}

/**
 * Checks if the user is currently locked out.
 * Returns { locked, remainingMs } — remainingMs is 0 if not locked.
 */
export function checkLoginLockout(): { locked: boolean; remainingMs: number } {
  const state = getLockoutState();
  const now = Date.now();

  if (state.lockedUntil > now) {
    return { locked: true, remainingMs: state.lockedUntil - now };
  }

  return { locked: false, remainingMs: 0 };
}

/**
 * Records a failed login attempt and applies exponential backoff
 * after MAX_ATTEMPTS_BEFORE_LOCKOUT consecutive failures.
 */
export function recordFailedAttempt(): void {
  const state = getLockoutState();
  state.attempts += 1;

  if (state.attempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
    // Exponential backoff: 30s, 60s, 120s, 240s, 480s... capped at 10min
    const exponent = state.attempts - MAX_ATTEMPTS_BEFORE_LOCKOUT;
    const lockoutMs = Math.min(BASE_LOCKOUT_MS * Math.pow(2, exponent), MAX_LOCKOUT_MS);
    state.lockedUntil = Date.now() + lockoutMs;
  }

  setLockoutState(state);
}

/**
 * Resets the lockout state on successful login.
 */
export function resetLockout(): void {
  localStorage.removeItem(LOGIN_LOCKOUT_KEY);
}

/**
 * Formats remaining milliseconds into a human-readable string.
 * e.g. "2m 30s", "45s"
 */
export function formatRemainingTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

// ─── Pre-configured Rate Limiters ────────────────────────────────────────────

/** Login form: 5 attempts burst, refills 1 token per 30 seconds */
export const loginRateLimiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 1 / 30,
  storageKey: 'rl_login',
});

/** Activation form: 5 attempts burst, refills 1 token per 120 seconds */
export const activationRateLimiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 1 / 120,
  storageKey: 'rl_activation',
});

/**
 * In-memory login rate limiting (`SECURITY_PLAN.md` §2.4).
 *
 * Shared/foundational (`CODE_CONVENTIONS.md` §5). Single-process Map is
 * enough for the one-VPS-per-customer model; swap for Redis if we ever
 * run multiple app replicas behind one hostname.
 *
 * Policy (deliberately *not* a hard lockout — FleetOS has no self-service
 * reset, so lockout would leave users with no in-app recovery):
 * - Per account: 5 failures inside a 15-minute window.
 * - Per IP: coarser ceiling of 40 failures inside the same window.
 * - Exponential backoff between attempts: `min(2^(n-1) seconds, 15 min)`
 *   after each failure (n = failures in the current window).
 */
import "server-only";

/** Sliding window for counting failures. */
const WINDOW_MS = 15 * 60 * 1000;

/** Max failed logins for one email within {@link WINDOW_MS}. */
const MAX_FAILURES_PER_ACCOUNT = 5;

/** Coarser IP ceiling within {@link WINDOW_MS} (credential stuffing spray). */
const MAX_FAILURES_PER_IP = 40;

/** Cap on exponential backoff delay. */
const MAX_BACKOFF_MS = WINDOW_MS;

type FailureBucket = {
  /** Failures counted inside the current window. */
  count: number;
  /** When the current window opened. */
  windowStartedAt: number;
  /** Timestamp of the most recent failure (drives backoff). */
  lastFailureAt: number;
};

const accountBuckets = new Map<string, FailureBucket>();
const ipBuckets = new Map<string, FailureBucket>();

/** Normalizes email for bucket keys (trim + lowercase). */
function accountKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Backoff delay after `failureCount` failures in the window.
 * 1 → 1s, 2 → 2s, 3 → 4s, … capped at {@link MAX_BACKOFF_MS}.
 */
function backoffMs(failureCount: number): number {
  if (failureCount <= 0) {
    return 0;
  }
  const raw = 1000 * 2 ** (failureCount - 1);
  return Math.min(raw, MAX_BACKOFF_MS);
}

/** Prunes or returns the live bucket for `map`/`key`. */
function getBucket(map: Map<string, FailureBucket>, key: string, now: number): FailureBucket {
  const existing = map.get(key);
  if (!existing || now - existing.windowStartedAt >= WINDOW_MS) {
    const fresh: FailureBucket = { count: 0, windowStartedAt: now, lastFailureAt: 0 };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
}

/**
 * True when this account or IP must wait before another login attempt
 * (window exhausted or backoff not elapsed). Callers must still return the
 * generic "invalid email or password" message — never reveal rate limiting.
 */
export function isLoginRateLimited(email: string, ip: string): boolean {
  const now = Date.now();
  const account = getBucket(accountBuckets, accountKey(email), now);
  const ipBucket = getBucket(ipBuckets, ip || "unknown", now);

  if (account.count >= MAX_FAILURES_PER_ACCOUNT) {
    return true;
  }
  if (ipBucket.count >= MAX_FAILURES_PER_IP) {
    return true;
  }

  const accountWait = account.lastFailureAt + backoffMs(account.count);
  const ipWait = ipBucket.lastFailureAt + backoffMs(ipBucket.count);
  if (account.count > 0 && now < accountWait) {
    return true;
  }
  if (ipBucket.count > 0 && now < ipWait) {
    return true;
  }
  return false;
}

/**
 * Records a failed login against both the account and IP buckets.
 *
 * @param email - Attempted email (normalized internally).
 * @param ip - Client IP from forwarded headers, or a fallback token.
 */
export function recordLoginFailure(email: string, ip: string): void {
  const now = Date.now();
  const account = getBucket(accountBuckets, accountKey(email), now);
  account.count += 1;
  account.lastFailureAt = now;

  const ipBucket = getBucket(ipBuckets, ip || "unknown", now);
  ipBucket.count += 1;
  ipBucket.lastFailureAt = now;
}

/**
 * Clears failure state after a successful login for this account (IP
 * history is left alone so a shared NAT cannot wipe a spray campaign).
 */
export function clearLoginFailuresForAccount(email: string): void {
  accountBuckets.delete(accountKey(email));
}

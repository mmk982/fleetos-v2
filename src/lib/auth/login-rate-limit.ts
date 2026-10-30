/**
 * Database-backed login rate limiting (`SECURITY_PLAN.md` §2.4).
 *
 * Shared/foundational (`CODE_CONVENTIONS.md` §5). Counters live in the
 * `login_attempts` table so limits survive restarts and are shared across
 * app replicas.
 *
 * Policy (deliberately *not* a hard lockout — FleetOS has no self-service
 * reset, so lockout would leave users with no in-app recovery):
 * - Per account: 5 failures inside a 15-minute window.
 * - Per IP: coarser ceiling of 40 failures inside the same window.
 * - Exponential backoff between attempts: `min(2^(n-1) seconds, 15 min)`
 *   after each failure (n = failures in the current window).
 *
 * Key hashing: rows are keyed by `(scope, key_hash)` where
 * `key_hash = hex(HMAC-SHA256(derivedKey, normalisedValue))` and
 * `derivedKey = HMAC-SHA256(SESSION_SECRET, "fleetos-login-rate-limit-v1")`.
 * The value is the trimmed, lower-cased email (scope `account`) or client IP
 * (scope `ip`). Raw emails / IPs are never stored or logged. Rotating
 * `SESSION_SECRET` orphans existing rows (counters effectively reset), which
 * is acceptable — the window is only 15 minutes.
 *
 * Failure mode: **fail closed**. If the database is unreachable,
 * {@link isLoginRateLimited} returns `true` (login is refused with the
 * generic message). {@link recordLoginFailure} and
 * {@link clearLoginFailuresForAccount} log and swallow so the login path
 * always completes with its generic response.
 *
 * Auth runs before any user context exists, so this module uses the plain
 * pooled {@link getDb} client (not `withDb`); `login_attempts` has no RLS.
 */
import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { logError } from "@/lib/logging";

/** Sliding window for counting failures. */
export const WINDOW_MS = 15 * 60 * 1000;

/** Max failed logins for one email within {@link WINDOW_MS}. */
export const MAX_FAILURES_PER_ACCOUNT = 5;

/** Coarser IP ceiling within {@link WINDOW_MS} (credential stuffing spray). */
export const MAX_FAILURES_PER_IP = 40;

/** Cap on exponential backoff delay. */
export const MAX_BACKOFF_MS = WINDOW_MS;

/** Chance per recorded failure of also purging expired rows. */
export const CLEANUP_PROBABILITY = 0.01;

/** Domain-separation label for the derived HMAC key. */
const KEY_DERIVATION_LABEL = "fleetos-login-rate-limit-v1";

const MIN_SECRET_LENGTH = 32;

/** Stable error code for logs/alerts when the limiter cannot reach the DB. */
export const RATE_LIMIT_UNAVAILABLE_CODE = "LOGIN_RATE_LIMIT_UNAVAILABLE";

type Scope = "account" | "ip";

/** Counter state for one `(scope, key)` as read from `login_attempts`. */
export type AttemptState = {
  failureCount: number;
  windowStartedAt: Date;
  lastFailureAt: Date;
};

let cachedDerived: { secret: string; key: Buffer } | null = null;

/** Derives the HMAC key from `SESSION_SECRET` (memoised per secret value). */
function derivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters (see .env.example).",
    );
  }
  if (cachedDerived?.secret !== secret) {
    cachedDerived = {
      secret,
      key: createHmac("sha256", secret).update(KEY_DERIVATION_LABEL).digest(),
    };
  }
  return cachedDerived.key;
}

/** Normalises an email for bucket keys (trim + lowercase). */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalises an IP for bucket keys; empty → `"unknown"`. */
function normaliseIp(ip: string): string {
  return ip.trim().toLowerCase() || "unknown";
}

/**
 * Keyed hash of a normalised value, as stored in `login_attempts.key_hash`.
 * Exported for tests; callers outside this module should not need it.
 */
export function hashLoginKey(normalisedValue: string): string {
  return createHmac("sha256", derivedKey()).update(normalisedValue).digest("hex");
}

/**
 * Backoff delay after `failureCount` failures in the window.
 * 1 → 1s, 2 → 2s, 3 → 4s, … capped at {@link MAX_BACKOFF_MS}.
 */
export function backoffMs(failureCount: number): number {
  if (failureCount <= 0) {
    return 0;
  }
  // Clamp the exponent: the cap is hit long before 2^30 s, and this avoids
  // Infinity for absurd counts.
  const raw = 1000 * 2 ** Math.min(failureCount - 1, 30);
  return Math.min(raw, MAX_BACKOFF_MS);
}

/** Failures that still count: an expired window reads as zero. */
function liveCount(state: AttemptState | undefined, now: number): number {
  if (!state || now - state.windowStartedAt.getTime() >= WINDOW_MS) {
    return 0;
  }
  return state.failureCount;
}

function blockedBy(
  state: AttemptState | undefined,
  max: number,
  now: number,
): boolean {
  const count = liveCount(state, now);
  if (count <= 0) {
    return false;
  }
  if (count >= max) {
    return true;
  }
  return now < state!.lastFailureAt.getTime() + backoffMs(count);
}

/**
 * Pure policy decision: is a login attempt at `nowMs` blocked given the
 * stored account / IP counters? Exported for unit tests.
 */
export function evaluateRateLimit(
  account: AttemptState | undefined,
  ip: AttemptState | undefined,
  nowMs: number,
): boolean {
  return (
    blockedBy(account, MAX_FAILURES_PER_ACCOUNT, nowMs) ||
    blockedBy(ip, MAX_FAILURES_PER_IP, nowMs)
  );
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

/** Logs a limiter DB failure without any email / IP / hash material. */
function logUnavailable(operation: string, error: unknown): void {
  logError(RATE_LIMIT_UNAVAILABLE_CODE, { operation, error });
}

/**
 * True when this account or IP must wait before another login attempt
 * (window exhausted or backoff not elapsed). Callers must still return the
 * generic "invalid email or password" message — never reveal rate limiting.
 *
 * **Fail-closed:** returns `true` (and logs `LOGIN_RATE_LIMIT_UNAVAILABLE`)
 * if the database or key derivation fails.
 */
export async function isLoginRateLimited(
  email: string,
  ip: string,
): Promise<boolean> {
  try {
    const accountHash = hashLoginKey(normaliseEmail(email));
    const ipHash = hashLoginKey(normaliseIp(ip));
    const result = await getDb().execute(sql`
      SELECT scope, failure_count, window_started_at, last_failure_at
      FROM login_attempts
      WHERE (scope = 'account' AND key_hash = ${accountHash})
         OR (scope = 'ip' AND key_hash = ${ipHash})
    `);

    const states: Partial<Record<Scope, AttemptState>> = {};
    for (const row of result.rows as Array<Record<string, unknown>>) {
      states[row.scope as Scope] = {
        failureCount: Number(row.failure_count),
        windowStartedAt: toDate(row.window_started_at),
        lastFailureAt: toDate(row.last_failure_at),
      };
    }
    return evaluateRateLimit(states.account, states.ip, Date.now());
  } catch (error) {
    logUnavailable("check", error);
    return true;
  }
}

/**
 * Records a failed login against both the account and IP counters in one
 * atomic `INSERT … ON CONFLICT DO UPDATE` (no read-modify-write race: N
 * concurrent failures yield exactly N increments). An expired window is
 * reset to 1 inside the same statement. Rows are written in a fixed
 * (scope) order so concurrent statements cannot deadlock.
 *
 * Never throws: DB failures are logged (`LOGIN_RATE_LIMIT_UNAVAILABLE`) so
 * the login path still returns its generic failure.
 *
 * @param email - Attempted email (normalised + hashed internally).
 * @param ip - Client IP from {@link getRequestIp}, or a fallback token.
 */
export async function recordLoginFailure(
  email: string,
  ip: string,
): Promise<void> {
  try {
    const accountHash = hashLoginKey(normaliseEmail(email));
    const ipHash = hashLoginKey(normaliseIp(ip));
    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - WINDOW_MS).toISOString();

    await getDb().execute(sql`
      INSERT INTO login_attempts
        (scope, key_hash, failure_count, window_started_at, last_failure_at, updated_at)
      VALUES
        ('account', ${accountHash}, 1, ${nowIso}::timestamptz, ${nowIso}::timestamptz, ${nowIso}::timestamptz),
        ('ip', ${ipHash}, 1, ${nowIso}::timestamptz, ${nowIso}::timestamptz, ${nowIso}::timestamptz)
      ON CONFLICT (scope, key_hash) DO UPDATE SET
        failure_count = CASE
          WHEN login_attempts.window_started_at <= ${cutoffIso}::timestamptz THEN 1
          ELSE login_attempts.failure_count + 1
        END,
        window_started_at = CASE
          WHEN login_attempts.window_started_at <= ${cutoffIso}::timestamptz
            THEN EXCLUDED.window_started_at
          ELSE login_attempts.window_started_at
        END,
        last_failure_at = GREATEST(login_attempts.last_failure_at, EXCLUDED.last_failure_at),
        updated_at = EXCLUDED.updated_at
    `);
  } catch (error) {
    logUnavailable("record", error);
    return;
  }

  if (Math.random() < CLEANUP_PROBABILITY) {
    // Opportunistic purge; failures are logged and never reach the caller.
    cleanupExpiredLoginAttempts().catch((error: unknown) => {
      logUnavailable("cleanup", error);
    });
  }
}

/**
 * Clears failure state after a successful login for this account (IP
 * history is left alone so a shared NAT cannot wipe a spray campaign).
 * Logs and swallows DB errors — a stale counter only errs toward caution.
 */
export async function clearLoginFailuresForAccount(
  email: string,
): Promise<void> {
  try {
    const accountHash = hashLoginKey(normaliseEmail(email));
    await getDb().execute(sql`
      DELETE FROM login_attempts
      WHERE scope = 'account' AND key_hash = ${accountHash}
    `);
  } catch (error) {
    logUnavailable("clear", error);
  }
}

/**
 * Deletes rows whose window has expired (they read as zero failures anyway).
 * Safe to call from a scheduled job; throws on DB error so the scheduler can
 * report it.
 *
 * @returns Number of rows removed.
 */
export async function cleanupExpiredLoginAttempts(): Promise<number> {
  const cutoffIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const result = await getDb().execute(sql`
    DELETE FROM login_attempts
    WHERE window_started_at <= ${cutoffIso}::timestamptz
  `);
  return result.rowCount ?? 0;
}

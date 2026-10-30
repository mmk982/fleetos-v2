/**
 * Unit tests for the DB-backed login rate limiter with a mocked `getDb`.
 * Policy maths is covered through the pure `evaluateRateLimit`; real SQL
 * behaviour (atomicity, window reset) lives in
 * `tests/integration/login-rate-limit.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const execute = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => ({ execute }),
}));

const logError = vi.fn();
vi.mock("@/lib/logging", () => ({ logError: (...args: unknown[]) => logError(...args) }));

import {
  backoffMs,
  cleanupExpiredLoginAttempts,
  clearLoginFailuresForAccount,
  CLEANUP_PROBABILITY,
  evaluateRateLimit,
  hashLoginKey,
  isLoginRateLimited,
  MAX_BACKOFF_MS,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
  RATE_LIMIT_UNAVAILABLE_CODE,
  recordLoginFailure,
  WINDOW_MS,
  type AttemptState,
} from "@/lib/auth/login-rate-limit";

const SECRET = "unit-test-session-secret-0123456789abcdef";
const NOW = new Date("2026-01-15T12:00:00.000Z").getTime();

function state(count: number, ageMs: number, lastFailureAgoMs = ageMs): AttemptState {
  return {
    failureCount: count,
    windowStartedAt: new Date(NOW - ageMs),
    lastFailureAt: new Date(NOW - lastFailureAgoMs),
  };
}

/** JSON of every bound parameter / SQL chunk in the last `execute` call. */
function lastExecuteText(): string {
  const arg = execute.mock.calls.at(-1)?.[0];
  return JSON.stringify(arg);
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  execute.mockReset();
  logError.mockReset();
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("backoffMs", () => {
  it("is 0 for no failures, doubles from 1s, and caps at 15 minutes", () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(5)).toBe(16_000);
    expect(backoffMs(10)).toBe(512_000);
    expect(backoffMs(11)).toBe(MAX_BACKOFF_MS); // 1024s > 900s cap
    expect(backoffMs(10_000)).toBe(MAX_BACKOFF_MS);
  });

  it("policy constants are unchanged (5 / 40 / 15 min)", () => {
    expect(MAX_FAILURES_PER_ACCOUNT).toBe(5);
    expect(MAX_FAILURES_PER_IP).toBe(40);
    expect(WINDOW_MS).toBe(15 * 60 * 1000);
    expect(MAX_BACKOFF_MS).toBe(15 * 60 * 1000);
  });
});

describe("evaluateRateLimit", () => {
  it("no rows → allowed", () => {
    expect(evaluateRateLimit(undefined, undefined, NOW)).toBe(false);
  });

  it("backoff blocks until the delay elapses, then allows (count < 5)", () => {
    for (let n = 1; n <= 4; n++) {
      const delay = backoffMs(n);
      expect(evaluateRateLimit(state(n, 0), undefined, NOW)).toBe(true);
      expect(evaluateRateLimit(state(n, delay - 1), undefined, NOW)).toBe(true);
      expect(evaluateRateLimit(state(n, delay), undefined, NOW)).toBe(false);
    }
  });

  it("5th account failure locks for the window regardless of backoff", () => {
    expect(evaluateRateLimit(state(5, 60_000), undefined, NOW)).toBe(true);
    expect(evaluateRateLimit(state(5, WINDOW_MS - 1), undefined, NOW)).toBe(true);
  });

  it("window expiry resets the account counter", () => {
    expect(evaluateRateLimit(state(5, WINDOW_MS), undefined, NOW)).toBe(false);
    expect(evaluateRateLimit(state(5, WINDOW_MS + 1), undefined, NOW)).toBe(false);
  });

  it("per-IP ceiling of 40 within one window", () => {
    expect(evaluateRateLimit(undefined, state(40, 120_000), NOW)).toBe(true);
    // 39 failures but backoff long elapsed (>= cap) → allowed.
    expect(evaluateRateLimit(undefined, state(39, MAX_BACKOFF_MS - 1, MAX_BACKOFF_MS), NOW)).toBe(false);
    expect(evaluateRateLimit(undefined, state(40, WINDOW_MS), NOW)).toBe(false);
  });

  it("either scope blocking is enough", () => {
    expect(evaluateRateLimit(state(5, 1000), state(1, MAX_BACKOFF_MS), NOW)).toBe(true);
    expect(evaluateRateLimit(state(1, MAX_BACKOFF_MS), state(40, 1000), NOW)).toBe(true);
  });
});

describe("key hashing", () => {
  it("is a deterministic 64-char hex HMAC that never contains the input", () => {
    const h = hashLoginKey("user@example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashLoginKey("user@example.com"));
    expect(h).not.toContain("user");
  });

  it("depends on SESSION_SECRET", () => {
    const a = hashLoginKey("user@example.com");
    process.env.SESSION_SECRET = "another-secret-another-secret-another-secret";
    expect(hashLoginKey("user@example.com")).not.toBe(a);
  });

  it("throws without a usable SESSION_SECRET", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => hashLoginKey("x")).toThrow(/SESSION_SECRET/);
  });
});

describe("isLoginRateLimited (mocked DB)", () => {
  it("reads rows and applies the policy", async () => {
    const now = Date.now();
    execute.mockResolvedValueOnce({
      rows: [
        {
          scope: "account",
          failure_count: 5,
          window_started_at: new Date(now - 1000),
          last_failure_at: new Date(now - 1000),
        },
      ],
    });
    await expect(isLoginRateLimited("a@example.com", "10.0.0.1")).resolves.toBe(true);

    execute.mockResolvedValueOnce({ rows: [] });
    await expect(isLoginRateLimited("a@example.com", "10.0.0.1")).resolves.toBe(false);
  });

  it("queries by hash only — raw email / IP never reach the DB layer", async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    await isLoginRateLimited("  Secret.User@Example.COM ", "203.0.113.55");
    const text = lastExecuteText();
    expect(text).not.toMatch(/secret\.user/i);
    expect(text).not.toContain("203.0.113.55");
    expect(text).toContain(hashLoginKey("secret.user@example.com"));
    expect(text).toContain(hashLoginKey("203.0.113.55"));
  });

  it("normalises email case/whitespace and empty IP → unknown", async () => {
    execute.mockResolvedValue({ rows: [] });
    await isLoginRateLimited("  Admin@Example.COM  ", "");
    const text = lastExecuteText();
    expect(text).toContain(hashLoginKey("admin@example.com"));
    expect(text).toContain(hashLoginKey("unknown"));
  });

  it("FAIL-CLOSED: returns true and logs when the DB throws", async () => {
    execute.mockRejectedValueOnce(new Error("connection refused"));
    await expect(
      isLoginRateLimited("victim@example.com", "198.51.100.9"),
    ).resolves.toBe(true);

    expect(logError).toHaveBeenCalledTimes(1);
    const [code, context] = logError.mock.calls[0]!;
    expect(code).toBe(RATE_LIMIT_UNAVAILABLE_CODE);
    expect(code).toBe("LOGIN_RATE_LIMIT_UNAVAILABLE");
    const serialised = JSON.stringify(context);
    expect(serialised).not.toContain("victim@example.com");
    expect(serialised).not.toContain("198.51.100.9");
  });

  it("FAIL-CLOSED: returns true when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;
    await expect(isLoginRateLimited("a@example.com", "1.1.1.1")).resolves.toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "LOGIN_RATE_LIMIT_UNAVAILABLE",
      expect.any(Object),
    );
  });
});

describe("recordLoginFailure (mocked DB)", () => {
  it("issues ONE atomic upsert covering account + ip with hashed keys", async () => {
    execute.mockResolvedValue({ rowCount: 2, rows: [] });
    await recordLoginFailure("Person@Example.com", "203.0.113.7");

    expect(execute).toHaveBeenCalledTimes(1);
    const text = lastExecuteText();
    expect(text).toMatch(/ON CONFLICT \(scope, key_hash\) DO UPDATE/);
    expect(text).toContain(hashLoginKey("person@example.com"));
    expect(text).toContain(hashLoginKey("203.0.113.7"));
    expect(text).not.toMatch(/person@example/i);
    expect(text).not.toContain("203.0.113.7");
  });

  it("does not throw and logs (without PII) when the DB fails", async () => {
    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordLoginFailure("victim@example.com", "198.51.100.9"),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledTimes(1);
    const [code, context] = logError.mock.calls[0]!;
    expect(code).toBe("LOGIN_RATE_LIMIT_UNAVAILABLE");
    const serialised = JSON.stringify(context);
    expect(serialised).not.toContain("victim@example.com");
    expect(serialised).not.toContain("198.51.100.9");
  });

  it("opportunistically cleans up when the dice roll hits", async () => {
    vi.spyOn(Math, "random").mockReturnValue(CLEANUP_PROBABILITY / 2);
    execute.mockResolvedValue({ rowCount: 0, rows: [] });
    await recordLoginFailure("a@example.com", "1.1.1.1");
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(lastExecuteText()).toMatch(/DELETE FROM login_attempts/);
  });

  it("does not clean up on a miss", async () => {
    execute.mockResolvedValue({ rowCount: 0, rows: [] });
    await recordLoginFailure("a@example.com", "1.1.1.1");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("opportunistic cleanup failure is logged, never thrown", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    execute
      .mockResolvedValueOnce({ rowCount: 2, rows: [] })
      .mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(recordLoginFailure("a@example.com", "1.1.1.1")).resolves.toBeUndefined();
    await vi.waitFor(() => expect(logError).toHaveBeenCalledTimes(1));
  });
});

describe("clearLoginFailuresForAccount (mocked DB)", () => {
  it("deletes only the account scope row for the hashed email", async () => {
    execute.mockResolvedValue({ rowCount: 1, rows: [] });
    await clearLoginFailuresForAccount("  Clear@Example.com ");

    expect(execute).toHaveBeenCalledTimes(1);
    const text = lastExecuteText();
    expect(text).toMatch(/DELETE FROM login_attempts/);
    expect(text).toContain("scope = 'account'");
    expect(text).not.toContain("'ip'");
    expect(text).toContain(hashLoginKey("clear@example.com"));
    expect(text).not.toMatch(/clear@example/i);
  });

  it("logs and swallows DB errors", async () => {
    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(
      clearLoginFailuresForAccount("a@example.com"),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      "LOGIN_RATE_LIMIT_UNAVAILABLE",
      expect.any(Object),
    );
  });
});

describe("cleanupExpiredLoginAttempts (mocked DB)", () => {
  it("returns the deleted row count", async () => {
    execute.mockResolvedValueOnce({ rowCount: 7, rows: [] });
    await expect(cleanupExpiredLoginAttempts()).resolves.toBe(7);
    expect(lastExecuteText()).toMatch(/DELETE FROM login_attempts/);
  });

  it("returns 0 when rowCount is null", async () => {
    execute.mockResolvedValueOnce({ rowCount: null, rows: [] });
    await expect(cleanupExpiredLoginAttempts()).resolves.toBe(0);
  });

  it("propagates DB errors to the scheduler", async () => {
    execute.mockRejectedValueOnce(new Error("boom"));
    await expect(cleanupExpiredLoginAttempts()).rejects.toThrow("boom");
  });
});

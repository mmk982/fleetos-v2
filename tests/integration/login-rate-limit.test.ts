/**
 * DB-backed login rate limiter against real Postgres (`fleetos_app` role).
 * Proves atomic counting under concurrency, window reset, policy parity with
 * the former in-memory limiter, hashed storage, and fail-closed behaviour.
 * Uses a Date-only fake clock (the limiter passes app time to SQL), no sleeps.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sql } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import {
  canReachPostgres,
  createRlsTestDatabase,
  dropRlsTestDatabase,
} from "./harness";
import { closeDb, getDb } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import {
  cleanupExpiredLoginAttempts,
  clearLoginFailuresForAccount,
  hashLoginKey,
  isLoginRateLimited,
  recordLoginFailure,
  WINDOW_MS,
} from "@/lib/auth/login-rate-limit";

const SECRET = "integration-session-secret-0123456789abcdef";

function backoff(n: number): number {
  return Math.min(1000 * 2 ** (n - 1), WINDOW_MS);
}

async function allRows() {
  return getDb().select().from(loginAttempts);
}

async function rowFor(scope: "account" | "ip", value: string) {
  const rows = await allRows();
  return rows.find(
    (r) => r.scope === scope && r.keyHash === hashLoginKey(value),
  );
}

describe("login-rate-limit (integration)", () => {
  let reachable = false;
  let validUrl = "";

  beforeAll(async () => {
    reachable = await canReachPostgres();
    if (!reachable) return;
    process.env.SESSION_SECRET = SECRET;
    const created = await createRlsTestDatabase();
    process.env.DATABASE_URL = created.appUrl;
    validUrl = created.appUrl;
  }, 120_000);

  afterAll(async () => {
    await closeDb().catch(() => undefined);
    if (reachable) await dropRlsTestDatabase();
  });

  beforeEach(async () => {
    process.env.SESSION_SECRET = SECRET;
    if (!reachable) return;
    await getDb().execute(sql`DELETE FROM login_attempts`);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("skips when Postgres unreachable", () => {
    if (!reachable) {
      console.info("Postgres unreachable — login-rate-limit integration skipped");
    }
    expect(true).toBe(true);
  });

  it("50 parallel failures for one account yield failure_count exactly 50", async () => {
    if (!reachable) return;
    const email = "race@example.com";
    const ip = "10.9.9.9";
    await Promise.all(
      Array.from({ length: 50 }, () => recordLoginFailure(email, ip)),
    );

    const account = await rowFor("account", email);
    const ipRow = await rowFor("ip", ip);
    expect(account?.failureCount).toBe(50);
    expect(ipRow?.failureCount).toBe(50);
    expect((await allRows()).length).toBe(2);
  });

  it("parallel failures across different accounts, one IP, count the IP exactly", async () => {
    if (!reachable) return;
    const ip = "10.9.9.10";
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        recordLoginFailure(`spray-${i}@example.com`, ip),
      ),
    );
    expect((await rowFor("ip", ip))?.failureCount).toBe(30);
  });

  it("stores only hashes — no raw email or IP in any column", async () => {
    if (!reachable) return;
    await recordLoginFailure("Plain.Person@Example.com", "203.0.113.77");
    const rows = await allRows();
    expect(rows).toHaveLength(2);
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/plain\.person/i);
    expect(dump).not.toContain("203.0.113.77");
    for (const r of rows) {
      expect(r.keyHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("a stale window resets to 1 inside the upsert", async () => {
    if (!reachable) return;
    const email = "stale@example.com";
    const ip = "10.9.9.11";
    for (let i = 0; i < 3; i++) await recordLoginFailure(email, ip);
    expect((await rowFor("account", email))?.failureCount).toBe(3);

    vi.setSystemTime(Date.now() + WINDOW_MS);
    await recordLoginFailure(email, ip);

    const account = await rowFor("account", email);
    expect(account?.failureCount).toBe(1);
    expect(account?.windowStartedAt.getTime()).toBe(Date.now());
  });

  it("4 failures: count does not lock; backoff blocks until delay elapses", async () => {
    if (!reachable) return;
    const email = "user@example.com";
    const ip = "10.0.0.50";

    expect(await isLoginRateLimited(email, ip)).toBe(false);
    for (let n = 1; n <= 4; n++) {
      await recordLoginFailure(email, ip);
      expect(await isLoginRateLimited(email, ip)).toBe(true);
      vi.advanceTimersByTime(backoff(n));
      expect(await isLoginRateLimited(email, ip)).toBe(false);
    }
  });

  it("5th failure locks the account for the window", async () => {
    if (!reachable) return;
    const email = "lock@example.com";
    const ip = "10.0.0.51";
    for (let n = 1; n <= 5; n++) {
      await recordLoginFailure(email, ip);
      if (n < 5) vi.advanceTimersByTime(backoff(n));
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(await isLoginRateLimited(email, ip)).toBe(true);
  });

  it("window expiry unlocks", async () => {
    if (!reachable) return;
    const email = "window@example.com";
    const ip = "10.0.0.52";
    for (let n = 1; n <= 5; n++) {
      await recordLoginFailure(email, ip);
      if (n < 5) vi.advanceTimersByTime(backoff(n));
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);
    vi.advanceTimersByTime(WINDOW_MS);
    expect(await isLoginRateLimited(email, ip)).toBe(false);
  });

  it("per-IP ceiling of 40 within one window", async () => {
    if (!reachable) return;
    const ip = "10.0.0.54";
    for (let i = 0; i < 40; i++) {
      await recordLoginFailure(`ip-ceil-${i}@example.com`, ip);
      vi.advanceTimersByTime(1000);
    }
    expect(await isLoginRateLimited("fresh@example.com", ip)).toBe(true);
  });

  it("account success clears only the account row", async () => {
    if (!reachable) return;
    const email = "clear-me@example.com";
    const ip = "10.0.0.55";
    for (let n = 1; n <= 5; n++) {
      await recordLoginFailure(email, ip);
      if (n < 5) vi.advanceTimersByTime(backoff(n));
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);

    await clearLoginFailuresForAccount(email);
    expect(await rowFor("account", email)).toBeUndefined();
    expect((await rowFor("ip", ip))?.failureCount).toBe(5);

    // Past the IP's own backoff (5 failures → 16s) the cleared account passes.
    vi.advanceTimersByTime(16_000);
    expect(await isLoginRateLimited(email, ip)).toBe(false);

    // Fill the IP to its ceiling: clearing the account must not wipe the IP.
    for (let i = 0; i < 35; i++) {
      await recordLoginFailure(`other-${i}@example.com`, ip);
      vi.advanceTimersByTime(1000);
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);
    await clearLoginFailuresForAccount(email);
    expect(await isLoginRateLimited(email, ip)).toBe(true);
  });

  it("normalises email case and whitespace for the account key", async () => {
    if (!reachable) return;
    const ip = "10.0.0.56";
    for (let n = 1; n <= 5; n++) {
      await recordLoginFailure("  Admin@Example.COM  ", ip);
      if (n < 5) vi.advanceTimersByTime(backoff(n));
    }
    expect(await isLoginRateLimited("admin@example.com", ip)).toBe(true);
    expect(await isLoginRateLimited("ADMIN@EXAMPLE.COM", ip)).toBe(true);
  });

  it('maps "" IP to "unknown"', async () => {
    if (!reachable) return;
    for (let i = 0; i < 40; i++) {
      await recordLoginFailure(`u-${i}@example.com`, "");
      vi.advanceTimersByTime(1000);
    }
    expect(await isLoginRateLimited("another@example.com", "")).toBe(true);
    expect(await isLoginRateLimited("another@example.com", "unknown")).toBe(true);
  });

  it("cleanupExpiredLoginAttempts removes only expired windows", async () => {
    if (!reachable) return;
    await recordLoginFailure("old@example.com", "10.1.1.1");
    vi.advanceTimersByTime(WINDOW_MS + 1000);
    await recordLoginFailure("new@example.com", "10.1.1.2");

    expect(await cleanupExpiredLoginAttempts()).toBe(2); // old account + old ip
    const remaining = await allRows();
    expect(remaining).toHaveLength(2);
    expect(await rowFor("account", "new@example.com")).toBeDefined();
    expect(await rowFor("account", "old@example.com")).toBeUndefined();
  });

  it("FAIL-CLOSED: unreachable DB → limited=true, logged without email/IP", async () => {
    if (!reachable) return;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const dead = new URL(validUrl);
      dead.port = "1"; // nothing listens here → ECONNREFUSED
      process.env.DATABASE_URL = dead.toString();
      await closeDb();

      expect(await isLoginRateLimited("victim@example.com", "198.51.100.9")).toBe(true);
      // Record / clear must not throw into the login path.
      await expect(
        recordLoginFailure("victim@example.com", "198.51.100.9"),
      ).resolves.toBeUndefined();
      await expect(
        clearLoginFailuresForAccount("victim@example.com"),
      ).resolves.toBeUndefined();

      const lines = errSpy.mock.calls.map((c) => String(c[0]));
      expect(
        lines.some((l) => l.includes("LOGIN_RATE_LIMIT_UNAVAILABLE")),
      ).toBe(true);
      for (const l of lines) {
        expect(l).not.toContain("victim@example.com");
        expect(l).not.toContain("198.51.100.9");
      }
    } finally {
      process.env.DATABASE_URL = validUrl;
      await closeDb();
    }
  });
});

/**
 * Session lifecycle against real Postgres (`fleetos_app`).
 * Characterises current behaviour with a Date-only fake clock (no sleeps).
 */
import { createHmac, randomUUID } from "node:crypto";
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
import { eq } from "drizzle-orm";

vi.mock("server-only", () => ({}));

type CookieEntry = { value: string; expires?: Date };

const cookieJar = new Map<string, CookieEntry>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieJar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (
      name: string,
      value: string,
      opts?: { expires?: Date; maxAge?: number },
    ) => {
      if (opts?.maxAge === 0 || value === "") {
        cookieJar.delete(name);
        return;
      }
      cookieJar.set(name, { value, expires: opts?.expires });
    },
  }),
}));

import {
  canReachPostgres,
  createRlsTestDatabase,
  dropRlsTestDatabase,
  type RlsFixtures,
} from "./harness";
import { getDb, closeDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  createSession,
  destroySession,
  rotateSession,
  validateSession,
} from "@/lib/auth/session";

const SECRET_A = "a".repeat(32) + "-session-secret-test-aaaa";
const SECRET_B = "b".repeat(32) + "-session-secret-test-bbbb";

function sign(sessionId: string, secret: string): string {
  const sig = createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

describe("session (integration)", () => {
  let fixtures: RlsFixtures;
  let userId: string;
  let reachable = false;

  beforeAll(async () => {
    reachable = await canReachPostgres();
    if (!reachable) return;
    process.env.SESSION_SECRET = SECRET_A;
    const created = await createRlsTestDatabase();
    process.env.DATABASE_URL = created.appUrl;
    fixtures = created.fixtures;
    userId = fixtures.users.admin;
  }, 120_000);

  afterAll(async () => {
    await closeDb().catch(() => undefined);
    if (reachable) await dropRlsTestDatabase();
  });

  beforeEach(() => {
    cookieJar.clear();
    process.env.SESSION_SECRET = SECRET_A;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips when Postgres unreachable", async () => {
    if (!reachable) {
      console.info("Postgres unreachable — session integration skipped");
    }
    expect(true).toBe(true);
  });

  it("create → validate OK", async () => {
    if (!reachable) return;
    const row = await createSession(userId);
    expect(row.userId).toBe(userId);
    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value).toMatch(
      /^[0-9a-f-]{36}\./,
    );

    const ctx = await validateSession({ touch: true });
    expect(ctx).not.toBeNull();
    expect(ctx!.user.id).toBe(userId);
    expect(ctx!.session.id).toBe(row.id);
  });

  it("rejects tampered / unsigned / wrong-secret cookie and clears when touch", async () => {
    if (!reachable) return;
    const row = await createSession(userId);

    cookieJar.set(SESSION_COOKIE_NAME, {
      value: `${row.id}.tampered-signature-xxxxx`,
    });
    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);

    cookieJar.set(SESSION_COOKIE_NAME, { value: "not-a-signed-cookie" });
    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);

    await createSession(userId);
    process.env.SESSION_SECRET = SECRET_B;
    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);
    process.env.SESSION_SECRET = SECRET_A;
  });

  it("rejects expired idle session", async () => {
    if (!reachable) return;
    const row = await createSession(userId);
    vi.setSystemTime(new Date(Date.now() + SESSION_IDLE_MS + 1000));
    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);
    // Row may still exist (idle expiry is soft via query filter).
    void row;
  });

  it("enforces absolute ceiling even if expiresAt was pushed out", async () => {
    if (!reachable) return;
    const row = await createSession(userId);
    const pastAbsolute = new Date(
      row.createdAt.getTime() + SESSION_ABSOLUTE_MS + 60_000,
    );
    await getDb()
      .update(sessions)
      .set({ expiresAt: pastAbsolute })
      .where(eq(sessions.id, row.id));

    vi.setSystemTime(
      new Date(row.createdAt.getTime() + SESSION_ABSOLUTE_MS + 1),
    );
    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it("rejects inactive user", async () => {
    if (!reachable) return;
    await createSession(userId);
    await getDb()
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId));

    expect(await validateSession({ touch: true })).toBeNull();
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);

    await getDb()
      .update(users)
      .set({ isActive: true })
      .where(eq(users.id, userId));
  });

  it("slides expiresAt but never past the absolute deadline", async () => {
    if (!reachable) return;
    const created = await createSession(userId);
    const t1 = created.expiresAt.getTime();
    const absolute = created.createdAt.getTime() + SESSION_ABSOLUTE_MS;

    // Advance in steps shorter than the idle window so the session stays live.
    vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000));
    const ctx = await validateSession({ touch: true });
    expect(ctx).not.toBeNull();
    expect(ctx!.session.expiresAt.getTime()).toBeGreaterThan(t1);

    // Keep sliding until within 30m of absolute — nextExpiry must clamp.
    let nowMs = Date.now();
    while (nowMs < absolute - 30 * 60 * 1000) {
      nowMs = Math.min(nowMs + 6 * 60 * 60 * 1000, absolute - 30 * 60 * 1000);
      vi.setSystemTime(new Date(nowMs));
      const step = await validateSession({ touch: true });
      expect(step).not.toBeNull();
    }
    const nearEnd = await validateSession({ touch: true });
    expect(nearEnd).not.toBeNull();
    expect(nearEnd!.session.expiresAt.getTime()).toBe(absolute);
  });

  it("touch:false does not set the cookie", async () => {
    if (!reachable) return;
    await createSession(userId);
    cookieJar.clear();

    const ctx = await validateSession({ touch: false });
    // Cookie cleared locally but DB row still valid — without cookie, validate
    // cannot find the session id. Re-create cookie without going through set.
    expect(ctx).toBeNull();

    const row = await createSession(userId);
    const signed = cookieJar.get(SESSION_COOKIE_NAME)!.value;
    cookieJar.clear();
    cookieJar.set(SESSION_COOKIE_NAME, { value: signed });

    const before = cookieJar.get(SESSION_COOKIE_NAME);
    const ok = await validateSession({ touch: false });
    expect(ok).not.toBeNull();
    expect(ok!.session.id).toBe(row.id);
    // Same jar entry object identity / value — set was not called with a refresh.
    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value).toBe(before?.value);
    expect(cookieJar.get(SESSION_COOKIE_NAME)?.expires).toBeUndefined();
  });

  it("rotateSession invalidates the old id and returns a new one", async () => {
    if (!reachable) return;
    const old = await createSession(userId);
    const next = await rotateSession(old.id);
    expect(next.id).not.toBe(old.id);

    const gone = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.id, old.id));
    expect(gone).toHaveLength(0);

    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value.startsWith(next.id)).toBe(
      true,
    );
  });

  it("destroySession deletes the row and clears the cookie", async () => {
    if (!reachable) return;
    const row = await createSession(userId);
    await destroySession(row.id);
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);
    const gone = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.id, row.id));
    expect(gone).toHaveLength(0);
  });

  it("two concurrent validations of the same session do not corrupt it", async () => {
    if (!reachable) return;
    const row = await createSession(userId);
    const [a, b] = await Promise.all([
      validateSession({ touch: true }),
      validateSession({ touch: true }),
    ]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.session.id).toBe(row.id);
    expect(b!.session.id).toBe(row.id);

    const rows = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.id, row.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userId);
    expect(Number.isFinite(rows[0]!.expiresAt.getTime())).toBe(true);
  });

  it("forged UUID alone (no valid HMAC) never authenticates", async () => {
    if (!reachable) return;
    const fakeId = randomUUID();
    cookieJar.set(SESSION_COOKIE_NAME, {
      value: sign(fakeId, "wrong-secret-not-long-enough!!!!"),
    });
    // Wrong length secret still produces a sig string; verify fails vs SESSION_SECRET.
    process.env.SESSION_SECRET = SECRET_A;
    cookieJar.set(SESSION_COOKIE_NAME, {
      value: `${fakeId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
    });
    expect(await validateSession({ touch: true })).toBeNull();
  });
});

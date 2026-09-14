/**
 * Server-side session lifecycle — DB row + httpOnly signed cookie
 * (`SECURITY_PLAN.md` §3 / `MASTER_IMPLEMENTATION_PLAN.md` Phase 3).
 *
 * Shared/foundational (`CODE_CONVENTIONS.md` §5): `proxy.ts`, every Server
 * Action, and Route Handlers will call into this module. Session tokens
 * never go in `localStorage` / `sessionStorage`.
 *
 * Lifetime (crew-PII-aware, not a flat 24h):
 * - **Idle:** 8 hours — each successful {@link validateSession} slides
 *   `expiresAt` forward by 8h in the DB, capped by the absolute deadline.
 *   The httpOnly cookie is only rewritten when `touch: true` (Server Actions /
 *   Route Handlers); Server Components and `proxy.ts` pass `touch: false`
 *   because Next.js forbids `cookies().set` outside those contexts.
 * - **Absolute:** 24 hours from `createdAt` — the session cannot outlive
 *   this even with continuous activity.
 *
 * Cookie value is `sessionId.hmac` (HMAC-SHA256 over the UUID with
 * `SESSION_SECRET`) so a forged UUID alone cannot authenticate.
 */
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  sessions,
  users,
  type SessionRow,
  type UserRow,
} from "@/db/schema";

/** Cookie name for the signed session token — keep stable across deploys. */
export const SESSION_COOKIE_NAME = "fleetos_session";

/** Idle window before an unused session expires (`SECURITY_PLAN.md` §3). */
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;

/** Hard ceiling from session creation, regardless of activity. */
export const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;

/**
 * Validated session payload returned to callers (proxy / Server Actions).
 * Includes the user row so auth checks do not need a second round-trip.
 */
export type SessionContext = {
  session: SessionRow;
  user: UserRow;
};

/** Resolves `SESSION_SECRET`, required to sign/verify session cookies. */
function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters (see .env.example).",
    );
  }
  return secret;
}

/** Absolute deadline for a session created at `createdAt`. */
function absoluteDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_ABSOLUTE_MS);
}

/**
 * Next `expiresAt` for idle sliding, never past the absolute 24h ceiling.
 *
 * @param createdAt - Session creation time (absolute clock starts here).
 * @param from - Instant to measure the idle window from (usually `now`).
 */
function nextExpiry(createdAt: Date, from: Date = new Date()): Date {
  const idle = new Date(from.getTime() + SESSION_IDLE_MS);
  const absolute = absoluteDeadline(createdAt);
  return idle.getTime() < absolute.getTime() ? idle : absolute;
}

/**
 * Produces `sessionId.signature` for the httpOnly cookie.
 *
 * @param sessionId - UUID primary key of the `sessions` row.
 */
function signSessionId(sessionId: string): string {
  const sig = createHmac("sha256", requireSessionSecret())
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

/**
 * Verifies the HMAC on a cookie value and returns the session UUID, or
 * `null` if the format or signature is invalid.
 *
 * @param cookieValue - Raw `fleetos_session` cookie contents.
 */
function verifySignedSessionId(cookieValue: string): string | null {
  const sep = cookieValue.lastIndexOf(".");
  if (sep <= 0 || sep === cookieValue.length - 1) {
    return null;
  }
  const sessionId = cookieValue.slice(0, sep);
  const provided = cookieValue.slice(sep + 1);
  const expected = createHmac("sha256", requireSessionSecret())
    .update(sessionId)
    .digest("base64url");

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  return sessionId;
}

/**
 * Writes the signed session cookie with flags from `SECURITY_PLAN.md` §3.
 *
 * @param sessionId - UUID to embed (signed, not plaintext alone).
 * @param expiresAt - Cookie `expires` / effective lifetime end.
 */
async function setSessionCookie(sessionId: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, signSessionId(sessionId), {
    httpOnly: true,
    // Local HTTP dev must omit Secure; production (Caddy TLS) enables it.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Clears the session cookie (logout / destroy / failed rotate). */
async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Creates a new session for `userId`, persists it, and sets the signed
 * httpOnly cookie. Call on successful login (after password verify).
 *
 * @param userId - Owning user (`users.id`).
 * @returns The new session row (cookie already set as a side effect).
 */
export async function createSession(userId: string): Promise<SessionRow> {
  const createdAt = new Date();
  const expiresAt = nextExpiry(createdAt, createdAt);
  const db = getDb();

  const inserted = await db
    .insert(sessions)
    .values({
      userId,
      expiresAt,
      createdAt,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error("Session insert did not return a row");
  }

  await setSessionCookie(row.id, row.expiresAt);
  return row;
}

/**
 * Reads the signed cookie, verifies the HMAC, loads the session+user, and
 * rejects expired or orphaned rows.
 *
 * On a valid session the idle `expiresAt` is always slid forward in the DB
 * (DB is authoritative). Cookie writes — refresh on success, clear on
 * failure — only run when `touch` is `true`, because Next.js forbids
 * `cookies().set` outside Server Actions and Route Handlers.
 *
 * @param options.touch - When `true` (default for Route Handlers / Actions),
 *   also refreshes or clears the httpOnly cookie. Pass `false` from
 *   `proxy.ts` and from Server Components via {@link requireSession} so
 *   those paths validate (and still slide the DB idle window) without
 *   mutating cookies.
 * @returns Session + user when valid; `null` when missing/invalid/expired.
 */
export async function validateSession(
  options: { touch?: boolean } = {},
): Promise<SessionContext | null> {
  const touch = options.touch !== false;
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  const sessionId = verifySignedSessionId(raw);
  if (!sessionId) {
    if (touch) {
      await clearSessionCookie();
    }
    return null;
  }

  const db = getDb();
  const now = new Date();

  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  const hit = rows[0];
  if (!hit) {
    if (touch) {
      await clearSessionCookie();
    }
    return null;
  }

  // Absolute ceiling — belt-and-suspenders if expiresAt was ever bumped past it.
  if (now.getTime() >= absoluteDeadline(hit.session.createdAt).getTime()) {
    if (touch) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      await clearSessionCookie();
    }
    return null;
  }

  const expiresAt = nextExpiry(hit.session.createdAt, now);
  const updated = await db
    .update(sessions)
    .set({ expiresAt })
    .where(eq(sessions.id, sessionId))
    .returning();

  const session = updated[0] ?? { ...hit.session, expiresAt };

  // Cookie refresh is Action/Route-Handler only — Server Components throw.
  if (touch) {
    await setSessionCookie(session.id, session.expiresAt);
  }

  return { session, user: hit.user };
}

/**
 * Like {@link validateSession}, but redirects to `/login` when absent.
 *
 * Defaults to {@link validateSession} with `touch: false` because this helper
 * is used from Server Components (dashboard pages). Next.js only allows
 * `cookies().set` in Server Actions and Route Handlers — sliding the idle
 * cookie from a page render throws. Callers that *can* mutate cookies
 * (Server Actions) must pass `{ touch: true }` so the idle window slides.
 *
 * @returns Guaranteed session context (never `null`).
 */
export async function requireSession(
  options: { touch?: boolean } = {},
): Promise<SessionContext> {
  const ctx = await validateSession({ touch: options.touch === true });
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}

/**
 * Invalidates `oldSessionId` and issues a fresh session for the same user
 * (new UUID + new signed cookie). Call on login (after verifying credentials
 * against an existing session path, if any) and on any future privilege
 * change so old session IDs cannot silently inherit new permissions.
 *
 * @param oldSessionId - Session UUID being replaced.
 * @returns The replacement session row.
 * @throws If `oldSessionId` does not exist (nothing to rotate).
 */
export async function rotateSession(oldSessionId: string): Promise<SessionRow> {
  const db = getDb();
  const existing = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, oldSessionId))
    .limit(1);

  const old = existing[0];
  if (!old) {
    throw new Error(`Cannot rotate unknown session: ${oldSessionId}`);
  }

  await db.delete(sessions).where(eq(sessions.id, oldSessionId));
  return createSession(old.userId);
}

/**
 * Deletes the session row (when known) and clears the cookie. Safe to call
 * when there is no active session — becomes a no-op cookie clear.
 *
 * @param sessionId - Optional explicit id; when omitted, derived from the
 *   signed cookie if present.
 */
export async function destroySession(sessionId?: string): Promise<void> {
  const db = getDb();
  let id = sessionId;

  if (!id) {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE_NAME)?.value;
    id = raw ? (verifySignedSessionId(raw) ?? undefined) : undefined;
  }

  if (id) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  await clearSessionCookie();
}

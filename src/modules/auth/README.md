# Auth module

Login boundary between the login form and shared auth helpers under
`src/lib/auth/`. This folder only holds Server Actions + Zod validation;
password hashing, sessions, rate limits, and RBAC live in `src/lib/auth/`.

Read order: `validation.ts` → `actions.ts` → `src/lib/auth/password.ts` /
`session.ts` / `login-rate-limit.ts` / `request-guard.ts` / `access.ts` /
`permissions.ts`.

## Login flow

1. `loginAction` (`actions.ts`) calls `assertSameOriginMutation`.
2. Parses email/password with `loginSchema` (`validation.ts`).
3. Checks `isLoginRateLimited` / records failures via `login-rate-limit.ts`.
4. Loads the user, `verifyPassword` (`password.ts`), then `createSession`
   (`session.ts`) and redirects to `/dashboard`.
5. Failures (bad credentials, rate limit, backoff) all return the same
   generic message — no user enumeration.

`logoutAction` destroys the session cookie/row.

## Cookie / session (`src/lib/auth/session.ts`)

- Cookie name: `fleetos_session` — value `sessionId.hmac` (HMAC-SHA256 with
  `SESSION_SECRET`).
- httpOnly, `sameSite: "lax"`, `secure` only when `NODE_ENV === "production"`.
- DB-backed `sessions` rows; idle **8h** (`SESSION_IDLE_MS`), absolute **24h**
  from `createdAt` (`SESSION_ABSOLUTE_MS`).
- `SESSION_SECRET` must be ≥ 32 characters or session APIs throw.

## Same-origin check (`src/lib/auth/request-guard.ts`)

`assertSameOriginMutation` rejects `Sec-Fetch-Site: cross-site` and Origin
host mismatches. Used at the top of mutating Server Actions (including login).

## Route Handlers

`/api/*` mutations (`POST`/`PUT`/`PATCH`/`DELETE`) call `rejectCrossOrigin()`
first: it wraps `assertSameOriginMutation` and returns a `403` JSON response
for a cross-origin request. The cron endpoint is excluded — it authenticates
with `CRON_SECRET` (`cron-auth.ts`). Requests with neither `Sec-Fetch-Site`
nor `Origin` are rejected, so non-browser clients must send an `Origin`.

## Login rate limiting (`src/lib/auth/login-rate-limit.ts`)

Counters are stored in Postgres (`login_attempts`, migration
`0027_login_attempts.sql`), so they survive restarts and are shared across
app instances:

- Per account: 5 failures / 15 minutes
- Per IP: 40 failures / 15 minutes
- Exponential backoff `min(2^(n-1) seconds, 15 min)` after failures
- Keys are `HMAC-SHA256` hashes (derived from `SESSION_SECRET`) of the
  normalised email / IP — raw values are never stored or logged.
- Failures are recorded with one atomic `INSERT … ON CONFLICT DO UPDATE`
  (concurrent attempts cannot undercount; an expired window resets in-place).
- **Fail-closed:** if the DB is unavailable, `isLoginRateLimited` returns
  `true` (login is refused with the generic message) and logs
  `LOGIN_RATE_LIMIT_UNAVAILABLE`. Recording/clearing failures log and never
  throw into the login path.
- Expired rows are purged opportunistically (~1% of recorded failures) and by
  `cleanupExpiredLoginAttempts()` for a scheduled job.
- Uses the plain pooled `getDb()` (auth runs outside RLS); `login_attempts`
  has no RLS policies, only DML grants to `fleetos_app`.

## Client IP (`getRequestIp`)

Controlled by `TRUSTED_PROXY_HOPS` (default `0`):

- `0`: `X-Forwarded-For` ignored; uses `X-Real-IP`, else `"unknown"`.
- `N ≥ 1`: the Nth entry from the **right** of `X-Forwarded-For` (single
  Caddy hop → `1`), falling back to `X-Real-IP`, then `"unknown"`. The leftmost
  value is client-controlled and is never used.

<!-- AUTH_HARDENING: there is no docs/DEPLOY.md on this branch. When a deploy
     guide exists, it must tell operators to set TRUSTED_PROXY_HOPS (Caddy
     single hop → 1); with the default 0 behind a proxy, every client shares
     one IP bucket and X-Real-IP must be set by the proxy. -->


## Password policy (`src/lib/auth/pwned-password.ts`)

`assertPasswordAllowed`: length ≥ 12 and HIBP k-anonymity range check.
Used by bootstrap scripts and settings password changes.

## Access / permissions

- `access.ts`: `assertAuthenticatedAccess`, `assertModuleAccess`,
  `assertVesselScope`, `requireScopedVesselId`, `toAccessContext`
- `permissions.ts`: role → module access matrix (`MODULE_PERMISSIONS`)

## Ops scripts (repo root)

- `npx tsx scripts/create-user.ts "Your Name" you@example.com "a real password"`
- `npx tsx scripts/reset-password.ts you@example.com "a new long password"`

## Known limits

- With `TRUSTED_PROXY_HOPS=0` (default) and no `X-Real-IP`, all clients share
  the `"unknown"` IP bucket (40/15 min) — set `TRUSTED_PROXY_HOPS` to match the
  real proxy chain in production.
- An IP's own backoff grows with its failure count (capped at 15 min), so a
  shared NAT with many failures is throttled sooner than the 40 ceiling.
- A database outage blocks all logins (fail-closed by design).

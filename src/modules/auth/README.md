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

## Login rate limiting (`src/lib/auth/login-rate-limit.ts`)

In-memory `Map`s **per Node process**:

- Per account: 5 failures / 15 minutes
- Per IP: 40 failures / 15 minutes
- Exponential backoff `min(2^(n-1) seconds, 15 min)` after failures

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

- Rate limiter is **in-memory** and not shared across process instances.
- `getRequestIp` trusts the **first** `X-Forwarded-For` value (then
  `X-Real-IP`); a reverse proxy must set it correctly.

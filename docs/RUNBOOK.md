# FleetOS operations runbook

Verified against the repo on branch `cursor/rbac-enforcement`. Do not invent
commands that are not in `scripts/` or `package.json`.

## Break-glass password reset

From `scripts/reset-password.ts` (`SECURITY_PLAN.md` §2.3):

```bash
npx tsx scripts/reset-password.ts you@example.com "a new long password"
```

Requires Postgres reachable at `DATABASE_URL` (or the local default
`postgres://fleetos:fleetos@localhost:5433/fleetos`). Password must pass
`assertPasswordAllowed` (≥ 12 chars + HIBP check).

## Creating the first user

v1 has no self-service signup. From `scripts/create-user.ts`:

```bash
npx tsx scripts/create-user.ts "Your Name" you@example.com "a real password"
```

Then open `/login`.

## Rotating secrets

### `SESSION_SECRET`

Must remain ≥ 32 characters (`src/lib/auth/session.ts`). The cookie is
`sessionId` HMAC’d with this secret; changing it invalidates verification of
existing cookies (sessions can no longer be validated until users log in
again). DB `sessions` rows are unchanged — only the signature check fails.

### `CRON_SECRET`

Must remain ≥ 32 characters (`src/lib/auth/cron-auth.ts`). Update the value
used by the VPS crontab / caller of `POST /api/internal/email-digest` at the
same time. Missing or short secrets cause the route to return **401**.

## Migrations / seeds

```bash
npm run db:migrate
```

Runs `tsx scripts/migrate.ts`: applies `drizzle/` migrations, then
idempotent reference seeds (certificates, crew, ISM categories, drawing
categories).

Re-seed one catalog without migrate:

```bash
npm run db:seed:certificates
npm run db:seed:ism-templates
npm run db:seed:drawings
```

`predev` / `prebuild` already call `db:migrate`.

## Attachments on disk

Uploaded files are stored under `data/attachments/` (see module controllers
and `src/lib/attachments/stream.ts`). `/data/` is git-ignored (`.gitignore`).

This directory must be backed up together with the database.

TODO: backup procedure not defined yet (see MASTER_PLAN Phase 7).

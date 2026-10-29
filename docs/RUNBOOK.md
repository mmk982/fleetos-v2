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

Runs `tsx scripts/migrate.ts`: ensures role `fleetos_app` + grants, applies
`drizzle/` migrations (including RLS phase 1 — `docs/RLS.md`), then
idempotent reference seeds (certificates, crew, ISM categories, drawing
categories).

Use **two** URLs in `.env.local` (see `.env.example`):

- `DATABASE_MIGRATE_URL` — table owner (`fleetos` locally)
- `DATABASE_URL` — runtime `fleetos_app` (RLS enforced)

If `DATABASE_MIGRATE_URL` is unset, migrate falls back to `DATABASE_URL` and
prints a log line. Fresh Docker volumes also run `docker/initdb/01-app-role.sql`.

```bash
npm run db:ensure-app-role   # grants only, if needed
```

Re-seed one catalog without migrate:

```bash
npm run db:seed:certificates
npm run db:seed:ism-templates
npm run db:seed:drawings
```

`predev` / `prebuild` already call `db:migrate`.

Migration `0024_notifications_cycle_key` adds `notifications.cycle_key` and a
unique index; it first deletes duplicate notification rows (keeps the oldest),
so it is safe on a database that already has duplicates.

Migration `0025_rls_phase1` enables RLS on `certificates`, `crew_members`,
`crew_certificates`, `crew_certificate_attachments`, and `access_logs`.

## Company time zone and critical days

Set in Settings → Company profile (IANA id such as `Asia/Dubai`; empty = UTC)
and Settings → critical days. Both are cached for up to 60 s per process and
reset on save, so a change shows immediately for the saving process and within
a minute elsewhere. Symptom of a wrong zone: a certificate flips to
`expired`/`critical` hours early or late around midnight.

## API clients

`POST`/`PUT`/`PATCH`/`DELETE` under `/api` (except `/api/internal/email-digest`)
return `403 Cross-origin mutating request blocked.` unless the request carries
`Sec-Fetch-Site: same-origin|same-site|none` or an `Origin` matching the host.
Scripts calling these endpoints must send `Origin: <APP_BASE_URL>`.

## Attachments on disk

Uploaded files are stored under `data/attachments/` (see module controllers
and `src/lib/attachments/stream.ts`). `/data/` is git-ignored (`.gitignore`).

This directory must be backed up together with the database (see below).

## Backups & restore

**Procedure (production):** `scripts/backup/backup.sh` produces a timestamped
bundle: `pg_dump -Fc` (owner/`DATABASE_MIGRATE_URL`) + tar of the attachments
volume, encrypted with **age** (`AGE_RECIPIENT` = public key only on the
server). SHA-256 checksum beside the bundle. Optional offsite copy via
`rclone` (`RCLONE_REMOTE`, e.g. Backblaze B2) — if unset, the script logs a
**loud warning** and continues (on-box only).

**Retention (configurable defaults):** 7 daily / 4 weekly / 6 monthly
(`BACKUP_RETENTION_DAILY|WEEKLY|MONTHLY`).

**Restore:** `scripts/backup/restore.sh <bundle.tar.age>` into an explicit
`TARGET_DATABASE_URL` + `TARGET_ATTACHMENTS_DIR`. Refuses targets that look
like the live DB unless `--i-know-this-overwrites-production` is passed.
Verifies checksum first; prints row counts + `relrowsecurity` for phase-1
tables.

**Monthly drill:** `scripts/backup/verify-restore.sh` (throwaway Postgres
container). Scheduling units: `deploy/systemd/fleetos-backup.timer` — enable
on the VPS (`docs/DEPLOY.md`); not applied by CI/agents.

**age private key:** held **offline** by `[HUMAN_KEY_HOLDER — CHANGE_ME]`
(password-manager vault / sealed backup). Never store the private key on the
app VPS.

**RPO / RTO:** *targets to be confirmed by the human* (not contractual
promises in this repo). Starting points for discussion: RPO ≈ 24h (daily
timer) unless more frequent backups are scheduled; RTO = time to provision
restore host + run `restore.sh` + smoke tests (measure during the first
drill).

Full VPS ordering: `docs/DEPLOY.md`.

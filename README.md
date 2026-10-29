# FleetOS v2

Maritime fleet-compliance app (Next.js App Router, Drizzle ORM, PostgreSQL).

## Requirements

- **Node.js 22** (CI uses `node-version: 22` in `.github/workflows/ci.yml`)
- **Docker** (local Postgres via `docker-compose.yml`)
- **npm** (CI runs `npm ci`)

Both `package-lock.json` and `pnpm-lock.yaml` exist in the repo. CI uses `npm ci`.

## Local setup

```bash
docker compose up -d
cp .env.example .env.local   # adjust if needed
npm install
npm run db:migrate
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)  
Postgres host port: **5433** (mapped from container `5432`; avoids clashing with a native Windows Postgres on 5432).

`predev` and `prebuild` in `package.json` already run `npm run db:migrate` before `dev` / `build`.

### Optional GlitchTip (error tracker)

```bash
docker compose --profile observability up -d
```

Open [http://localhost:8000](http://localhost:8000), create an org/project, copy the DSN into `.env.local` as `GLITCHTIP_DSN=...`, restart `npm run dev`. Controllers report unexpected failures through `src/lib/logging.ts` (`logError`).

## Environment variables

Variables read under `src/` (plus the documented legacy alias):

| Name | Required? | Purpose | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | No (local default) | Runtime Postgres URL (**`fleetos_app`**, RLS) | Default `postgres://fleetos_app:fleetos_app@localhost:5433/fleetos` (`src/db/urls.ts`). See `docs/RLS.md`. |
| `DATABASE_MIGRATE_URL` | No | Owner URL for migrate/seed | Falls back to `DATABASE_URL` (logged). Local default `postgres://fleetos:fleetos@localhost:5433/fleetos` |
| `SESSION_SECRET` | Yes (at session use) | HMAC key for the `fleetos_session` cookie | Must be ≥ 32 chars after trim (`src/lib/auth/session.ts` throws otherwise) |
| `CRON_SECRET` | Yes (for cron) | Bearer token for `/api/internal/email-digest` | Must be ≥ 32 chars; missing/short secrets fail closed (`src/lib/auth/cron-auth.ts`) |
| `APP_BASE_URL` | No | Absolute origin used in digest email links | Defaults to `http://localhost:3000` when unset (`email-digest.controller.ts`) |
| `RESEND_API_KEY` | No | Resend API key for outbound mail | When unset, `sendEmail` logs and no-ops (`src/lib/email/send.ts`) |
| `RESEND_FROM_EMAIL` | No* | From address for Resend | Used when sending; see `src/lib/email/send.ts` |
| `GLITCHTIP_DSN` | No | GlitchTip / Sentry-compatible DSN | Optional error reporting (`src/lib/logging.ts`) |
| `SENTRY_DSN` | No | Legacy alias for `GLITCHTIP_DSN` | Same reader as above in `src/lib/logging.ts` |

\*Sending still needs a from address when `RESEND_API_KEY` is set — see `src/lib/email/send.ts`.

## First user & operations scripts

| Script | Purpose | Usage | When |
| --- | --- | --- | --- |
| `scripts/create-user.ts` | Create the first (or another) user for `/login` | `npx tsx scripts/create-user.ts "Your Name" you@example.com "a real password"` | Before first login; v1 has no self-service signup |
| `scripts/reset-password.ts` | Break-glass password reset (`SECURITY_PLAN.md` §2.3) | `npx tsx scripts/reset-password.ts you@example.com "a new long password"` | When an account is locked out (no self-service reset) |
| `scripts/migrate.ts` | Apply Drizzle migrations + idempotent reference seeds | `npm run db:migrate` → `tsx scripts/migrate.ts` | After pull / schema change; also via `predev` / `prebuild` |
| `scripts/seed-certificates.ts` | Re-seed certificate reference data without migrate | `npm run db:seed:certificates` → `tsx scripts/seed-certificates.ts` | When you need authorities/types re-seeded alone |
| `scripts/seed-ism-templates.ts` | Re-seed ISM template categories without migrate | `npm run db:seed:ism-templates` → `tsx scripts/seed-ism-templates.ts` | When you need ISM categories re-seeded alone |
| `scripts/seed-drawings.ts` | Re-seed drawing categories without migrate | `npm run db:seed:drawings` → `tsx scripts/seed-drawings.ts` | When you need drawing categories re-seeded alone |

Do not run these as part of normal `npm run dev` beyond what `predev` already does for migrate.

## Daily email digest cron

From `src/app/api/internal/email-digest/route.ts`:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://…/api/internal/email-digest
```

Local example (replace host and secret):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/internal/email-digest
```

## Commands

| Command | From |
| --- | --- |
| `npm run lint` | `package.json` → `eslint` |
| `npx tsc --noEmit` | Typecheck (same as CI) |
| `npm test` | `package.json` → `vitest run` |
| `npm run db:generate` | `drizzle-kit generate` |
| `npm run db:studio` | `drizzle-kit studio` |
| `npm run db:migrate` | `tsx scripts/migrate.ts` |
| `npm run dev` | `next dev` (after `predev` migrate) |

## Production deploy (Phase 7)

Authoritative runbook: **`docs/DEPLOY.md`**. Compose file:
`docker-compose.prod.yml` (app + Postgres + Caddy; optional GlitchTip
profile). Env template: `.env.production.example` → `.env.production` on the
host (git-ignored). Backups: `scripts/backup/` + `docs/RUNBOOK.md`.

Local image build (no secrets baked in):

```bash
docker build -t fleetos:local .
```

VPS hardening, DNS, TLS, LUKS, B2, and age key custody are **`[HUMAN]`** steps
in `docs/DEPLOY.md` — this agent cannot reach the VPS.

## CI / staging deploy

- **CI** (`.github/workflows/ci.yml`): lint, typecheck, tests, `npm audit --omit=dev --audit-level=high`, and Trivy (filesystem + image after `docker build`) on every push/PR.
- **Staging deploy** (`.github/workflows/deploy-staging.yml`): manual `workflow_dispatch`, gated on the GitHub Environment named `staging`. It is still a **scaffold**: when staging secrets are missing it prints warnings and **exits 0**.

Required Action secrets (document only — never commit values):

| Secret | Purpose |
| --- | --- |
| `STAGING_HOST` | Staging VPS hostname (Phase 7 Hetzner) |
| `STAGING_SSH_USER` | SSH user |
| `STAGING_SSH_KEY` | Private key for that user |
| `STAGING_APP_PATH` | Optional remote compose project path |

## Behaviour notes

- **"Today"** for expiry status, due dates and reminders is the company's
  calendar day, from the time zone in Settings → Company profile (empty =
  UTC), and the critical threshold is the `criticalDays` setting. Both live in
  `src/lib/settings/business-time.ts` (60 s cache, reset on save).
- **Dashboard cards** deep-link to filtered lists whose rows match the card
  count (e.g. Valid certs → `certificates?status=valid`, Open defs →
  `deficiencies?status=active`, Due certs → `alerts?...status=critical,expiring`).
- **`/api/*` mutations** reject cross-origin requests (`rejectCrossOrigin`);
  non-browser clients must send an `Origin` header. The cron route uses
  `CRON_SECRET` instead.
- **URL filters** such as `?vesselId=` are sanitised with `uuidSearchParam`
  (`src/lib/validation/search-params.ts`); a malformed id means "no filter".

## Documentation map

| Doc | Role |
| --- | --- |
| `PROJECT_PLAN.md` | In-repo feature/schema build plan (modules, tables, validation). Header: product scope conflicts follow **“required in details.docx”**; `MASTER_PLAN.md` describes this file as the feature/schema plan. |
| `MASTER_PLAN.md` | Project sequencing / SDLC above the feature plan — does not replace `PROJECT_PLAN.md` |
| `MASTER_IMPLEMENTATION_PLAN.md` | Phased implementation checklist |
| `SECURITY_PLAN.md` | Security requirements (auth, sessions, attachments, …) |
| `CERTIFICATES_SPEC.md` | Certificates rules grounded in real vessel data |
| `CODE_CONVENTIONS.md` | Coding conventions for this repo |
| `DESIGN_HANDOFF.md` | UI/design handoff |
| `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` | Design-system implementation plan |
| `PLAN_REVIEW.md` | Review notes on the plans |
| `PROJECT_REVIEW_2026-10-28.md` | 2026-10-28 project review report (Arabic) |
| `diagrams/` | Mermaid diagrams (architecture, ERD, phases, …) |
| `docs/RUNBOOK.md` | Operations runbook (break-glass, secrets, migrations) |

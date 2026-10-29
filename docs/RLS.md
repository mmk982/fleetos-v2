# PostgreSQL Row Level Security (phases 1–2)

Second defense layer under app-layer `assertModuleAccess` /
`assertVesselScope`. Fail-closed: missing session vars → no rows / no writes
for `fleetos_app`.

## Roles

| Role | Purpose | Flags |
| --- | --- | --- |
| Owner (`fleetos` locally) | Migrations, seeds, `DATABASE_MIGRATE_URL` | Superuser locally; table owner; **bypasses RLS** (no `FORCE`) |
| `fleetos_app` | Runtime `DATABASE_URL` | `NOSUPERUSER NOBYPASSRLS`; DML grants only |

Local password for `fleetos_app` is `fleetos_app` (docker init +
`scripts/ensure-app-role.ts`). **Never put production passwords in SQL
migrations.**

### VPS deploy order

1. As Postgres superuser/owner: create `fleetos_app LOGIN PASSWORD '…' NOSUPERUSER NOBYPASSRLS`.
2. Set `DATABASE_MIGRATE_URL` (owner) and `DATABASE_URL` (`fleetos_app`) in the app env.
3. Run `npm run db:migrate` (applies schema + RLS migrations `0025` / `0026`, re-grants DML to `fleetos_app`, seeds).
4. Restart the app so it uses `DATABASE_URL` as `fleetos_app`.

If `DATABASE_MIGRATE_URL` is unset, migrate falls back to `DATABASE_URL` and
logs that fact (existing local setups keep working, but the runtime role
must still be `fleetos_app` for RLS to bind — the table owner bypasses RLS).

## Session vars (`withDb` / `withSystemDb`)

Set transaction-locally via `SELECT set_config(name, value, true)`:

- `app.user_id` — UUID string or empty
- `app.role` — `admin` \| `superintendent` \| `read_only` \| `management_user` \| `vessel_user` \| `system` \| empty
- `app.vessel_id` — UUID string or empty

Nested `withDb` reuses the open transaction (ALS). Queries on that client must
be **sequential** (no `Promise.all` on the shared `pg` client).

## Policies (one line each)

### Phase 1

| Table | Expression |
| --- | --- |
| `certificates` | SELECT `app_sees_vessel(vessel_id)`; writes `app_can_write_certificates()` ∧ same |
| `crew_members` | SELECT `app_sees_vessel(vessel_id)` (NULL vessel → hidden from scoped); writes `app_can_write_crew()` ∧ same |
| `crew_certificates` | via `app_sees_crew_member(crew_member_id)` |
| `crew_certificate_attachments` | via `app_sees_crew_certificate(...)` |
| `access_logs` | Office/system: all; scoped: `user_id = app_user_id()`; INSERT only own user |

### Phase 2

| Table | Expression |
| --- | --- |
| `certificate_events` / `certificate_attachments` | via `app_sees_certificate(certificate_id)`; writes + `app_can_write_certificates()` |
| `deficiencies` | `app_sees_vessel(vessel_id)`; writes `app_can_write_deficiencies()` (admin/super/management) |
| `deficiency_attachments` | via `app_sees_deficiency(id)` + deficiencies write helper |
| `insurance_policies` | vessel; writes `app_can_write_insurance()` (admin/super) |
| `insurance_attachments` | via `app_sees_insurance_policy` + insurance write |
| `manuals` / `manual_revisions` | vessel / `app_sees_manual`; writes `app_can_write_manuals()` (admin/super) |
| `drawings` / `drawing_attachments` | vessel / `app_sees_drawing`; writes `app_can_write_drawings()` (admin/super) |
| `monthly_form_requirements` | vessel; writes `app_can_write_monthly_form_requirements()` (admin/super only) |
| `monthly_executed_forms` (+ attachments) | vessel / parent helper; writes `app_can_write_monthly_executed_forms()` (admin/super/management/vessel_user) |
| `vessel_particulars` (+ attachments) / `vessel_notes` | vessel / parent; writes `app_can_write_particulars()` (admin/super) — notes share particulars write |
| `reminders` | `app_sees_vessel(vessel_id)`; **NULL `vessel_id` = fleet-wide** → office/system only (same NULL rule as crew); writes `app_can_write_reminders()` (admin/super) |
| `audits` / `psc_inspections` | vessel; writes `app_can_write_audits()` / `app_can_write_psc()` (admin/super/management) |
| `notifications` | SELECT/UPDATE: `user_id = app_user_id()` **or** `app_is_system()`; INSERT own or system; no DELETE policy |

`app_sees_vessel`: system + office (`admin`/`superintendent`/`read_only`) → all rows;
scoped (`management_user`/`vessel_user`) → matching `app.vessel_id`; NULL vessel or
missing setting → false for scoped.

### Stays app-layer only

- Finer monthly-form gates (`full` vs `submit` vs listing requirements on the
  list page) beyond coarse RLS write helpers.
- Module “none” vs “read” UI (e.g. `vessels` module for vessel_user) — RLS does
  not cover `vessels` itself.
- IDOR shape that is not vessel/user-row shaped.
- Attachment path validation / MIME checks.

## Callers moved to `withDb` / `withSystemDb`

| File | Wrapper |
| --- | --- |
| `src/modules/certificates/certificate.controller.ts` | `withDb` (incl. events/attachments) |
| `src/modules/crew/crew.controller.ts` | `withDb` |
| `src/modules/crew/crew-certificate.controller.ts` | `withDb` |
| `src/modules/crew/scrub-pii.ts` | `withDb` |
| `src/modules/deficiencies/deficiency.controller.ts` | `withDb` |
| `src/modules/insurance/insurance.controller.ts` | `withDb` |
| `src/modules/manuals/manual.controller.ts` | `withDb` |
| `src/modules/drawings/drawing.controller.ts` | `withDb` |
| `src/modules/monthly-forms/monthlyForm.controller.ts` | `withDb` |
| `src/modules/monthly-forms/monthly-form-requirement.controller.ts` | `withDb` |
| `src/modules/ship-particulars/particulars.controller.ts` | `withDb` |
| `src/modules/ship-particulars/vessel-notes.controller.ts` | `withDb` |
| `src/modules/reminders/reminder.controller.ts` | `withDb` |
| `src/modules/audits/audit.controller.ts` | `withDb` |
| `src/modules/psc/psc.controller.ts` | `withDb` |
| `src/modules/notifications/notifications.controller.ts` | `withDb` on list/mark-read; **`withSystemDb("notification-sync")`** for sync writers |
| `src/modules/alerts/alerts.controller.ts` (`getAlerts`) | `withDb` (certs/crew/insurance/deficiencies) |
| `src/lib/access-log/write.ts` | `withDb` |
| `src/lib/attachments/resolve.ts` | no direct DB — calls wrapped controllers |
| Export routes / dashboard pages / nav-badges | call wrapped controllers only |

`withSystemDb` reasons (narrow):

- `notification-sync` — fan-out insert across users
- `integration-test` — harness only
- `email-digest` — reserved; digest still uses Admin `AccessContext` → `getAlerts` → `withDb`

## Remaining plain-pool callers (safe)

| Area | Why safe |
| --- | --- |
| `src/lib/auth/session.ts`, `src/modules/auth/actions.ts` | `users` / `sessions` — auth before identity; **out of RLS scope** |
| `src/lib/settings/*`, company profile / users controllers | `settings` / `company_profile` / `users` — **out of scope** (phase 3 candidates) |
| `src/lib/activity-log/write.ts`, activity-log controller | `activity_logs` — **out of scope** |
| `src/modules/email-digest/email-digest.controller.ts` | reads `users` / `email_deliveries` (out of scope); alerts via `getAlerts`→`withDb` |
| `src/modules/vessels/vessel.controller.ts` | `vessels` itself — **not RLS’d**; proposal: scoped roles should only SELECT their vessel (phase 3) |
| `src/modules/ism-templates/ismTemplate.controller.ts` | fleet-wide templates — **out of scope** |
| Seeds / `scripts/migrate.ts` | Owner connection (`DATABASE_MIGRATE_URL`) **bypasses RLS** |

## Out of scope (one sentence each)

| Table / area | Why not covered |
| --- | --- |
| `users`, `sessions` | Auth must run before `app.user_id` exists; RLS would lock login. |
| `settings`, `company_profile` | Fleet-office config; not vessel-scoped; phase-3 candidate if multi-tenant. |
| `vessels` | Listing currently app-gated; **proposal**: enable RLS so scoped roles only see their row — do not implement in phase 2. |
| System lists / lookup tables (sources, categories, severities, …) | Reference data shared fleet-wide; no vessel FK. |
| `ism_templates` (+ categories/attachments) | Fleet-wide blanks; no vessel; phase-3 only if templates become tenant-scoped. |
| `email_deliveries` | Cron/digest bookkeeping; no user vessel scope. |
| `activity_logs` | Audit trail; phase-3 candidate (own rows vs office). |

## Tests

```bash
npm test                 # unit (excludes integration)
npm run test:integration # real Postgres; creates/drops fleetos_rls_test
```

- Phase 1: `tests/integration/rls-phase1.test.ts` (14)
- Phase 2: `tests/integration/rls-phase2.test.ts` (12)

## Migrations

- `drizzle/0025_rls_phase1.sql` — helpers + phase-1 tables
- `drizzle/0026_rls_phase2.sql` — phase-2 tables + write helpers aligned to `MODULE_PERMISSIONS`

## Known limits

- Connecting the app as the **table owner** bypasses RLS (by design without `FORCE`). Always use `fleetos_app` for `DATABASE_URL` in staging/prod.
- Pooled connections: session vars are transaction-local; `withDb` always `BEGIN`/`COMMIT`/`ROLLBACK` and `release`s the client.
- `withSystemDb` can SELECT/INSERT notifications and SELECT vessel-scoped rows — keep the reason union tiny.
- App-layer bugs can still 500 on ForbiddenError (e.g. monthly-forms list calling requirements with submit-only role).

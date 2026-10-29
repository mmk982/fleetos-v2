# PostgreSQL Row Level Security (phase 1)

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
3. Run `npm run db:migrate` (applies schema + RLS migration `0025_rls_phase1`, re-grants DML to `fleetos_app`, seeds).
4. Restart the app so it uses `DATABASE_URL` as `fleetos_app`.

If `DATABASE_MIGRATE_URL` is unset, migrate falls back to `DATABASE_URL` and
logs that fact (existing local setups keep working, but the runtime role
must still be `fleetos_app` for RLS to bind — the table owner bypasses RLS).

## Session vars (`withDb` / `withSystemDb`)

Set transaction-locally via `SELECT set_config(name, value, true)`:

- `app.user_id` — UUID string or empty
- `app.role` — `admin` \| `superintendent` \| `read_only` \| `management_user` \| `vessel_user` \| `system` \| empty
- `app.vessel_id` — UUID string or empty

## Policies (one line each)

| Table | Scope | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- | --- |
| `certificates` | `vessel_id` | `app_sees_vessel(vessel_id)` | Write only if `app_can_write_certificates()` (admin/superintendent) **and** `app_sees_vessel` |
| `crew_members` | `vessel_id` (nullable → hidden from scoped) | `app_sees_vessel(vessel_id)` | Write only if `app_can_write_crew()` **and** `app_sees_vessel` |
| `crew_certificates` | via `crew_members.vessel_id` | `app_sees_crew_member(crew_member_id)` | Write + parent visible |
| `crew_certificate_attachments` | via crew cert → member | `app_sees_crew_certificate(...)` | Write + parent visible |
| `access_logs` | **no `vessel_id`** | Office/system: all; scoped: `user_id = app_user_id()` | INSERT only when `user_id = app_user_id()`; no UPDATE/DELETE policies |

`app_sees_vessel`: system + office → all; scoped → `vessel_id = app_vessel_id()`; NULL vessel or missing setting → false.

### Stays app-layer only

- Module matrix finer than admin/superintendent write vs everyone-else read (`MODULE_PERMISSIONS` for `management_user` / `vessel_user` read on certificates/crew).
- `certificate_attachments` / `certificate_events` (not phase 1).
- Non-phase-1 modules (deficiencies, insurance, …).
- IDOR checks that are not vessel-shaped.

## Callers moved to `withDb` / `withSystemDb`

| File | Wrapper |
| --- | --- |
| `src/modules/certificates/certificate.controller.ts` | `withDb` on every `AccessContext` export |
| `src/modules/crew/crew.controller.ts` | `withDb` on every `AccessContext` export |
| `src/modules/crew/crew-certificate.controller.ts` | `withDb` on every `AccessContext` export |
| `src/modules/crew/scrub-pii.ts` | `withDb` |
| `src/modules/alerts/alerts.controller.ts` (`getAlerts`) | `withDb` (covers cert + crew joins) |
| `src/lib/access-log/write.ts` | `withDb` |

`withSystemDb` reasons (narrow SELECT via `app.role = 'system'`):

- `email-digest` — reserved; digest currently uses an Admin `AccessContext` through `getAlerts` → `withDb`
- `integration-test` — harness only

Nested `getDb()` inside `withDb` reuses the transactional client via
`AsyncLocalStorage`.

## Remaining `getDb()` callers (safe for phase 1)

| Area | Why safe |
| --- | --- |
| `src/lib/auth/session.ts`, `src/modules/auth/actions.ts` | `users` / `sessions` — no phase-1 RLS |
| `src/lib/settings/*`, company profile / users controllers | settings / users — no phase-1 RLS |
| `src/lib/activity-log/write.ts` | `activity_logs` — not phase 1 |
| Other module controllers (vessels, deficiencies, …) | Their tables are not RLS’d yet |
| Seeds / `scripts/migrate.ts` | Owner connection (`DATABASE_MIGRATE_URL`) |

## Tests

```bash
npm test                 # unit (excludes integration)
npm run test:integration # real Postgres; creates/drops fleetos_rls_test
```

## Phase 2 candidates

- `certificate_attachments`, `certificate_events`
- `deficiencies` (+ attachments), `insurance_policies`, `manuals`, `drawings`
- `monthly_executed_forms`, `vessel_particulars`, `vessel_notes`, `reminders`
- Vessel-scoped `access_logs` (add `vessel_id` or join policy)
- Optional `FORCE ROW LEVEL SECURITY` if owner connections must never see unscoped data

## Known limits

- Connecting the app as the **table owner** bypasses RLS (by design without `FORCE`). Always use `fleetos_app` for `DATABASE_URL` in staging/prod.
- Pooled connections: session vars are transaction-local; `withDb` always `BEGIN`/`COMMIT`/`ROLLBACK` and `release`s the client.
- `withSystemDb` can SELECT all phase-1 rows — keep the reason union tiny.
- Attachment download for **vessel certificates** still relies on app-layer scope until `certificate_attachments` is phase 2.

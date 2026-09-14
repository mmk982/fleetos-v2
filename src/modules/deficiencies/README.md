# Deficiencies module

Two tables: `deficiencies` (findings linked to a vessel) and
`deficiency_attachments` (owned children, CASCADE).

Read order: `deficiency.model.ts` (enums + `deficiencyStatusTone`) →
`deficiency.controller.ts` (CRUD + status transitions + attachments) →
`validation.ts` → `actions.ts`.

## Status model

Stored 4-state enum (`open` / `in_progress` / `closed` / `monitoring`) —
authoritative for this module, **not** date-derived. Dedicated actions
handle transitions (`close` / `reopen` / `startProgress` / `setMonitoring`).
Non-`closed` rows with a `dueDate` feed the future Alerts aggregator (§0.7)
via the expiry engine; that wiring is Alerts' job, not this module's.

## Attachments

Files live under `data/attachments/` with generated names. Served through
the **generic** `/api/attachments/[id]` route, which resolves across
`certificate_attachments` and `deficiency_attachments` (same UUID space,
DB path only — see that route's header comment).

Full spec: `PROJECT_PLAN.md` §2.

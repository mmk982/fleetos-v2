# Monthly executed forms module

Per-vessel checklist of required ISM forms and their monthly submissions
(`PROJECT_PLAN.md` §10).

## Files

- `monthlyForm.controller.ts` — list/get/create, `generateMonthlyChecklist`,
  `submitMonthlyForm`, attachments
- `monthly-form-requirement.controller.ts` — which forms each vessel must
  file, and how often (`monthly` / `quarterly` / `yearly` / `on_demand`)
- `monthly-form-status.ts` — `deriveMonthlyFormDisplayStatus`
  (`submitted` / `pending` / `overdue`, derived, never stored)
- `monthlyForm.model.ts`, `validation.ts`, `actions.ts`

## Tables

`monthly_form_requirements`, `monthly_executed_forms`,
`monthly_executed_form_attachments` (uses `ism_templates` for form names).

## Behaviour

- `generateMonthlyChecklist` inserts `pending` rows for active requirements
  due in the period; idempotent via a unique (vessel, template, month, year)
  key. The default period is the current month **in the company time zone**
  (`businessToday()`), not the server's.
- Stored status is only `pending` / `submitted`; "overdue" is derived once the
  month has ended.
- The dashboard "Pending forms" card links to
  `/dashboard/monthly-forms?month=M&year=Y&displayStatus=pending`.
- Requirements admin currently lives on the list page.

## Permissions

`getMonthlyFormAccess(role)`: `full` (generate, create, requirements),
`submit` (own vessel only), or none.

# ISM Templates module

Fleet-wide blank form templates (`PROJECT_PLAN.md` §9) — **not**
vessel-specific and **not** an expiry-engine consumer. Monthly Executed
Forms (§10) will be per-vessel executions of these templates.

Three tables: `ism_template_categories` (seeded), `ism_templates`,
`ism_template_attachments`.

Read order: `ismTemplate.model.ts` (status tones) →
`ismTemplate.controller.ts` → `validation.ts` → `actions.ts`.

## Status

Stored lifecycle enum (`active` / `superseded` / `draft`) — StatusPill
**tone** mode via `ismTemplateStatusTone`.

## Categories

Seeded six names from the docx. Read-only `listIsmTemplateCategories`
here; CRUD deferred to Settings (§7a). No `/api/ism-template-categories`
in this pass.

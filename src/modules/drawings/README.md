# Drawings module

Vessel-scoped technical drawings (`PROJECT_PLAN.md` §11).

## Files

- `drawing.controller.ts` — queries/CRUD, categories, attachments
- `drawing.model.ts` — list shapes and labels
- `validation.ts` — Zod schemas (`drawingCreateSchema`, `drawingUpdateSchema`)
- `actions.ts` — Server Actions (create/update/delete, attachments, categories)

## Tables

`drawings`, `drawing_categories` (seeded, read-only list; category CRUD
actions exist behind `settings_general` write), `drawing_attachments`.

## Notes

- Attachments are served through the generic `/api/attachments/[id]`
  resolver; no GDPR `access_logs` (Crew-only scope).
- Seed with `npm run db:seed:drawings` (also run by `db:migrate`).

## Permissions

`assertModuleAccess(ctx, "drawings", "read" | "write")`; categories need
`settings_general` write.

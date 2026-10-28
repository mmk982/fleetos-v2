# Reminders module

User-set nudges, separate from system-derived Alerts (`PROJECT_PLAN.md` §12).
No attachments.

## Files

- `reminder.controller.ts` — list/get/create/update/delete, `dismissReminder`,
  `completeReminder`
- `reminder.model.ts` — types, labels and tones
- `validation.ts` — `reminderCreateSchema`, `reminderUpdateSchema`
- `actions.ts` — Server Actions (incl. form variants for dismiss/complete)

## Tables

`reminders`.

## Behaviour

- Statuses: `pending` → `done` (complete) or `dismissed`.
- A `pending` reminder whose `reminderDate` has arrived (company calendar day)
  becomes an in-app notification through `syncNotifications`
  (see `src/modules/notifications/README.md`).
- Lists are vessel-scoped for `management_user` / `vessel_user`.

## Permissions

`assertModuleAccess(ctx, "reminders", "read" | "write")`.

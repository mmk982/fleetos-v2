# Notifications module

Persisted inbox rows synced from Alerts + due Reminders
(`PROJECT_PLAN.md` §12a).

## Files

- `notifications.controller.ts`, `notifications.model.ts`, `actions.ts`

## Exports

- `syncNotifications`, `listNotifications`, `getUnreadCount`,
  `markNotificationRead`, `markAllNotificationsRead`,
  `notificationTypeFromAlert`
- Actions: `markNotificationReadAction`, `markAllReadAction`
- Model: `toNotificationListItem`; type `NotificationListItem`

## Tables

- `notifications`, `reminders`, `users` (plus alerts derived via `getAlerts`)

## Delivery & dedupe rules

- Recipients: only users with `alerts` access; vessel-scoped roles
  (`management_user` / `vessel_user`) receive items for their own vessel only
  (`canReceiveNotification`). List / unread counts apply the same vessel scope.
- Dedupe key: (user, record, type, `cycle_key`). `cycle_key` is the due/expiry
  date the item was raised for, so a renewed certificate notifies again in its
  next cycle. Unique index `notifications_user_record_type_cycle_uq` plus
  `ON CONFLICT DO NOTHING` makes concurrent sweeps idempotent (migration 0024).
- Legacy rows (`cycle_key = ''`) suppress repeats for 60 days only.
- "Today" for due reminders comes from the company time zone
  (`src/lib/settings/business-time.ts`).

## Permissions

- List / unread: `assertModuleAccess(ctx, "alerts", "read")`
- Mark-read paths require authenticated access (see controller for
  ownership checks)

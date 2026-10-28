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

## Permissions

- List / unread: `assertModuleAccess(ctx, "alerts", "read")`
- Mark-read paths require authenticated access (see controller for
  ownership checks)

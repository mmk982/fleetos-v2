# Activity-log module

Dashboard “Recent activity” **read** path. Writes live in
`@/lib/activity-log/write` (`writeActivityLog`) — this folder only reads.

## Files

- `activity-log.controller.ts`

## Exports

- `getRecentActivity`
- types: `RecentActivityItem`, `GetRecentActivityOptions`

## Tables

- `activity_logs` (join `users` for display name)

## Permissions

- `assertModuleAccess(ctx, "alerts", "read")`
- Also rejects `management_user` / `vessel_user` (ForbiddenError)

# Email-digest module

Daily Admin email digest of actionable alerts (`PROJECT_PLAN.md` §12b).
Triggered by `POST /api/internal/email-digest` (Bearer `CRON_SECRET`).

## Files

- `email-digest.controller.ts`

## Exports

- `runEmailDigest` → `{ sent, skipped }`

## Tables

- `users` (active admins), `email_deliveries` (one send per admin per day)
- Reads alerts via `getAlerts` (no direct certificate queries here)

## Permissions

- No `assertModuleAccess` on `runEmailDigest` (server-to-server cron).
- Builds an admin `AccessContext` to call `getAlerts`.
- Toggle: `getEmailDigestEnabled` / settings key (`src/lib/settings/email-digest.ts`)

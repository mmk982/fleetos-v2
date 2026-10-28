# Settings module

Admin settings: company profile, users & roles, and toggles that call
`src/lib/settings/*`.

## Files

- `actions.ts`, `users-actions.ts`
- `users.controller.ts`, `users.model.ts`
- `company-profile.controller.ts`

## Exports

- Users: `listUsers`, `createUser`, `updateUser`, `changeUserPassword`,
  `setUserActive` (+ matching `*-Action` Server Actions)
- Company: `getCompanyProfile`, `updateCompanyProfile`, `uploadCompanyLogo`,
  `clearCompanyLogo`
- Actions: `setCriticalDaysAction`, `setEmailDigestEnabledAction`

## Tables

- `users`, `vessels`, `company_profile`
- Key/value `settings` via `src/lib/settings/critical-days.ts` and
  `email-digest.ts`

## Company time zone and critical days

- `timezone` must be a valid IANA id (e.g. `Asia/Dubai`); invalid values are
  rejected. It decides what "today" is for every status and due-date check
  (`src/lib/settings/business-time.ts`, pure helpers in `timezone.ts`).
- `criticalDays` is read from the same cache, so certificate, crew-certificate,
  insurance and alert statuses all use one threshold.
- The cache is refreshed every 60 s and per request via `validateSession`;
  saving either setting calls `resetBusinessTimezoneCache()` so the change
  applies immediately. Empty time zone = UTC.

## Permissions

- Users: `settings_users` read/write
- Company / critical days / digest: `settings_general` write
  (asserts in company-profile controller and `src/lib/settings/*`)

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

## Permissions

- Users: `settings_users` read/write
- Company / critical days / digest: `settings_general` write
  (asserts in company-profile controller and `src/lib/settings/*`)

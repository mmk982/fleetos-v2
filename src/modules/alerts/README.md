# Alerts module

Centralized **derived** compliance alerts (`PROJECT_PLAN.md` §5). No
`alerts` table — status comes from the expiry engine at read time.

## Files

- `alerts.controller.ts`
- `alerts.model.ts`
- `alerts.model.test.ts`

## Exports

- `getAlerts`
- `ALERT_KINDS`, `alertKindLabel`, `parseAlertStatusFilter`,
  `DEFICIENCY_ALERT_REMINDER_RULE`
- types: `AlertItem`, `AlertKind`, `GetAlertsOptions`

## Status filter

`parseAlertStatusFilter` accepts one actionable status (`expired`, `critical`,
`expiring`) or a comma-separated set such as `critical,expiring`; unknown
tokens are ignored and nothing valid means "all actionable". The dashboard
"Due certs" card and the "Certificates due soon" preview link to
`/dashboard/alerts?kind=certificate&status=critical,expiring`.

Critical vs expiring uses the configured `criticalDays` setting.

## Tables read

- `certificates`, `certificate_types`, `crew_certificates`, `crew_members`,
  `deficiencies`, `insurance_policies`, `vessels`

## Permissions

- `assertModuleAccess(ctx, "alerts", "read")`
- Vessel-scoped callers filtered via `requireScopedVesselId`

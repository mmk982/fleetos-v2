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

## Tables read

- `certificates`, `certificate_types`, `crew_certificates`, `crew_members`,
  `deficiencies`, `insurance_policies`, `vessels`

## Permissions

- `assertModuleAccess(ctx, "alerts", "read")`
- Vessel-scoped callers filtered via `requireScopedVesselId`

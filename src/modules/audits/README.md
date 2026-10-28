# Audits module

Standalone audit event log (`audits` table). No FK to deficiencies.

## Files

- `audit.controller.ts`, `audit.model.ts`, `validation.ts`, `actions.ts`

## Exports

- Controller: `listAudits`, `getAudit`, `requireAudit`, `createAudit`,
  `updateAudit`, `deleteAudit`
- Actions: `createAuditAction`, `updateAuditAction`, `deleteAuditFormAction`
- Model: `auditTypeLabel`; types `AuditListItem`, `AuditRow`, `AuditType`

## Tables

- `audits` (join `vessels` for list/detail)

## Permissions

- Read: `assertModuleAccess(ctx, "audits", "read")`
- Write: `assertModuleAccess(ctx, "audits", "write")`
- Vessel scope via `assertVesselScope` / `requireScopedVesselId`

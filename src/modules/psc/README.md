# PSC module

Port State Control inspections (`PROJECT_PLAN.md` §7b).

## Files

- `psc.controller.ts`, `psc.model.ts`, `validation.ts`, `actions.ts`

## Exports

- Controller: `listPscInspections`, `getPscInspection`,
  `requirePscInspection`, `createPscInspection`, `updatePscInspection`,
  `deletePscInspection`
- Actions: `createPscInspectionAction`, `updatePscInspectionAction`,
  `deletePscInspectionFormAction`
- Model: `pscInspectionResultLabel`, `pscInspectionResultTone`;
  type `PscInspectionListItem`

## Tables

- `psc_inspections` (join `vessels`)

## Permissions

- Read: `assertModuleAccess(ctx, "psc", "read")`
- Write: `assertModuleAccess(ctx, "psc", "write")`
- Vessel scope via `assertVesselScope` / `requireScopedVesselId`

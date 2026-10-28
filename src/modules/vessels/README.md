# Vessels module

Fleet vessel registry (CRUD + selectable list for forms).

## Files

- `vessel.controller.ts`, `vessel.model.ts`, `validation.ts`, `actions.ts`

## Exports

- Controller: `listVessels`, `listSelectableVessels`, `getVesselCount`,
  `getVesselById`, `requireVesselById`, `createVessel`, `updateVessel`,
  `deleteVessel`
- Actions: `createVesselAction`, `updateVesselAction`,
  `deleteVesselFormAction`
- Model: `isVesselStatus`, `vesselStatusTone`, `formatImo`

## Tables

- `vessels`

## Permissions

- Read: `assertModuleAccess(ctx, "vessels", "read")`
- Write: `assertModuleAccess(ctx, "vessels", "write")`
- Note: in `MODULE_PERMISSIONS`, only `admin` has `vessels` write; other
  roles are `"none"` for this module key (vessel-scoped roles use
  `assertVesselScope` elsewhere)

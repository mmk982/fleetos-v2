# Ship particulars module

Per-vessel particulars with history (`PROJECT_PLAN.md` §13), plus the vessel
Notes backend.

## Files

- `particulars.controller.ts` — fleet summary (`listVesselParticularsSummary`),
  current + history (`getParticularsForVessel`), CRUD, attachments
- `vessel-notes.controller.ts` — `listVesselNotes`, `createVesselNote`,
  `deleteVesselNote`
- `particulars.model.ts`, `validation.ts`, `actions.ts`

## Tables

`vessel_particulars` (one `isCurrent` row per vessel, older rows kept as
history), `vessel_particulars_attachments`, `vessel_notes`.

## Notes

- The Notes tab on the vessel detail page uses the notes controller.
- Attachments use the generic `/api/attachments/[id]` resolver.

## Permissions

`assertModuleAccess(ctx, "particulars", "read" | "write")`.

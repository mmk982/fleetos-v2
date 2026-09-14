# Manuals module

Vessel-linked manuals with revision history (`PROJECT_PLAN.md` §8).
Each upload is a `manual_revisions` row (event + file). Exactly one
`isCurrentVersion` per manual, enforced in controller transactions.

Read order: `manual.model.ts` → `manual.controller.ts` → `validation.ts`
→ `actions.ts`.

## Deviations from literal §8

`manual_revisions` includes `fileName` and `uploadedBy` so revisions can
be served through the generic `/api/attachments/[id]` resolver — matching
every other file-storage table.

## Not an expiry consumer

No `cachedStatus`, no `deriveComplianceStatus`.
